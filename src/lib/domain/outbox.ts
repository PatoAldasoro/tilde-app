/**
 * Cola de cambios pendientes ("outbox"): lo que hace que la app se pueda usar sin conexión.
 *
 * Cada escritura se aplica primero en la caché local y queda anotada acá como una lista de
 * operaciones simples. La cola se guarda en el dispositivo y se sube en orden cuando hay conexión.
 * Las operaciones se pueden repetir sin efectos de más (los ids nacen en el cliente y un alta
 * repetida se ignora), así que reintentar una entrada a medio subir es seguro.
 *
 * Si dos dispositivos cambian lo mismo sin conexión, gana el último que sincroniza: cada
 * operación pisa solo los campos que tocó.
 */

export type WriteOp =
  | { kind: "insert"; table: string; rows: Record<string, unknown>[] }
  | { kind: "update"; table: string; id: string; patch: Record<string, unknown> }
  | { kind: "delete"; table: string; ids: string[] }
  /** RPC `set_task_order`: fija el orden de varias tareas de una vez. */
  | { kind: "task_order"; ids: string[]; orders: number[] }
  /** El perfil no tiene `id`: es la fila del usuario. */
  | { kind: "profile"; patch: Record<string, unknown> };

export type OutboxEntry = {
  id: string;
  /** Milisegundos (epoch) en que se hizo el cambio. */
  createdAt: number;
  ops: WriteOp[];
  /** Tablas que hay que volver a leer cuando la entrada termina (las que cambia y sus cascadas). */
  tables: string[];
};

/** Saca las operaciones que no hacen nada (un alta sin filas, un borrado sin ids). */
export function compactOps(ops: readonly (WriteOp | null | false | undefined)[]): WriteOp[] {
  return ops.filter((op): op is WriteOp => {
    if (!op) return false;
    if (op.kind === "insert") return op.rows.length > 0;
    if (op.kind === "delete") return op.ids.length > 0;
    if (op.kind === "task_order") return op.ids.length > 0;
    return true;
  });
}

/** La tabla que toca cada operación. */
export const opTable = (op: WriteOp): string => (op.kind === "task_order" ? "tasks" : op.kind === "profile" ? "profiles" : op.table);

/** Las tablas a releer por una entrada: las de sus operaciones más las que se pidan aparte (cascadas). */
export function entryTables(ops: readonly WriteOp[], extra: readonly string[] = []): string[] {
  return [...new Set([...ops.map(opTable), ...extra])];
}

// ---------- qué hacer cuando una operación falla ----------

/** Lo que devuelve el servidor (o la falta de él) al fallar una operación. */
export type OpFailure = { status: number; code: string; message: string };

/**
 * - "network": no se llegó al servidor o está saturado. La entrada queda en la cola y se reintenta.
 * - "auth": la sesión venció. Se renueva y se reintenta.
 * - "rejected": el servidor entendió el cambio y lo rechazó (una regla de la base, un dato que ya
 *   no existe). No tiene sentido insistir: la entrada se descarta y se relee lo que quedó.
 */
export type FailureKind = "network" | "auth" | "rejected";

const AUTH_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"]);
const RETRY_STATUS = new Set([408, 425, 429]);

export function classifyFailure(failure: OpFailure, online: boolean): FailureKind {
  if (!online) return "network";
  if (failure.status === 401 || AUTH_CODES.has(failure.code) || /jwt (is )?expired/i.test(failure.message)) return "auth";
  // Sin respuesta: fetch falló antes de llegar (supabase-js lo informa con estado 0 y sin código).
  if (failure.status === 0 || (failure.code === "" && /failed to fetch|networkerror|network request failed|load failed|timed? ?out|aborted/i.test(failure.message))) {
    return "network";
  }
  if (failure.status >= 500 || RETRY_STATUS.has(failure.status)) return "network";
  return "rejected";
}

const RETRY_STEPS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

/** Espera antes del reintento número `attempt` (1 = el primero): crece hasta un minuto y ahí se queda. */
export function retryDelayMs(attempt: number): number {
  return RETRY_STEPS_MS[Math.max(0, Math.min(attempt, RETRY_STEPS_MS.length) - 1)];
}

// ---------- lo guardado en el dispositivo ----------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

function isWriteOp(value: unknown): value is WriteOp {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case "insert":
      return typeof value.table === "string" && Array.isArray(value.rows) && value.rows.every(isRecord);
    case "update":
      return typeof value.table === "string" && typeof value.id === "string" && isRecord(value.patch);
    case "delete":
      return typeof value.table === "string" && isStrings(value.ids);
    case "task_order":
      return isStrings(value.ids) && Array.isArray(value.orders) && value.orders.length === value.ids.length && value.orders.every((n) => typeof n === "number");
    case "profile":
      return isRecord(value.patch);
    default:
      return false;
  }
}

/**
 * Lee la cola guardada. Lo que no tenga la forma esperada (almacenamiento roto, una versión vieja)
 * se descarta entrada por entrada: mejor perder un cambio ilegible que trabar todos los demás.
 */
export function parseOutbox(raw: string | null): OutboxEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (entry): entry is OutboxEntry =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.createdAt === "number" &&
      Array.isArray(entry.ops) &&
      entry.ops.length > 0 &&
      entry.ops.every(isWriteOp) &&
      isStrings(entry.tables),
  );
}
