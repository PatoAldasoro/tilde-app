/**
 * Lector de archivos iCalendar (.ics): lo que exportan Google Calendar, Outlook, iCloud o un
 * campus virtual. Devuelve cada evento como un día (y una hora opcional) en la zona del usuario,
 * que es como los guarda Tilde.
 *
 * Cubre lo que aparece en calendarios reales: eventos de todo el día, horas en UTC, con TZID o
 * "flotantes", repeticiones (RRULE diaria, semanal, mensual y anual con INTERVAL, COUNT, UNTIL,
 * BYDAY, BYMONTHDAY y BYMONTH), fechas excluidas (EXDATE), instancias modificadas
 * (RECURRENCE-ID) y eventos cancelados. Una regla que no se entiende deja solo la primera fecha.
 */
import { addDays, dateInTimeZone, dateParts, diffDays, isIsoDate, makeDate, minutesInTimeZone, startOfWeek, weekdayOf, type IsoDate } from "./dates";
import { minutesToTime } from "./time";

export type IcsOccurrence = {
  /** Estable entre importaciones: "ics:<uid>" o "ics:<uid>:<AAAAMMDD>" si es parte de una serie. */
  externalId: string;
  uid: string;
  title: string;
  /** Día en la zona del usuario. */
  date: IsoDate;
  /** "HH:MM", o null si el evento dura todo el día. */
  time: string | null;
  /** Es una de las fechas de un evento que se repite. */
  recurring: boolean;
};

export type IcsParseResult =
  | { ok: false; error: "not_ics" }
  | {
      ok: true;
      /** Nombre del calendario, si el archivo lo trae. */
      calendarName: string | null;
      occurrences: IcsOccurrence[];
      /** Hubo que recortar: demasiados eventos o alguna repetición que no se pudo desarrollar. */
      truncated: boolean;
    };

export type IcsOptions = {
  /** Zona horaria del usuario (perfil). */
  timeZone: string;
  /** Rango de fechas a devolver, inclusive. */
  from: IsoDate;
  to: IsoDate;
};

export const ICS_MAX_OCCURRENCES = 1500;
const TITLE_MAX = 200;
const UID_MAX = 300;
/** Tope de pasos al desarrollar una repetición (más de 50 años de una regla diaria). */
const MAX_STEPS = 20_000;

// ---------- líneas ----------

type Property = { name: string; params: Record<string, string>; value: string };

/** "DTSTART;TZID=America/Argentina/Buenos_Aires:20261012T140000" → nombre, parámetros y valor. */
function parseLine(line: string): Property | null {
  let quoted = false;
  let colon = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ":" && !quoted) {
      colon = index;
      break;
    }
  }
  if (colon <= 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const raw of rawParams) {
    const equals = raw.indexOf("=");
    if (equals > 0) params[raw.slice(0, equals).toUpperCase()] = raw.slice(equals + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- fechas y zonas ----------

/** Un momento tal como está escrito en el archivo: día, hora (o todo el día) y en qué zona. */
type Stamp = { date: IsoDate; minutes: number | null; zone: "utc" | "floating" | string };

const validZones = new Map<string, boolean>();
function isTimeZone(zone: string): boolean {
  let valid = validZones.get(zone);
  if (valid === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      valid = true;
    } catch {
      valid = false;
    }
    validZones.set(zone, valid);
  }
  return valid;
}

function parseStamp(property: Property): Stamp | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(property.value.trim());
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (!isIsoDate(date)) return null;
  if (match[4] === undefined || property.params.VALUE === "DATE") return { date, minutes: null, zone: "floating" };
  const minutes = Number(match[4]) * 60 + Number(match[5]);
  if (minutes >= 24 * 60) return null;
  if (match[7]) return { date, minutes, zone: "utc" };
  const tzid = property.params.TZID;
  return { date, minutes, zone: tzid && isTimeZone(tzid) ? tzid : "floating" };
}

/** Milisegundos UTC de una hora "de pared" (día + minutos) como si fuera UTC. */
function wallMs(date: IsoDate, minutes: number): number {
  const { year, month, day } = dateParts(date);
  return Date.UTC(year, month - 1, day, 0, minutes);
}

/** Instante real de una hora de pared en una zona horaria. */
export function zonedToInstant(date: IsoDate, minutes: number, timeZone: string): number {
  const wall = wallMs(date, minutes);
  const offsetAt = (instant: number) => wallMs(dateInTimeZone(instant, timeZone), minutesInTimeZone(timeZone, new Date(instant))) - instant;
  // Dos pasadas: la segunda corrige los cambios de horario (donde los haya).
  const first = wall - offsetAt(wall);
  return wall - offsetAt(first);
}

