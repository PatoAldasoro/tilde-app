/**
 * Fechas sin zona horaria. Un día es siempre un string "YYYY-MM-DD" (lo mismo que guarda
 * Postgres en una columna `date`), así nunca se corre por husos. Semana desde el lunes.
 */
export type IsoDate = string;

/** 1 = lunes … 7 = domingo (ISO). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

function toUtc(iso: IsoDate): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): IsoDate {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

/** Arma una fecha a partir de año, mes (1–12) y día; normaliza desbordes (día 0, mes 13…). */
export function makeDate(year: number, month: number, day: number): IsoDate {
  return fromUtc(Date.UTC(year, month - 1, day));
}

export function dateParts(iso: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Días de `from` a `to` (positivo si `to` es posterior). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function weekdayOf(iso: IsoDate): Weekday {
  return ((((new Date(toUtc(iso)).getUTCDay() + 6) % 7) + 1) as Weekday);
}

/** Lunes de la semana que contiene a `iso`. */
export function startOfWeek(iso: IsoDate): IsoDate {
  return addDays(iso, -(weekdayOf(iso) - 1));
}

/** Los siete días (lunes a domingo) de la semana que empieza en `weekStart`. */
export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

/** Semanas (lunes primero) que cubren el mes, con los días vecinos necesarios. */
export function monthMatrix(year: number, month: number): IsoDate[][] {
  const first = makeDate(year, month, 1);
  const last = makeDate(year, month + 1, 0);
  const weeks: IsoDate[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    weeks.push(weekDates(start));
  }
  return weeks;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/** El día calendario de un instante en una zona horaria. */
export function dateInTimeZone(instant: Date | string | number, timeZone: string = DEFAULT_TIME_ZONE): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Hoy" en la zona del usuario. */
export function todayInTimeZone(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): IsoDate {
  return dateInTimeZone(now, timeZone);
}

/** Minutos desde la medianoche en la zona del usuario (para la línea de "ahora"). */
export function minutesInTimeZone(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** DD/MM */
export function formatDayMonth(iso: IsoDate): string {
  const { month, day } = dateParts(iso);
  return `${pad(day)}/${pad(month)}`;
}

/** DD/MM/AAAA */
export function formatFullDate(iso: IsoDate): string {
  const { year, month, day } = dateParts(iso);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** Acepta "DD/MM/AAAA", "D/M/AA" o "DD/MM" (año de referencia) y devuelve la fecha, o null. */
export function parseDayMonthYear(text: string, referenceYear: number): IsoDate | null {
  const match = /^\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?\s*$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : referenceYear;
  if (match[3]?.length === 2) year += 2000;
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isIsoDate(iso) ? iso : null;
}
