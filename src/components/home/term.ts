"use client";

import { useTranslations } from "next-intl";
import type { TermPeriod } from "@/lib/domain/subjects";

type Term = { term_period: number | null; term_year: number | null };

const PERIOD_KEY = { 0: "term_p0", 1: "term_p1", 2: "term_p2", 3: "term_p3" } as const;

/** Texto del cuatrimestre: "2C 2026" (o "T2 2026" en inglés). Vacío si no se cargó. */
export function useTermLabel() {
  const t = useTranslations();
  return (subject: Term): string => {
    const period = subject.term_period;
    const periodLabel = period !== null && period in PERIOD_KEY ? t(PERIOD_KEY[period as TermPeriod]) : "";
    return [periodLabel, subject.term_year ?? ""].filter(Boolean).join(" ");
  };
}

/** Cuatrimestre sugerido al crear una materia: 1C hasta julio, 2C desde agosto. */
export function suggestedTerm(today: string): { period: TermPeriod; year: number } {
  const [year, month] = today.split("-").map(Number);
  return { period: month <= 7 ? 1 : 2, year };
}
