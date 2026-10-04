/**
 * Tipos del dominio. Son las filas de la base tal como llegan (snake_case) más lo que
 * la UI necesita ya resuelto: las subtareas dentro de su tarea y el día en que se completó.
 */
import type { IsoDate } from "./dates";
import type { SubtaskRow, TaskRow } from "@/lib/supabase/types";

export type Priority = "none" | "low" | "medium" | "high";

export type Subtask = SubtaskRow;

export type Task = Omit<TaskRow, "priority"> & {
  priority: Priority;
  /** Subtareas ordenadas por sort_order. */
  subtasks: Subtask[];
  /** Día (en la zona del usuario) en que se completó; null si está pendiente. */
  completed_on: IsoDate | null;
};
