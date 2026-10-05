"use client";

import { ListChecks, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { useProfile, useToday } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { CALENDAR_CATEGORIES, generatesTask, linkedTaskFields, taskSyncFor, type CalendarCategory } from "@/lib/domain/calendar";
import type { IsoDate } from "@/lib/domain/dates";
import { isArchived, subjectClass } from "@/lib/domain/subjects";
import { normalizeTime, parseTimeInput } from "@/lib/domain/time";
import { useCalendarMutations } from "@/lib/queries/calendar";
import type { CalendarEventRow, SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useEventLabel } from "./labels";

export type EventFormTarget = { event: CalendarEventRow } | { date: IsoDate };

type EventFormDialogProps = {
  target: EventFormTarget | null;
  subjects: SubjectRow[];
  onClose: () => void;
  onDelete: (event: CalendarEventRow) => void;
};

export function EventFormDialog({ target, subjects, onClose, onDelete }: EventFormDialogProps) {
  const t = useTranslations();
  const editing = target && "event" in target ? target.event : null;
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target ? (
        <DialogContent size="lg" title={editing ? t("edit_date") : t("add_date")}>
          <EventForm
            event={editing}
            initialDate={"date" in target ? target.date : target.event.date}
            subjects={subjects}
            onDone={onClose}
            onDelete={onDelete}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

type EventFormProps = {
  event: CalendarEventRow | null;
  initialDate: IsoDate;
  subjects: SubjectRow[];
  onDone: () => void;
  onDelete: (event: CalendarEventRow) => void;
};

function EventForm({ event, initialDate, subjects, onDone, onDelete }: EventFormProps) {
  const t = useTranslations();
  const id = useId();
  const today = useToday();
  const defaultLead = useProfile().default_task_lead_days;
  const mutations = useCalendarMutations();
  const eventLabel = useEventLabel();

  // Materias elegibles: las activas, más la del evento aunque esté archivada.
  const options = subjects.filter((subject) => !isArchived(subject) || subject.id === event?.subject_id);
  const [category, setCategory] = useState<CalendarCategory>((event?.category as CalendarCategory) ?? "parcial");
  const [subjectId, setSubjectId] = useState(event ? (event.subject_id ?? "") : (options[0]?.id ?? ""));
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState<IsoDate>(initialDate);
  const [lead, setLead] = useState(String(event?.lead_days ?? defaultLead));
  const [time, setTime] = useState(event?.start_time ? normalizeTime(event.start_time) : "");
  const [timeInvalid, setTimeInvalid] = useState(false);

  const isHoliday = category === "feriado";
  const subject = isHoliday ? undefined : subjects.find((item) => item.id === subjectId);
  const color = subjectClass(subject?.color_key);
  const placeholder = isHoliday ? t("holiday_ph") : eventLabel({ title: "", category }, subject?.name);

  function onCategoryKey(keyEvent: KeyboardEvent<HTMLDivElement>) {
    const step = keyEvent.key === "ArrowRight" || keyEvent.key === "ArrowDown" ? 1 : keyEvent.key === "ArrowLeft" || keyEvent.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    keyEvent.preventDefault();
    const index = (CALENDAR_CATEGORIES.indexOf(category) + step + CALENDAR_CATEGORIES.length) % CALENDAR_CATEGORIES.length;
    setCategory(CALENDAR_CATEGORIES[index]);
    keyEvent.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  }

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    const startTime = parseTimeInput(time);
    if (startTime === "invalid") {
      setTimeInvalid(true);
      document.getElementById(`${id}-time`)?.focus();
      return;
    }
    const leadDays = Math.max(0, Math.min(60, Math.trunc(Number(lead)) || 0));
    const input = {
      category,
      subject_id: isHoliday ? null : subjectId || null,
      title: title.trim(),
      date,
      start_time: startTime,
      lead_days: generatesTask(category) ? leadDays : null,
    };
    const hasTask = event ? Boolean(mutations.linkedTask(event.id)) : false;
    const plan = {
      sync: taskSyncFor(event?.category ?? null, category, hasTask),
      fields: linkedTaskFields(input, t("cat_tp"), subject?.name ?? null, defaultLead),
    };
    if (event) mutations.update(event.id, input, plan);
    else mutations.create(input, plan);
    toast(plan.sync === "create" ? t("date_added_task") : t("date_saved"));
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <DialogBody>
        <Field label={t("category")} labelId={`${id}-category`} hint={t(`cat_hint_${category}`)}>
          <div className="cat-picker" role="radiogroup" aria-labelledby={`${id}-category`} onKeyDown={onCategoryKey}>
            {CALENDAR_CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                className="cat-option"
                aria-checked={category === option}
                tabIndex={category === option ? 0 : -1}
                onClick={() => setCategory(option)}
              >
                <span className={cn("ev", `cat-${option}`, option === "feriado" ? "subj-grafito" : color)} aria-hidden="true" />
                {t(`cat_${option}`)}
              </button>
            ))}
          </div>
        </Field>
        <div className="form-grid">
          {isHoliday ? null : (
            <Field className="span-2" label={t("subject")} htmlFor={`${id}-subject`}>
              <select id={`${id}-subject`} className="select" value={subjectId} onChange={(changeEvent) => setSubjectId(changeEvent.target.value)}>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
                <option value="">{t("no_subject")}</option>
              </select>
            </Field>
          )}
          <Field className="span-2" label={t("title")} htmlFor={`${id}-title`} optionalLabel={t("optional")}>
            <input
              id={`${id}-title`}
              className="input"
              maxLength={200}
              value={title}
              placeholder={placeholder}
              autoComplete="off"
              onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            />
          </Field>
          <Field label={t("date")} htmlFor={`${id}-date`}>
            <DateField id={`${id}-date`} value={date} today={today} onChange={(next) => next && setDate(next)} />
          </Field>
          <Field label={t("time")} htmlFor={`${id}-time`} optionalLabel={t("optional")} error={timeInvalid ? t("time_invalid") : undefined} errorId={`${id}-time-error`}>
            <input
              id={`${id}-time`}
              className="input tnum"
              inputMode="numeric"
              maxLength={5}
              value={time}
              placeholder="HH:MM"
              autoComplete="off"
              aria-invalid={timeInvalid || undefined}
              aria-describedby={timeInvalid ? `${id}-time-error` : undefined}
              onChange={(changeEvent) => {
                setTime(changeEvent.target.value);
                setTimeInvalid(false);
              }}
            />
          </Field>
          {generatesTask(category) ? (
            <Field className="span-2" label={t("in_your_list")} htmlFor={`${id}-lead`}>
              <div className="lead-row">
                <span>{t("appear_before_a")}</span>
                <input
                  id={`${id}-lead`}
                  className="input tnum"
                  inputMode="numeric"
                  maxLength={2}
                  value={lead}
                  onChange={(changeEvent) => setLead(changeEvent.target.value.replace(/\D/g, ""))}
                />
                <span>{t("appear_before_b")}</span>
              </div>
            </Field>
          ) : null}
        </div>
        {generatesTask(category) ? (
          <p className="field-hint flex items-center gap-1.5">
            <ListChecks size={14} className="flex-none" />
            {t("task_auto_note")}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        {event ? (
          <Button variant="danger-ghost" onClick={() => onDelete(event)}>
            <Trash2 size={18} />
            {t("delete")}
          </Button>
        ) : null}
        <span className="spacer" />
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" variant="primary">
          {event ? t("save") : t("add_date")}
        </Button>
      </DialogFooter>
    </form>
  );
}
