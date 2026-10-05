/**
 * Horario semanal: clases de las materias (bloques que se repiten todas las semanas) y
 * actividades fuera de las materias (una fecha, todos los días o días específicos).
 *
 * Excepciones: `skip` omite una ocurrencia puntual. Un feriado deja las clases de ese día
 * como "Sin clase", salvo que haya una excepción `keep` (hubo clase igual). Los feriados no
 * afectan a las actividades.
 */
import { addDays, weekdayOf, type IsoDate } from "./dates";
import { timeToMinutes } from "./time";

/** La grilla va de 07:00 a 23:00 en pasos de 30 minutos. */
export const GRID_START = 7 * 60;
export const GRID_END = 23 * 60;
export const GRID_STEP = 30;

export type ScheduleBlock = {
  id: string;
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
};

export type Recurrence = "none" | "daily" | "weekdays";

export type ScheduleEvent = {
  id: string;
  title: string;
  color_key: string;
  icon?: string | null;
  start_time: string;
  end_time: string;
  recurrence: string;
  weekdays: number[];
  date: IsoDate | null;
  start_date: IsoDate | null;
  until_date: IsoDate | null;
};

export type ScheduleException = {
  target_type: string;
  target_id: string;
  date: IsoDate;
  kind: string;
};

export type OccurrenceStatus = "normal" | "skipped" | "holiday";

type OccurrenceBase = {
  /** Único dentro de la semana: `${kind}:${id}:${date}`. */
  key: string;
  date: IsoDate;
  /** Minutos desde la medianoche. */
  start: number;
  end: number;
  /** normal · skipped (omitida esta vez) · holiday (sin clase por feriado). */
  status: OccurrenceStatus;
  /** Columna y cantidad de columnas del grupo de bloques superpuestos. */
  col: number;
  cols: number;
};

export type ClassOccurrence = OccurrenceBase & { kind: "class"; block: ScheduleBlock };
export type EventOccurrence = OccurrenceBase & { kind: "event"; event: ScheduleEvent };
export type Occurrence = ClassOccurrence | EventOccurrence;

/** ¿La actividad ocurre en esa fecha? (sin mirar excepciones) */
export function eventOccursOn(event: ScheduleEvent, date: IsoDate): boolean {
  if (event.recurrence === "none") return event.date === date;
  if (event.start_date && date < event.start_date) return false;
  if (event.until_date && date > event.until_date) return false;
  if (event.recurrence === "daily") return true;
  if (event.recurrence === "weekdays") return event.weekdays.includes(weekdayOf(date));
  return false;
}

/** Las clases solo se dictan mientras la materia no esté archivada. */
export function blocksOfActiveSubjects<B extends { subject_id: string }>(
  blocks: readonly B[],
  subjects: readonly { id: string; archived_at: string | null }[],
): B[] {
  const active = new Set(subjects.filter((subject) => subject.archived_at === null).map((subject) => subject.id));
  return blocks.filter((block) => active.has(block.subject_id));
}

/**
 * Reparte el ancho de la columna entre bloques superpuestos: agrupa los que se pisan en
 * clústeres y a cada uno le asigna la primera columna libre (mínimo de columnas).
 */
export function layoutOverlaps<T extends { start: number; end: number; col: number; cols: number }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: T[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columnEnds: number[] = [];
    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column < 0) {
        column = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[column] = item.end;
      item.col = column;
    }
    for (const item of cluster) item.cols = columnEnds.length;
    cluster = [];
  };
  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = item.end;
    } else {
      clusterEnd = Math.max(clusterEnd, item.end);
    }
    cluster.push(item);
  }
  flush();
  return sorted;
}

/**
 * Todo lo que ocurre en la semana que empieza el lunes `weekStart`, día por día y ya con la
 * disposición de los bloques superpuestos.
 *
 * @param blocks clases (pasar solo las de materias no archivadas: ver blocksOfActiveSubjects)
 * @param holidays fechas que son feriado, nacional o manual
 */
