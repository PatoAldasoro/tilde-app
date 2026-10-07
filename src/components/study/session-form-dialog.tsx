"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type FormEvent } from "react";
import { useProfile, useToday } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { dateInTimeZone, minutesInTimeZone, type IsoDate } from "@/lib/domain/dates";
import { zonedToInstant } from "@/lib/domain/ics";
import { sessionFormSchema, type SessionTaskDraft } from "@/lib/domain/sessions";
import { isArchived } from "@/lib/domain/subjects";
import { minutesToTime, parseTimeInput, timeToMinutes } from "@/lib/domain/time";
import type { PresetKey } from "@/lib/domain/timer";
import { useStudyMutations } from "@/lib/queries/study";
import { useTasks } from "@/lib/queries/tasks";
import type { StudySessionRow, StudySessionTaskRow, SubjectRow } from "@/lib/supabase/types";

/** Sesión a corregir, o `"new"` para anotar una que se hizo sin el timer. */
export type SessionFormTarget = { session: StudySessionRow; links: StudySessionTaskRow[] } | "new";

type SessionFormDialogProps = { target: SessionFormTarget | null; subjects: SubjectRow[]; onClose: () => void };

const PRESET_KEYS: PresetKey[] = ["25-5", "50-10", "90-20", "custom", "exam"];

