import { describe, expect, it } from "vitest";
import { typicalWeek, type ScheduleBlock, type ScheduleEvent } from "./schedule";
import { WALLPAPER_SIZE, wallpaperLayout, wallpaperRange } from "./wallpaper";

const block = (id: string, weekday: number, start_time: string, end_time: string): ScheduleBlock => ({ id, subject_id: "s1", weekday, start_time, end_time, room: null });
const activity = (id: string, patch: Partial<ScheduleEvent>): ScheduleEvent => ({
  id,
  title: id,
  color_key: "lima",
  start_time: "19:00",
  end_time: "20:30",
  recurrence: "weekdays",
  weekdays: [1, 3],
  date: null,
  start_date: null,
  until_date: null,
  ...patch,
});

describe("typicalWeek", () => {
  const today = "2026-10-05";

  it("incluye clases y actividades recurrentes, por día de la semana", () => {
    const week = typicalWeek(
      [block("b1", 1, "08:00", "10:00"), block("b2", 4, "18:00", "20:00")],
      [activity("voley", {}), activity("almuerzo", { recurrence: "daily", weekdays: [], start_time: "13:00", end_time: "14:00" })],
      today,
    );
    expect(week.filter((item) => item.weekday === 1).map((item) => item.key)).toEqual(["class:b1:1", "event:almuerzo:1", "event:voley:1"]);
    expect(week.filter((item) => item.weekday === 2).map((item) => item.key)).toEqual(["event:almuerzo:2"]);
    expect(week.filter((item) => item.kind === "event" && item.event.id === "almuerzo")).toHaveLength(7);
  });

  it("deja afuera las actividades de una sola fecha y las que ya terminaron", () => {
    const week = typicalWeek(
      [],
      [
        activity("consulta", { recurrence: "none", weekdays: [], date: "2026-10-07" }),
        activity("vencida", { until_date: "2026-10-04" }),
        activity("vigente", { until_date: "2026-10-05" }),
      ],
      today,
    );
    expect([...new Set(week.map((item) => (item.kind === "event" ? item.event.id : "")))]).toEqual(["vigente"]);
  });

  it("reparte el ancho entre los que se pisan", () => {
    const week = typicalWeek([block("a", 2, "08:00", "10:00"), block("b", 2, "09:00", "11:00")], [], today);
    expect(week.map((item) => [item.col, item.cols])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });
});

describe("wallpaperRange", () => {
  it("redondea a horas enteras", () => {
    expect(wallpaperRange([{ start: 8 * 60 + 30, end: 11 * 60 }, { start: 14 * 60, end: 17 * 60 + 15 }])).toEqual({ start: 8 * 60, end: 18 * 60 });
  });
  it("vacío: de 08:00 a 18:00", () => {
    expect(wallpaperRange([])).toEqual({ start: 8 * 60, end: 18 * 60 });
  });
  it("garantiza un rango mínimo sin pasarse de la medianoche", () => {
    expect(wallpaperRange([{ start: 9 * 60, end: 11 * 60 }])).toEqual({ start: 9 * 60, end: 15 * 60 });
    expect(wallpaperRange([{ start: 21 * 60, end: 23 * 60 }])).toEqual({ start: 18 * 60, end: 24 * 60 });
  });
});

describe("wallpaperLayout", () => {
  const today = "2026-10-05";
  const week = typicalWeek(
    [block("b1", 1, "08:00", "10:00"), block("b2", 2, "14:00", "17:00"), block("b3", 2, "15:00", "16:00"), block("sab", 6, "09:00", "12:00")],
    [activity("voley", { start_time: "21:00", end_time: "23:00" })],
    today,
  );
  const weekdays = [1, 2, 3, 4, 5];

  for (const format of ["landscape", "portrait"] as const) {
    it(`${format}: imagen 16:9 con la tabla centrada y adentro`, () => {
      const layout = wallpaperLayout(week, weekdays, format);
      const size = WALLPAPER_SIZE[format];
      expect([layout.width, layout.height]).toEqual([size.width, size.height]);
      const ratio = Math.max(size.width, size.height) / Math.min(size.width, size.height);
      expect(ratio).toBeCloseTo(16 / 9, 5);

      const { table } = layout;
      expect(table.x).toBeGreaterThan(0);
      expect(table.y).toBeGreaterThan(0);
      expect(Math.abs(table.x + table.width / 2 - size.width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(table.y + table.height / 2 - size.height / 2)).toBeLessThanOrEqual(2);
      expect(layout.columns.map((column) => column.weekday)).toEqual(weekdays);
      const last = layout.columns[layout.columns.length - 1];
      expect(Math.abs(last.x + last.width - (table.x + table.width))).toBeLessThanOrEqual(3);
    });

    it(`${format}: cada bloque queda dentro de su columna y de la grilla`, () => {
      const layout = wallpaperLayout(week, weekdays, format);
      // El sábado no es un día visible: su clase no se dibuja ni estira el rango horario.
      expect(layout.blocks.some(({ item }) => item.weekday === 6)).toBe(false);
      expect([layout.startMinutes, layout.endMinutes]).toEqual([8 * 60, 23 * 60]);
      expect(layout.hours).toHaveLength(16);
      const bodyTop = layout.table.y + layout.headerHeight;
      for (const { item, rect } of layout.blocks) {
        const column = layout.columns.find((entry) => entry.weekday === item.weekday)!;
        expect(rect.x).toBeGreaterThanOrEqual(column.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(column.x + column.width);
        expect(rect.y).toBeGreaterThanOrEqual(bodyTop);
        expect(rect.y + rect.height).toBeLessThanOrEqual(layout.table.y + layout.table.height);
      }
      // Los dos bloques del martes que se pisan van lado a lado.
      const [first, second] = layout.blocks.filter(({ item }) => item.weekday === 2 && item.kind === "class");
      expect(first.rect.x + first.rect.width).toBeLessThanOrEqual(second.rect.x);
    });
  }

  it("sin nada cargado igual arma una grilla", () => {
    const layout = wallpaperLayout([], weekdays, "landscape");
    expect(layout.blocks).toEqual([]);
    expect(layout.hours).toHaveLength(11);
    expect(layout.columns).toHaveLength(5);
  });
});
