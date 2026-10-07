/** Historial de sesiones de estudio: totales por semana (lunes a domingo) y por materia, y la carga a mano. */
import { z } from "zod";
import { addDays, dateInTimeZone, startOfWeek, type IsoDate } from "./dates";

export type StudySession = {
  subject_id: string | null;
  started_at: string;
  focus_seconds: number;
};

export type WeekTotal = { weekStart: IsoDate; focusSeconds: number };

/**
 * Foco por semana de las últimas `weeks` semanas, de la más vieja a la actual.
 * Cada sesión cuenta en la semana del día (en la zona del usuario) en que empezó.
 */
export function weeklyFocus(sessions: readonly StudySession[], today: IsoDate, timeZone: string, weeks = 8): WeekTotal[] {
  const current = startOfWeek(today);
  const totals: WeekTotal[] = Array.from({ length: weeks }, (_, index) => ({
    weekStart: addDays(current, (index - (weeks - 1)) * 7),
    focusSeconds: 0,
  }));
  const byWeek = new Map(totals.map((week) => [week.weekStart, week]));
  for (const session of sessions) {
    const week = byWeek.get(startOfWeek(dateInTimeZone(session.started_at, timeZone)));
    if (week) week.focusSeconds += session.focus_seconds;
  }
  return totals;
}

export type SubjectTotal = { subjectId: string | null; focusSeconds: number };

/** Foco total por materia (null = sin materia), de mayor a menor. */
export function focusBySubject(sessions: readonly StudySession[]): SubjectTotal[] {
  const totals = new Map<string | null, number>();
  for (const session of sessions) {
    totals.set(session.subject_id, (totals.get(session.subject_id) ?? 0) + session.focus_seconds);
  }
  return [...totals.entries()]
    .map(([subjectId, focusSeconds]) => ({ subjectId, focusSeconds }))
    .sort((a, b) => b.focusSeconds - a.focusSeconds);
}

export function totalFocus(sessions: readonly StudySession[]): number {
  return sessions.reduce((sum, session) => sum + session.focus_seconds, 0);
}

// ---------- anotar o corregir una sesión a mano ----------

/** Una tarea anotada en una sesión: enlazada a una tarea real (`id`) o solo su título. */
export type SessionTaskDraft = { id: string | null; title: string };

/**
 * Lo que se puede escribir en el formulario de una sesión. El foco va de 1 minuto a 24 horas:
 * una sesión sin foco no es una sesión.
 */
export const sessionFormSchema = z.object({
  focusMinutes: z.number().int().min(1).max(24 * 60),
  breakMinutes: z.number().int().min(0).max(12 * 60),
  cycles: z.number().int().min(0).max(99),
  subtasks: z.number().int().min(0).max(999),
  aways: z.number().int().min(0).max(999),
});

/** Las sesiones de la más nueva a la más vieja (como se listan en el historial). */
export function newestFirst<S extends { started_at: string }>(sessions: readonly S[]): S[] {
  return [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at));
}
