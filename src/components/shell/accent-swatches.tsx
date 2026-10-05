"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import type { Accent } from "@/lib/accent";
import { SUBJECT_COLORS } from "@/lib/domain/subjects";

const COLUMNS = 7;
/** El acento original primero; después, la paleta de materias en su orden. */
const OPTIONS: Accent[] = [null, ...SUBJECT_COLORS];

type AccentSwatchesProps = { value: Accent; onChange: (accent: Accent) => void; labelledBy: string };

/** Selector del color de acento (radiogroup de 7 × 2; flechas para moverse). */
export function AccentSwatches({ value, onChange, labelledBy }: AccentSwatchesProps) {
  const t = useTranslations();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };
    const step = moves[event.key];
    if (!step) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(OPTIONS.length - 1, OPTIONS.indexOf(value) + step));
    onChange(OPTIONS[next]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div className="swatches is-accent" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {OPTIONS.map((accent) => {
        const selected = accent === value;
        const name = accent ? t(`color_${accent}`) : t("accent_default");
        return (
          <button
            key={accent ?? "default"}
            type="button"
            role="radio"
            className={`swatch ${accent ? `subj-${accent}` : "accent-default"}`}
            aria-checked={selected}
            aria-label={name}
            data-tip={name}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(accent)}
          >
            {selected ? <Check size={16} strokeWidth={2.5} /> : null}
          </button>
        );
      })}
    </div>
  );
}
