/**
 * Progreso por unidades: una tarea sin subtareas cuenta como 1; una tarea con subtareas
 * cuenta por sus subtareas (la principal no se suma aparte). Sin unidades, el progreso es 100 %.
 */
type UnitSource = {
  completed_at: string | null;
  subtasks: { completed_at: string | null }[];
};

export type Progress = {
  /** 0–100, entero. Solo llega a 100 cuando están todas las unidades (o no hay ninguna). */
  percent: number;
  done: number;
  total: number;
};

export function taskUnits(task: UnitSource): { done: number; total: number } {
  if (task.subtasks.length === 0) return { done: task.completed_at ? 1 : 0, total: 1 };
  return { done: task.subtasks.filter((subtask) => subtask.completed_at).length, total: task.subtasks.length };
}

export function progressOf(tasks: readonly UnitSource[]): Progress {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    const units = taskUnits(task);
    done += units.done;
    total += units.total;
  }
  if (total === 0) return { percent: 100, done: 0, total: 0 };
  const percent = done === total ? 100 : Math.min(99, Math.round((done / total) * 100));
  return { percent, done, total };
}

/** Progreso de una materia: todas sus tareas, de cualquier fecha. */
export function subjectProgress<T extends UnitSource & { subject_id: string | null }>(tasks: readonly T[], subjectId: string): Progress {
  return progressOf(tasks.filter((task) => task.subject_id === subjectId));
}

/** Tareas (no unidades) completadas y totales: para el texto "2 de 5 tareas completadas". */
export function taskCounts(tasks: readonly { completed_at: string | null }[]): { done: number; total: number } {
  return { done: tasks.filter((task) => task.completed_at).length, total: tasks.length };
}
