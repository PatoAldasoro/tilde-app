/**
 * Importar fechas al Calendario desde un archivo .ics o desde un calendario vinculado.
 *
 * Cada evento importado guarda su `external_id`: volver a importar el mismo calendario
 * actualiza la fecha de lo que ya está en vez de duplicarlo. Nada entra sin pasar por la
 * vista previa, que propone categoría y materia a partir del título.
 */
import type { CalendarCategory, CalendarEvent } from "./calendar";
import { addDays, type IsoDate } from "./dates";
import type { IcsOccurrence } from "./ics";
import { normalizeKey } from "./task-import";
import { normalizeTime } from "./time";

// ---------- dirección del calendario vinculado ----------

/**
 * Servicios de calendario de los que se acepta una dirección .ics. La descarga la hace el
 * servidor, así que no se le puede pedir cualquier dirección: solo estas.
 */
const FEED_HOSTS = ["calendar.google.com", "outlook.office365.com", "outlook.live.com"];
const FEED_HOST_SUFFIXES = [".icloud.com"];

/** Devuelve la dirección normalizada (https) si es de un servicio aceptado; si no, null. */
export function normalizeFeedUrl(input: string): string | null {
  const text = input.trim().replace(/^webcals?:\/\//i, "https://");
  if (text.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const allowed = FEED_HOSTS.includes(host) || FEED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  return allowed ? url.toString() : null;
}

// ---------- sugerencias a partir del título ----------

const CATEGORY_HINTS: [CalendarCategory, RegExp][] = [
  ["recuperatorio", /\b(recuperatorios?|recu|makeup|make up|retake|resit)\b/],
  ["final", /\b(final|finales|final exam|mesa de examen|examen final)\b/],
  ["parcial", /\b(parcial|parciales|parcialito|midterm|exam|examen|prueba|test|quiz)\b/],
  ["tp", /\b(tp|tps|trabajo practico|trabajos practicos|entrega|entregar|assignment|homework|deadline|due|informe|monografia)\b/],
  ["feriado", /\b(feriado|holiday|asueto|dia no laborable)\b/],
];

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Categoría que sugiere el título; "evento" si no dice nada reconocible. */
export function guessCategory(title: string): CalendarCategory {
  const text = plain(title);
  return CATEGORY_HINTS.find(([, pattern]) => pattern.test(text))?.[0] ?? "evento";
}

/** La materia nombrada en el título (la de nombre más largo, si hay varias). */
export function guessSubject(title: string, subjects: readonly { id: string; name: string }[]): string | null {
  const text = normalizeKey(title);
  let best: { id: string; length: number } | null = null;
  for (const subject of subjects) {
    const name = normalizeKey(subject.name);
    // Nombres muy cortos ("Arte") darían coincidencias casuales dentro de otras palabras.
    if (name.length < 4 || !text.includes(name)) continue;
    if (!best || name.length > best.length) best = { id: subject.id, length: name.length };
  }
  return best?.id ?? null;
}

// ---------- plan de importación ----------

export type ImportStatus =
  /** No está en Tilde. */
  | "new"
  /** Ya está, pero cambió de día u hora en el origen. */
  | "changed"
  /** Ya está y no cambió: no hay nada que hacer. */
  | "same"
  /** Se ofreció antes y no se importó (o se borró después). */
  | "skipped";

export type ImportItem = {
  /** Clave de la fila: el identificador del evento o, en una serie, el de la serie. */
  key: string;
  title: string;
  /** Fechas que representa: una, o todas las de una serie que se repite. */
  occurrences: IcsOccurrence[];
  status: Exclude<ImportStatus, "same">;
  /** Categoría y materia propuestas (o las que ya tiene en Tilde). */
  category: CalendarCategory;
  subjectId: string | null;
  /** Marcado para importar por defecto. */
  selected: boolean;
};

export type ImportPlan = {
  items: ImportItem[];
  /** Eventos que ya están en Tilde sin cambios. */
  upToDate: number;
};

type Existing = Pick<CalendarEvent, "id" | "date" | "category" | "subject_id"> & { external_id: string | null; start_time: string | null };

const sameMoment = (existing: Existing, occurrence: IcsOccurrence) =>
  existing.date === occurrence.date && (existing.start_time ? normalizeTime(existing.start_time) : null) === occurrence.time;

/**
 * Compara lo que trae el calendario con lo que ya hay en Tilde y arma la vista previa.
 * Las series que se repiten van en una sola fila y sin marcar: el Calendario es para fechas
 * puntuales (lo que se repite todas las semanas va en el Horario).
 */
export function planCalendarImport(
  occurrences: readonly IcsOccurrence[],
  existing: readonly Existing[],
  subjects: readonly { id: string; name: string }[],
  skipped: readonly string[] = [],
): ImportPlan {
  const byExternalId = new Map(existing.filter((event) => event.external_id).map((event) => [event.external_id!, event]));
  const skippedIds = new Set(skipped);
  const items: ImportItem[] = [];
  const series = new Map<string, ImportItem>();
  let upToDate = 0;

  for (const occurrence of occurrences) {
    const current = byExternalId.get(occurrence.externalId);
    if (current && sameMoment(current, occurrence)) {
      upToDate += 1;
      continue;
    }
    const status: ImportItem["status"] = current ? "changed" : skippedIds.has(occurrence.externalId) ? "skipped" : "new";
    const category = (current?.category as CalendarCategory | undefined) ?? guessCategory(occurrence.title);
    const subjectId = current ? current.subject_id : category === "feriado" ? null : guessSubject(occurrence.title, subjects);

    // Las fechas nuevas de una misma serie se agrupan; un cambio en una fecha ya importada va aparte.
    if (occurrence.recurring && !current) {
      const key = `series:${occurrence.uid}:${status}`;
      const group = series.get(key);
      if (group) {
        group.occurrences.push(occurrence);
        continue;
      }
      const item: ImportItem = { key, title: occurrence.title, occurrences: [occurrence], status, category, subjectId, selected: false };
      series.set(key, item);
      items.push(item);
      continue;
    }
    items.push({ key: occurrence.externalId, title: occurrence.title, occurrences: [occurrence], status, category, subjectId, selected: status !== "skipped" });
  }

  // Una "serie" de una sola fecha en el rango se trata como un evento suelto.
  for (const item of items) {
    if (item.key.startsWith("series:") && item.occurrences.length === 1 && item.status === "new") item.selected = true;
  }
  items.sort((a, b) => a.occurrences[0].date.localeCompare(b.occurrences[0].date) || (a.occurrences[0].time ?? "").localeCompare(b.occurrences[0].time ?? ""));
  return { items, upToDate };
}

/** Cuántas novedades trae un plan (lo que amerita avisar): fechas nuevas o que cambiaron. */
export function importNews(plan: ImportPlan): number {
  return plan.items.filter((item) => item.status !== "skipped").reduce((total, item) => total + item.occurrences.length, 0);
}

/**
 * Identificadores que quedan como "omitidos" después de una importación: lo que se ofreció y
 * no se eligió, más lo que ya estaba omitido y sigue existiendo en el calendario.
 */
export function nextSkipped(plan: ImportPlan, importedKeys: ReadonlySet<string>, previous: readonly string[], present: readonly IcsOccurrence[]): string[] {
  const still = new Set(present.map((occurrence) => occurrence.externalId));
  const result = new Set(previous.filter((id) => still.has(id)));
  for (const item of plan.items) {
    for (const occurrence of item.occurrences) {
      if (importedKeys.has(item.key)) result.delete(occurrence.externalId);
      else if (item.status !== "changed") result.add(occurrence.externalId);
    }
  }
  return [...result].sort();
}

/** Rango que se importa: desde hoy (o un año atrás, si se piden las fechas pasadas) hasta dentro de un año. */
export function importRange(today: IsoDate, includePast: boolean): { from: IsoDate; to: IsoDate } {
  return { from: includePast ? addDays(today, -365) : today, to: addDays(today, 365) };
}
