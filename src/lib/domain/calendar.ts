/**
 * Calendario: categorías cerradas, orden de los chips del día y la tarea que genera un TP.
 * Las clases del Horario no aparecen acá. "evento" es la categoría genérica: la usan sobre todo
 * las fechas importadas de otro calendario que no son parcial, final, TP ni recuperatorio.
 */
import type { IsoDate } from "./dates";
import type { Holiday } from "./holidays";

export const CALENDAR_CATEGORIES = ["parcial", "final", "tp", "recuperatorio", "feriado", "evento"] as const;
export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export type CalendarEvent = {
  id: string;
  subject_id: string | null;
  category: string;
  title: string;
  date: IsoDate;
  confirmed: boolean;
  lead_days: number | null;
  /** Hora opcional ("HH:MM" o "HH:MM:SS"); null = todo el día. */
  start_time?: string | null;
};

/** Cuántos chips entran en una celda antes de "+N más". */
export const MAX_CHIPS = 3;

/** Lo que se dibuja en un día: un feriado nacional (no se guarda en la base) o un evento del usuario. */
export type DayItem = { kind: "holiday"; holiday: Holiday } | { kind: "event"; event: CalendarEvent };

const RANK: Record<string, number> = { feriado: 0, final: 1, parcial: 2, recuperatorio: 3, tp: 4, evento: 5 };

const itemRank = (item: DayItem) => (item.kind === "holiday" ? -1 : (RANK[item.event.category] ?? 9));

/** Índice por fecha de feriados nacionales y eventos, cada día ya ordenado. */
export function itemsByDate(events: readonly CalendarEvent[], holidays: readonly Holiday[]): Map<IsoDate, DayItem[]> {
  const map = new Map<IsoDate, DayItem[]>();
  const push = (date: IsoDate, item: DayItem) => {
    const list = map.get(date);
    if (list) list.push(item);
    else map.set(date, [item]);
  };
  holidays.forEach((holiday) => push(holiday.date, { kind: "holiday", holiday }));
  events.forEach((event) => push(event.date, { kind: "event", event }));
  const timeOf = (item: DayItem) => (item.kind === "event" ? (item.event.start_time ?? "") : "");
  for (const list of map.values()) list.sort((a, b) => itemRank(a) - itemRank(b) || timeOf(a).localeCompare(timeOf(b)));
  return map;
}

/** Hasta MAX_CHIPS chips y cuántos quedan para "+N más". */
export function splitChips<T>(items: readonly T[], max = MAX_CHIPS): { shown: T[]; more: number } {
  return { shown: items.slice(0, max), more: Math.max(0, items.length - max) };
}

/** Días que cuentan como feriado: nacionales y manuales (eventos de categoría "feriado"). */
export function holidayNames(
  events: readonly Pick<CalendarEvent, "category" | "date" | "title">[],
  holidays: readonly Holiday[],
): Map<IsoDate, { name: string; holiday: Holiday | null }> {
  const map = new Map<IsoDate, { name: string; holiday: Holiday | null }>();
  for (const event of events) {
    if (event.category === "feriado") map.set(event.date, { name: event.title, holiday: null });
  }
  // Un feriado nacional manda sobre uno manual el mismo día.
  for (const holiday of holidays) map.set(holiday.date, { name: holiday.name, holiday });
  return map;
}

// ---------- TP → tarea ----------

/** Solo los TP generan tarea. Parcial, final y recuperatorio, no. */
export const generatesTask = (category: string): boolean => category === "tp";

/** Título de la tarea de un TP: "TP · <título>" (o la materia si el evento no tiene título). */
export function tpTaskTitle(prefix: string, eventTitle: string, subjectName: string | null): string {
  const detail = eventTitle.trim() || subjectName || "";
  return detail ? `${prefix} · ${detail}` : prefix;
}

export type LinkedTaskFields = { title: string; subject_id: string | null; due_date: IsoDate; lead_days: number };

/** Los campos de la tarea que salen del evento (fecha, materia, título y anticipación). */
export function linkedTaskFields(
  event: Pick<CalendarEvent, "title" | "subject_id" | "date" | "lead_days">,
  prefix: string,
  subjectName: string | null,
  defaultLeadDays: number,
): LinkedTaskFields {
  return {
    title: tpTaskTitle(prefix, event.title, subjectName),
    subject_id: event.subject_id,
    due_date: event.date,
    lead_days: event.lead_days ?? defaultLeadDays,
  };
}

export type TaskSync = "create" | "update" | "delete" | "none";

/**
 * Qué hacer con la tarea vinculada al guardar un evento:
 * - TP nuevo (o un evento que pasa a ser TP) → crear.
 * - TP editado con tarea → actualizar. Si la tarea se borró a mano, no se recrea sola.
 * - Deja de ser TP → borrar la tarea.
 */
export function taskSyncFor(previousCategory: string | null, nextCategory: string, hasLinkedTask: boolean): TaskSync {
  const was = previousCategory !== null && generatesTask(previousCategory);
  const is = generatesTask(nextCategory);
  if (is) {
    if (hasLinkedTask) return "update";
    return was ? "none" : "create";
  }
  return hasLinkedTask ? "delete" : "none";
}