export function SessionFormDialog({ target, subjects, onClose }: SessionFormDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target ? (
        <DialogContent size="lg" title={target === "new" ? t("session_add") : t("session_edit")} description={target === "new" ? t("session_add_desc") : undefined}>
          <SessionForm target={target} subjects={subjects} onDone={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

type Errors = { time?: boolean; focus?: boolean };

function SessionForm({ target, subjects, onDone }: { target: SessionFormTarget; subjects: SubjectRow[]; onDone: () => void }) {
  const t = useTranslations();
  const id = useId();
  const today = useToday();
  const timeZone = useProfile().timezone;
  const mutations = useStudyMutations();
  const tasksQuery = useTasks();
  const session = target === "new" ? null : target.session;

  // Lo que se muestra al abrir: los datos de la sesión o, si es nueva, una hora de foco que termina ahora.
  const [opened] = useState(() => new Date());
  const startedAt = session ? new Date(session.started_at) : new Date(opened.getTime() - 60 * 60_000);
  const [date, setDate] = useState<IsoDate>(session ? dateInTimeZone(startedAt, timeZone) : today);
  const [time, setTime] = useState(minutesToTime(minutesInTimeZone(timeZone, startedAt)));
  const [subjectId, setSubjectId] = useState(session?.subject_id ?? "");
  const [preset, setPreset] = useState<PresetKey>((session?.preset as PresetKey | undefined) ?? "custom");
  const [hours, setHours] = useState(String(Math.floor((session?.focus_seconds ?? 3600) / 3600)));
  const [minutes, setMinutes] = useState(String(Math.round(((session?.focus_seconds ?? 3600) % 3600) / 60)));
  const [breakMinutes, setBreakMinutes] = useState(String(Math.round((session?.break_seconds ?? 0) / 60)));
  const [cycles, setCycles] = useState(String(session?.cycles_completed ?? 1));
  const [subtasks, setSubtasks] = useState(String(session?.subtasks_completed ?? 0));
  const [aways, setAways] = useState(String(session?.away_count ?? 0));
  const [tasks, setTasks] = useState<SessionTaskDraft[]>(target === "new" ? [] : target.links.map((link) => ({ id: link.task_id, title: link.title })));
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const options = subjects.filter((subject) => !isArchived(subject) || subject.id === session?.subject_id);
  // Sugerencias para anotar tareas: las propias, con las de la materia elegida primero.
  const suggestions = useMemo(() => {
    const all = tasksQuery.data ?? [];
    const taken = new Set(tasks.map((task) => task.id).filter(Boolean));
    return [...all.filter((task) => task.subject_id === (subjectId || null)), ...all.filter((task) => task.subject_id !== (subjectId || null))]
      .filter((task) => !taken.has(task.id))
      .slice(0, 60);
  }, [tasksQuery.data, tasks, subjectId]);
  const digits = (setter: (value: string) => void) => (event: { target: { value: string } }) => setter(event.target.value.replace(/\D/g, ""));

  function addTask() {
    const title = draft.trim();
    if (!title) return;
    // Si el texto coincide con una tarea propia, queda enlazada; si no, se anota solo el título.
    const match = suggestions.find((task) => task.title === title);
    setTasks((current) => [...current, { id: match?.id ?? null, title: title.slice(0, 300) }]);
    setDraft("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const startTime = parseTimeInput(time);
    const parsed = sessionFormSchema.safeParse({
      focusMinutes: Number(hours || 0) * 60 + Number(minutes || 0),
      breakMinutes: Number(breakMinutes || 0),
      cycles: Number(cycles || 0),
      subtasks: Number(subtasks || 0),
      aways: preset === "exam" ? Number(aways || 0) : 0,
    });
    const nextErrors: Errors = { time: startTime === null || startTime === "invalid", focus: !parsed.success };
    if (nextErrors.time || !parsed.success || typeof startTime !== "string") {
      setErrors(nextErrors);
      document.getElementById(nextErrors.time ? `${id}-time` : `${id}-hours`)?.focus();
      return;
    }
    const input = {
      subject_id: subjectId || null,
      preset,
      started_at: new Date(zonedToInstant(date, timeToMinutes(startTime), timeZone)).toISOString(),
      focus_seconds: parsed.data.focusMinutes * 60,
      break_seconds: parsed.data.breakMinutes * 60,
      cycles_completed: parsed.data.cycles,
      subtasks_completed: parsed.data.subtasks,
      away_count: parsed.data.aways,
      tasks,
    };
    if (session) {
      mutations.update(session.id, input);
      toast(t("session_updated"));
    } else {
      mutations.add(input);
      toast(t("session_saved"));
    }
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <DialogBody>
        <div className="form-grid">
          <Field label={t("date")} htmlFor={`${id}-date`}>
            <DateField id={`${id}-date`} value={date} today={today} onChange={(next) => next && setDate(next)} />
          </Field>
          <Field label={t("session_start_time")} htmlFor={`${id}-time`} error={errors.time ? t("time_invalid") : undefined} errorId={`${id}-time-error`}>
            <input
              id={`${id}-time`}
              className="input tnum"
              inputMode="numeric"
              maxLength={5}
              value={time}
              placeholder="HH:MM"
              autoComplete="off"
              aria-invalid={errors.time || undefined}
              aria-describedby={errors.time ? `${id}-time-error` : undefined}
              onChange={(event) => {
                setTime(event.target.value);
                setErrors((current) => ({ ...current, time: false }));
              }}
            />
          </Field>
          <Field label={t("subject")} htmlFor={`${id}-subject`}>
            <select id={`${id}-subject`} className="select" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">{t("no_subject")}</option>
              {options.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("session_kind")} htmlFor={`${id}-preset`}>
            <select id={`${id}-preset`} className="select" value={preset} onChange={(event) => setPreset(event.target.value as PresetKey)}>
              {PRESET_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key === "custom" ? t("custom") : key === "exam" ? t("mode_exam") : key === "25-5" ? t("preset_pomodoro") : key.replace("-", "/")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("focus_time")} labelId={`${id}-focus`} error={errors.focus ? t("session_focus_invalid") : undefined}>
            <div className="lead-row" role="group" aria-labelledby={`${id}-focus`}>
              <input
                id={`${id}-hours`}
                className="input tnum"
                inputMode="numeric"
                maxLength={2}
                value={hours}
                aria-label={t("hours")}
                aria-invalid={errors.focus || undefined}
                onChange={(event) => {
                  digits(setHours)(event);
                  setErrors((current) => ({ ...current, focus: false }));
                }}
              />
              <span>{t("h_unit")}</span>
              <input
                className="input tnum"
                inputMode="numeric"
                maxLength={2}
                value={minutes}
                aria-label={t("minutes")}
                aria-invalid={errors.focus || undefined}
                onChange={(event) => {
                  digits(setMinutes)(event);
                  setErrors((current) => ({ ...current, focus: false }));
                }}
              />
              <span>{t("min_unit")}</span>
            </div>
          </Field>
          <Field label={t("break_min")} htmlFor={`${id}-break`}>
            <input id={`${id}-break`} className="input tnum" inputMode="numeric" maxLength={3} value={breakMinutes} onChange={digits(setBreakMinutes)} />
          </Field>
          <Field label={t("cycles_completed")} htmlFor={`${id}-cycles`}>
            <input id={`${id}-cycles`} className="input tnum" inputMode="numeric" maxLength={2} value={cycles} onChange={digits(setCycles)} />
          </Field>
          <Field label={t("subtasks_completed")} htmlFor={`${id}-subtasks`}>
            <input id={`${id}-subtasks`} className="input tnum" inputMode="numeric" maxLength={3} value={subtasks} onChange={digits(setSubtasks)} />
          </Field>
          {preset === "exam" ? (
            <Field label={t("exam_aways")} htmlFor={`${id}-aways`}>
              <input id={`${id}-aways`} className="input tnum" inputMode="numeric" maxLength={3} value={aways} onChange={digits(setAways)} />
            </Field>
          ) : null}
        </div>

        <Field label={t("tasks_completed")} htmlFor={`${id}-task`} hint={t("session_tasks_hint")}>
          {tasks.length > 0 ? (
            <ul className="session-tasks">
              {tasks.map((task, index) => (
                <li key={`${task.id ?? "free"}-${index}`}>
                  <span className="min-w-0 flex-1 truncate" title={task.title}>
                    {task.title}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={t("session_task_remove", { title: task.title })}
                    onClick={() => setTasks((current) => current.filter((_, position) => position !== index))}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <input
              id={`${id}-task`}
              className="input"
              list={`${id}-suggestions`}
              value={draft}
              maxLength={300}
              placeholder={t("session_task_ph")}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addTask();
              }}
            />
            <datalist id={`${id}-suggestions`}>
              {suggestions.map((task) => (
                <option key={task.id} value={task.title} />
              ))}
            </datalist>
            <Button onClick={addTask} disabled={draft.trim() === ""}>
              <Plus size={18} />
              {t("add")}
            </Button>
          </div>
        </Field>
      </DialogBody>
      <DialogFooter>
        <span className="spacer" />
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" variant="primary">
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
