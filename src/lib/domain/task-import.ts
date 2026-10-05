/**
 * Importar tareas desde un JSON (por ejemplo, un plan de estudio armado por una IA).
 *
 * Formato recomendado:
 *
 *   { "tasks": [ { "title": "…", "date": "2026-10-06", "due": "2026-10-10", "subject": "Álgebra",
 *                  "priority": "high", "subtasks": ["…", "…"] } ] }
 *
 * - `date`: el día en que se hace la tarea. `due`: fecha límite (entrega). Con las dos, la tarea
 *   aparece en la lista desde `date` hasta `due`. Sin ninguna, queda para hoy.
 * - También se aceptan variantes razonables: un array suelto, tareas agrupadas por día
 *   (`{ "days": [{ "date": …, "tasks": […] }] }` o `{ "2026-10-06": […] }`), claves en español
 *   y el JSON envuelto en un bloque de código o en texto.
 */
import { z } from "zod";
import { addDays, diffDays, isIsoDate, parseDayMonthYear, type IsoDate } from "./dates";
import type { Priority } from "./types";

export const TASK_IMPORT_LIMIT = 500;
const TITLE_MAX = 300;
const SUBTASKS_MAX = 50;
const LEAD_MAX = 60;

export type ImportedTask = {
  title: string;
  /** Tarea diaria: el día en que vive. null si tiene fecha límite. */
  planned_date: IsoDate | null;
  due_date: IsoDate | null;
  lead_days: number | null;
  priority: Priority;
  subject_id: string | null;
  subtasks: string[];
};

export type TaskImportIssueCode = "no_title" | "bad_date" | "bad_due" | "not_a_task";

export type TaskImportIssue = {
  /** Posición del elemento en el archivo, empezando en 1. */
  position: number;
  code: TaskImportIssueCode;
  /** El valor que no se pudo interpretar. */
  value: string;
};

export type TaskImportResult =
  | { ok: false; error: "empty" | "invalid_json" | "no_tasks" | "too_many" }
  | {
      ok: true;
      tasks: ImportedTask[];
      /** Elementos que no se pudieron importar. */
      issues: TaskImportIssue[];
      /** Nombres de materia que no coinciden con ninguna: esas tareas quedan sin materia. */
      unknownSubjects: string[];
    };

export type TaskImportContext = {
  today: IsoDate;
  subjects: readonly { id: string; name: string }[];
  /** Anticipación para las entregas que no la indican. */
  defaultLeadDays: number;
};

// ---------- JSON dentro de texto ----------

/** Devuelve el JSON aunque venga dentro de un bloque ``` o rodeado de texto. undefined si no hay. */
export function extractJson(text: string): unknown {
  const candidates: string[] = [];
  const trimmed = text.trim();
  if (trimmed) candidates.push(trimmed);
  for (const match of trimmed.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)) candidates.push(match[1].trim());
  for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
    const start = trimmed.indexOf(open);
    const end = trimmed.lastIndexOf(close);
    if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (typeof value === "object" && value !== null) return value;
    } catch {
      // probar el siguiente candidato
    }
  }
  return undefined;
}

// ---------- normalización ----------

/** Minúsculas, sin acentos y sin separadores: "Fecha_Límite" → "fechalimite". */
export function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const KEYS = {
  title: ["title", "titulo", "task", "tarea", "name", "nombre", "text", "texto", "todo"],
  date: ["date", "fecha", "day", "dia", "planneddate", "planned", "when", "cuando", "start", "inicio"],
  due: ["due", "duedate", "deadline", "vence", "vencimiento", "entrega", "fechalimite", "limite", "fechadeentrega"],
  lead: ["leaddays", "lead", "anticipacion", "diasantes"],
  subject: ["subject", "materia", "course", "asignatura", "curso"],
  priority: ["priority", "prioridad"],
  subtasks: ["subtasks", "subtareas", "steps", "pasos", "checklist", "items"],
  tasks: ["tasks", "tareas", "todos", "items", "pendientes"],
  days: ["days", "dias", "plan", "schedule", "agenda", "calendario"],
} as const;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