/** Instante de un momento del archivo; lo flotante y lo de todo el día se toman en la zona del usuario. */
function instantOf(stamp: Stamp, userZone: string): number {
  if (stamp.zone === "utc") return wallMs(stamp.date, stamp.minutes ?? 0);
  return zonedToInstant(stamp.date, stamp.minutes ?? 0, stamp.zone === "floating" ? userZone : stamp.zone);
}

/** Día y hora en la zona del usuario. */
function toUserZone(stamp: Stamp, userZone: string): { date: IsoDate; time: string | null } {
  if (stamp.minutes === null) return { date: stamp.date, time: null };
  if (stamp.zone === "floating" || stamp.zone === userZone) return { date: stamp.date, time: minutesToTime(stamp.minutes) };
  const instant = instantOf(stamp, userZone);
  return { date: dateInTimeZone(instant, userZone), time: minutesToTime(minutesInTimeZone(userZone, new Date(instant))) };
}

/** El día de un momento, visto desde la zona de un evento (para comparar EXDATE y RECURRENCE-ID). */
function dateInEventZone(stamp: Stamp, eventZone: Stamp["zone"], userZone: string): IsoDate {
  if (stamp.minutes === null || stamp.zone === eventZone || stamp.zone === "floating") return stamp.date;
  const zone = eventZone === "floating" ? userZone : eventZone;
  return zone === "utc" ? dateInTimeZone(instantOf(stamp, userZone), "UTC") : dateInTimeZone(instantOf(stamp, userZone), zone);
}

// ---------- repeticiones ----------

type Rule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  until: Stamp | null;
  /** Días de la semana (1 = lunes … 7 = domingo) con su ordinal opcional ("2TU", "-1FR"). */
  byDay: { weekday: number; nth: number | null }[];
  byMonthDay: number[];
  byMonth: number[];
};

const WEEKDAY: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
const SUPPORTED = new Set(["FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY", "BYMONTH", "WKST"]);

/** null si la regla usa algo que no se sabe desarrollar. */
function parseRule(value: string): Rule | null {
  const parts = new Map<string, string>();
  for (const part of value.split(";")) {
    const [key, raw] = part.split("=");
    if (key && raw !== undefined) parts.set(key.toUpperCase(), raw.toUpperCase());
  }
  if ([...parts.keys()].some((key) => !SUPPORTED.has(key))) return null;
  const freq = parts.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;
  const interval = Number(parts.get("INTERVAL") ?? 1);
  const count = parts.has("COUNT") ? Number(parts.get("COUNT")) : null;
  if (!Number.isInteger(interval) || interval < 1 || (count !== null && (!Number.isInteger(count) || count < 1))) return null;

  const byDay: Rule["byDay"] = [];
  for (const token of (parts.get("BYDAY") ?? "").split(",").filter(Boolean)) {
    const match = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(token);
    if (!match) return null;
    byDay.push({ weekday: WEEKDAY[match[2]], nth: match[1] ? Number(match[1]) : null });
  }
  const numbers = (key: string) => (parts.get(key) ?? "").split(",").filter(Boolean).map(Number);
  const byMonthDay = numbers("BYMONTHDAY");
  const byMonth = numbers("BYMONTH");
  if ([...byMonthDay, ...byMonth].some((n) => !Number.isInteger(n) || n === 0)) return null;
  // Ordinales ("2.º martes") solo tienen sentido por mes.
  if (byDay.some((day) => day.nth !== null) && freq !== "MONTHLY" && freq !== "YEARLY") return null;

  const until = parts.has("UNTIL") ? parseStamp({ name: "UNTIL", params: {}, value: parts.get("UNTIL")! }) : null;
  if (parts.has("UNTIL") && !until) return null;
  return { freq, interval, count, until, byDay, byMonthDay, byMonth };
}

const daysInMonth = (year: number, month: number) => dateParts(makeDate(year, month + 1, 0)).day;

/** Los días de un mes que pide la regla, en orden. */
function daysOfMonth(rule: Rule, year: number, month: number, fallbackDay: number): IsoDate[] {
  const length = daysInMonth(year, month);
  const days = new Set<number>();
  if (rule.byMonthDay.length > 0) {
    for (const value of rule.byMonthDay) {
      const day = value > 0 ? value : length + 1 + value;
      if (day >= 1 && day <= length) days.add(day);
    }
  } else if (rule.byDay.length > 0) {
    for (const { weekday, nth } of rule.byDay) {
      const matches: number[] = [];
      for (let day = 1; day <= length; day += 1) if (weekdayOf(makeDate(year, month, day)) === weekday) matches.push(day);
      if (nth === null) matches.forEach((day) => days.add(day));
      else {
        const picked = nth > 0 ? matches[nth - 1] : matches[matches.length + nth];
        if (picked) days.add(picked);
      }
    }
  } else if (fallbackDay <= length) {
    days.add(fallbackDay);
  }
  return [...days].sort((a, b) => a - b).map((day) => makeDate(year, month, day));
}

