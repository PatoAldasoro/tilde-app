/**
 * Reglas de las tareas.
 *
 * - Tarea diaria (sin due_date): vive en planned_date. Si no se completó, se "arrastra": se ve
 *   también en hoy con "de ayer" / "hace N días". El arrastre solo afecta a la vista de hoy:
 *   no reescribe planned_date.
 * - Tarea con fecha límite (due_date + lead_days): aparece todos los días desde
 *   due_date − lead_days hasta due_date, y después como "Vencida" (en hoy) si sigue pendiente.
 *   Deja de aparecer los días posteriores al que se completó.
 * - Una tarea completada se ve, en gris y al fondo, el día en que se completó.
 */
import { addDays, diffDays, type IsoDate } from "./dates";
import type { Priority, Subtask, Task } from "./types";

export type DayTask = {
  task: Task;
  /** Días de arrastre: 0 si la tarea es de ese día; N si viene de N días atrás (solo en hoy). */
  carriedDays: number;
};

export const isDaily = (task: Pick<Task, "due_date">): boolean => task.due_date === null;
export const isCompleted = (task: Pick<Task, "completed_at">): boolean => task.completed_at !== null;

/** Primer día en que una tarea con fecha límite aparece en la lista. */
export function windowStart(task: Pick<Task, "due_date" | "lead_days">): IsoDate | null {
  return task.due_date ? addDays(task.due_date, -(task.lead_days ?? 0)) : null;
}

/** ¿Se ve la tarea en `day`? Devuelve los días de arrastre, o null si no se ve. */
export function visibilityOn(task: Task, day: IsoDate, today: IsoDate): { carriedDays: number } | null {
  const visible = { carriedDays: 0 };
  const completedOn = task.completed_at ? task.completed_on : null;

  if (task.due_date === null) {
    const planned = task.planned_date;
    if (planned === null) return null;
    if (completedOn) {
      if (day === completedOn) return visible;
      // Completada después de su día: ese día pasado la sigue mostrando (no se reescribe).
      return day === planned && planned < completedOn ? visible : null;
    }
    if (day === planned) return visible;
    if (day === today && planned < today) return { carriedDays: diffDays(planned, today) };
    return null;
  }

  const start = windowStart(task)!;
  if (completedOn) {
    if (day === completedOn) return visible;
    return day >= start && day < completedOn ? visible : null;
  }
  if (day >= start && day <= task.due_date) return visible;
  // Vencida y pendiente: se sigue viendo en hoy.
  if (day === today && task.due_date < today) return visible;
  return null;
}

const byOrder = (a: Task, b: Task) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/**
 * Las tareas visibles en `day`, en el orden en que se muestran: pendientes por sort_order
 * y completadas al fondo.
 */
export function tasksForDay(tasks: readonly Task[], day: IsoDate, today: IsoDate): DayTask[] {
  const result: DayTask[] = [];
  for (const task of tasks) {
    const visibility = visibilityOn(task, day, today);
    if (visibility) result.push({ task, carriedDays: visibility.carriedDays });
  }
  return result.sort((a, b) => Number(isCompleted(a.task)) - Number(isCompleted(b.task)) || byOrder(a.task, b.task));
}

/** Los días que muestra cada filtro de fecha. */
export function daysInRange(range: "today" | "week" | "date", today: IsoDate, pickedDate: IsoDate | null): IsoDate[] {
  if (range === "today") return [today];
  if (range === "date") return [pickedDate ?? today];
  return Array.from({ length: 7 }, (_, index) => addDays(today, index));
}

// ---------- fecha límite ----------

export type DueStatus =
  | { kind: "done"; dueDate: IsoDate }
  | { kind: "overdue" }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "upcoming"; days: number; soon: boolean };

/** Etiqueta de la fecha límite, relativa a hoy. "Pronto" = faltan 3 días o menos. */
export function dueStatus(task: Pick<Task, "due_date" | "completed_at">, today: IsoDate): DueStatus | null {
  if (!task.due_date) return null;
  if (task.completed_at) return { kind: "done", dueDate: task.due_date };
  const days = diffDays(today, task.due_date);
  if (days < 0) return { kind: "overdue" };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  return { kind: "upcoming", days, soon: days <= 3 };
}

