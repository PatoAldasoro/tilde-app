import { describe, expect, it } from "vitest";
import { classifyFailure, compactOps, entryTables, opTable, parseOutbox, retryDelayMs, type OutboxEntry, type WriteOp } from "./outbox";

const insert: WriteOp = { kind: "insert", table: "tasks", rows: [{ id: "t1", title: "Leer" }] };
const update: WriteOp = { kind: "update", table: "subtasks", id: "s1", patch: { completed_at: null } };
const remove: WriteOp = { kind: "delete", table: "tasks", ids: ["t1"] };
const order: WriteOp = { kind: "task_order", ids: ["t1", "t2"], orders: [1, 2] };
const profile: WriteOp = { kind: "profile", patch: { theme: "dark" } };

describe("operaciones de la cola", () => {
  it("compactOps saca lo que no hace nada y lo que no es una operación", () => {
    const ops = compactOps([
      insert,
      null,
      false,
      undefined,
      { kind: "insert", table: "subtasks", rows: [] },
      { kind: "delete", table: "tasks", ids: [] },
      { kind: "task_order", ids: [], orders: [] },
      update,
      profile,
    ]);
    expect(ops).toEqual([insert, update, profile]);
  });

  it("cada operación sabe qué tabla toca", () => {
    expect([insert, update, remove, order, profile].map(opTable)).toEqual(["tasks", "subtasks", "tasks", "tasks", "profiles"]);
  });

  it("entryTables: las tablas de las operaciones más las cascadas pedidas, sin repetir", () => {
    expect(entryTables([insert, update, remove, order], ["subtasks", "study_session_tasks"])).toEqual(["tasks", "subtasks", "study_session_tasks"]);
  });
});

describe("qué hacer cuando una operación falla", () => {
  const failure = (status: number, code = "", message = "") => ({ status, code, message });

  it("sin conexión todo es un problema de red, diga lo que diga el error", () => {
    expect(classifyFailure(failure(400, "23505", "duplicate key"), false)).toBe("network");
  });

  it("no se llegó al servidor: se reintenta", () => {
    expect(classifyFailure(failure(0, "", "TypeError: Failed to fetch"), true)).toBe("network");
    expect(classifyFailure(failure(0), true)).toBe("network");
    expect(classifyFailure(failure(200, "", "NetworkError when attempting to fetch resource."), true)).toBe("network");
    expect(classifyFailure(failure(200, "", "Load failed"), true)).toBe("network");
  });

  it("el servidor está caído o saturado: se reintenta", () => {
    for (const status of [500, 502, 503, 504, 408, 425, 429]) expect(classifyFailure(failure(status), true), String(status)).toBe("network");
  });

  it("la sesión venció: se renueva y se reintenta", () => {
    expect(classifyFailure(failure(401, "PGRST301", "JWT expired"), true)).toBe("auth");
    expect(classifyFailure(failure(401), true)).toBe("auth");
    expect(classifyFailure(failure(403, "", "JWT is expired"), true)).toBe("auth");
  });

  it("el servidor lo rechazó: no se insiste", () => {
    expect(classifyFailure(failure(409, "23505", "duplicate key value violates unique constraint"), true)).toBe("rejected");
    expect(classifyFailure(failure(409, "23503", "violates foreign key constraint"), true)).toBe("rejected");
    expect(classifyFailure(failure(403, "42501", "new row violates row-level security policy"), true)).toBe("rejected");
    expect(classifyFailure(failure(400, "23514", "violates check constraint"), true)).toBe("rejected");
    expect(classifyFailure(failure(404, "PGRST205", "Could not find the table"), true)).toBe("rejected");
  });

  it("los reintentos se espacian hasta un minuto", () => {
    expect([1, 2, 3, 4, 5, 6, 40].map(retryDelayMs)).toEqual([2_000, 5_000, 15_000, 30_000, 60_000, 60_000, 60_000]);
    expect(retryDelayMs(0)).toBe(2_000);
  });
});

describe("la cola guardada en el dispositivo", () => {
  const entry: OutboxEntry = { id: "e1", createdAt: 1_760_000_000_000, ops: [insert, update, remove, order, profile], tables: ["tasks", "subtasks", "profiles"] };

  it("ida y vuelta por JSON", () => {
    expect(parseOutbox(JSON.stringify([entry]))).toEqual([entry]);
  });

  it("vacío, roto o con otra forma: una cola vacía", () => {
    for (const raw of [null, "", "{", "null", "42", '{"id":"e1"}', '"hola"']) expect(parseOutbox(raw), String(raw)).toEqual([]);
  });

  it("descarta solo las entradas ilegibles y conserva las demás", () => {
    const broken = [
      { ...entry, id: 7 },
      { ...entry, ops: [] },
      { ...entry, ops: [{ kind: "drop_table", table: "tasks" }] },
      { ...entry, ops: [{ kind: "insert", table: "tasks", rows: "todas" }] },
      { ...entry, ops: [{ kind: "task_order", ids: ["a", "b"], orders: [1] }] },
      { ...entry, ops: [{ kind: "update", table: "tasks", id: "t1" }] },
      { ...entry, tables: "tasks" },
      { ...entry, createdAt: "ayer" },
      "texto",
      null,
    ];
    const good = { ...entry, id: "e2" };
    expect(parseOutbox(JSON.stringify([...broken, good, entry]))).toEqual([good, entry]);
  });
});
