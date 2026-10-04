"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { addDays, addMonths, dateParts, formatFullDate, monthMatrix, type IsoDate } from "@/lib/domain/dates";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type DateFieldProps = {
  value: IsoDate | null;
  onChange: (value: IsoDate | null) => void;
  today: IsoDate;
  id?: string;
  /** Permite dejar el campo sin fecha ("Quitar fecha"). */
  clearable?: boolean;
  placeholder?: string;
  min?: IsoDate;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Selector de fecha propio: siempre muestra DD/MM/AAAA y la semana desde el lunes,
 * sin depender del formato del sistema operativo (como sí lo hace <input type="date">).
 */
export function DateField({ value, onChange, today, id, clearable, placeholder, min, disabled, className, ...props }: DateFieldProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn("input date-field", !value && "is-empty", className)}
          aria-label={props["aria-label"]}
        >
          <span>{value ? formatFullDate(value) : (placeholder ?? t("no_date"))}</span>
          <Calendar size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="mini-cal">
        <MiniCalendar
          value={value}
          today={today}
          min={min}
          clearable={clearable}
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type MiniCalendarProps = {
  value: IsoDate | null;
  today: IsoDate;
  min?: IsoDate;
  clearable?: boolean;
  onPick: (value: IsoDate | null) => void;
};

function MiniCalendar({ value, today, min, clearable, onPick }: MiniCalendarProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [focused, setFocused] = useState<IsoDate>(value ?? today);
  const moveFocus = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const { year, month } = dateParts(focused);
  const weeks = monthMatrix(year, month);
  const months = t("months").split(",");
  const letters = t("wd_letter").split(",");
  const names = t("wd_long").split(",");
  const title = `${months[month - 1]} ${year}`;

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused]);

  function shiftMonth(delta: number) {
    const target = addMonths(year, month, delta);
    setFocused(`${target.year}-${String(target.month).padStart(2, "0")}-01`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: IsoDate | null = null;
    if (event.key in steps) next = addDays(focused, steps[event.key]);
    else if (event.key === "PageUp" || event.key === "PageDown") {
      const target = addMonths(year, month, event.key === "PageUp" ? -1 : 1);
      const day = Math.min(dateParts(focused).day, 28);
      next = `${target.year}-${String(target.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    if (!next) return;
    event.preventDefault();
    moveFocus.current = true;
    setFocused(next);
  }

  return (
    <>
      <div className="mini-cal-head">
        <span className="mini-cal-title" aria-live="polite">
          {title}
        </span>
        <button type="button" className="btn btn-ghost btn-icon" aria-label={t("prev_month")} onClick={() => shiftMonth(-1)}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" aria-label={t("next_month")} onClick={() => shiftMonth(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mini-cal-grid" aria-hidden="true">
        {letters.map((letter, index) => (
          <span key={names[index]} className="mini-cal-wd">
            {letter}
          </span>
        ))}
      </div>
      <div className="mini-cal-grid" role="group" aria-label={t("calendar_of", { month: title })} ref={grid} onKeyDown={onKeyDown}>
        {weeks.flat().map((day) => {
          const parts = dateParts(day);
          return (
            <button
              key={day}
              type="button"
              data-date={day}
              className={cn("mini-day", parts.month !== month && "is-out")}
              aria-label={formatLongDate(day, locale)}
              aria-pressed={day === value}
              aria-current={day === today ? "date" : undefined}
              tabIndex={day === focused ? 0 : -1}
              disabled={min !== undefined && day < min}
              autoFocus={day === focused}
              onClick={() => onPick(day)}
            >
              {parts.day}
            </button>
          );
        })}
      </div>
      <div className="mini-cal-foot">
        <button type="button" className="btn btn-ghost btn-sm" disabled={min !== undefined && today < min} onClick={() => onPick(today)}>
          {t("today")}
        </button>
        {clearable && value ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick(null)}>
            {t("clear_date")}
          </button>
        ) : null}
      </div>
    </>
  );
}
