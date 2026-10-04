/**
 * Feriados nacionales de Argentina. Fuente: api.argentinadatos.com (con respaldo en /data).
 * Solo feriados: los "puente" son días no laborables y se descartan.
 */
import { addDays, isIsoDate, weekdayOf, type IsoDate } from "./dates";

/** Lo que devuelve la API. */
export type RawHoliday = { fecha: string; tipo: string; nombre: string };

export type HolidayKey =
  | "new_year"
  | "carnival"
  | "memory"
  | "malvinas"
  | "good_friday"
  | "labor"
  | "may_revolution"
  | "guemes"
  | "belgrano"
  | "independence"
  | "san_martin"
  | "diversity"
  | "sovereignty"
  | "immaculate"
  | "christmas"
  | "pope_visit";

export type Holiday = {
  date: IsoDate;
  /** Nombre original (en español) de la fuente. */
  name: string;
  /** Feriado conocido, para mostrar el nombre traducido; null si no se reconoce. */
  key: HolidayKey | null;
};

const KNOWN: [RegExp, HolidayKey][] = [
  [/a[ñn]o nuevo/, "new_year"],
  [/carnaval/, "carnival"],
  [/memoria/, "memory"],
  [/malvinas|veterano/, "malvinas"],
  [/viernes santo/, "good_friday"],
  [/trabajador|trabajo/, "labor"],
  [/revoluci[oó]n de mayo/, "may_revolution"],
  [/g[uü]emes/, "guemes"],
  [/belgrano/, "belgrano"],
  [/independencia/, "independence"],
  [/san mart[ií]n/, "san_martin"],
  [/diversidad cultural/, "diversity"],
  [/soberan[ií]a/, "sovereignty"],
  [/inmaculada/, "immaculate"],
  [/navidad/, "christmas"],
  [/papa/, "pope_visit"],
];

export function holidayKey(name: string): HolidayKey | null {
  const lower = name.toLowerCase();
  return KNOWN.find(([pattern]) => pattern.test(lower))?.[1] ?? null;
}

/** Fechas originales (MM-DD) de los feriados trasladables. */
const TRANSFERABLE_ORIGINAL_DATES = new Set(["06-17", "08-17", "10-12", "11-20"]);

/**
 * Traslado de la Ley 27.399: martes y miércoles pasan al lunes anterior; jueves y viernes,
 * al lunes siguiente; lunes, sábado y domingo no se mueven.
 */
export function transferredDate(date: IsoDate): IsoDate {
  const weekday = weekdayOf(date);
  if (weekday === 2 || weekday === 3) return addDays(date, -(weekday - 1));
  if (weekday === 4 || weekday === 5) return addDays(date, 8 - weekday);
  return date;
}

/**
 * Limpia la respuesta de la API: descarta los "puente" y las filas inválidas, y si un feriado
 * trasladable todavía figura en su fecha original (pasa con años cuyo calendario oficial aún no
 * se publicó) lo mueve según la ley. Con fechas ya trasladadas no cambia nada.
 */
export function normalizeHolidays(raw: readonly RawHoliday[]): Holiday[] {
  const byDate = new Map<IsoDate, Holiday>();
  for (const entry of raw) {
    if (!entry || entry.tipo === "puente" || !isIsoDate(entry.fecha) || typeof entry.nombre !== "string") continue;
    const unmoved = entry.tipo === "trasladable" && TRANSFERABLE_ORIGINAL_DATES.has(entry.fecha.slice(5));
    const date = unmoved ? transferredDate(entry.fecha) : entry.fecha;
    if (!byDate.has(date)) byDate.set(date, { date, name: entry.nombre.trim(), key: holidayKey(entry.nombre) });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Años a consultar para un rango de fechas: los visibles y sus vecinos. */
export function yearsAround(from: IsoDate, to: IsoDate = from): number[] {
  const first = Number(from.slice(0, 4)) - 1;
  const last = Number(to.slice(0, 4)) + 1;
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
