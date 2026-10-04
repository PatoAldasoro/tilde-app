import { describe, expect, it } from "vitest";
import {
  blocksOfActiveSubjects,
  eventOccursOn,
  gridPosition,
  layoutOverlaps,
  occurrencesForWeek,
  type Occurrence,
  type ScheduleBlock,
  type ScheduleEvent,
  type ScheduleException,
} from "./schedule";

const WEEK = "2026-10-12"; // lunes 12/10/2026, feriado (Diversidad Cultural)

const block = (id: string, weekday: number, start: string, end: string, subject_id = "s1"): ScheduleBlock => ({
  id,
  subject_id,
  weekday,
  start_time: start,
  end_time: end,
  room: null,
});

const activity = (overrides: Partial<ScheduleEvent> & { id: string }): ScheduleEvent => ({
  title: "Vóley",
  color_key: "lima",
  start_time: "19:00",
  end_time: "20:30",
  recurrence: "none",
  weekdays: [],
  date: null,
  start_date: null,
  until_date: null,
  ...overrides,
});

const on = (list: Occurrence[], date: string) => list.filter((item) => item.date === date);
const dates = (list: Occurrence[]) => list.map((item) => item.date);

describe("occurrencesForWeek · clases", () => {
  it("cada bloque ocurre una vez por semana, en su día", () => {
    const result = occurrencesForWeek(WEEK, [block("a", 2, "08:00", "10:00"), block("b", 4, "14:00", "16:00:00")], [], [], []);
    expect(result.map((o) => [o.key, o.start, o.end])).toEqual([
      ["class:a:2026-10-13", 480, 600],
      ["class:b:2026-10-15", 840, 960],
    ]);
    expect(occurrencesForWeek("2026-10-19", [block("a", 2, "08:00", "10:00")], [], [], [])[0].date).toBe("2026-10-20");
  });

  it("una materia puede tener varios bloques, incluso sábado y domingo", () => {
    const result = occurrencesForWeek(WEEK, [block("a", 1, "08:00", "10:00"), block("b", 6, "09:00", "12:00"), block("c", 7, "10:00", "11:00")], [], [], []);
    expect(dates(result)).toEqual(["2026-10-12", "2026-10-17", "2026-10-18"]);
  });

  it("las clases de materias archivadas no se dictan", () => {
    const blocks = [block("a", 1, "08:00", "10:00", "activa"), block("b", 1, "10:00", "12:00", "archivada")];
    const subjects = [
      { id: "activa", archived_at: null },
      { id: "archivada", archived_at: "2026-07-20T00:00:00Z" },
    ];
    expect(blocksOfActiveSubjects(blocks, subjects).map((b) => b.id)).toEqual(["a"]);
  });
});

describe("occurrencesForWeek · actividades y recurrencia", () => {
  it("sin repetición: solo en su fecha", () => {
    const once = activity({ id: "e", recurrence: "none", date: "2026-10-14" });
    expect(dates(occurrencesForWeek(WEEK, [], [once], [], []))).toEqual(["2026-10-14"]);
    expect(occurrencesForWeek("2026-10-19", [], [once], [], [])).toEqual([]);
  });

  it("todos los días: los siete días de la semana", () => {
    const daily = activity({ id: "e", recurrence: "daily" });
    expect(occurrencesForWeek(WEEK, [], [daily], [], [])).toHaveLength(7);
  });

  it("días específicos: solo esos días de la semana", () => {
    const weekly = activity({ id: "e", recurrence: "weekdays", weekdays: [1, 3, 6] });
    expect(dates(occurrencesForWeek(WEEK, [], [weekly], [], []))).toEqual(["2026-10-12", "2026-10-14", "2026-10-17"]);
  });

  it("respeta la fecha de fin (inclusive) y la de inicio", () => {
    const until = activity({ id: "e", recurrence: "daily", until_date: "2026-10-14" });
    expect(dates(occurrencesForWeek(WEEK, [], [until], [], []))).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(occurrencesForWeek("2026-10-19", [], [until], [], [])).toEqual([]);

    const from = activity({ id: "f", recurrence: "weekdays", weekdays: [2, 4], start_date: "2026-10-15" });
    expect(dates(occurrencesForWeek(WEEK, [], [from], [], []))).toEqual(["2026-10-15"]);
    expect(eventOccursOn(from, "2026-10-13")).toBe(false);
    expect(eventOccursOn(from, "2026-10-20")).toBe(true);
  });

  it("sin fecha de fin se repite indefinidamente", () => {
    const weekly = activity({ id: "e", recurrence: "weekdays", weekdays: [5] });
    expect(dates(occurrencesForWeek("2027-03-01", [], [weekly], [], []))).toEqual(["2027-03-05"]);
  });
});