// ---------- completar ----------

export function pendingSubtasks(task: Pick<Task, "subtasks">): number {
  return task.subtasks.filter((subtask) => subtask.completed_at === null).length;
}

/** Una tarea con subtareas solo se puede completar cuando todas están completas. */
export function canComplete(task: Pick<Task, "subtasks">): boolean {
  return pendingSubtasks(task) === 0;
}

/**
 * Marca o desmarca la tarea. Devuelve el nuevo completed_at, o "blocked" si tiene
 * subtareas pendientes.
 */
export function toggleTask(task: Pick<Task, "completed_at" | "subtasks">, now: string): { completed_at: string | null } | "blocked" {
  if (task.completed_at) return { completed_at: null };
  if (!canComplete(task)) return "blocked";
  return { completed_at: now };
}

export type SubtaskToggle = {
  subtask: { completed_at: string | null };
  /** Presente solo si la tarea principal cambia de estado. */
  task?: { completed_at: string | null };
};

/**
 * Marca o desmarca una subtarea. Al completar la última, la tarea se completa sola;
 * al desmarcar cualquiera, la tarea principal vuelve a pendiente.
 */
export function toggleSubtask(task: Pick<Task, "completed_at" | "subtasks">, subtaskId: string, now: string): SubtaskToggle | null {
  const subtask = task.subtasks.find((item) => item.id === subtaskId);
  if (!subtask) return null;
  if (subtask.completed_at) {
    return { subtask: { completed_at: null }, ...(task.completed_at ? { task: { completed_at: null } } : {}) };
  }
  const othersDone = task.subtasks.every((item) => item.id === subtaskId || item.completed_at !== null);
  return { subtask: { completed_at: now }, ...(othersDone && !task.completed_at ? { task: { completed_at: now } } : {}) };
}

// ---------- orden ----------

export type OrderPatch = { id: string; sort_order: number };
type Orderable = { id: string; sort_order: number };

/**
 * Fija el orden de un día. Recibe las tareas en el orden deseado y reparte entre ellas los
 * mismos valores de sort_order que ya tenían (ordenados), así su posición respecto de las
 * tareas de otros días no cambia. Devuelve solo las que cambian.
 */
export function orderPatches(desired: readonly Orderable[]): OrderPatch[] {
  const pool = desired.map((task) => task.sort_order).sort((a, b) => a - b);
  // Con valores repetidos no hay forma de expresar el orden: se espacian.
  for (let index = 1; index < pool.length; index += 1) {
    if (pool[index] <= pool[index - 1]) pool[index] = pool[index - 1] + 1;
  }
  return desired
    .map((task, index) => ({ id: task.id, sort_order: pool[index] }))
    .filter((patch, index) => patch.sort_order !== desired[index].sort_order);
}

/** Mueve un elemento a `toIndex` dentro de la lista (o lo inserta si no estaba). */
export function moveItem<T extends { id: string }>(list: readonly T[], item: T, toIndex: number): T[] {
  const without = list.filter((entry) => entry.id !== item.id);
  const index = Math.max(0, Math.min(toIndex, without.length));
  return [...without.slice(0, index), item, ...without.slice(index)];
}

const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1, none: 0 };

/** "Ordenar por prioridad": acción puntual que reordena las pendientes (alta primero). */
export function priorityOrderPatches(tasks: readonly Task[]): OrderPatch[] {
  const pending = tasks.filter((task) => !isCompleted(task));
  const sorted = [...pending].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || byOrder(a, b));
  return orderPatches(sorted);
}

/** sort_order para una tarea nueva: al final. */
export function nextSortOrder(tasks: readonly Orderable[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.sort_order), 0) + 1;
}

export function nextSubtaskOrder(subtasks: readonly Subtask[]): number {
  return subtasks.reduce((max, subtask) => Math.max(max, subtask.sort_order), 0) + 1;
}

// ---------- mover entre días ----------

/**
 * Solo las tareas diarias se mueven entre días (cambia planned_date). Las de fecha límite
 * se reordenan únicamente dentro del día en el que están.
 */
export function canDropOnDay(task: Pick<Task, "due_date">, fromDay: IsoDate, toDay: IsoDate): boolean {
  return fromDay === toDay || isDaily(task);
}
