"use client";

import { useMemo } from "react";
import { useProfile } from "@/components/providers";
import { dateInTimeZone } from "@/lib/domain/dates";
import type { Priority, Task } from "@/lib/domain/types";
import type { SubtaskRow, TaskRow } from "@/lib/supabase/types";
import { useRows } from "./table";

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
