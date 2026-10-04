"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSessionUser } from "@/components/providers";
import type { LinkedTaskFields, TaskSync } from "@/lib/domain/calendar";
import { nextSortOrder } from "@/lib/domain/tasks";
import type { CalendarEventRow, TaskRow, Update } from "@/lib/supabase/types";
import { deleteRows, insertRows, newId, nowIso, patchById, removeByIds, updateRow, useRows, useWrite } from "./table";
import { buildTaskRow } from "./tasks";

export function useCalendarEvents() {
  return useRows("calendar_events", "date");
}

export type EventInput = Pick<CalendarEventRow, "category" | "subject_id" | "title" | "date" | "lead_days">;

/** Qué hacer con la tarea de un TP al guardar el evento (lo decide taskSyncFor). */
export type TaskPlan = { sync: TaskSync; fields: LinkedTaskFields };

export function useCalendarMutations() {
  const write = useWrite();
  const user = useSessionUser();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const cachedTasks = () => queryClient.getQueryData<TaskRow[]>(["tasks"]) ?? [];
    const linkedTask = (eventId: string) => cachedTasks().find((task) => task.source_calendar_event_id === eventId);
    const newTask = (eventId: string, fields: LinkedTaskFields) =>
      buildTaskRow(user.id, { ...fields, source_calendar_event_id: eventId }, nextSortOrder(cachedTasks()));

    return {
      linkedTask,

      /** Crea el evento y, si es un TP, su tarea vinculada. */
      create(input: EventInput, plan: TaskPlan): CalendarEventRow {
        const now = nowIso();
        const row: CalendarEventRow = {
          id: newId(),
          user_id: user.id,
          ...input,
          // Un recuperatorio nace tentativo; el resto no usa este campo.
          confirmed: input.category !== "recuperatorio",
          created_at: now,
          updated_at: now,
        };
        const task = plan.sync === "create" ? newTask(row.id, plan.fields) : null;
        void write(
          {
            calendar_events: (rows) => [...rows, row],
            ...(task ? { tasks: (rows: TaskRow[]) => [...rows, task] } : {}),
          },
          async () => {
            await insertRows("calendar_events", [row]);
            if (task) await insertRows("tasks", [task]);
          },
        );
        return row;
      },

      /** Guarda cambios del evento y mantiene en línea su tarea (crear, actualizar o borrar). */
      update(id: string, input: EventInput, plan: TaskPlan) {
        const existing = linkedTask(id);
        const created = plan.sync === "create" ? newTask(id, plan.fields) : null;
        void write(
          {
            calendar_events: (rows) => patchById(rows, id, input),
            tasks: (rows) => {
              if (created) return [...rows, created];
              if (plan.sync === "update" && existing) return patchById(rows, existing.id, plan.fields);
              if (plan.sync === "delete" && existing) return removeByIds(rows, [existing.id]);
              return rows;
            },
          },
          async () => {
            await updateRow("calendar_events", id, input as Update<"calendar_events">);
            if (created) await insertRows("tasks", [created]);
            else if (plan.sync === "update" && existing) await updateRow("tasks", existing.id, plan.fields);
            else if (plan.sync === "delete" && existing) await deleteRows("tasks", [existing.id]);
          },
          { alsoInvalidate: plan.sync === "delete" ? ["subtasks"] : undefined },
        );
      },

      /** Crea la tarea de un TP que se había quedado sin ella. */
      createTask(eventId: string, fields: LinkedTaskFields) {
        const task = newTask(eventId, fields);
        void write({ tasks: (rows) => [...rows, task] }, () => insertRows("tasks", [task]));
      },

      /** Un clic en un recuperatorio alterna tentativo ↔ confirmado. */
      setConfirmed(id: string, confirmed: boolean) {
        void write({ calendar_events: (rows) => patchById(rows, id, { confirmed }) }, () =>
          updateRow("calendar_events", id, { confirmed }),
        );
      },

      /** Borra el evento. La base borra en cascada su tarea vinculada. */
      remove(id: string) {
        void write(
          {
            calendar_events: (rows) => removeByIds(rows, [id]),
            tasks: (rows) => rows.filter((task) => task.source_calendar_event_id !== id),
          },
          () => deleteRows("calendar_events", [id]),
          { alsoInvalidate: ["subtasks"] },
        );
      },
    };
  }, [write, user.id, queryClient]);
}
