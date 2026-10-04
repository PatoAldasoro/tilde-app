"use client";

import { useMemo } from "react";
import { useSessionUser } from "@/components/providers";
import type { SessionSummary } from "@/lib/domain/timer";
import type { StudySessionRow, StudySessionTaskRow } from "@/lib/supabase/types";
import { insertRows, newId, nowIso, useRows, useWrite } from "./table";

export const useStudySessions = () => useRows("study_sessions", "started_at");
export const useStudySessionTasks = () => useRows("study_session_tasks");

export function useStudyMutations() {
  const write = useWrite();
  const user = useSessionUser();

  return useMemo(
    () => ({
      /** Guarda la sesión con sus tiempos reales y las tareas tildadas entre el inicio y el fin. */
      save(summary: SessionSummary, completedTasks: { id: string; title: string }[]): Promise<boolean> {
        const now = nowIso();
        const session: StudySessionRow = {
          id: newId(),
          user_id: user.id,
          subject_id: summary.subjectId,
          preset: summary.preset,
          started_at: new Date(summary.startedAt).toISOString(),
          ended_at: new Date(summary.endedAt).toISOString(),
          focus_seconds: summary.focusSeconds,
          break_seconds: summary.breakSeconds,
          cycles_completed: summary.cyclesCompleted,
          created_at: now,
        };
        const links: StudySessionTaskRow[] = completedTasks.map((task) => ({
          id: newId(),
          user_id: user.id,
          session_id: session.id,
          task_id: task.id,
          title: task.title,
          created_at: now,
        }));
        return write(
          { study_sessions: (rows) => [...rows, session], study_session_tasks: (rows) => [...rows, ...links] },
          async () => {
            await insertRows("study_sessions", [session]);
            await insertRows("study_session_tasks", links);
          },
        );
      },
    }),
    [write, user.id],
  );
}
