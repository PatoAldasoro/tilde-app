"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { useProfile, useToday } from "@/components/providers";
import { PageFrame } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LoadError } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { CALENDAR_CATEGORIES, itemsByDate, linkedTaskFields, splitChips, type DayItem } from "@/lib/domain/calendar";
import { addMonths, dateParts, formatDayMonth, monthMatrix, weekdayOf, type IsoDate } from "@/lib/domain/dates";
import { yearsAround } from "@/lib/domain/holidays";
import { useCalendarEvents, useCalendarMutations } from "@/lib/queries/calendar";
import { useHolidays } from "@/lib/queries/holidays";
import { useSubjects } from "@/lib/queries/subjects";
import { useTasks } from "@/lib/queries/tasks";
import type { CalendarEventRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { ItemChip, type ChipActions } from "./event-chip";
import { EventFormDialog, type EventFormTarget } from "./event-form-dialog";
import { useEventLabel, useHolidayName } from "./labels";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Calendario: vista mensual (lunes primero) con parciales, finales, TP, recuperatorios y feriados. */
export function CalendarView() {
  const t = useTranslations();
  const today = useToday();
  const router = useRouter();
  const defaultLead = useProfile().default_task_lead_days;
  const eventsQuery = useCalendarEvents();
  const subjectsQuery = useSubjects();
  const tasksQuery = useTasks();
  const mutations = useCalendarMutations();
  const eventLabel = useEventLabel();

  const [shown, setShown] = useState<{ year: number; month: number } | null>(null);
  const [form, setForm] = useState<EventFormTarget | null>(null);
  const current = dateParts(today);
  const { year, month } = shown ?? current;
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const holidays = useHolidays(yearsAround(weeks[0][0], weeks[weeks.length - 1][6]));

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const byDate = useMemo(() => itemsByDate(events, holidays), [events, holidays]);
  const linkedLead = useMemo(
    () => new Map((tasksQuery.data ?? []).filter((task) => task.source_calendar_event_id).map((task) => [task.source_calendar_event_id!, task.lead_days ?? 0])),
    [tasksQuery.data],
  );

  const months = t("months").split(",");
  const weekdayShort = t("wd_short").split(",");
  const weekdayLong = t("wd_long").split(",");
  const title = `${months[month - 1]} ${year}`;
  const isCurrentMonth = year === current.year && month === current.month;
  const shift = (delta: number) => setShown(addMonths(year, month, delta));

  async function remove(event: CalendarEventRow) {
    const name = eventLabel(event, event.subject_id ? subjectMap.get(event.subject_id)?.name : null);
    const ok = await confirm({
      title: t("delete_date_q", { name }),
      body: event.category === "tp" ? t("delete_tp_body") : t("delete_date_body"),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!ok) return;
    mutations.remove(event.id);
    setForm(null);
    toast(t("date_deleted"));
  }

  const actions: ChipActions = {
    onEdit: (event) => setForm({ event }),
    onDelete: (event) => void remove(event),
    onToggleConfirmed: (event) => {
      mutations.setConfirmed(event.id, !event.confirmed);
      toast(event.confirmed ? t("recup_paused_toast") : t("recup_confirmed_toast"));
    },
    onSeeTask: () => router.push("/app/todo"),
    onCreateTask: (event) => {
      const subjectName = event.subject_id ? (subjectMap.get(event.subject_id)?.name ?? null) : null;
      mutations.createTask(event.id, linkedTaskFields(event, t("cat_tp"), subjectName, defaultLead));
      toast(t("tp_task_created"));
    },
    linkedLeadDays: (event) => linkedLead.get(event.id) ?? null,
  };

  return (
    <PageFrame
      title={t("nav_calendar")}
      width="wide"
      actions={
        <Button variant="primary" onClick={() => setForm({ date: today })}>
          <CalendarPlus size={18} />
          {t("add_date")}
        </Button>
      }
    >
      <div className="cal-head">
        <Button icon aria-label={t("prev_month")} onClick={() => shift(-1)}>
          <ChevronLeft size={20} />
        </Button>
        <Button icon aria-label={t("next_month")} onClick={() => shift(1)}>
          <ChevronRight size={20} />
        </Button>
        <h2 className="cal-month" aria-live="polite">
          {title}
        </h2>
        <Button disabled={isCurrentMonth} onClick={() => setShown(null)}>
          {t("today")}
        </Button>
        <div className="cal-legend" role="group" aria-label={t("legend")}>
          {CALENDAR_CATEGORIES.map((category) => (
            <span className="k" key={category}>
              <span className={cn("ev subj-grafito", `cat-${category}`)} aria-hidden="true" />
              {t(`cat_${category}`)}
              {category === "recuperatorio" ? <span className="subtle">({t("tentative")})</span> : null}
            </span>
          ))}
        </div>
      </div>

      {eventsQuery.isError ? <LoadError onRetry={() => void eventsQuery.refetch()} /> : null}
      {eventsQuery.isSuccess && events.length === 0 ? (
        <div className="archived-banner">
          <CalendarPlus size={18} className="flex-none" />
          <span>{t("cal_empty")}</span>
        </div>
      ) : null}

      <div className="cal" role="grid" aria-label={title} aria-busy={eventsQuery.isPending}>
        <div className="cal-wd" role="rowgroup">
          <div className="cal-row" role="row">
            {WEEKDAYS.map((weekday) => (
              <div role="columnheader" key={weekday} aria-label={weekdayLong[weekday - 1]}>
                {weekdayShort[weekday - 1]}
              </div>
            ))}
          </div>
        </div>
        <div className="cal-grid" role="rowgroup">
          {weeks.map((week) => (
            <div className="cal-row" role="row" key={week[0]}>
              {week.map((day) => {
                const items = byDate.get(day) ?? [];
                const { shown: chips, more } = splitChips(items);
                const weekday = weekdayOf(day);
                const longDay = `${weekdayLong[weekday - 1]} ${formatDayMonth(day)}`;
                return (
                  <div
                    key={day}
                    role="gridcell"
                    className={cn(
                      "cal-cell",
                      dateParts(day).month !== month && "is-out",
                      day === today && "is-today",
                      weekday >= 6 && "is-weekend",
                    )}
                    aria-label={
                      items.length > 0
                        ? t("day_dates_count", { weekday: weekdayLong[weekday - 1], date: formatDayMonth(day), count: t("events_count", { n: items.length }) })
                        : longDay
                    }
                  >
                    <div className="cal-cell-top">
                      <DayPopover day={day} items={items} subjects={subjectMap} actions={actions} onAdd={() => setForm({ date: day })}>
                        <button
                          type="button"
                          className="cal-dn tnum"
                          aria-label={t("open_day", { date: longDay })}
                          aria-current={day === today ? "date" : undefined}
                        >
                          {dateParts(day).day}
                        </button>
                      </DayPopover>
                      <button
                        type="button"
                        className="cal-add"
                        aria-label={t("add_on", { date: formatDayMonth(day) })}
                        onClick={() => setForm({ date: day })}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {chips.map((item) => (
                      <ItemChip
                        key={item.kind === "holiday" ? `h-${item.holiday.date}` : item.event.id}
                        item={item}
                        subjects={subjectMap}
                        actions={actions}
                      />
                    ))}
                    {more > 0 ? (
                      <DayPopover day={day} items={items} subjects={subjectMap} actions={actions} onAdd={() => setForm({ date: day })}>
                        <button type="button" className="cal-more">
                          {t("n_more", { n: more })}
                        </button>
                      </DayPopover>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <EventFormDialog target={form} subjects={subjects} onClose={() => setForm(null)} onDelete={(event) => void remove(event)} />
    </PageFrame>
  );
}

type DayPopoverProps = {
  day: IsoDate;
  items: DayItem[];
  subjects: Map<string, { name: string; color_key: string }>;
  actions: ChipActions;
  onAdd: () => void;
  children: ReactNode;
};

/** Lista completa de un día (se abre desde el número del día o desde "+N más"). */
function DayPopover({ day, items, subjects, actions, onAdd, children }: DayPopoverProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const eventLabel = useEventLabel();
  const holidayName = useHolidayName();
  const weekday = t("wd_long").split(",")[weekdayOf(day) - 1];
  const close = (run: () => void) => () => {
    setOpen(false);
    run();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent>
        <div className="day-list">
          <div className="day-list-head">
            <div className="t">{t("day_dates", { weekday, date: formatDayMonth(day) })}</div>
            <div className="field-hint">{t("events_count", { n: items.length })}</div>
          </div>
          {items.length === 0 ? <p className="field-hint px-2">{t("no_dates")}</p> : null}
          {items.map((item) => {
            const event = item.kind === "event" ? (item.event as CalendarEventRow) : null;
            const name = event
              ? eventLabel(event, event.subject_id ? subjects.get(event.subject_id)?.name : null)
              : holidayName((item as Extract<DayItem, { kind: "holiday" }>).holiday);
            return (
              <div className="day-list-row" key={event ? event.id : `h-${day}`}>
                <div className="min-w-0 flex-1">
                  <ItemChip
                    item={item}
                    subjects={subjects}
                    plain
                    actions={{ ...actions, onEdit: (target) => close(() => actions.onEdit(target))() }}
                  />
                </div>
                {event && event.category !== "recuperatorio" ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label={t("edit_named", { name })}
                    onClick={close(() => actions.onEdit(event))}
                  >
                    <Pencil size={16} />
                  </button>
                ) : null}
              </div>
            );
          })}
          <div className="menu-sep" />
          <button type="button" className="menu-item" onClick={close(onAdd)}>
            <Plus size={18} />
            <span>{t("add_date")}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