describe("occurrencesForWeek · excepciones y feriados", () => {
  const blocks = [block("lun", 1, "08:00", "10:00"), block("mar", 2, "08:00", "10:00")];
  const voley = activity({ id: "v", recurrence: "weekdays", weekdays: [1, 2] });
  const holidays = ["2026-10-12"];
  const exception = (target_type: string, target_id: string, date: string, kind: string): ScheduleException => ({ target_type, target_id, date, kind });
  const status = (list: Occurrence[], key: string) => list.find((o) => o.key === key)?.status;

  it("skip omite solo esa ocurrencia", () => {
    const result = occurrencesForWeek(WEEK, blocks, [voley], [exception("block", "mar", "2026-10-13", "skip")], []);
    expect(status(result, "class:mar:2026-10-13")).toBe("skipped");
    expect(status(result, "class:lun:2026-10-12")).toBe("normal");
    // La semana siguiente la clase vuelve a la normalidad.
    const next = occurrencesForWeek("2026-10-19", blocks, [], [exception("block", "mar", "2026-10-13", "skip")], []);
    expect(next.every((o) => o.status === "normal")).toBe(true);
  });

  it("un feriado deja las clases de ese día 'sin clase'", () => {
    const result = occurrencesForWeek(WEEK, blocks, [], [], holidays);
    expect(status(result, "class:lun:2026-10-12")).toBe("holiday");
    expect(status(result, "class:mar:2026-10-13")).toBe("normal");
  });

  it("keep indica que hubo clase igual aunque sea feriado", () => {
    const result = occurrencesForWeek(WEEK, blocks, [], [exception("block", "lun", "2026-10-12", "keep")], holidays);
    expect(status(result, "class:lun:2026-10-12")).toBe("normal");
  });

  it("los feriados no afectan a las actividades, que sí se pueden omitir a mano", () => {
    const result = occurrencesForWeek(WEEK, [], [voley], [exception("event", "v", "2026-10-13", "skip")], holidays);
    expect(status(result, "event:v:2026-10-12")).toBe("normal");
    expect(status(result, "event:v:2026-10-13")).toBe("skipped");
  });

  it("una excepción de otro bloque o de otro tipo no se aplica", () => {
    const result = occurrencesForWeek(WEEK, blocks, [voley], [exception("event", "mar", "2026-10-13", "skip"), exception("block", "v", "2026-10-13", "skip")], []);
    expect(result.every((o) => o.status === "normal")).toBe(true);
  });

  it("una omitida en feriado se muestra como omitida", () => {
    const result = occurrencesForWeek(WEEK, blocks, [], [exception("block", "lun", "2026-10-12", "skip")], holidays);
    expect(status(result, "class:lun:2026-10-12")).toBe("skipped");
  });
});

describe("bloques superpuestos", () => {
  const item = (start: number, end: number) => ({ start, end, col: 0, cols: 1 });

  it("sin superposición cada bloque usa todo el ancho", () => {
    const result = layoutOverlaps([item(480, 600), item(600, 720)]);
    expect(result.map((r) => [r.col, r.cols])).toEqual([[0, 1], [0, 1]]);
  });

  it("dos bloques que se pisan se reparten el ancho", () => {
    const result = layoutOverlaps([item(480, 600), item(540, 660)]);
    expect(result.map((r) => [r.col, r.cols])).toEqual([[0, 2], [1, 2]]);
  });

  it("usa el mínimo de columnas dentro de un clúster", () => {
    // A 8–10, B 9–11, C 10–12: A y C no se pisan y comparten columna.
    const result = layoutOverlaps([item(480, 600), item(540, 660), item(600, 720)]);
    expect(result.map((r) => [r.col, r.cols])).toEqual([[0, 2], [1, 2], [0, 2]]);
  });

  it("clústeres separados se calculan por separado", () => {
    const result = layoutOverlaps([item(480, 600), item(480, 600), item(480, 600), item(900, 960)]);
    expect(result.map((r) => r.cols)).toEqual([3, 3, 3, 1]);
  });

  it("occurrencesForWeek aplica el reparto por día", () => {
    const result = occurrencesForWeek(
      WEEK,
      [block("a", 2, "08:00", "10:00"), block("b", 2, "09:00", "11:00"), block("c", 3, "08:00", "10:00")],
      [activity({ id: "e", recurrence: "none", date: "2026-10-13", start_time: "09:30", end_time: "10:30" })],
      [],
      [],
    );
    expect(on(result, "2026-10-13").map((o) => [o.key.split(":")[1], o.col, o.cols])).toEqual([["a", 0, 3], ["b", 1, 3], ["e", 2, 3]]);
    expect(on(result, "2026-10-14").map((o) => [o.col, o.cols])).toEqual([[0, 1]]);
  });
});

describe("gridPosition", () => {
  it("mide en slots de 30 minutos desde las 07:00", () => {
    expect(gridPosition(7 * 60, 8 * 60)).toEqual({ top: 0, height: 2 });
    expect(gridPosition(18 * 60 + 30, 21 * 60)).toEqual({ top: 23, height: 5 });
  });

  it("recorta a la grilla (07:00–23:00)", () => {
    expect(gridPosition(6 * 60, 8 * 60)).toEqual({ top: 0, height: 2 });
    expect(gridPosition(22 * 60, 24 * 60)).toEqual({ top: 30, height: 2 });
  });
});
