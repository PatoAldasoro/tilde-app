import { describe, expect, it } from "vitest";
import { typicalWeek, type ScheduleBlock, type ScheduleEvent } from "./schedule";
import {
  deviceWallpaperSize,
  hasOffGridTimes,
  isPortrait,
  isWallpaperFormat,
  normalizeHexColor,
  WALLPAPER_FORMAT_KEYS,
  WALLPAPER_FORMATS,
  wallpaperLayout,
  wallpaperRange,
  wallpaperSize,
} from "./wallpaper";

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

  it("formatos: dos horizontales y dos verticales, con la proporción que dicen", () => {
    const ratio = (format: (typeof WALLPAPER_FORMAT_KEYS)[number]) => WALLPAPER_FORMATS[format].width / WALLPAPER_FORMATS[format].height;
    expect(WALLPAPER_FORMAT_KEYS).toEqual(["16x9", "16x10", "9x16", "9x19.5"]);
    expect(ratio("16x9")).toBeCloseTo(16 / 9, 5);
    expect(ratio("16x10")).toBeCloseTo(16 / 10, 5);
    expect(ratio("9x16")).toBeCloseTo(9 / 16, 5);
    expect(ratio("9x19.5")).toBeCloseTo(9 / 19.5, 5);
    expect(WALLPAPER_FORMAT_KEYS.map((format) => isPortrait(WALLPAPER_FORMATS[format]))).toEqual([false, false, true, true]);
    expect(isWallpaperFormat("9x16")).toBe(true);
    expect(isWallpaperFormat("device")).toBe(true);
    expect(isWallpaperFormat("4x3")).toBe(false);
  });

  for (const format of WALLPAPER_FORMAT_KEYS) {
    const size = WALLPAPER_FORMATS[format];
    const portrait = isPortrait(size);

    it(`${format}: la tabla está centrada y ocupa casi toda la imagen`, () => {
      const layout = wallpaperLayout(week, weekdays, size);
      expect([layout.width, layout.height, layout.portrait]).toEqual([size.width, size.height, portrait]);
      const { table } = layout;
      expect(Math.abs(table.x + table.width / 2 - size.width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(table.y + table.height / 2 - size.height / 2)).toBeLessThanOrEqual(2);
      // En vertical cubre casi todo el alto de la pantalla; en horizontal, casi todo el ancho.
      expect(table.height / size.height).toBeGreaterThanOrEqual(portrait ? 0.89 : 0.85);
      expect(table.width / size.width).toBeGreaterThanOrEqual(portrait ? 0.86 : 0.93);
      expect(table.x).toBeGreaterThan(0);
      expect(table.y).toBeGreaterThan(0);
      expect(layout.columns.map((column) => column.weekday)).toEqual(weekdays);
      const last = layout.columns[layout.columns.length - 1];
      expect(Math.abs(last.x + last.width - (table.x + table.width))).toBeLessThanOrEqual(4);
    });

    it(`${format}: una fila por media hora, con la de cierre, que llenan la tabla`, () => {
      const layout = wallpaperLayout(week, weekdays, size);
      // El sábado no es un día visible: su clase no se dibuja ni estira el rango horario.
      expect(layout.blocks.some(({ item }) => item.weekday === 6)).toBe(false);
      expect([layout.startMinutes, layout.endMinutes]).toEqual([8 * 60, 23 * 60]);
      // De 08:00 a 23:00 son 30 medias horas, más la fila que muestra las 23:00.
      expect(layout.rows).toHaveLength(31);
      expect(layout.rows.slice(0, 3).map((row) => [row.minutes, row.isHour])).toEqual([
        [480, true],
        [510, false],
        [540, true],
      ]);
      expect(layout.rows[30].minutes).toBe(23 * 60);
      const lastRow = layout.rows[30];
      expect(layout.rows[0].y).toBe(layout.table.y + layout.headerHeight);
      expect(Math.abs(lastRow.y + lastRow.height - (layout.table.y + layout.table.height))).toBeLessThanOrEqual(4);
    });

    it(`${format}: cada bloque queda en su columna y arranca en la fila de su hora`, () => {
      const layout = wallpaperLayout(week, weekdays, size);
      for (const { item, rect } of layout.blocks) {
        const column = layout.columns.find((entry) => entry.weekday === item.weekday)!;
        expect(rect.x).toBeGreaterThanOrEqual(column.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(column.x + column.width);
        const startRow = layout.rows.find((row) => row.minutes === item.start)!;
        const endRow = layout.rows.find((row) => row.minutes === item.end)!;
        expect(rect.y).toBeGreaterThanOrEqual(startRow.y);
        expect(rect.y - startRow.y).toBeLessThanOrEqual(layout.unit * 3);
        expect(rect.y + rect.height).toBeLessThanOrEqual(endRow.y);
        expect(endRow.y - (rect.y + rect.height)).toBeLessThanOrEqual(layout.unit * 3);
      }
      // Los dos bloques del martes que se pisan van lado a lado.
      const [first, second] = layout.blocks.filter(({ item }) => item.weekday === 2 && item.kind === "class");
      expect(first.rect.x + first.rect.width).toBeLessThanOrEqual(second.rect.x);
    });
  }

  it("sin nada cargado igual arma una grilla de 08:00 a 18:00", () => {
    const layout = wallpaperLayout([], weekdays, WALLPAPER_FORMATS["16x9"]);
    expect(layout.blocks).toEqual([]);
    expect(layout.rows).toHaveLength(21);
    expect(layout.columns).toHaveLength(5);
  });

  it("con más días las columnas se achican, pero la tabla ocupa lo mismo", () => {
    const five = wallpaperLayout(week, weekdays, WALLPAPER_FORMATS["9x19.5"]);
    const seven = wallpaperLayout(week, [1, 2, 3, 4, 5, 6, 7], WALLPAPER_FORMATS["9x19.5"]);
    expect(seven.table).toEqual(five.table);
    expect(seven.columns[0].width).toBeLessThan(five.columns[0].width);
  });
});

