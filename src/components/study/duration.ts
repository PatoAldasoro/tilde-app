"use client";

import { useTranslations } from "next-intl";
import { durationParts } from "@/lib/format";

/** Duración legible a partir de segundos: "45 min", "2 h" o "1 h 20 min". */
export function useDuration() {
  const t = useTranslations();
  return (seconds: number): string => {
    const { hours, minutes } = durationParts(seconds / 60);
    if (hours === 0) return t("min_short", { n: minutes });
    return minutes === 0 ? t("h_short", { h: hours }) : t("h_min_short", { h: hours, m: minutes });
  };
}