function pick(object: Json, names: readonly string[]): unknown {
  for (const [key, value] of Object.entries(object)) {
    if (names.includes(normalizeKey(key)) && value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

const PRIORITIES: Record<string, Priority> = {
  none: "none", ninguna: "none", sin: "none", sinprioridad: "none", "0": "none",
  low: "low", baja: "low", "1": "low",
  medium: "medium", media: "medium", normal: "medium", med: "medium", "2": "medium",
  high: "high", alta: "high", urgent: "high", urgente: "high", "3": "high",
};

function parsePriority(value: unknown): Priority {
  return PRIORITIES[normalizeKey(String(value ?? ""))] ?? "none";
}

/** Fecha en ISO, DD/MM/AAAA, DD/MM (año de hoy), o "hoy" / "mañana". */
export function parseImportDate(value: unknown, today: IsoDate): IsoDate | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(text)?.[1];
  if (iso) return isIsoDate(iso) ? iso : null;
  const word = normalizeKey(text);
  if (word === "hoy" || word === "today") return today;
  if (word === "manana" || word === "tomorrow") return addDays(today, 1);
  return parseDayMonthYear(text, Number(today.slice(0, 4)));
}

/** La materia cuyo nombre coincide (sin distinguir mayúsculas ni acentos), o la única que lo contiene. */
export function matchSubject(name: string, subjects: readonly { id: string; name: string }[]): string | null {
  const wanted = normalizeKey(name);
  if (!wanted) return null;
  const exact = subjects.find((subject) => normalizeKey(subject.name) === wanted);
  if (exact) return exact.id;
  const partial = subjects.filter((subject) => {
    const candidate = normalizeKey(subject.name);
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
  return partial.length === 1 ? partial[0].id : null;
}

const taskSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX),
  planned_date: z.string().nullable(),
  due_date: z.string().nullable(),
  lead_days: z.number().int().min(0).max(LEAD_MAX).nullable(),
  priority: z.enum(["none", "low", "medium", "high"]),
  subject_id: z.string().nullable(),
  subtasks: z.array(z.string().min(1).max(TITLE_MAX)).max(SUBTASKS_MAX),
});

// ---------- recorrido ----------

type Candidate = { value: unknown; date: IsoDate | null };

/** Aplana las formas aceptadas (lista, por día, por fecha) en candidatos a tarea con su día heredado. */
function collect(value: unknown, inherited: IsoDate | null, today: IsoDate, out: Candidate[]): void {
  if (out.length > TASK_IMPORT_LIMIT) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isObject(item) && (Array.isArray(pick(item, KEYS.tasks)) || pick(item, KEYS.days) !== undefined) && pick(item, KEYS.title) === undefined) {
        collect(item, inherited, today, out);
      } else {
        out.push({ value: item, date: inherited });
      }
    }
    return;
  }
  if (!isObject(value)) {
    out.push({ value, date: inherited });
    return;
  }
  const ownDate = parseImportDate(pick(value, KEYS.date), today) ?? inherited;
  const tasks = pick(value, KEYS.tasks);
  const days = pick(value, KEYS.days);
  const hasTitle = pick(value, KEYS.title) !== undefined;
  if (!hasTitle && (Array.isArray(tasks) || isObject(tasks))) return collect(tasks, ownDate, today, out);
  if (!hasTitle && (Array.isArray(days) || isObject(days))) return collect(days, ownDate, today, out);
  // Objeto con fechas como claves: { "2026-10-06": [ … ] }
  const entries = Object.entries(value);
  if (!hasTitle && entries.length > 0 && entries.every(([key]) => parseImportDate(key, today) !== null)) {
    for (const [key, items] of entries) collect(Array.isArray(items) ? items : [items], parseImportDate(key, today), today, out);
    return;
  }
  out.push({ value, date: inherited });
}

const clip = (text: string) => text.trim().replace(/\s+/g, " ").slice(0, TITLE_MAX);

function subtaskTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (isObject(item) ? pick(item, KEYS.title) : item))
    .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
    .map((item) => clip(String(item)))
    .filter(Boolean)
    .slice(0, SUBTASKS_MAX);
}

