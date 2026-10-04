"use client";

import { useTranslations } from "next-intl";
import { TERM_PERIODS } from "@/lib/domain/subjects";

type TermFieldsProps = {
  idPrefix: string;
  period: string;
  year: string;
  onPeriodChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onYearBlur?: () => void;
  yearInvalid?: boolean;
};

/** Cuatrimestre = período (1C, 2C, anual, verano) + año. */
export function TermFields({ idPrefix, period, year, onPeriodChange, onYearChange, onYearBlur, yearInvalid }: TermFieldsProps) {
  const t = useTranslations();
  return (
    <div className="flex gap-2">
      <select
        id={`${idPrefix}-period`}
        className="select"
        aria-label={t("term_period")}
        value={period}
        onChange={(event) => onPeriodChange(event.target.value)}
      >
        <option value="">{t("term_none")}</option>
        {TERM_PERIODS.map((value) => (
          <option key={value} value={value}>
            {t(`term_p${value}`)}
          </option>
        ))}
      </select>
      <input
        id={`${idPrefix}-year`}
        className={`input tnum w-24 flex-none ${yearInvalid ? "is-invalid" : ""}`}
        aria-label={t("term_year")}
        aria-invalid={yearInvalid || undefined}
        inputMode="numeric"
        placeholder="2026"
        maxLength={4}
        value={year}
        onChange={(event) => onYearChange(event.target.value.replace(/\D/g, ""))}
        onBlur={onYearBlur}
      />
    </div>
  );
}
