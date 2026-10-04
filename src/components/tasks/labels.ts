"use client";

import { useTranslations } from "next-intl";
import { diffDays, weekdayOf, type IsoDate } from "@/lib/domain/dates";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Nombre de un día relativo a hoy: "Hoy", "Mañana", "Ayer" o el día de la semana. */
export function useDayLabel(today: IsoDate) {
  const t = useTranslations();
  return (day: IsoDate, options?: { lowercase?: boolean }): string => {
    const diff = diffDays(today, day);
    const label =
      diff === 0 ? t("today") : diff === 1 ? t("tomorrow") : diff === -1 ? t("yesterday") : t("wd_long").split(",")[weekdayOf(day) - 1];
    return options?.lowercase ? label.toLowerCase() : capitalize(label);
  };
}