describe("la medida de este dispositivo", () => {
  it("es la pantalla en píxeles reales", () => {
    expect(deviceWallpaperSize({ width: 393, height: 852 }, 3)).toEqual({ width: 1179, height: 2556 });
    expect(deviceWallpaperSize({ width: 1440, height: 900 }, 2)).toEqual({ width: 2880, height: 1800 });
    expect(deviceWallpaperSize({ width: 1366, height: 768 }, 1)).toEqual({ width: 1366, height: 768 });
    // Escala de Windows al 150 %: 1707 × 960 de CSS son 2560 × 1440.
    expect(deviceWallpaperSize({ width: 1706.67, height: 960 }, 1.5)).toEqual({ width: 2560, height: 1440 });
  });

  it("una pantalla enorme se achica hasta lo que entra en un canvas, sin cambiar la proporción", () => {
    const size = deviceWallpaperSize({ width: 3008, height: 1692 }, 2)!;
    expect(size.width * size.height).toBeLessThanOrEqual(16_777_216);
    expect(size.width / size.height).toBeCloseTo(3008 / 1692, 2);
    const tall = deviceWallpaperSize({ width: 600, height: 6000 }, 2)!;
    expect(Math.max(tall.width, tall.height)).toBeLessThanOrEqual(8192);
  });

  it("sin datos de la pantalla no hay medida, y el formato cae en 16:9", () => {
    expect(deviceWallpaperSize({ width: 0, height: 0 }, 2)).toBeNull();
    expect(deviceWallpaperSize({ width: 390, height: 844 }, Number.NaN)).toEqual({ width: 390, height: 844 });
    expect(wallpaperSize("device", null)).toEqual(WALLPAPER_FORMATS["16x9"]);
    expect(wallpaperSize("device", { width: 1179, height: 2556 })).toEqual({ width: 1179, height: 2556 });
    expect(wallpaperSize("9x16", { width: 1179, height: 2556 })).toEqual(WALLPAPER_FORMATS["9x16"]);
  });

  it("una medida cualquiera arma la tabla igual que los formatos fijos", () => {
    const layout = wallpaperLayout(typicalWeek([block("b1", 1, "18:50", "21:33")], [], "2026-10-05"), [1, 2, 3, 4, 5], { width: 1179, height: 2556 });
    expect(layout.portrait).toBe(true);
    expect(layout.table.x + layout.table.width).toBeLessThan(1179);
    const [{ rect }] = layout.blocks;
    // 18:50 cae a dos tercios de la fila de las 18:30.
    const row = layout.rows.find((entry) => entry.minutes === 18 * 60 + 30)!;
    expect(rect.y).toBeGreaterThan(row.y + row.height * 0.6);
    expect(rect.y).toBeLessThan(row.y + row.height * 0.75);
  });
});

describe("horarios fuera de la media hora", () => {
  it("se detectan para escribirlos en los bloques", () => {
    expect(hasOffGridTimes([{ start: 8 * 60, end: 10 * 60 + 30 }])).toBe(false);
    expect(hasOffGridTimes([{ start: 8 * 60, end: 10 * 60 }, { start: 18 * 60 + 50, end: 21 * 60 + 33 }])).toBe(true);
  });
});

describe("normalizeHexColor", () => {
  it("acepta el color con o sin numeral, en mayúsculas o en forma corta", () => {
    expect(normalizeHexColor("#1A2B3C")).toBe("#1a2b3c");
    expect(normalizeHexColor(" 1a2b3c ")).toBe("#1a2b3c");
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
  });
  it("rechaza lo que no es un color", () => {
    for (const text of ["", "#12", "#12345", "rojo", "#gggggg", "#1234567", "rgb(0,0,0)"]) expect(normalizeHexColor(text), text).toBeNull();
  });
});