/** Interpreta el texto pegado o el archivo y devuelve las tareas listas para crear. */
export function parseTaskImport(text: string, context: TaskImportContext): TaskImportResult {
  if (!text.trim()) return { ok: false, error: "empty" };
  const json = extractJson(text);
  if (json === undefined) return { ok: false, error: "invalid_json" };

  const candidates: Candidate[] = [];
  collect(json, null, context.today, candidates);
  if (candidates.length === 0) return { ok: false, error: "no_tasks" };
  if (candidates.length > TASK_IMPORT_LIMIT) return { ok: false, error: "too_many" };

  const tasks: ImportedTask[] = [];
  const issues: TaskImportIssue[] = [];
  const unknown = new Set<string>();

  candidates.forEach(({ value, date: inherited }, index) => {
    const position = index + 1;
    const fail = (code: TaskImportIssueCode, bad: unknown) =>
      issues.push({ position, code, value: typeof bad === "string" ? bad.slice(0, 80) : JSON.stringify(bad ?? null).slice(0, 80) });

    if (typeof value === "string" || typeof value === "number") {
      const title = clip(String(value));
      if (!title) return fail("no_title", value);
      tasks.push({ title, planned_date: inherited ?? context.today, due_date: null, lead_days: null, priority: "none", subject_id: null, subtasks: [] });
      return;
    }
    if (!isObject(value)) return fail("not_a_task", value);

    const rawTitle = pick(value, KEYS.title);
    const title = typeof rawTitle === "string" || typeof rawTitle === "number" ? clip(String(rawTitle)) : "";
    if (!title) return fail("no_title", value);

    const rawDate = pick(value, KEYS.date);
    const date = rawDate === undefined ? inherited : parseImportDate(rawDate, context.today);
    if (rawDate !== undefined && date === null) return fail("bad_date", rawDate);
    const rawDue = pick(value, KEYS.due);
    const due = rawDue === undefined ? null : parseImportDate(rawDue, context.today);
    if (rawDue !== undefined && due === null) return fail("bad_due", rawDue);

    // Con fecha límite la tarea aparece desde `date` (o con la anticipación indicada) hasta `due`.
    let leadDays: number | null = null;
    if (due) {
      const rawLead = pick(value, KEYS.lead);
      const explicit = rawLead === undefined ? Number.NaN : Number(rawLead);
      const fromDate = date && date <= due ? diffDays(date, due) : null;
      const wanted = Number.isFinite(explicit) ? explicit : (fromDate ?? context.defaultLeadDays);
      leadDays = Math.max(0, Math.min(LEAD_MAX, Math.trunc(wanted)));
    }

    const rawSubject = pick(value, KEYS.subject);
    const subjectName = typeof rawSubject === "string" ? rawSubject.trim() : "";
    const subjectId = subjectName ? matchSubject(subjectName, context.subjects) : null;
    if (subjectName && !subjectId) unknown.add(subjectName);

    const parsed = taskSchema.safeParse({
      title,
      planned_date: due ? null : (date ?? context.today),
      due_date: due,
      lead_days: leadDays,
      priority: parsePriority(pick(value, KEYS.priority)),
      subject_id: subjectId,
      subtasks: subtaskTitles(pick(value, KEYS.subtasks)),
    });
    if (!parsed.success) return fail("not_a_task", value);
    tasks.push(parsed.data);
  });

  if (tasks.length === 0 && issues.length === 0) return { ok: false, error: "no_tasks" };
  return { ok: true, tasks, issues, unknownSubjects: [...unknown] };
}

// ---------- ejemplo y resumen ----------

/** El ejemplo de formato que se muestra en el diálogo y se incluye en el pedido para la IA. */
export function taskImportExample(today: IsoDate, subjectName: string): string {
  const example = {
    tasks: [
      { title: "Leer el capítulo 3", date: today, subject: subjectName, priority: "medium" },
      {
        title: "Resolver la guía 4",
        date: addDays(today, 1),
        subject: subjectName,
        priority: "high",
        subtasks: ["Ejercicios 1 a 5", "Ejercicios 6 a 10"],
      },
      { title: "Entregar el TP 2", due: addDays(today, 6), subject: subjectName },
    ],
  };
  return JSON.stringify(example, null, 2);
}

/** Día en que una tarea importada aparece por primera vez en la lista (para agrupar la vista previa). */
export function firstVisibleDay(task: Pick<ImportedTask, "planned_date" | "due_date" | "lead_days">, today: IsoDate): IsoDate {
  if (task.due_date) return addDays(task.due_date, -(task.lead_days ?? 0));
  return task.planned_date ?? today;
}
