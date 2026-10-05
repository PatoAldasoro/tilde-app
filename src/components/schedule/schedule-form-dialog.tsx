"use client";

import { BookOpen, Calendar, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ColorSwatches } from "@/components/home/color-swatches";
import { IconPicker } from "@/components/icon-picker";
import { useToday } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { TimeSelect } from "@/components/ui/time-select";
import { toast } from "@/components/ui/toast";
import type { IsoDate } from "@/lib/domain/dates";
import { GRID_END, GRID_START, GRID_STEP, type Recurrence } from "@/lib/domain/schedule";
import type { IconKey } from "@/lib/domain/icons";
import { isArchived, subjectClass, type ColorKey } from "@/lib/domain/subjects";
import { minutesToTime, normalizeTime, timeToMinutes } from "@/lib/domain/time";
import { useScheduleMutations } from "@/lib/queries/schedule";
import type { ScheduleBlockRow, ScheduleEventRow, SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type ScheduleFormTarget =
  | { mode: "new"; tab: "class" | "event"; weekday?: number; time?: string; date?: IsoDate }
  | { mode: "edit-block"; block: ScheduleBlockRow }
  | { mode: "edit-event"; event: ScheduleEventRow };

type ScheduleFormDialogProps = { target: ScheduleFormTarget | null; subjects: SubjectRow[]; onClose: () => void };

export function ScheduleFormDialog({ target, subjects, onClose }: ScheduleFormDialogProps) {
  const t = useTranslations();
  const title = !target
    ? ""
    : target.mode === "edit-block"
      ? t("edit_class")
      : target.mode === "edit-event"
        ? t("edit_activity")
        : t("add_to_schedule");
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target ? (
        <DialogContent size="lg" title={title}>
          <ScheduleForm target={target} subjects={subjects} onDone={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

type SlotRow = { key: number; weekday: number; start: string; end: string; room: string };
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function ScheduleForm({ target, subjects, onDone }: { target: ScheduleFormTarget; subjects: SubjectRow[]; onDone: () => void }) {
  const t = useTranslations();
  const id = useId();
  const today = useToday();
  const mutations = useScheduleMutations();
  const block = target.mode === "edit-block" ? target.block : null;
  const activity = target.mode === "edit-event" ? target.event : null;
  const editing = block !== null || activity !== null;
  const preset = target.mode === "new" ? target : null;

  const startDefault = preset?.time ?? "18:00";
  const endDefault = minutesToTime(Math.min(timeToMinutes(startDefault) + 120, GRID_END));
  const options = subjects.filter((subject) => !isArchived(subject) || subject.id === block?.subject_id);

  const [tab, setTab] = useState<"class" | "event">(block ? "class" : activity ? "event" : (preset?.tab ?? "class"));
  // Clase
  const [subjectId, setSubjectId] = useState(block?.subject_id ?? options[0]?.id ?? "");
  const [rows, setRows] = useState<SlotRow[]>([
    block
      ? { key: 0, weekday: block.weekday, start: normalizeTime(block.start_time), end: normalizeTime(block.end_time), room: block.room ?? "" }
      : { key: 0, weekday: preset?.weekday ?? 1, start: startDefault, end: endDefault, room: "" },
  ]);
  const [rowError, setRowError] = useState<number | null>(null);
  // Actividad
  const [title, setTitle] = useState(activity?.title ?? "");
  const [color, setColor] = useState<ColorKey>((activity?.color_key as ColorKey | undefined) ?? "lima");
  const [icon, setIcon] = useState<IconKey | null>((activity?.icon as IconKey | null | undefined) ?? null);
  const [recurrence, setRecurrence] = useState<Recurrence>((activity?.recurrence as Recurrence | undefined) ?? "none");
  const [weekdays, setWeekdays] = useState<number[]>(activity?.weekdays.length ? activity.weekdays : [preset?.weekday ?? 1]);
  const [date, setDate] = useState<IsoDate>(activity?.date ?? preset?.date ?? today);
  const [until, setUntil] = useState<IsoDate | null>(activity?.until_date ?? null);
  const [start, setStart] = useState(activity ? normalizeTime(activity.start_time) : startDefault);
  const [end, setEnd] = useState(activity ? normalizeTime(activity.end_time) : endDefault);
  const [errors, setErrors] = useState<{ title?: boolean; time?: boolean; days?: boolean }>({});

  const names = t("wd_long").split(",");
  const letters = t("wd_letter").split(",");
  const updateRow = (key: number, patch: Partial<SlotRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setRowError(null);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (tab === "class") {
      if (!subjectId) return;
      const bad = rows.findIndex((row) => timeToMinutes(row.end) <= timeToMinutes(row.start));
      if (bad >= 0) {
        setRowError(bad);
        return;
      }
      const inputs = rows.map((row) => ({
        subject_id: subjectId,
        weekday: row.weekday,
        start_time: row.start,
        end_time: row.end,
        room: row.room.trim() || null,
      }));
      if (block) {
        mutations.updateBlock(block.id, inputs[0]);
        toast(t("saved"));
      } else {
        mutations.addBlocks(inputs);
        toast(t("slots_added", { n: inputs.length, name: subjects.find((subject) => subject.id === subjectId)?.name ?? "" }));
      }
      onDone();
      return;
    }

    const nextErrors = {
      title: !title.trim(),
      time: timeToMinutes(end) <= timeToMinutes(start),
      days: recurrence === "weekdays" && weekdays.length === 0,
    };
    if (nextErrors.title || nextErrors.time || nextErrors.days) {
      setErrors(nextErrors);
      if (nextErrors.title) document.getElementById(`${id}-title`)?.focus();
      return;
    }
    const input = {
      title: title.trim(),
      color_key: color,
      icon,
      start_time: start,
      end_time: end,
      recurrence,
      weekdays: recurrence === "weekdays" ? [...weekdays].sort((a, b) => a - b) : [],
      date: recurrence === "none" ? date : null,
      start_date: activity?.start_date ?? null,
      until_date: recurrence === "none" ? null : until,
    };
    if (activity) {
      mutations.updateActivity(activity.id, input);
      toast(t("saved"));
    } else {
      mutations.addActivity(input);
      toast(t("activity_added", { title: input.title }));
    }
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <DialogBody>
        {editing ? null : (
          <Segmented
            className="self-start"
            label={t("what_to_add")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "class", label: t("class_of_subject"), icon: <BookOpen size={16} /> },
              { value: "event", label: t("activity"), icon: <Calendar size={16} /> },
            ]}
          />
        )}

        {tab === "class" ? (
          options.length === 0 ? (
            <p className="notice">{t("no_subjects_for_class")}</p>
          ) : (
            <>
              <Field label={t("subject")} htmlFor={`${id}-subject`}>
                <select id={`${id}-subject`} className="select" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  {options.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("class_slots")}>
                <div className="slot-rows">
                  {rows.map((row, index) => (
                    <div key={row.key}>
                      <div className="slot-row">
                        <Field label={t("day")} htmlFor={`${id}-day-${row.key}`}>
                          <select
                            id={`${id}-day-${row.key}`}
                            className="select capitalize"
                            value={row.weekday}
                            onChange={(event) => updateRow(row.key, { weekday: Number(event.target.value) })}
                          >
                            {WEEKDAYS.map((weekday) => (
                              <option key={weekday} value={weekday}>
                                {names[weekday - 1]}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("from")} htmlFor={`${id}-start-${row.key}`}>
                          <TimeSelect
                            id={`${id}-start-${row.key}`}
                            value={row.start}
                            from={GRID_START}
                            to={GRID_END - GRID_STEP}
                            onChange={(value) => updateRow(row.key, { start: value })}
                          />
                        </Field>
                        <Field label={t("to")} htmlFor={`${id}-end-${row.key}`} className={rowError === index ? "is-invalid" : undefined}>
                          <TimeSelect
                            id={`${id}-end-${row.key}`}
                            className={rowError === index ? "is-invalid" : undefined}
                            aria-invalid={rowError === index || undefined}
                            value={row.end}
                            from={GRID_START + GRID_STEP}
                            to={GRID_END}
                            onChange={(value) => updateRow(row.key, { end: value })}
                          />
                        </Field>
                        <Field label={t("room")} htmlFor={`${id}-room-${row.key}`}>
                          <input
                            id={`${id}-room-${row.key}`}
                            className="input"
                            maxLength={60}
                            value={row.room}
                            placeholder={t("room_ph")}
                            onChange={(event) => updateRow(row.key, { room: event.target.value })}
                          />
                        </Field>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          aria-label={t("remove_slot")}
                          disabled={rows.length === 1}
                          onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {rowError === index ? (
                        <span className="field-error mt-1.5" role="alert">
                          {t("end_after_start")}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Field>
              {block ? null : (
                <Button
                  variant="ghost"
                  className="self-start"
                  onClick={() =>
                    setRows((current) => {
                      const last = current[current.length - 1];
                      return [...current, { ...last, key: last.key + 1, weekday: Math.min(last.weekday + 2, 7), room: "" }];
                    })
                  }
                >
                  <Plus size={18} />
                  {t("add_another_slot")}
                </Button>
              )}
            </>
          )
        ) : (
          <div className="form-grid">
            <Field
              className="span-2"
              label={t("title")}
              htmlFor={`${id}-title`}
              required
              error={errors.title ? t("title_required") : undefined}
            >
              <input
                id={`${id}-title`}
                className="input"
                maxLength={120}
                value={title}
                placeholder={t("activity_ph")}
                autoComplete="off"
                aria-required="true"
                aria-invalid={errors.title || undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setErrors((current) => ({ ...current, title: false }));
                }}
              />
            </Field>
            <Field className="span-2" label={t("color")} labelId={`${id}-color`}>
              <ColorSwatches value={color} onChange={setColor} labelledBy={`${id}-color`} />
            </Field>
            <Field className="span-2" label={t("icon")} labelId={`${id}-icon-label`} optionalLabel={t("optional")}>
              <IconPicker id={`${id}-icon`} value={icon} onChange={setIcon} colorClass={subjectClass(color)} labelledBy={`${id}-icon-label`} />
            </Field>
            <Field className="span-2" label={t("repeat")}>
              <Segmented
                className="self-start"
                label={t("repeat")}
                value={recurrence}
                onChange={setRecurrence}
                options={[
                  { value: "none", label: t("repeat_none") },
                  { value: "daily", label: t("repeat_daily") },
                  { value: "weekdays", label: t("repeat_weekly") },
                ]}
              />
            </Field>
            {recurrence === "weekdays" ? (
              <Field className="span-2" label={t("which_days")} error={errors.days ? t("days_required") : undefined}>
                <div className="daychips" role="group" aria-label={t("which_days")}>
                  {WEEKDAYS.map((weekday) => (
                    <button
                      key={weekday}
                      type="button"
                      className="daychip"
                      aria-pressed={weekdays.includes(weekday)}
                      aria-label={names[weekday - 1]}
                      onClick={() => {
                        setWeekdays((current) => (current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday]));
                        setErrors((current) => ({ ...current, days: false }));
                      }}
                    >
                      {letters[weekday - 1]}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}
            {recurrence === "none" ? (
              <Field className="span-2" label={t("date")} htmlFor={`${id}-date`}>
                <DateField id={`${id}-date`} className="max-w-[220px]" value={date} today={today} onChange={(next) => next && setDate(next)} />
              </Field>
            ) : null}
            <Field label={t("from")} htmlFor={`${id}-from`}>
              <TimeSelect
                id={`${id}-from`}
                value={start}
                from={GRID_START}
                to={GRID_END - GRID_STEP}
                onChange={(value) => {
                  setStart(value);
                  setErrors((current) => ({ ...current, time: false }));
                }}
              />
            </Field>
            <Field label={t("to")} htmlFor={`${id}-to`} className={cn(errors.time && "is-invalid")}>
              <TimeSelect
                id={`${id}-to`}
                className={errors.time ? "is-invalid" : undefined}
                aria-invalid={errors.time || undefined}
                value={end}
                from={GRID_START + GRID_STEP}
                to={GRID_END}
                onChange={(value) => {
                  setEnd(value);
                  setErrors((current) => ({ ...current, time: false }));
                }}
              />
            </Field>
            {errors.time ? (
              <span className="field-error span-2" role="alert">
                {t("end_after_start")}
              </span>
            ) : null}
            {recurrence !== "none" ? (
              <Field className="span-2" label={t("ends_on")} htmlFor={`${id}-until`} optionalLabel={t("optional")} hint={t("ends_on_hint")}>
                <DateField id={`${id}-until`} className="max-w-[220px]" value={until} today={today} clearable onChange={setUntil} />
              </Field>
            ) : null}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" variant="primary" disabled={tab === "class" && options.length === 0}>
          {editing ? t("save") : t("add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
