"use client";

import { CalendarClock, CalendarDays, CalendarOff, CalendarX2, ChevronLeft, ChevronRight, ImageDown, MapPin, Pencil, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useHolidayName } from "@/components/calendar/labels";
import { useNowMinutes, useProfile, useToday, useUpdateProfile } from "@/components/providers";
import { PageFrame } from "@/components/shell/app-shell";
import { SubjectIcon, SubjectTile } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LoadError } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast";
import { holidayNames } from "@/lib/domain/calendar";
import { addDays, dateParts, formatDayMonth, startOfWeek, type IsoDate, type Weekday } from "@/lib/domain/dates";
import { yearsAround } from "@/lib/domain/holidays";
import {
  blocksOfActiveSubjects,
  GRID_END,
  GRID_START,
  GRID_STEP,
  gridPosition,
  occurrencesForWeek,
  typicalWeek,
  type Occurrence,
  type ScheduleEvent,
} from "@/lib/domain/schedule";
import { subjectClass, type SubjectBadge } from "@/lib/domain/subjects";
import { minutesToTime } from "@/lib/domain/time";
import { useCalendarEvents } from "@/lib/queries/calendar";
import { useHolidays } from "@/lib/queries/holidays";
import { useScheduleBlocks, useScheduleEvents, useScheduleExceptions, useScheduleMutations } from "@/lib/queries/schedule";
import { useSubjects } from "@/lib/queries/subjects";
import type { ScheduleBlockRow, ScheduleEventRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { ScheduleFormDialog, type ScheduleFormTarget } from "./schedule-form-dialog";
import { WallpaperDialog } from "./wallpaper-dialog";

/** Alto de un slot de 30 minutos, igual a --schedule-slot-height. */
const SLOT_PX = 26;
const ALL_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const SLOTS = Array.from({ length: (GRID_END - GRID_START) / GRID_STEP }, (_, index) => GRID_START + index * GRID_STEP);
const HOURS = Array.from({ length: (GRID_END - GRID_START) / 60 }, (_, index) => GRID_START + index * 60);


/** Horario: grilla semanal de 07:00 a 23:00 con clases, actividades, excepciones y feriados. */
export function ScheduleView() {
  const t = useTranslations();
  const today = useToday();
  const nowMinutes = useNowMinutes();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const holidayName = useHolidayName();
  const mutations = useScheduleMutations();

  const blocksQuery = useScheduleBlocks();
  const eventsQuery = useScheduleEvents();
  const exceptionsQuery = useScheduleExceptions();
  const subjectsQuery = useSubjects();
  const calendarQuery = useCalendarEvents();

  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState<ScheduleFormTarget | null>(null);
  const [exporting, setExporting] = useState(false);
  const weekStart = useMemo(() => addDays(startOfWeek(today), weekOffset * 7), [today, weekOffset]);
  const weekEnd = addDays(weekStart, 6);
  const years = useMemo(() => yearsAround(weekStart, addDays(weekStart, 6)), [weekStart]);
  const nationalHolidays = useHolidays(years);

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const subjectMap = useMemo(() => new Map<string, SubjectBadge>(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const blocks = useMemo(() => blocksOfActiveSubjects(blocksQuery.data ?? [], subjects), [blocksQuery.data, subjects]);
  const activities = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  // Feriados: los nacionales más los manuales cargados en el Calendario.
  const holidayByDate = useMemo(() => holidayNames(calendarQuery.data ?? [], nationalHolidays), [calendarQuery.data, nationalHolidays]);
  const byDate = useMemo(() => {
    const all = occurrencesForWeek(weekStart, blocks, activities, exceptionsQuery.data ?? [], holidayByDate.keys());
    const map = new Map<IsoDate, Occurrence[]>();
    for (const occurrence of all) {
      const list = map.get(occurrence.date);
      if (list) list.push(occurrence);
      else map.set(occurrence.date, [occurrence]);
    }
    return map;
  }, [weekStart, blocks, activities, exceptionsQuery.data, holidayByDate]);

  // Lo que se exporta como fondo de pantalla: la semana tipo, sin fechas ni excepciones.
  const week = useMemo(() => typicalWeek(blocks, activities, today), [blocks, activities, today]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Arranca mostrando las 08:00.
    if (scrollRef.current) scrollRef.current.scrollTop = ((8 * 60 - GRID_START) / GRID_STEP) * SLOT_PX - 4;
  }, []);

  const days = [...profile.visible_weekdays].sort((a, b) => a - b) as Weekday[];
  const columns = { gridTemplateColumns: `var(--schedule-time-col) repeat(${days.length}, minmax(0, 1fr))` } satisfies CSSProperties;
  const weekdayShort = t("wd_short").split(",");
  const weekdayLong = t("wd_long").split(",");
  const letters = t("wd_letter").split(",");
  const isLoaded = blocksQuery.isSuccess && eventsQuery.isSuccess;
  const isEmpty = isLoaded && blocks.length === 0 && activities.length === 0;
  const isError = blocksQuery.isError || eventsQuery.isError || exceptionsQuery.isError;

  const holidayLabel = (date: IsoDate): string | null => {
    const entry = holidayByDate.get(date);
    if (!entry) return null;
    return entry.holiday ? holidayName(entry.holiday) : entry.name || t("cat_feriado");
  };

  function toggleVisibleDay(day: Weekday) {
    const visible = profile.visible_weekdays;
    const next = visible.includes(day) ? visible.filter((d) => d !== day) : [...visible, day].sort((a, b) => a - b);
    if (next.length > 0) updateProfile.mutate({ visible_weekdays: next });
  }

  const titleOf = (occurrence: Occurrence) =>
    occurrence.kind === "class" ? (subjectMap.get(occurrence.block.subject_id)?.name ?? "") : occurrence.event.title;

  function skip(occurrence: Occurrence) {
    const target = occurrenceTarget(occurrence);
    // Si había un "keep" (clase dictada en feriado), deshacer vuelve a ese estado.
    const previous = occurrence.kind === "class" && holidayByDate.has(occurrence.date) ? ("keep" as const) : null;
    mutations.setException(target, "skip");
    toast(t("skipped_toast", { title: titleOf(occurrence), date: formatDayMonth(occurrence.date) }), {
      action: { label: t("undo"), onAction: () => mutations.setException(target, previous) },
    });
  }

  function restore(occurrence: Occurrence) {
    // Omitida → se quita la excepción. Sin clase por feriado → "keep": hubo clase igual.
    mutations.setException(occurrenceTarget(occurrence), occurrence.status === "holiday" ? "keep" : null);
    toast(t("restored_toast"));
  }

  async function remove(occurrence: Occurrence) {
    const isClass = occurrence.kind === "class";
    const ok = await confirm({
      title: isClass ? t("delete_slot_q") : t("delete_activity_q", { title: occurrence.event.title }),
      body: isClass ? t("delete_slot_body") : t("delete_activity_body"),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!ok) return;
    if (occurrence.kind === "class") {
      mutations.removeBlock(occurrence.block.id);
      toast(t("slot_deleted"));
    } else {
      mutations.removeActivity(occurrence.event.id);
      toast(t("activity_deleted", { title: occurrence.event.title }));
    }
  }

  const repeatLabel = (activity: ScheduleEvent): string => {
    const until = activity.until_date ? ` · ${t("until", { date: formatDayMonth(activity.until_date) })}` : "";
    if (activity.recurrence === "none") return t("repeat_none_on", { date: activity.date ? formatDayMonth(activity.date) : "" });
    if (activity.recurrence === "daily") return t("repeat_daily") + until;
    return activity.weekdays.map((day) => weekdayShort[day - 1]).join(", ") + until;
  };

  return (
    <PageFrame
      title={t("nav_schedule")}
      width="wide"
      actions={
        <>
          <Button variant="ghost" onClick={() => setExporting(true)}>
            <ImageDown size={18} />
            {t("export")}
          </Button>
          <Button variant="primary" onClick={() => setForm({ mode: "new", tab: "class" })}>
            <Plus size={18} />
            {t("add")}
          </Button>
        </>
      }
    >
      <div className="sched-toolbar">
        <div className="week-nav">
          <Button icon aria-label={t("prev_week")} onClick={() => setWeekOffset((offset) => offset - 1)}>
            <ChevronLeft size={20} />
          </Button>
          <span className="week-label tnum" aria-live="polite">
            {t("week_range", { from: formatDayMonth(weekStart), to: formatDayMonth(weekEnd), year: dateParts(weekEnd).year })}
          </span>
          <Button icon aria-label={t("next_week")} onClick={() => setWeekOffset((offset) => offset + 1)}>
            <ChevronRight size={20} />
          </Button>
        </div>
        <Button disabled={weekOffset === 0} onClick={() => setWeekOffset(0)}>
          {t("this_week")}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost">
              <CalendarDays size={18} />
              {t("visible_days")}
              <span className="badge tnum">{days.length}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="popover-pad flex flex-col gap-2.5">
            <strong className="text-body-s">{t("visible_days")}</strong>
            <div className="daychips" role="group" aria-label={t("visible_days")}>
              {ALL_WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className="daychip"
                  aria-pressed={profile.visible_weekdays.includes(day)}
                  aria-label={weekdayLong[day - 1]}
                  onClick={() => toggleVisibleDay(day)}
                >
                  {letters[day - 1]}
                </button>
              ))}
            </div>
            <span className="field-hint">{t("visible_days_hint")}</span>
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <div className="sched-legend" aria-hidden="true">
          <span className="k">
            <i className="sw sw-class" />
            {t("legend_class")}
          </span>
          <span className="k">
            <i className="sw sw-event" />
            {t("legend_event")}
          </span>
          <span className="k">
            <i className="sw sw-skip" />
            {t("legend_skipped")}
          </span>
        </div>
      </div>

      {isError ? (
        <div className="mb-4">
          <LoadError
            onRetry={() => {
              void blocksQuery.refetch();
              void eventsQuery.refetch();
              void exceptionsQuery.refetch();
            }}
          />
        </div>
      ) : null}

      <div className="sched" role="group" aria-label={t("schedule_grid")} aria-busy={!isLoaded}>
        <div className="sched-head" style={columns}>
          <div />
          {days.map((weekday) => {
            const date = addDays(weekStart, weekday - 1);
            const holiday = holidayLabel(date);
            return (
              <div key={weekday} className={cn("sched-dayhead", date === today && "is-today")}>
                <div className="d">
                  <span className="wd">{weekdayShort[weekday - 1]}</span>
                  <span className="dn tnum">{formatDayMonth(date)}</span>
                </div>
                {holiday ? (
                  <span className="holiday-tag" title={holiday}>
                    <CalendarOff size={12} className="flex-none" />
                    <span>{holiday}</span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="sched-scroll" ref={scrollRef}>
          <div className="sched-body" style={{ ...columns, height: SLOTS.length * SLOT_PX }}>
            <div className="sched-times" aria-hidden="true">
              {HOURS.map((minutes) => (
                <div key={minutes} className="sched-time">
                  {minutes === GRID_START ? "" : minutesToTime(minutes)}
                </div>
              ))}
            </div>
            {days.map((weekday) => {
              const date = addDays(weekStart, weekday - 1);
              const holiday = holidayLabel(date);
              const dayName = weekdayLong[weekday - 1];
              const showNow = date === today && nowMinutes >= GRID_START && nowMinutes <= GRID_END;
              const nowTop = ((nowMinutes - GRID_START) / GRID_STEP) * SLOT_PX;
              return (
                <div
                  key={weekday}
                  className={cn("sched-col", date === today && "is-today", holiday && "is-holiday")}
                  role="group"
                  aria-label={
                    holiday
                      ? t("day_column_holiday", { weekday: dayName, date: formatDayMonth(date), holiday })
                      : t("day_column", { weekday: dayName, date: formatDayMonth(date) })
                  }
                >
                  {SLOTS.map((minutes, index) => (
                    <button
                      key={minutes}
                      type="button"
                      className="slot-btn"
                      tabIndex={-1}
                      style={{ top: index * SLOT_PX }}
                      aria-label={t("add_at", { day: dayName, time: minutesToTime(minutes) })}
                      onClick={() => setForm({ mode: "new", tab: "class", weekday, time: minutesToTime(minutes), date })}
                    />
                  ))}
                  {(byDate.get(date) ?? []).map((occurrence) => (
                    <BlockButton
                      key={occurrence.key}
                      occurrence={occurrence}
                      title={titleOf(occurrence)}
                      subject={occurrence.kind === "class" ? subjectMap.get(occurrence.block.subject_id) : undefined}
                      dayLabel={`${dayName} ${formatDayMonth(date)}`}
                      holiday={occurrence.status === "holiday" ? holiday : null}
                      repeatLabel={occurrence.kind === "event" ? repeatLabel(occurrence.event) : null}
                      onSkip={() => skip(occurrence)}
                      onRestore={() => restore(occurrence)}
                      onEdit={() =>
                        setForm(
                          occurrence.kind === "class"
                            ? { mode: "edit-block", block: occurrence.block as ScheduleBlockRow }
                            : { mode: "edit-event", event: occurrence.event as ScheduleEventRow },
                        )
                      }
                      onDelete={() => void remove(occurrence)}
                    />
                  ))}
                  {showNow ? (
                    <>
                      <div className="now-line" style={{ top: nowTop }} aria-hidden="true" />
                      <span className="now-label" style={{ top: nowTop }} aria-hidden="true">
                        {minutesToTime(nowMinutes)}
                      </span>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {isEmpty ? (
          <div className="sched-empty">
            <div className="panel">
              <CalendarClock size={32} strokeWidth={1.75} className="subtle" />
              <p className="empty-title">{t("sched_empty_title")}</p>
              <p className="empty-text">{t("sched_empty_text")}</p>
              <div className="btn-row mt-2 justify-center">
                <Button variant="primary" onClick={() => setForm({ mode: "new", tab: "class" })}>
                  <Plus size={18} />
                  {t("add_class")}
                </Button>
                <Button onClick={() => setForm({ mode: "new", tab: "event" })}>{t("add_activity")}</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ScheduleFormDialog target={form} subjects={subjects} onClose={() => setForm(null)} />
      <WallpaperDialog open={exporting} onOpenChange={setExporting} week={week} subjects={subjectMap} weekdays={days} />
    </PageFrame>
  );
}

function occurrenceTarget(occurrence: Occurrence) {
  return occurrence.kind === "class"
    ? ({ type: "block", id: occurrence.block.id, date: occurrence.date } as const)
    : ({ type: "event", id: occurrence.event.id, date: occurrence.date } as const);
}

type BlockButtonProps = {
  occurrence: Occurrence;
  title: string;
  subject?: SubjectBadge;
  dayLabel: string;
  holiday: string | null;
  repeatLabel: string | null;
  onSkip: () => void;
  onRestore: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Un bloque de la grilla. Al tocarlo abre un popover con todas sus acciones (nada depende del hover). */
function BlockButton({ occurrence, title, subject, dayLabel, holiday, repeatLabel, onSkip, onRestore, onEdit, onDelete }: BlockButtonProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const isEvent = occurrence.kind === "event";
  const color = subjectClass(isEvent ? occurrence.event.color_key : subject?.color_key);
  const icon = isEvent ? occurrence.event.icon : subject?.icon;
  const room = occurrence.kind === "class" ? occurrence.block.room : null;
  const repeats = isEvent && occurrence.event.recurrence !== "none";
  const inactive = occurrence.status !== "normal";
  const flag = occurrence.status === "skipped" ? t("skipped_flag") : occurrence.status === "holiday" ? t("no_class_flag") : "";
  const time = `${minutesToTime(occurrence.start)}–${minutesToTime(occurrence.end)}`;

  const position = gridPosition(occurrence.start, occurrence.end);
  const height = Math.max(position.height * SLOT_PX - 3, 20);
  const compact = height < 40;
  const style: CSSProperties = {
    top: position.top * SLOT_PX + 1,
    height,
    left: `calc(3px + (100% - 6px) * ${occurrence.col} / ${occurrence.cols})`,
    width: `calc((100% - 6px) / ${occurrence.cols} - 3px)`,
  };
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("sched-block", color, isEvent && "is-event", inactive && "is-skipped")}
          style={style}
          aria-label={[title, time, room, flag].filter(Boolean).join(", ")}
        >
          {compact ? (
            <span className="b-meta">
              {icon ? <SubjectIcon icon={icon} size={13} /> : isEvent ? <span className="b-dot" /> : null}
              <strong className="b-title is-compact">{title}</strong>
            </span>
          ) : (
            <>
              <span className="b-title">
                <SubjectIcon icon={icon} size={14} />
                {title}
              </span>
              <span className="b-meta">
                {isEvent ? repeats ? <Repeat size={12} className="flex-none" /> : icon ? null : <span className="b-dot" /> : null}
                <span>{time}</span>
              </span>
              {room && height > 56 ? (
                <span className="b-meta">
                  <MapPin size={12} className="flex-none" />
                  <span>{room}</span>
                </span>
              ) : null}
              {flag ? <span className="b-flag">{flag}</span> : null}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className={cn("block-pop-head", color)}>
          {icon ? <SubjectTile icon={icon} size="sm" /> : <span className="sw" />}
          <div className="min-w-0">
            <div className="t">{title}</div>
            <div className="m">{[dayLabel, time, room].filter(Boolean).join(" · ")}</div>
            {holiday ? (
              <div className="m mt-1.5">
                <span className="holiday-tag">
                  <CalendarOff size={12} className="flex-none" />
                  <span>{holiday}</span>
                </span>
              </div>
            ) : null}
            {occurrence.status === "skipped" ? <div className="m mt-1">{t("skipped_note")}</div> : null}
            {repeatLabel ? (
              <div className="m mt-1">
                <Repeat size={12} /> {repeatLabel}
              </div>
            ) : null}
          </div>
        </div>
        <div className="menu-sep" />
        {occurrence.status === "normal" ? (
          <button type="button" className="menu-item" onClick={run(onSkip)}>
            <CalendarX2 size={18} />
            <span>{t("skip_once")}</span>
          </button>
        ) : (
          <button type="button" className="menu-item" onClick={run(onRestore)}>
            <Undo2 size={18} />
            <span>{occurrence.status === "holiday" ? t("restore_holiday") : t("restore")}</span>
          </button>
        )}
        <button type="button" className="menu-item" onClick={run(onEdit)}>
          <Pencil size={18} />
          <span>{t("edit")}</span>
        </button>
        <button type="button" className="menu-item danger" onClick={run(onDelete)}>
          <Trash2 size={18} />
          <span>{isEvent ? t("delete_activity") : t("delete_slot")}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
