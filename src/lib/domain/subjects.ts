/** Paleta cerrada de materias (DESIGN.md §3.2), en el orden del selector. */
export const SUBJECT_COLORS = [
  "frambuesa",
  "mandarina",
  "ambar",
  "lima",
  "pino",
  "turquesa",
  "cielo",
  "cobalto",
  "uva",
  "fucsia",
  "cacao",
  "grafito",
] as const;

export type ColorKey = (typeof SUBJECT_COLORS)[number];

export function isColorKey(value: unknown): value is ColorKey {
  return typeof value === "string" && (SUBJECT_COLORS as readonly string[]).includes(value);
}

/** Clase CSS que expone --s-solid, --s-vivid, --s-soft… para un color de la paleta. */
export function subjectClass(colorKey: string | null | undefined): string {
  return `subj-${isColorKey(colorKey) ? colorKey : "grafito"}`;
}

/** Primer color de la paleta que no usa ninguna materia activa (o el primero si están todos en uso). */
export function firstFreeColor(usedByActive: readonly string[]): ColorKey {
  return SUBJECT_COLORS.find((color) => !usedByActive.includes(color)) ?? SUBJECT_COLORS[0];
}

/** Períodos del cuatrimestre: 1 = 1C, 2 = 2C, 0 = anual, 3 = verano. */
export const TERM_PERIODS = [1, 2, 0, 3] as const;
export type TermPeriod = (typeof TERM_PERIODS)[number];

type Archivable = { archived_at: string | null };

export const isArchived = (subject: Archivable): boolean => subject.archived_at !== null;

export function activeSubjects<S extends Archivable>(subjects: S[]): S[] {
  return subjects.filter((subject) => !isArchived(subject));
}

export function archivedSubjects<S extends Archivable>(subjects: S[]): S[] {
  return subjects.filter(isArchived);
}
