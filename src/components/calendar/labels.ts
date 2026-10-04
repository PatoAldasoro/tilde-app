"use client";

import { useTranslations } from "next-intl";
import type { CalendarCategory } from "@/lib/domain/calendar";
import type { Holiday } from "@/lib/domain/holidays";

/** Nombre de un feriado nacional en el idioma activo (o el original si no se reconoce). */
export function useHolidayName() {
  const t = useTranslations();
  return (holiday: Holiday): string => (holiday.key ? t(`holiday_${holiday.key}`) : holiday.name);
}

type Labeled = { title: string; category: string };

/** Texto de un evento: su título o, si no tiene, "Categoría · Materia". */
export function useEventLabel() {
  const t = useTranslations();
  return (event: Labeled, subjectName: string | null | undefined): string => {
    if (event.title.trim()) return event.title;
    const category = t(`cat_${event.category as CalendarCategory}`);
    return subjectName && event.category !== "feriado" ? `${category} · ${subjectName}` : category;
  };
}
