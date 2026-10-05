"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useProfile, useSessionUser } from "@/components/providers";
import { dateInTimeZone, type IsoDate } from "@/lib/domain/dates";
import { nextSortOrder, nextSubtaskOrder, toggleSubtask, toggleTask, type OrderPatch } from "@/lib/domain/tasks";
import type { Priority, Task } from "@/lib/domain/types";
import { getSupabase } from "@/lib/supabase/client";
import type { SubtaskRow, TaskRow, Update } from "@/lib/supabase/types";
import { deleteRows, insertRows, newId, nowIso, patchById, removeByIds, updateRow, useRows, useWrite } from "./table";

/** Arma las tareas del dominio: subtareas dentro de cada tarea y día de completado en la zona del usuario. */
export function assembleTasks(tasks: TaskRow[], subtasks: SubtaskRow[], timeZone: string): Task[] {
  const byTask = new Map<string, SubtaskRow[]>();
  for (const subtask of subtasks) {
    const list = byTask.get(subtask.task_id);
    if (list) list.push(subtask);
    else byTask.set(subtask.task_id, [subtask]);
  }
  return tasks.map((task) => ({
    ...task,
    priority: task.priority as Priority,
    subtasks: (byTask.get(task.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    completed_on: task.completed_at ? dateInTimeZone(task.completed_at, timeZone) : null,
  }));
}

/** Todas las tareas del usuario, con sus subtareas. */
export function useTasks() {
  const tasks = useRows("tasks", "sort_order");
  const subtasks = useRows("subtasks", "sort_order");
  const timeZone = useProfile().timezone;
  const data = useMemo(
    () => (tasks.data && subtasks.data ? assembleTasks(tasks.data, subtasks.data, timeZone) : undefined),
    [tasks.data, subtasks.data, timeZone],
  );
  return {
    data,
    isPending: tasks.isPending || subtasks.isPending,
    isError: tasks.isError || subtasks.isError,
    refetch: () => {
      void tasks.refetch();
      void subtasks.refetch();
    },
  };
}

export type NewTask = {
  title: string;
  subject_id?: string | null;
  priority?: Priority;
  planned_date?: IsoDate | null;
  due_date?: IsoDate | null;
  lead_days?: number | null;
  source_calendar_event_id?: string | null;
};

export type DeletedTasks = { tasks: TaskRow[]; subtasks: SubtaskRow[] };

async function setTaskOrder(patches: OrderPatch[]) {
  if (patches.length === 0) return;
  const { error } = await getSupabase().rpc("set_task_order", {
    task_ids: patches.map((patch) => patch.id),
    sort_orders: patches.map((patch) => patch.sort_order),
  });
  if (error) throw new Error(error.message);
}

const applyOrder = (rows: TaskRow[], patches: OrderPatch[]): TaskRow[] => {
  const orders = new Map(patches.map((patch) => [patch.id, patch.sort_order]));
  return rows.map((row) => (orders.has(row.id) ? { ...row, sort_order: orders.get(row.id)! } : row));
};

/** Construye la fila de una tarea nueva (también la usa el Calendario para las tareas de los TP). */
export function buildTaskRow(userId: string, input: NewTask, sortOrder: number): TaskRow {
  const now = nowIso();
  return {
    id: newId(),
    user_id: userId,
    subject_id: input.subject_id ?? null,
    title: input.title,
    priority: input.priority ?? "none",
    planned_date: input.planned_date ?? null,
    due_date: input.due_date ?? null,
    lead_days: input.due_date ? (input.lead_days ?? 0) : null,
    sort_order: sortOrder,
    completed_at: null,
    source_calendar_event_id: input.source_calendar_event_id ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function useTaskMutations() {
  const write = useWrite();
  const user = useSessionUser();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const cachedTasks = () => queryClient.getQueryData<TaskRow[]>(["tasks"]) ?? [];
    const cachedSubtasks = () => queryClient.getQueryData<SubtaskRow[]>(["subtasks"]) ?? [];

    return {
      create(input: NewTask): TaskRow {
        const row = buildTaskRow(user.id, input, nextSortOrder(cachedTasks()));
        void write({ tasks: (rows) => [...rows, row] }, () => insertRows("tasks", [row]));
        return row;
      },

      /** Crea varias tareas de una vez (importación), al final de la lista, con sus subtareas. Devuelve sus ids. */
      createMany(inputs: (NewTask & { subtasks?: string[] })[]): string[] {
        const firstOrder = nextSortOrder(cachedTasks());
        const stamp = Date.now();
        // created_at escalonado: conserva el orden del archivo ante un sort_order igual.
        const tasks = inputs.map((input, index) => ({
          ...buildTaskRow(user.id, input, firstOrder + index),
          created_at: new Date(stamp + index).toISOString(),
        }));
        const subtasks: SubtaskRow[] = inputs.flatMap((input, index) =>
          (input.subtasks ?? []).map((title, position) => ({
            id: newId(),
            user_id: user.id,
            task_id: tasks[index].id,
            title,
            sort_order: position + 1,
            completed_at: null,
            created_at: new Date(stamp + position).toISOString(),
          })),
        );
        void write(
          { tasks: (rows) => [...rows, ...tasks], subtasks: (rows) => [...rows, ...subtasks] },
          async () => {
            await insertRows("tasks", tasks);
            await insertRows("subtasks", subtasks);
          },
        );
        return tasks.map((task) => task.id);
      },

      update(id: string, patch: Update<"tasks">) {
        void write({ tasks: (rows) => patchById(rows, id, patch as Partial<TaskRow>) }, () => updateRow("tasks", id, patch));
      },

      /** Aplica un orden nuevo y, si la tarea cambió de día, su planned_date. */
      reorder(patches: OrderPatch[], move?: { id: string; planned_date: IsoDate }) {
        if (patches.length === 0 && !move) return;
        void write(
          {
            tasks: (rows) => {
              const ordered = applyOrder(rows, patches);
              return move ? patchById(ordered, move.id, { planned_date: move.planned_date }) : ordered;
            },
          },
          async () => {
            await Promise.all([
              setTaskOrder(patches),
              move ? updateRow("tasks", move.id, { planned_date: move.planned_date }) : Promise.resolve(),
            ]);
          },
        );
      },

      /** Marca o desmarca. Devuelve false si está bloqueada por subtareas pendientes. */
      toggle(task: Task): boolean {
        const result = toggleTask(task, nowIso());
        if (result === "blocked") return false;
        void write({ tasks: (rows) => patchById(rows, task.id, result) }, () => updateRow("tasks", task.id, result));
        return true;
      },

      toggleSubtask(task: Task, subtaskId: string) {
        const result = toggleSubtask(task, subtaskId, nowIso());
        if (!result) return;
        const taskPatch = result.task;
        void write(
          {
            subtasks: (rows) => patchById(rows, subtaskId, result.subtask),
            ...(taskPatch ? { tasks: (rows: TaskRow[]) => patchById(rows, task.id, taskPatch) } : {}),
          },
          async () => {
            await Promise.all([
              updateRow("subtasks", subtaskId, result.subtask),
              taskPatch ? updateRow("tasks", task.id, taskPatch) : Promise.resolve(),
            ]);
          },
        );
      },

      /** Agrega una subtarea. Si la tarea estaba completada, vuelve a pendiente. */
      addSubtask(task: Task, title: string) {
        const row: SubtaskRow = {
          id: newId(),
          user_id: user.id,
          task_id: task.id,
          title,
          sort_order: nextSubtaskOrder(task.subtasks),
          completed_at: null,
          created_at: nowIso(),
        };
        const reopen = task.completed_at !== null;
        void write(
          {
            subtasks: (rows) => [...rows, row],
            ...(reopen ? { tasks: (rows: TaskRow[]) => patchById(rows, task.id, { completed_at: null }) } : {}),
          },
          async () => {
            await insertRows("subtasks", [row]);
            if (reopen) await updateRow("tasks", task.id, { completed_at: null });
          },
        );
      },

      removeSubtask(id: string) {
        void write({ subtasks: (rows) => removeByIds(rows, [id]) }, () => deleteRows("subtasks", [id]));
      },

      /** Borra tareas (y sus subtareas, en cascada). Devuelve lo borrado para poder deshacer. */
      remove(ids: string[]): DeletedTasks {
        const idSet = new Set(ids);
        const deleted: DeletedTasks = {
          tasks: cachedTasks().filter((row) => idSet.has(row.id)),
          subtasks: cachedSubtasks().filter((row) => idSet.has(row.task_id)),
        };
        void write(
          { tasks: (rows) => removeByIds(rows, ids), subtasks: (rows) => rows.filter((row) => !idSet.has(row.task_id)) },
          () => deleteRows("tasks", ids),
          { alsoInvalidate: ["study_session_tasks"] },
        );
        return deleted;
      },

      /** Deshace un borrado: vuelve a insertar las mismas filas. */
      restore(deleted: DeletedTasks) {
        void write(
          { tasks: (rows) => [...rows, ...deleted.tasks], subtasks: (rows) => [...rows, ...deleted.subtasks] },
          async () => {
            await insertRows("tasks", deleted.tasks);
            await insertRows("subtasks", deleted.subtasks);
          },
        );
      },
    };
  }, [write, user.id, queryClient]);
}