/**
 * Fechas (en la zona del evento) de una repetición, desde la primera, hasta `lastDate`.
 * La cuenta de COUNT y el corte de UNTIL arrancan en la primera fecha de la serie.
 */
function expandRule(rule: Rule, start: Stamp, lastDate: IsoDate, userZone: string): { dates: IsoDate[]; complete: boolean } {
  const dates: IsoDate[] = [start.date];
  const untilInstant = rule.until ? (rule.until.minutes === null ? null : instantOf(rule.until, userZone)) : null;
  const beyond = (date: IsoDate) => {
    if (date > lastDate) return true;
    if (!rule.until) return false;
    if (untilInstant === null || start.minutes === null) return date > rule.until.date;
    return instantOf({ ...start, date }, userZone) > untilInstant;
  };
  const full = () => rule.count !== null && dates.length >= rule.count;
  const push = (date: IsoDate): boolean => {
    if (date <= start.date) return true;
    if (beyond(date)) return false;
    dates.push(date);
    return !full();
  };

  const { year: startYear, month: startMonth, day: startDay } = dateParts(start.date);
  const weekdays = new Set(rule.byDay.map((day) => day.weekday));
  let steps = 0;
  let complete = true;

  if (full()) return { dates, complete };

  if (rule.freq === "DAILY" || rule.freq === "WEEKLY") {
    const weekStart = startOfWeek(start.date);
    const startWeekday = weekdayOf(start.date);
    for (let date = addDays(start.date, 1); ; date = addDays(date, 1)) {
      if ((steps += 1) > MAX_STEPS) {
        complete = false;
        break;
      }
      if (date > lastDate) break;
      let matches: boolean;
      if (rule.freq === "DAILY") {
        matches = diffDays(start.date, date) % rule.interval === 0 && (weekdays.size === 0 || weekdays.has(weekdayOf(date)));
      } else {
        const week = Math.floor(diffDays(weekStart, date) / 7);
        matches = week % rule.interval === 0 && (weekdays.size > 0 ? weekdays.has(weekdayOf(date)) : weekdayOf(date) === startWeekday);
      }
      if (matches && rule.byMonth.length > 0 && !rule.byMonth.includes(dateParts(date).month)) matches = false;
      if (matches && !push(date)) break;
    }
    return { dates, complete };
  }

  // Mensual y anual: se recorre mes a mes.
  for (let offset = 0; ; offset += 1) {
    if ((steps += 1) > MAX_STEPS) {
      complete = false;
      break;
    }
    const index = startYear * 12 + (startMonth - 1) + offset;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    if (makeDate(year, month, 1) > lastDate) break;
    if (rule.freq === "MONTHLY") {
      if (offset % rule.interval !== 0) continue;
      if (rule.byMonth.length > 0 && !rule.byMonth.includes(month)) continue;
    } else {
      if ((year - startYear) % rule.interval !== 0) continue;
      if (rule.byMonth.length > 0 ? !rule.byMonth.includes(month) : month !== startMonth) continue;
    }
    let stop = false;
    for (const date of daysOfMonth(rule, year, month, startDay)) {
      if (!push(date)) {
        stop = true;
        break;
      }
    }
    if (stop) break;
  }
  return { dates, complete };
}

// ---------- eventos ----------

type RawEvent = {
  uid: string;
  summary: string;
  start: Stamp;
  rule: string | null;
  exDates: Stamp[];
  recurrenceId: Stamp | null;
  cancelled: boolean;
};

/** Hash corto y estable para eventos sin UID. */
function hash(text: string): string {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1) value = ((value * 33) ^ text.charCodeAt(index)) >>> 0;
  return value.toString(36);
}

function readEvents(text: string): { events: RawEvent[]; calendarName: string | null } | null {
  if (!/BEGIN:VCALENDAR/i.test(text)) return null;
  // Los renglones largos vienen partidos: los que siguen empiezan con un espacio o un tab.
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: RawEvent[] = [];
  let calendarName: string | null = null;
  let current: Property[] | null = null;
  let nested = 0;

  for (const line of lines) {
    const property = parseLine(line);
    if (!property) continue;
    if (property.name === "BEGIN") {
      if (property.value.toUpperCase() === "VEVENT" && !current) current = [];
      else if (current) nested += 1;
      continue;
    }
    if (property.name === "END") {
      if (current && nested > 0) nested -= 1;
      else if (current && property.value.toUpperCase() === "VEVENT") {
        const event = toEvent(current);
        if (event) events.push(event);
        current = null;
      }
      continue;
    }
    if (current) {
      if (nested === 0) current.push(property);
    } else if (property.name === "X-WR-CALNAME" && !calendarName) {
      calendarName = unescapeText(property.value).slice(0, 120) || null;
    }
  }
  return { events, calendarName };
}

