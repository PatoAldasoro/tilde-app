/**
 * Geometría del horario exportado como fondo de pantalla: la semana tipo en una tabla que ocupa
 * casi toda la imagen, con una fila por media hora. Sin fechas: solo los días.
 * El dibujo en sí está en `src/lib/wallpaper-canvas.ts`.
 */
import type { WeekItem } from "./schedule";

/**
 * Proporciones fijas. Las dos de 16:9 son las clásicas; 16:10 es la de la mayoría de las
 * notebooks y 9:19,5 la de los teléfonos actuales (una imagen 9:16 les queda corta de alto y el
 * teléfono la agranda recortando los costados). Además está "device": la pantalla de este equipo.
 */
export const WALLPAPER_FORMATS = {
  "16x9": { width: 3840, height: 2160 },
  "16x10": { width: 3840, height: 2400 },
  "9x16": { width: 2160, height: 3840 },
  "9x19.5": { width: 2160, height: 4680 },
} as const;

export type FixedWallpaperFormat = keyof typeof WALLPAPER_FORMATS;
export type WallpaperFormat = FixedWallpaperFormat | "device";
export type WallpaperSize = { width: number; height: number };

export const WALLPAPER_FORMAT_KEYS = Object.keys(WALLPAPER_FORMATS) as FixedWallpaperFormat[];

export function isWallpaperFormat(value: unknown): value is WallpaperFormat {
  return value === "device" || (typeof value === "string" && value in WALLPAPER_FORMATS);
}

export const isPortrait = (size: WallpaperSize): boolean => size.height > size.width;

/** Lo más grande que dibuja un canvas en todos los navegadores (Safari: 16,7 megapíxeles y 8192 de lado). */
const MAX_AREA = 16_777_216;
const MAX_SIDE = 8192;

/**
 * La medida de la pantalla en píxeles reales: la de CSS (`screen.width`, `screen.height`) por la
 * densidad (`devicePixelRatio`). El zoom del navegador cambia los dos en sentido contrario, así
 * que el producto no se mueve. Si no entra en un canvas, se achica sin cambiar la proporción.
 */
export function deviceWallpaperSize(screen: WallpaperSize, pixelRatio: number): WallpaperSize | null {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  let width = Math.round(screen.width * ratio);
  let height = Math.round(screen.height * ratio);
  if (!(width > 0 && height > 0)) return null;
  const scale = Math.min(1, Math.sqrt(MAX_AREA / (width * height)), MAX_SIDE / Math.max(width, height));
  if (scale < 1) {
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }
  return { width, height };
}

/** El tamaño de la imagen para un formato ("device" necesita la medida de la pantalla). */
export function wallpaperSize(format: WallpaperFormat, device: WallpaperSize | null): WallpaperSize {
  if (format === "device") return device ?? WALLPAPER_FORMATS["16x9"];
  return WALLPAPER_FORMATS[format];
}

/** ¿Algún bloque empieza o termina fuera de la media hora? (entonces conviene escribir su horario) */
export function hasOffGridTimes(items: readonly Pick<WeekItem, "start" | "end">[]): boolean {
  return items.some((item) => item.start % WALLPAPER_STEP !== 0 || item.end % WALLPAPER_STEP !== 0);
}

/**
 * Medidas en unidades de diseño: el ancho de la imagen son 1920 unidades (horizontal) o 1080
 * (vertical). La tabla ocupa todo menos un margen: fino a los costados en horizontal y, en
 * vertical, casi todo el alto de la pantalla.
 */
const SPEC = {
  landscape: { units: 1920, marginX: 0.03, marginY: 0.07, timeColumn: 96, header: 58 },
  portrait: { units: 1080, marginX: 0.065, marginY: 0.05, timeColumn: 112, header: 62 },
} as const;

/** Cada fila de la grilla es media hora. */
export const WALLPAPER_STEP = 30;
/** Sin nada cargado se dibuja una grilla de 08:00 a 18:00. */
const EMPTY_RANGE = { start: 8 * 60, end: 18 * 60 };
/** Rango mínimo, para que un horario de pocas horas no quede con filas gigantes. */
const MIN_HOURS = 6;

export type Rect = { x: number; y: number; width: number; height: number };

export type WallpaperLayout = {
  portrait: boolean;
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
  /**
   * Filas de media hora, de arriba hacia abajo. La hora de cada fila se escribe adentro de ella;
   * la última es la de cierre: muestra la hora en que termina el horario.
   */
  rows: { minutes: number; y: number; height: number; isHour: boolean }[];
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
 * Calcula dónde va cada cosa, para una imagen de cualquier medida. Solo se dibujan los días de
 * `weekdays` (los visibles en el Horario).
 */
export function wallpaperLayout(items: readonly WeekItem[], weekdays: readonly number[], size: WallpaperSize): WallpaperLayout {
  const { width, height } = size;
  const portrait = height > width;
  const spec = portrait ? SPEC.portrait : SPEC.landscape;
  const unit = width / spec.units;
  const unitsHigh = height / unit;
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  const shown = items.filter((item) => days.includes(item.weekday));
  const { start, end } = wallpaperRange(shown);
  // Una fila por media hora, más la de cierre.
  const rowCount = (end - start) / WALLPAPER_STEP + 1;

  const left = spec.units * spec.marginX;
  const top = unitsHigh * spec.marginY;
  const tableWidth = spec.units - left * 2;
  const tableHeight = unitsHigh - top * 2;
  const columnWidth = (tableWidth - spec.timeColumn) / Math.max(days.length, 1);
  const rowHeight = (tableHeight - spec.header) / rowCount;
  const bodyTop = top + spec.header;
  const px = (value: number) => Math.round(value * unit);
  const y = (minutes: number) => bodyTop + ((minutes - start) / WALLPAPER_STEP) * rowHeight;
  /** Separación entre un bloque y las líneas de la grilla. */
  const gap = 2;

  return {
    portrait,
    width,
    height,
    unit,
    table: { x: px(left), y: px(top), width: px(tableWidth), height: px(tableHeight) },
    headerHeight: px(spec.header),
    timeColumnWidth: px(spec.timeColumn),
    columns: days.map((weekday, index) => ({ weekday, x: px(left + spec.timeColumn + columnWidth * index), width: px(columnWidth) })),
    rows: Array.from({ length: rowCount }, (_, index) => {
      const minutes = start + index * WALLPAPER_STEP;
      return { minutes, y: px(y(minutes)), height: px(rowHeight), isHour: minutes % 60 === 0 };
    }),
    startMinutes: start,
    endMinutes: end,
    blocks: shown.map((item) => {
      const columnLeft = left + spec.timeColumn + columnWidth * days.indexOf(item.weekday);
      const slot = (columnWidth - gap * 2) / item.cols;
      return {
        item,
        rect: {
          x: px(columnLeft + gap + slot * item.col),
          y: px(y(item.start) + gap),
          width: px(slot - (item.cols > 1 ? gap : 0)),
          height: px(Math.max(((item.end - item.start) / WALLPAPER_STEP) * rowHeight - gap * 2, rowHeight * 0.5)),
        },
      };
    }),
  };
}

// ---------- color de fondo personalizado ----------

/** "#1a2B3c" o "1A2B3C" (también la forma corta "#abc") → "#1a2b3c"; null si no es un color. */
export function normalizeHexColor(value: string): string | null {
  const text = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(text)) return `#${text}`;
  if (/^[0-9a-f]{3}$/.test(text)) return `#${[...text].map((char) => char + char).join("")}`;
  return null;
}
