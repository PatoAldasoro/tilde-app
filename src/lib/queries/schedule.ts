"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSessionUser } from "@/components/providers";
import type { IsoDate } from "@/lib/domain/dates";
import type { ScheduleBlockRow, ScheduleEventRow, ScheduleExceptionRow, Update } from "@/lib/supabase/types";
import { deleteRows, insertRows, newId, nowIso, patchById, removeByIds, updateRow, useRows, useWrite } from "./table";

export const useScheduleBlocks = () => useRows("schedule_blocks");
export const useScheduleEvents = () => useRows("schedule_events");
export const useScheduleExceptions = () => useRows("schedule_exceptions");

export type BlockInput = Pick<ScheduleBlockRow, "subject_id" | "weekday" | "start_time" | "end_time" | "room">;
export type ActivityInput = Pick<
  ScheduleEventRow,
  "title" | "color_key" | "icon" | "start_time" | "end_time" | "recurrence" | "weekdays" | "date" | "start_date" | "until_date"
>;
type ExceptionTarget = { type: "block" | "event"; id: string; date: IsoDate };

export function useScheduleMutations() {
  const write = useWrite();
  const user = useSessionUser();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const cachedExceptions = () => queryClient.getQueryData<ScheduleExceptionRow[]>(["schedule_exceptions"]) ?? [];
    const findException = (target: ExceptionTarget) =>
      cachedExceptions().find((row) => row.target_type === target.type && row.target_id === target.id && row.date === target.date);

    return {
      /** Una materia puede sumar varios horarios de una vez. */
      addBlocks(inputs: BlockInput[]) {
        const base = Date.now();
        const rows: ScheduleBlockRow[] = inputs.map((input, index) => ({
          id: newId(),
          user_id: user.id,
          created_at: new Date(base + index).toISOString(),
          ...input,
        }));
        void write({ schedule_blocks: (current) => [...current, ...rows] }, () => insertRows("schedule_blocks", rows));
      },
      updateBlock(id: string, input: BlockInput) {
        void write({ schedule_blocks: (rows) => patchById(rows, id, input) }, () =>
          updateRow("schedule_blocks", id, input as Update<"schedule_blocks">),
        );
      },
      removeBlock(id: string) {
        void write(
          {
            schedule_blocks: (rows) => removeByIds(rows, [id]),
            schedule_exceptions: (rows) => rows.filter((row) => !(row.target_type === "block" && row.target_id === id)),
          },
          () => deleteRows("schedule_blocks", [id]),
        );
      },

      addActivity(input: ActivityInput) {
        const row: ScheduleEventRow = { id: newId(), user_id: user.id, created_at: nowIso(), ...input };
        void write({ schedule_events: (rows) => [...rows, row] }, () => insertRows("schedule_events", [row]));
      },
      updateActivity(id: string, input: ActivityInput) {
        void write({ schedule_events: (rows) => patchById(rows, id, input) }, () =>
          updateRow("schedule_events", id, input as Update<"schedule_events">),
        );
      },
      removeActivity(id: string) {
        void write(
          {
            schedule_events: (rows) => removeByIds(rows, [id]),
            schedule_exceptions: (rows) => rows.filter((row) => !(row.target_type === "event" && row.target_id === id)),
          },
          () => deleteRows("schedule_events", [id]),
        );
      },

      /**
       * Fija la excepción de una ocurrencia: "skip" la omite, "keep" indica que hubo clase aunque
       * sea feriado y null la quita (vuelve al comportamiento normal).
       */
      setException(target: ExceptionTarget, kind: "skip" | "keep" | null) {
        const existing = findException(target);
        if (kind === null) {
          if (!existing) return;
          void write({ schedule_exceptions: (rows) => removeByIds(rows, [existing.id]) }, () =>
            deleteRows("schedule_exceptions", [existing.id]),
          );
          return;
        }
        if (existing) {
          if (existing.kind === kind) return;
          void write({ schedule_exceptions: (rows) => patchById(rows, existing.id, { kind }) }, () =>
            updateRow("schedule_exceptions", existing.id, { kind }),
          );
          return;
        }
        const row: ScheduleExceptionRow = {
          id: newId(),
          user_id: user.id,
          target_type: target.type,
          target_id: target.id,
          date: target.date,
          kind,
          created_at: nowIso(),
        };
        void write({ schedule_exceptions: (rows) => [...rows, row] }, () => insertRows("schedule_exceptions", [row]));
      },
    };
  }, [write, user.id, queryClient]);
}
