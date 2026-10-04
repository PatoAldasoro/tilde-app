/** Historial de sesiones de estudio: totales por semana (lunes a domingo) y por materia. */
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