export function occurrencesForWeek(
  weekStart: IsoDate,
  blocks: readonly ScheduleBlock[],
  events: readonly ScheduleEvent[],
  exceptions: readonly ScheduleException[],
  holidays: Iterable<IsoDate>,
): Occurrence[] {
  const holidaySet = new Set(holidays);
  const exceptionKind = new Map(exceptions.map((item) => [`${item.target_type}:${item.target_id}:${item.date}`, item.kind]));
  const result: Occurrence[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    const weekday = weekdayOf(date);
    const day: Occurrence[] = [];

    for (const block of blocks) {
      if (block.weekday !== weekday) continue;
      const exception = exceptionKind.get(`block:${block.id}:${date}`);
      const status: OccurrenceStatus =
        exception === "skip" ? "skipped" : holidaySet.has(date) && exception !== "keep" ? "holiday" : "normal";
      day.push({
        kind: "class",
        key: `class:${block.id}:${date}`,
        block,
        date,
        start: timeToMinutes(block.start_time),
        end: timeToMinutes(block.end_time),
        status,
        col: 0,
        cols: 1,
      });
    }

    for (const event of events) {
      if (!eventOccursOn(event, date)) continue;
      day.push({
        kind: "event",
        key: `event:${event.id}:${date}`,
        event,
        date,
        start: timeToMinutes(event.start_time),
        end: timeToMinutes(event.end_time),
        // Los feriados no afectan a las actividades: solo se pueden omitir a mano.
        status: exceptionKind.get(`event:${event.id}:${date}`) === "skip" ? "skipped" : "normal",
        col: 0,
        cols: 1,
      });
    }

    result.push(...layoutOverlaps(day));
  }
  return result;
}

/** Posición vertical (en slots de 30 min desde las 07:00) de un bloque, recortada a la grilla. */
export function gridPosition(start: number, end: number): { top: number; height: number } {
  const from = Math.max(GRID_START, Math.min(start, GRID_END));
  const to = Math.max(from, Math.min(end, GRID_END));
  return { top: (from - GRID_START) / GRID_STEP, height: (to - from) / GRID_STEP };
}

// ---------- semana tipo (para exportar el horario) ----------

type WeekItemBase = {
  /** Único dentro de la semana: `${kind}:${id}:${weekday}`. */
  key: string;
  /** 1 = lunes … 7 = domingo. */
  weekday: number;
  start: number;
  end: number;
  col: number;
  cols: number;
};

export type WeekItem = WeekItemBase & ({ kind: "class"; block: ScheduleBlock } | { kind: "event"; event: ScheduleEvent });

/**
 * La semana "tipo": lo que se repite todas las semanas, sin fechas. Entran las clases y las
 * actividades recurrentes que siguen vigentes; no entran las actividades de una sola fecha,
 * las excepciones ni los feriados.
 *
 * @param blocks clases (pasar solo las de materias no archivadas: ver blocksOfActiveSubjects)
 */
export function typicalWeek(blocks: readonly ScheduleBlock[], events: readonly ScheduleEvent[], today: IsoDate): WeekItem[] {
  const recurring = events.filter((event) => event.recurrence !== "none" && (!event.until_date || event.until_date >= today));
  const result: WeekItem[] = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const day: WeekItem[] = [];
    for (const block of blocks) {
      if (block.weekday !== weekday) continue;
      day.push({ kind: "class", key: `class:${block.id}:${weekday}`, weekday, block, start: timeToMinutes(block.start_time), end: timeToMinutes(block.end_time), col: 0, cols: 1 });
    }
    for (const event of recurring) {
      if (event.recurrence === "weekdays" && !event.weekdays.includes(weekday)) continue;
      day.push({ kind: "event", key: `event:${event.id}:${weekday}`, weekday, event, start: timeToMinutes(event.start_time), end: timeToMinutes(event.end_time), col: 0, cols: 1 });
    }
    result.push(...layoutOverlaps(day));
  }
  return result;
}
