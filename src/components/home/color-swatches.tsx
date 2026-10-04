"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { SUBJECT_COLORS, type ColorKey } from "@/lib/domain/subjects";

type ColorSwatchesProps = { value: string; onChange: (color: ColorKey) => void; labelledBy?: string };

/** Selector de color de la paleta cerrada (6 × 2). Flechas para moverse, como un radiogroup. */
export function ColorSwatches({ value, onChange, labelledBy }: ColorSwatchesProps) {
  const t = useTranslations();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 };
    const step = moves[event.key];
    if (!step) return;
    event.preventDefault();
    const index = SUBJECT_COLORS.indexOf(value as ColorKey);
    const next = (Math.max(index, 0) + step + SUBJECT_COLORS.length) % SUBJECT_COLORS.length;
    onChange(SUBJECT_COLORS[next]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div className="swatches" role="radiogroup" aria-label={labelledBy ? undefined : t("color")} aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {SUBJECT_COLORS.map((color) => {
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            className={`swatch subj-${color}`}
            aria-checked={selected}
            aria-label={t(`color_${color}`)}
            data-tip={t(`color_${color}`)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(color)}
          >
            {selected ? <Check size={16} strokeWidth={2.5} /> : null}
          </button>
        );
      })}
    </div>
  );
}
