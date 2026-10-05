"use client";

import { Calendar, CircleAlert, ClipboardCopy, FileUp, ListTodo, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { useProfile, useToday } from "@/components/providers";
import { SubjectChip } from "@/components/subject-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { formatDayMonth, type IsoDate } from "@/lib/domain/dates";
import { activeSubjects } from "@/lib/domain/subjects";
import { firstVisibleDay, parseTaskImport, TASK_IMPORT_LIMIT, taskImportExample, type ImportedTask } from "@/lib/domain/task-import";
import { useTaskMutations } from "@/lib/queries/tasks";
import type { SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useDayLabel } from "./labels";
import { PRIORITY_CLASS, PRIORITY_LABEL, PriorityFlag } from "./task-row";

/** Los planes son texto: más de esto no es un plan. */
const MAX_FILE_BYTES = 1_000_000;

type TaskImportDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; subjects: SubjectRow[] };

export function TaskImportDialog({ open, onOpenChange, subjects }: TaskImportDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent size="lg" title={t("import_tasks")} description={t("import_tasks_desc")}>
          <TaskImportForm subjects={subjects} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function TaskImportForm({ subjects, onDone }: { subjects: SubjectRow[]; onDone: () => void }) {
  const t = useTranslations();
  const id = useId();
  const today = useToday();
  const dayLabel = useDayLabel(today);
  const defaultLeadDays = useProfile().default_task_lead_days;
  const mutations = useTaskMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState(false);

  const active = useMemo(() => activeSubjects(subjects), [subjects]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const result = useMemo(
    () => (text.trim() ? parseTaskImport(text, { today, subjects: active, defaultLeadDays }) : null),
    [text, today, active, defaultLeadDays],
  );
  const tasks = useMemo(() => (result?.ok ? result.tasks : []), [result]);

  // Vista previa: por el primer día en que cada tarea aparece en la lista.
  const groups = useMemo(() => {
    const map = new Map<IsoDate, ImportedTask[]>();
    for (const task of tasks) {
      const day = firstVisibleDay(task, today);
      const list = map.get(day);
      if (list) list.push(task);
      else map.set(day, [task]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, today]);

  const example = useMemo(() => taskImportExample(today, active[0]?.name ?? t("import_example_subject")), [today, active, t]);
  const prompt = [
    t("import_prompt_intro"),
    example,
    active.length > 0
      ? t("import_prompt_rules", { subjects: active.map((subject) => `«${subject.name}»`).join(", "), today })
      : t("import_prompt_rules_no_subjects", { today }),
    t("import_prompt_outro"),
  ].join("\n\n");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      toast(t("import_prompt_copied"));
    } catch {
      // Sin permiso para el portapapeles: el pedido queda a la vista para copiarlo a mano.
      document.getElementById(`${id}-prompt`)?.setAttribute("open", "");
      toast(t("import_prompt_copy_failed"));
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError(true);
      return;
    }
    setFileError(false);
    setText(await file.text());
  }

  function submit() {
    if (tasks.length === 0) return;
    const ids = mutations.createMany(tasks);
    toast(t("tasks_imported", { n: ids.length }), { action: { label: t("undo"), onAction: () => mutations.remove(ids) } });
    onDone();
  }

  const errorText =
    fileError ? t("import_file_too_big")
    : result && !result.ok
      ? result.error === "too_many"
        ? t("import_error_too_many", { n: TASK_IMPORT_LIMIT })
        : result.error === "no_tasks"
          ? t("import_error_no_tasks")
          : t("import_error_invalid")
      : null;

  return (
    <>
      <DialogBody>
        <section className="import-step">
          <div className="import-step-head">
            <Sparkles size={18} className="flex-none" />
            <div className="min-w-0 flex-1">
              <strong>{t("import_ai_title")}</strong>
              <p className="field-hint">{t("import_ai_text")}</p>
            </div>
            <Button onClick={() => void copyPrompt()}>
              <ClipboardCopy size={18} />
              {t("import_copy_prompt")}
            </Button>
          </div>
          <details className="import-details" id={`${id}-prompt`}>
            <summary>{t("import_see_prompt")}</summary>
            <pre className="import-code" tabIndex={0}>
              {prompt}
            </pre>
          </details>
        </section>

        <Field label={t("import_plan_label")} htmlFor={`${id}-text`} hint={t("import_plan_hint")}>
          <textarea
            id={`${id}-text`}
            className="textarea import-text"
            rows={6}
            spellCheck={false}
            value={text}
            placeholder={'{ "tasks": [ { "title": "…", "date": "' + today + '" } ] }'}
            aria-invalid={errorText ? true : undefined}
            aria-describedby={errorText ? `${id}-error` : undefined}
            onChange={(event) => {
              setText(event.target.value);
              setFileError(false);
            }}
          />
        </Field>
        <div className="btn-row -mt-2 items-center">
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <FileUp size={18} />
            {t("import_choose_file")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="visually-hidden"
            tabIndex={-1}
            aria-label={t("import_choose_file")}
            onChange={(event) => {
              void readFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        {errorText ? (
          <p className="notice notice-danger" role="alert" id={`${id}-error`}>
            <CircleAlert size={18} className="flex-none" />
            <span>{errorText}</span>
          </p>
        ) : null}

        {result?.ok ? (
          <section aria-label={t("import_preview")} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="section-label">{t("import_preview")}</h3>
              <span className="field-hint" role="status">
                {t("import_summary", { tasks: t("tasks_n", { n: tasks.length }), days: groups.length })}
              </span>
            </div>
            {tasks.length > 0 ? (
              <div className="import-preview" tabIndex={0}>
                {groups.map(([day, list]) => (
                  <div key={day} className="import-day">
                    <div className="import-day-head">
                      <strong>{dayLabel(day)}</strong>
                      <span className="tnum">{formatDayMonth(day)}</span>
                    </div>
                    <ul>
                      {list.map((task, index) => {
                        const subject = task.subject_id ? subjectMap.get(task.subject_id) : undefined;
                        return (
                          <li key={index} className="import-row">
                            <span className="min-w-0 flex-1 truncate" title={task.title}>
                              {task.title}
                            </span>
                            {subject ? <SubjectChip subject={subject} /> : null}
                            {task.subtasks.length > 0 ? (
                              <span className="subcount" aria-label={t("subtasks_count", { n: task.subtasks.length })}>
                                <ListTodo size={14} />
                                {task.subtasks.length}
                              </span>
                            ) : null}
                            {task.due_date ? (
                              <span className="due">
                                <Calendar size={13} />
                                {formatDayMonth(task.due_date)}
                              </span>
                            ) : null}
                            {task.priority !== "none" ? (
                              <span className={cn("flag", PRIORITY_CLASS[task.priority])} role="img" aria-label={`${t("priority")}: ${t(PRIORITY_LABEL[task.priority])}`}>
                                <PriorityFlag priority={task.priority} />
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
            {result.unknownSubjects.length > 0 ? (
              <p className="notice">
                <CircleAlert size={18} className="flex-none" />
                <span>{t("import_unknown_subjects", { names: result.unknownSubjects.join(", ") })}</span>
              </p>
            ) : null}
            {result.issues.length > 0 ? (
              <div className="notice notice-danger flex-col items-start" role="alert">
                <strong>{t("import_issues", { n: result.issues.length })}</strong>
                <ul className="import-issues">
                  {result.issues.slice(0, 8).map((issue) => (
                    <li key={issue.position}>{t(`import_issue_${issue.code}`, { position: issue.position, value: issue.value })}</li>
                  ))}
                  {result.issues.length > 8 ? <li>{t("import_issues_more", { n: result.issues.length - 8 })}</li> : null}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <span className="spacer" />
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button variant="primary" disabled={tasks.length === 0} onClick={submit}>
          {tasks.length > 0 ? t("import_n_tasks", { n: tasks.length }) : t("import")}
        </Button>
      </DialogFooter>
    </>
  );
}
