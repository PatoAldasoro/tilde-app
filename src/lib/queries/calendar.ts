"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSessionUser } from "@/components/providers";
import type { IcalError } from "@/app/api/ical/route";
import type { LinkedTaskFields, TaskSync } from "@/lib/domain/calendar";
import type { IsoDate } from "@/lib/domain/dates";
import { nextSortOrder } from "@/lib/domain/tasks";
import type { CalendarEventRow, CalendarFeedRow, TaskRow, Update } from "@/lib/supabase/types";
import { deleteRows, insertRows, newId, nowIso, patchById, removeByIds, updateRow, useRows, useWrite } from "./table";
import { buildTaskRow } from "./tasks";

export function useCalendarEvents() {
  return useRows("calendar_events", "date");
}

export function useCalendarFeeds() {
  return useRows("calendar_feeds");
}

/** Descarga un calendario vinculado a través del servidor (ver /api/ical). Lanza el código del error. */
export async function fetchFeedIcs(url: string): Promise<string> {
  const response = await fetch("/api/ical", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
  const body = (await response.json().catch(() => null)) as { ics?: string; error?: IcalError } | null;
  if (!response.ok || typeof body?.ics !== "string") throw new Error(body?.error ?? "unreachable");
  return body.ics;
}

export type EventInput = Pick<CalendarEventRow, "category" | "subject_id" | "title" | "date" | "start_time" | "lead_days">;

/** Una fecha que viene de otro calendario, con la tarea que le corresponde si es un TP. */
export type ImportedEvent = {
  event: EventInput & Pick<CalendarEventRow, "external_id" | "feed_id">;
  task: LinkedTaskFields | null;
};

/** Una fecha ya importada que cambió de día u hora en su origen. */
export type MovedEvent = { id: string; date: IsoDate; start_time: string | null };

/** Qué hacer con la tarea de un TP al guardar el evento (lo decide taskSyncFor). */
export type TaskPlan = { sync: TaskSync; fields: LinkedTaskFields };

export function useCalendarMutations() {
  const write = useWrite();
  const user = useSessionUser();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const cachedTasks = () => queryClient.getQueryData<TaskRow[]>(["tasks"]) ?? [];
    const cachedEvents = () => queryClient.getQueryData<CalendarEventRow[]>(["calendar_events"]) ?? [];
    const cachedFeeds = () => queryClient.getQueryData<CalendarFeedRow[]>(["calendar_feeds"]) ?? [];
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
          external_id: null,
          feed_id: null,
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

      /**
       * Borra eventos. La base borra en cascada sus tareas vinculadas. Si venían de un calendario
       * vinculado quedan anotados como omitidos, para que la próxima sincronización no los proponga.
       */
      remove(ids: string[]) {
        const idSet = new Set(ids);
        const removed = cachedEvents().filter((event) => idSet.has(event.id));
        const skippedByFeed = new Map<string, string[]>();
        for (const event of removed) {
          if (!event.feed_id || !event.external_id) continue;
          skippedByFeed.set(event.feed_id, [...(skippedByFeed.get(event.feed_id) ?? []), event.external_id]);
        }
        const feedPatches = cachedFeeds()
          .filter((feed) => skippedByFeed.has(feed.id))
          .map((feed) => ({ id: feed.id, skipped: [...new Set([...feed.skipped, ...skippedByFeed.get(feed.id)!])] }));
        void write(
          {
            calendar_events: (rows) => removeByIds(rows, ids),
            tasks: (rows) => rows.filter((task) => !task.source_calendar_event_id || !idSet.has(task.source_calendar_event_id)),
            ...(feedPatches.length > 0
              ? { calendar_feeds: (rows: CalendarFeedRow[]) => feedPatches.reduce((list, patch) => patchById(list, patch.id, { skipped: patch.skipped }), rows) }
              : {}),
          },
          async () => {
            await deleteRows("calendar_events", ids);
            for (const patch of feedPatches) await updateRow("calendar_feeds", patch.id, { skipped: patch.skipped });
          },
          { alsoInvalidate: ["subtasks"] },
        );
      },

      /**
       * Importa fechas de otro calendario: crea las nuevas (y la tarea de cada TP) y mueve las que
       * cambiaron de día u hora. Devuelve los ids creados, para poder deshacer.
       */
      importEvents(imported: ImportedEvent[], moved: MovedEvent[]): string[] {
        const now = nowIso();
        const firstOrder = nextSortOrder(cachedTasks());
        const events: CalendarEventRow[] = [];
        const tasks: TaskRow[] = [];
        for (const { event, task } of imported) {
          const row: CalendarEventRow = {
            id: newId(),
            user_id: user.id,
            ...event,
            confirmed: event.category !== "recuperatorio",
            created_at: now,
            updated_at: now,
          };
          events.push(row);
          if (task) tasks.push(buildTaskRow(user.id, { ...task, source_calendar_event_id: row.id }, firstOrder + tasks.length));
        }
        // La tarea de un TP sigue a su fecha.
        const movedTasks = moved.flatMap((move) => {
          const task = linkedTask(move.id);
          return task ? [{ id: task.id, due_date: move.date }] : [];
        });
        void write(
          {
            calendar_events: (rows) => [...moved.reduce((list, move) => patchById(list, move.id, { date: move.date, start_time: move.start_time }), rows), ...events],
            tasks: (rows) => [...movedTasks.reduce((list, move) => patchById(list, move.id, { due_date: move.due_date }), rows), ...tasks],
          },
          async () => {
            await insertRows("calendar_events", events);
            await insertRows("tasks", tasks);
            for (const move of moved) await updateRow("calendar_events", move.id, { date: move.date, start_time: move.start_time });
            for (const move of movedTasks) await updateRow("tasks", move.id, { due_date: move.due_date });
          },
        );
        return events.map((event) => event.id);
      },

      /** Vincula un calendario por su dirección .ics. */
      addFeed(name: string, url: string): CalendarFeedRow {
        const row: CalendarFeedRow = { id: newId(), user_id: user.id, name, url, skipped: [], last_synced_at: null, created_at: nowIso() };
        void write({ calendar_feeds: (rows) => [...rows, row] }, () => insertRows("calendar_feeds", [row]));
        return row;
      },

      /** Anota una sincronización: cuándo fue y qué eventos quedaron omitidos. */
      markFeedSynced(id: string, skipped: string[]) {
        const patch = { skipped, last_synced_at: nowIso() };
        void write({ calendar_feeds: (rows) => patchById(rows, id, patch) }, () => updateRow("calendar_feeds", id, patch));
      },

      /** Desvincula un calendario. Sus fechas quedan, salvo que se pida quitarlas también. */
      removeFeed(id: string, withEvents: boolean) {
        const eventIds = withEvents ? cachedEvents().filter((event) => event.feed_id === id).map((event) => event.id) : [];
        const eventSet = new Set(eventIds);
        void write(
          {
            calendar_feeds: (rows) => removeByIds(rows, [id]),
            calendar_events: (rows) => (withEvents ? removeByIds(rows, eventIds) : rows.map((row) => (row.feed_id === id ? { ...row, feed_id: null } : row))),
            tasks: (rows) => rows.filter((task) => !task.source_calendar_event_id || !eventSet.has(task.source_calendar_event_id)),
          },
          async () => {
            await deleteRows("calendar_events", eventIds);
            await deleteRows("calendar_feeds", [id]);
          },
          { alsoInvalidate: ["subtasks"] },
        );
      },
    };
  }, [write, user.id, queryClient]);
}