function toEvent(properties: Property[]): RawEvent | null {
  const find = (name: string) => properties.find((property) => property.name === name);
  const startProperty = find("DTSTART");
  const start = startProperty ? parseStamp(startProperty) : null;
  if (!start) return null;
  const summary = unescapeText(find("SUMMARY")?.value ?? "").slice(0, TITLE_MAX);
  const rawUid = (find("UID")?.value ?? "").trim();
  const uid = (rawUid || `sin-uid-${hash(`${summary}|${startProperty!.value}`)}`).slice(0, UID_MAX);
  const exDates = properties
    .filter((property) => property.name === "EXDATE")
    .flatMap((property) => property.value.split(",").map((value) => parseStamp({ ...property, value })))
    .filter((stamp): stamp is Stamp => stamp !== null);
  const recurrenceProperty = find("RECURRENCE-ID");
  return {
    uid,
    summary,
    start,
    rule: find("RRULE")?.value ?? null,
    exDates,
    recurrenceId: recurrenceProperty ? parseStamp(recurrenceProperty) : null,
    cancelled: (find("STATUS")?.value ?? "").trim().toUpperCase() === "CANCELLED",
  };
}

const compact = (date: IsoDate) => date.replace(/-/g, "");

/** Lee un archivo .ics y devuelve los eventos que caen entre `from` y `to` (zona del usuario). */
export function parseIcs(text: string, options: IcsOptions): IcsParseResult {
  const read = readEvents(text);
  if (!read) return { ok: false, error: "not_ics" };
  const { timeZone, from, to } = options;
  // Un día de margen: al pasar a la zona del usuario la fecha puede correrse.
  const lastDate = addDays(to, 1);
  const occurrences: IcsOccurrence[] = [];
  let truncated = false;

  // Instancias modificadas de una serie: reemplazan a la fecha original.
  const overrides = new Map<string, Set<IsoDate>>();
  const masters = new Map<string, RawEvent>();
  for (const event of read.events) if (event.rule && !event.recurrenceId) masters.set(event.uid, event);
  for (const event of read.events) {
    if (!event.recurrenceId) continue;
    const master = masters.get(event.uid);
    const original = dateInEventZone(event.recurrenceId, master?.start.zone ?? event.recurrenceId.zone, timeZone);
    const set = overrides.get(event.uid) ?? new Set<IsoDate>();
    set.add(original);
    overrides.set(event.uid, set);
  }

  const add = (event: RawEvent, stamp: Stamp, externalId: string, recurring: boolean) => {
    const { date, time } = toUserZone(stamp, timeZone);
    if (date < from || date > to) return;
    occurrences.push({ externalId, uid: event.uid, title: event.summary, date, time, recurring });
  };

  for (const event of read.events) {
    if (event.cancelled) continue;

    if (event.recurrenceId) {
      const master = masters.get(event.uid);
      const original = dateInEventZone(event.recurrenceId, master?.start.zone ?? event.recurrenceId.zone, timeZone);
      add(event, event.start, `ics:${event.uid}:${compact(original)}`, true);
      continue;
    }
    if (!event.rule) {
      add(event, event.start, `ics:${event.uid}`, false);
      continue;
    }

    const rule = parseRule(event.rule);
    if (!rule) {
      // Regla que no se sabe desarrollar: queda la primera fecha.
      truncated = true;
      add(event, event.start, `ics:${event.uid}:${compact(event.start.date)}`, true);
      continue;
    }
    const { dates, complete } = expandRule(rule, event.start, lastDate, timeZone);
    if (!complete) truncated = true;
    const excluded = new Set(event.exDates.map((stamp) => dateInEventZone(stamp, event.start.zone, timeZone)));
    const replaced = overrides.get(event.uid);
    for (const date of dates) {
      if (excluded.has(date) || replaced?.has(date)) continue;
      add(event, { ...event.start, date }, `ics:${event.uid}:${compact(date)}`, true);
    }
  }

  occurrences.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
  // Un mismo identificador repetido en el archivo (calendarios mal formados): queda el primero.
  const seen = new Set<string>();
  const unique: IcsOccurrence[] = [];
  for (const occurrence of occurrences) {
    if (seen.has(occurrence.externalId)) continue;
    seen.add(occurrence.externalId);
    unique.push(occurrence);
  }
  if (unique.length > ICS_MAX_OCCURRENCES) truncated = true;
  return { ok: true, calendarName: read.calendarName, occurrences: unique.slice(0, ICS_MAX_OCCURRENCES), truncated };
}
