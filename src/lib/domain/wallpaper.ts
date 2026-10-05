/**
 * Geometría del horario exportado como fondo de pantalla: una tabla con la semana tipo,
 * centrada en una imagen 16:9 (horizontal) o 9:16 (vertical). Sin fechas: solo los días.
 * El dibujo en sí está en `src/lib/wallpaper-canvas.ts`.
 */
import type { WeekItem } from "./schedule";

export type WallpaperFormat = "landscape" | "portrait";

/** Tamaño de la imagen en píxeles (4K). */
export const WALLPAPER_SIZE: Record<WallpaperFormat, { width: number; height: number }> = {
  landscape: { width: 3840, height: 2160 },
  portrait: { width: 2160, height: 3840 },
};

/**
 * Medidas en unidades de diseño: la imagen mide 1920 × 1080 (horizontal) o 1080 × 1920
 * (vertical) unidades y cada unidad son `unit` píxeles.
 */
const SPEC = {
  landscape: { width: 1920, height: 1080, maxTableWidth: 1680, maxTableHeight: 880, timeColumn: 92, header: 68, maxColumn: 300, maxHour: 104 },
  portrait: { width: 1080, height: 1920, maxTableWidth: 1000, maxTableHeight: 1340, timeColumn: 84, header: 80, maxColumn: 230, maxHour: 150 },
} as const;

/** Sin nada cargado se dibuja una grilla de 08:00 a 18:00. */
const EMPTY_RANGE = { start: 8 * 60, end: 18 * 60 };
/** Rango mínimo, para que un horario de pocas horas no quede con filas gigantes. */
const MIN_HOURS = 6;

export type Rect = { x: number; y: number; width: number; height: number };

export type WallpaperLayout = {
  format: WallpaperFormat;
  /** Tamaño de la imagen, en píxeles. */
  width: number;
  height: number;
  /** Píxeles por unidad de diseño. */
  unit: number;
  /** La tabla completa (encabezado + grilla), en píxeles. */
  table: Rect;
  headerHeight: number;
  timeColumnWidth: number;
  columns: { weekday: number; x: number; width: number }[];
  /** Líneas de hora, de la primera a la última inclusive. */
  hours: { minutes: number; y: number }[];
  startMinutes: number;
  endMinutes: number;
  blocks: { item: WeekItem; rect: Rect }[];
};

/** Rango horario que cubre los bloques, redondeado a horas enteras. */
export function wallpaperRange(items: readonly Pick<WeekItem, "start" | "end">[]): { start: number; end: number } {
  if (items.length === 0) return EMPTY_RANGE;
  let start = Math.floor(Math.min(...items.map((item) => item.start)) / 60) * 60;
  let end = Math.ceil(Math.max(...items.map((item) => item.end)) / 60) * 60;
  // Se completa hasta el mínimo repartiendo hacia abajo y, si no alcanza el día, hacia arriba.
  while ((end - start) / 60 < MIN_HOURS) {
    if (end < 24 * 60) end += 60;
    else start -= 60;
  }
  return { start, end };
}

/**
 * Calcula dónde va cada cosa. Solo se dibujan los días de `weekdays` (los visibles en el Horario).
 */
export function wallpaperLayout(items: readonly WeekItem[], weekdays: readonly number[], format: WallpaperFormat): WallpaperLayout {
  const spec = SPEC[format];
  const { width, height } = WALLPAPER_SIZE[format];
  const unit = width / spec.width;
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  const shown = items.filter((item) => days.includes(item.weekday));
  const { start, end } = wallpaperRange(shown);
  const hourCount = (end - start) / 60;

  const columnWidth = Math.min((spec.maxTableWidth - spec.timeColumn) / Math.max(days.length, 1), spec.maxColumn);
  const hourHeight = Math.min((spec.maxTableHeight - spec.header) / hourCount, spec.maxHour);
  const tableWidth = spec.timeColumn + columnWidth * days.length;
  const tableHeight = spec.header + hourHeight * hourCount;
  const left = (spec.width - tableWidth) / 2;
  const top = (spec.height - tableHeight) / 2;
  const px = (value: number) => Math.round(value * unit);

  const bodyTop = top + spec.header;
  const y = (minutes: number) => bodyTop + ((minutes - start) / 60) * hourHeight;
  const columns = days.map((weekday, index) => ({ weekday, x: px(left + spec.timeColumn + columnWidth * index), width: px(columnWidth) }));
  const gutter = 5;

  return {
    format,
    width,
    height,
    unit,
    table: { x: px(left), y: px(top), width: px(tableWidth), height: px(tableHeight) },
    headerHeight: px(spec.header),
    timeColumnWidth: px(spec.timeColumn),
    columns,
    hours: Array.from({ length: hourCount + 1 }, (_, index) => ({ minutes: start + index * 60, y: px(y(start + index * 60)) })),
    startMinutes: start,
    endMinutes: end,
    blocks: shown.map((item) => {
      const columnLeft = left + spec.timeColumn + columnWidth * days.indexOf(item.weekday);
      const inner = columnWidth - gutter * 2;
      const slot = inner / item.cols;
      return {
        item,
        rect: {
          x: px(columnLeft + gutter + slot * item.col),
          y: px(y(item.start) + 2),
          width: px(slot - (item.cols > 1 ? 3 : 0)),
          height: px(Math.max(((item.end - item.start) / 60) * hourHeight - 4, 12)),
        },
      };
    }),
  };
}
