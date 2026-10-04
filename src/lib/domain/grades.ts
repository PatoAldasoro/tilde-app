/**
 * Notas: escala de 0 a 10 con decimales.
 * - Promedio de la materia = (cursada + final) / 2, solo si existen ambas; si falta una es null.
 * - Promedio simple = media de los promedios de materia no nulos.
 * - Promedio ponderado = Σ(promedio × créditos) / Σ(créditos), solo con materias que tengan
 *   promedio y créditos mayores a 0.
 */
import { isArchived } from "./subjects";

export const GRADE_MIN = 0;
export const GRADE_MAX = 10;

export type Graded = {
  grade_course: number | null;
  grade_final: number | null;
  credits: number | null;
  archived_at: string | null;
};

export type GradeParse = { ok: true; value: number | null } | { ok: false };

/** Lee una nota escrita por el usuario. Acepta coma o punto y hasta 2 decimales; vacío = sin nota. */
export function parseGrade(text: string): GradeParse {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d{1,2}([.,]\d{1,2})?$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < GRADE_MIN || value > GRADE_MAX) return { ok: false };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

export function subjectAverage(subject: Pick<Graded, "grade_course" | "grade_final">): number | null {
  if (subject.grade_course === null || subject.grade_final === null) return null;
  return (subject.grade_course + subject.grade_final) / 2;
}

export type Averages = {
  simple: number | null;
  weighted: number | null;
  /** Cantidad de materias con promedio (las que entran en el promedio simple). */
  counted: number;
};

export function averages(subjects: readonly Graded[]): Averages {
  const withAverage = subjects
    .map((subject) => ({ average: subjectAverage(subject), credits: subject.credits ?? 0 }))
    .filter((entry): entry is { average: number; credits: number } => entry.average !== null);
  if (withAverage.length === 0) return { simple: null, weighted: null, counted: 0 };

  const simple = withAverage.reduce((sum, entry) => sum + entry.average, 0) / withAverage.length;
  const withCredits = withAverage.filter((entry) => entry.credits > 0);
  const totalCredits = withCredits.reduce((sum, entry) => sum + entry.credits, 0);
  const weighted =
    totalCredits > 0 ? withCredits.reduce((sum, entry) => sum + entry.average * entry.credits, 0) / totalCredits : null;
  return { simple, weighted, counted: withAverage.length };
}

/** Los dos alcances: cuatrimestre actual (no archivadas) y general (todas). */
export function gradeScopes(subjects: readonly Graded[]): { current: Averages; overall: Averages } {
  return { current: averages(subjects.filter((subject) => !isArchived(subject))), overall: averages(subjects) };
}
