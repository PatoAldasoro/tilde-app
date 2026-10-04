"use client";

import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CalendarCategory, DayItem } from "@/lib/domain/calendar";
import { formatDayMonth, weekdayOf } from "@/lib/domain/dates";
import { subjectClass } from "@/lib/domain/subjects";
import type { CalendarEventRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useEventLabel, useHolidayName } from "./labels";

export type ChipActions = {
  onEdit: (event: CalendarEventRow) => void;
  onDelete: (event: CalendarEventRow) => void;
  onToggleConfirmed: (event: CalendarEventRow) => void;
  onSeeTask: () => void;
  onCreateTask: (event: CalendarEventRow) => void;
  /** Días de anticipación de la tarea vinculada al evento, o null si no tiene tarea. */
  linkedLeadDays: (event: CalendarEventRow) => number | null;
};

type SubjectInfo = { name: string; color_key: string };

type ItemChipProps = {
  item: DayItem;
  subjects: Map<string, SubjectInfo>;
  actions: ChipActions;
  /** En la lista del día el chip no abre su propio popover (ya hay un lápiz al lado). */
  plain?: boolean;
};

/** Chip del calendario. El color viene de la materia; la categoría se distingue por borde y opacidad. */
export function ItemChip({ item, subjects, actions, plain }: ItemChipProps) {
  const t = useTranslations();
  const holidayName = useHolidayName();
  const eventLabel = useEventLabel();
  const [open, setOpen] = useState(false);

  if (item.kind === "holiday") {
    const name = holidayName(item.holiday);
    const label = t("event_label", { label: name, category: t("holiday_national") });
    if (plain) {
      return (
        <span className="ev cat-feriado" title={name}>
          <span className="ev-label">{name}</span>
        </span>
      );
    }
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="ev cat-feriado" aria-label={label} title={name}>
            <span className="ev-label">{name}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="popover-pad">
          <div className="badge mb-2">{t("cat_feriado")}</div>
          <div className="font-semibold">{name}</div>
          <div className="field-hint mt-1">{t("holiday_preset_note")}</div>
        </PopoverContent>
      </Popover>
    );
  }

  const event = item.event as CalendarEventRow;
  const category = event.category as CalendarCategory;
  const subject = event.subject_id ? subjects.get(event.subject_id) : undefined;
  const color = category === "feriado" ? "" : subjectClass(subject?.color_key);
  const label = eventLabel(event, subject?.name);
  const categoryName = t(`cat_${category}`);

  // Recuperatorio: el chip es un interruptor (tentativo ↔ confirmado) y el lápiz, siempre visible, edita.
  if (category === "recuperatorio") {
    const state = event.confirmed ? t("recup_confirmed") : t("recup_tentative");
    return (
      <div className={cn("ev-wrap", color)}>
        <button
          type="button"
          className={cn("ev cat-recuperatorio", event.confirmed && "is-confirmed")}
          aria-pressed={event.confirmed}
          aria-label={t("recup_state_label", { label, category: categoryName, state, hint: t("recup_toggle_hint") })}
          title={label}
          onClick={() => actions.onToggleConfirmed(event)}
        >
          <span className="ev-label">{label}</span>
        </button>
        <button type="button" className="ev-edit-abs" aria-label={t("edit_named", { name: label })} onClick={() => actions.onEdit(event)}>
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  const className = cn("ev", `cat-${category}`, color);
  if (plain) {
    return (
      <span className={className} title={label}>
        <span className="ev-label">{label}</span>
      </span>
    );
  }

  const leadDays = actions.linkedLeadDays(event);
  const weekday = t("wd_long").split(",")[weekdayOf(event.date) - 1];
  const close = (run: () => void) => () => {
    setOpen(false);
    run();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={className} aria-label={t("event_label", { label, category: categoryName })} title={label}>
          <span className="ev-label">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className={cn("block-pop-head", color || "subj-grafito")}>
          <span className="sw" />
          <div className="min-w-0">
            <div className="t">{label}</div>
            <div className="m">
              {categoryName} · {weekday} {formatDayMonth(event.date)}
            </div>
            {leadDays !== null ? (
              <div className="m mt-1.5 flex items-center gap-1">
                <ListChecks size={13} className="flex-none" />
                {t("linked_task", { n: leadDays })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="menu-sep" />
        <button type="button" className="menu-item" onClick={close(() => actions.onEdit(event))}>
          <Pencil size={18} />
          <span>{t("edit")}</span>
        </button>
        {category === "tp" ? (
          <button
            type="button"
            className="menu-item"
            onClick={close(() => (leadDays !== null ? actions.onSeeTask() : actions.onCreateTask(event)))}
          >
            <ListChecks size={18} />
            <span>{leadDays !== null ? t("see_in_tasks") : t("create_task_for_tp")}</span>
          </button>
        ) : null}
        <button type="button" className="menu-item danger" onClick={close(() => actions.onDelete(event))}>
          <Trash2 size={18} />
          <span>{t("delete")}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
