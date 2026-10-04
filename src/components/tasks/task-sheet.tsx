"use client";

import { CalendarDays, Info, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useProfile, useToday } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CommitInput } from "@/components/ui/commit-input";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { isArchived } from "@/lib/domain/subjects";
import { isCompleted, pendingSubtasks } from "@/lib/domain/tasks";
import type { Priority, Task } from "@/lib/domain/types";
import { useTaskMutations } from "@/lib/queries/tasks";
import type { SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, PriorityFlag, TaskCheckbox } from "./task-row";

const PRIORITIES: Priority[] = ["none", "low", "medium", "high"];
const FLAG_CLASS: Record<Priority, string> = { none: "", low: "p1", medium: "p2", high: "p3" };

type TaskSheetProps = {
  task: Task | null;
  subjects: SubjectRow[];
  onClose: () => void;
  onDelete: (task: Task) => void;
};

/** Panel de detalle de una tarea: título, materia, prioridad, fechas y subtareas. */
export function TaskSheet({ task, subjects, onClose, onDelete }: TaskSheetProps) {
  const t = useTranslations();
  const mutations = useTaskMutations();
  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      {task ? (
        <SheetContent
          label={t("task_detail")}
          head={
            <>
              <TaskCheckbox task={task} onToggle={() => mutations.toggle(task)} />
              <span className="flex-1 pl-2 font-semibold" aria-hidden="true">
                {t("task_detail")}
              </span>
            </>
          }
        >
          <TaskDetails task={task} subjects={subjects} />
          <SheetFooter>
            <Button variant="danger-ghost" onClick={() => onDelete(task)}>
              <Trash2 size={18} />
              {t("delete_task")}
            </Button>
            <span className="flex-1" />
            <Button variant="primary" onClick={onClose}>
              {t("done")}
            </Button>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function TaskDetails({ task, subjects }: { task: Task; subjects: SubjectRow[] }) {
  const t = useTranslations();
  const id = useId();
  const today = useToday();
  const defaultLead = useProfile().default_task_lead_days;
  const mutations = useTaskMutations();
  const [subtaskTitle, setSubtaskTitle] = useState("");
  // Las tareas creadas por un TP del Calendario se editan desde el evento.
  const linked = task.source_calendar_event_id !== null;
  const left = pendingSubtasks(task);
  const subjectOptions = subjects.filter((subject) => !isArchived(subject) || subject.id === task.subject_id);

  function setDue(due: string | null) {
    if (due) mutations.update(task.id, { due_date: due, lead_days: task.lead_days ?? defaultLead, planned_date: null });
    else mutations.update(task.id, { due_date: null, lead_days: null, planned_date: today });
  }

  return (
    <SheetBody>
      <Field label={t("title")} htmlFor={`${id}-title`}>
        <CommitInput
          id={`${id}-title`}
          className="input h-11 text-base"
          maxLength={300}
          disabled={linked}
          value={task.title}
          onCommit={(title) => {
            if (!title) return false;
            mutations.update(task.id, { title });
          }}
        />
      </Field>
      <Field label={t("subject")} htmlFor={`${id}-subject`} optionalLabel={t("optional")}>
        <select
          id={`${id}-subject`}
          className="select"
          disabled={linked}
          value={task.subject_id ?? ""}
          onChange={(event) => mutations.update(task.id, { subject_id: event.target.value || null })}
        >
          <option value="">{t("no_subject")}</option>
          {subjectOptions.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("priority")} labelId={`${id}-priority`}>
        <div className="prio-picker" role="radiogroup" aria-labelledby={`${id}-priority`}>
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              role="radio"
              className="chip-toggle"
              aria-checked={task.priority === priority}
              onClick={() => mutations.update(task.id, { priority })}
            >
              <span className={cn("flag size-4", FLAG_CLASS[priority])}>
                <PriorityFlag priority={priority} />
              </span>
              {t(PRIORITY_LABEL[priority])}
            </button>
          ))}
        </div>
      </Field>
      <div className="form-grid">
        <Field label={t("due_date")} htmlFor={`${id}-due`} hint={task.due_date ? t("due_hint_set") : t("due_hint")}>
          <DateField id={`${id}-due`} value={task.due_date} today={today} clearable disabled={linked} onChange={setDue} />
        </Field>
        {task.due_date ? null : (
          <Field label={t("day")} htmlFor={`${id}-day`} hint={t("day_hint")}>
            <DateField
              id={`${id}-day`}
              value={task.planned_date}
              today={today}
              onChange={(day) => day && mutations.update(task.id, { planned_date: day })}
            />
          </Field>
        )}
      </div>
      {task.due_date ? (
        <div className="lead-row">
          <label htmlFor={`${id}-lead`}>{t("appear_before_a")}</label>
          <CommitInput
            id={`${id}-lead`}
            className="input tnum"
            inputMode="numeric"
            maxLength={2}
            disabled={linked}
            value={String(task.lead_days ?? defaultLead)}
            onCommit={(text) => {
              if (!/^\d{1,2}$/.test(text)) return false;
              mutations.update(task.id, { lead_days: Math.min(60, Number(text)) });
            }}
          />
          <span>{t("appear_before_b")}</span>
        </div>
      ) : null}
      <Field
        label={
          <>
            {t("subtasks")} ·{" "}
            <span className="tnum">
              {task.subtasks.length - left}/{task.subtasks.length}
            </span>
          </>
        }
      >
        <div className="sub-edit">
          {task.subtasks.map((subtask) => (
            <div key={subtask.id} className={cn("subtask", subtask.completed_at && "is-done")}>
              <Checkbox
                size="sm"
                checked={subtask.completed_at !== null}
                label={subtask.title}
                onChange={() => mutations.toggleSubtask(task, subtask.id)}
              />
              <span className="subtask-title">{subtask.title}</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label={t("remove_subtask", { title: subtask.title })}
                onClick={() => mutations.removeSubtask(subtask.id)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <div className="quick-add">
            <Plus size={18} />
            <input
              aria-label={t("add_subtask")}
              placeholder={t("add_subtask")}
              autoComplete="off"
              maxLength={300}
              value={subtaskTitle}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || !subtaskTitle.trim()) return;
                mutations.addSubtask(task, subtaskTitle.trim());
                setSubtaskTitle("");
              }}
            />
            <span className="kbd" aria-hidden="true">
              Enter
            </span>
          </div>
        </div>
        {left > 0 && !isCompleted(task) ? (
          <span className="field-hint flex items-center gap-1">
            <Info size={13} className="flex-none" />
            {t("subtasks_rule")}
          </span>
        ) : null}
      </Field>
      {linked ? (
        <p className="field-hint flex items-center gap-1">
          <CalendarDays size={13} className="flex-none" />
          {t("from_calendar")} {t("linked_fields_hint")}
        </p>
      ) : null}
    </SheetBody>
  );
}
