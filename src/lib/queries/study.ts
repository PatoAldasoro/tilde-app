"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSessionUser } from "@/components/providers";
import type { PresetKey, SessionSummary } from "@/lib/domain/timer";
import type { StudySessionRow, StudySessionTaskRow } from "@/lib/supabase/types";
import { deleteRows, insertRows, newId, nowIso, patchById, removeByIds, updateRow, useRows, useWrite } from "./table";

export const useStudySessions = () => useRows("study_sessions", "started_at");
export const useStudySessionTasks = () => useRows("study_session_tasks");

/** Una tarea anotada en una sesión: enlazada a una tarea real (`id`) o solo su título. */
export type SessionTaskInput = { id: string | null; title: string };

/** Lo que se puede cargar o corregir a mano de una sesión. */
export type SessionInput = {
  subject_id: string | null;
  preset: PresetKey;
  started_at: string;
  focus_seconds: number;
  break_seconds: number;
  cycles_completed: number;
  subtasks_completed: number;
  away_count: number;
  tasks: SessionTaskInput[];
};

const endOf = (input: Pick<SessionInput, "started_at" | "focus_seconds" | "break_seconds">) =>
  new Date(Date.parse(input.started_at) + (input.focus_seconds + input.break_seconds) * 1000).toISOString();

export function useStudyMutations() {
  const write = useWrite();
  const user = useSessionUser();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const cachedLinks = () => queryClient.getQueryData<StudySessionTaskRow[]>(["study_session_tasks"]) ?? [];
    const linkRows = (sessionId: string, tasks: SessionTaskInput[], createdAt: string): StudySessionTaskRow[] =>
      tasks.map((task) => ({ id: newId(), user_id: user.id, session_id: sessionId, task_id: task.id, title: task.title, created_at: createdAt }));

    return {
      /** Guarda la sesión del timer con sus tiempos reales y lo que se tildó entre el inicio y el fin. */
      save(summary: SessionSummary, completedTasks: { id: string; title: string }[], subtasksCompleted: number): Promise<boolean> {
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
          subtasks_completed: subtasksCompleted,
          away_count: summary.awayCount ?? 0,
          away_seconds: summary.awaySeconds ?? 0,
          created_at: now,
        };
        const links = linkRows(session.id, completedTasks, now);
        return write(
          { study_sessions: (rows) => [...rows, session], study_session_tasks: (rows) => [...rows, ...links] },
          async () => {
            await insertRows("study_sessions", [session]);
            await insertRows("study_session_tasks", links);
          },
        );
      },

      /** Anota a mano una sesión que se hizo sin el timer. */
      add(input: SessionInput): StudySessionRow {
        const now = nowIso();
        const { tasks, ...fields } = input;
        const session: StudySessionRow = { id: newId(), user_id: user.id, ...fields, ended_at: endOf(input), away_seconds: 0, created_at: now };
        const links = linkRows(session.id, tasks, now);
        void write(
          { study_sessions: (rows) => [...rows, session], study_session_tasks: (rows) => [...rows, ...links] },
          async () => {
            await insertRows("study_sessions", [session]);
            await insertRows("study_session_tasks", links);
          },
        );
        return session;
      },

      /** Corrige una sesión guardada: sus datos y la lista de tareas (se reemplaza entera). */
      update(id: string, input: SessionInput) {
        const { tasks, ...fields } = input;
        const patch = { ...fields, ended_at: endOf(input) };
        const oldIds = cachedLinks().filter((link) => link.session_id === id).map((link) => link.id);
        const links = linkRows(id, tasks, nowIso());
        void write(
          {
            study_sessions: (rows) => patchById(rows, id, patch),
            study_session_tasks: (rows) => [...removeByIds(rows, oldIds), ...links],
          },
          async () => {
            await updateRow("study_sessions", id, patch);
            await deleteRows("study_session_tasks", oldIds);
            await insertRows("study_session_tasks", links);
          },
        );
      },

      /** Borra una sesión (la base se lleva sus tareas anotadas). Devuelve lo borrado para poder deshacer. */
      remove(id: string): { session: StudySessionRow | undefined; links: StudySessionTaskRow[] } {
        const session = (queryClient.getQueryData<StudySessionRow[]>(["study_sessions"]) ?? []).find((row) => row.id === id);
        const links = cachedLinks().filter((link) => link.session_id === id);
        void write(
          { study_sessions: (rows) => removeByIds(rows, [id]), study_session_tasks: (rows) => rows.filter((link) => link.session_id !== id) },
          () => deleteRows("study_sessions", [id]),
        );
        return { session, links };
      },

      restore(deleted: { session: StudySessionRow | undefined; links: StudySessionTaskRow[] }) {
        const { session, links } = deleted;
        if (!session) return;
        void write(
          { study_sessions: (rows) => [...rows, session], study_session_tasks: (rows) => [...rows, ...links] },
          async () => {
            await insertRows("study_sessions", [session]);
            await insertRows("study_session_tasks", links);
          },
        );
      },
    };
  }, [write, user.id, queryClient]);
}
