"use client";

import { Calendar, ChevronDown, CircleAlert, Flag, History, ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode, Ref } from "react";
import { SubjectChip } from "@/components/subject-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { formatDayMonth, type IsoDate } from "@/lib/domain/dates";
import { dueStatus, isCompleted, pendingSubtasks } from "@/lib/domain/tasks";
import type { Priority, Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const PRIORITY_CLASS: Record<Priority, string> = { none: "", low: "p1", medium: "p2", high: "p3" };
export const PRIORITY_LABEL = { none: "prio_none", low: "prio_low", medium: "prio_med", high: "prio_high" } as const;

/** Bandera de prioridad: rellena en media y alta, contorno en baja (no depende solo del color). */
export function PriorityFlag({ priority, size = 16 }: { priority: Priority; size?: number }) {
  return <Flag size={size} fill={priority === "medium" || priority === "high" ? "currentColor" : "none"} />;
}

/** Checkbox de una tarea: bloqueado (con el motivo) mientras tenga subtareas pendientes. */
export function TaskCheckbox({ task, onToggle, size }: { task: Task; onToggle: () => void; size?: "sm" | "md" }) {
  const t = useTranslations();
  const left = pendingSubtasks(task);
  const blocked = !isCompleted(task) && left > 0;
  const reason = blocked ? t("subtasks_left", { n: left }) : undefined;
  return (
    <Checkbox
      size={size}
      checked={isCompleted(task)}
      label={`${isCompleted(task) ? t("mark_pending") : t("mark_done")}: ${task.title}`}
      blockedReason={reason}
      onBlocked={() => {
        // En táctil no hay hover: además del tooltip, se avisa con un toast.
        if (reason && window.matchMedia("(hover: none)").matches) toast(reason);
      }}
      onChange={onToggle}
    />
  );
}

export type TaskRowProps = {
  task: Task;
  day: IsoDate;
  today: IsoDate;
  carriedDays: number;
  subject?: { name: string; color_key: string };
  expanded: boolean;
  selecting: boolean;
  selected: boolean;
  /** Asa de arrastre (o nada, en la copia que sigue al puntero). */
  grip?: ReactNode;
  className?: string;
  rowRef?: Ref<HTMLDivElement>;
  onToggle: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onOpen: () => void;
  onSelect: () => void;
  onExpand: () => void;
};

/** Fila de tarea: asa · checkbox · título · chip de materia · arrastre · prioridad · fecha límite · subtareas. */
export function TaskRow(props: TaskRowProps) {
  const { task, day, today, carriedDays, subject, expanded, selecting, selected, grip, className, rowRef } = props;
  const t = useTranslations();
  const done = isCompleted(task);
  const due = dueStatus(task, today);
  const subtaskCount = task.subtasks.length;
  const left = pendingSubtasks(task);
  const showSubtasks = expanded && subtaskCount > 0;

  return (
    <div
      ref={rowRef}
      className={cn("task", done && "is-done", selected && "is-selected", className)}
      data-flip={`${task.id}@${day}`}
      data-task={task.id}
    >
      <div className="task-row">
        {selecting ? (
          <>
            <span className="select-gap" />
            <Checkbox variant="select" checked={selected} label={t("select_task", { title: task.title })} onChange={props.onSelect} />
          </>
        ) : (
          <>
            {grip}
            <TaskCheckbox task={task} onToggle={props.onToggle} />
          </>
        )}
        <div className="task-main">
          <button type="button" className="task-title" onClick={selecting ? props.onSelect : props.onOpen}>
            {task.title}
          </button>
          <span className="task-meta">
            {subject ? <SubjectChip subject={subject} /> : null}
            {carriedDays > 0 ? (
              <span className="carry">
                <History size={13} />
                {carriedDays === 1 ? t("from_yesterday") : t("days_ago", { n: carriedDays })}
              </span>
            ) : null}
          </span>
        </div>
        <div className="task-side">
          {task.priority !== "none" ? (
            <span
              className={cn("flag", PRIORITY_CLASS[task.priority])}
              role="img"
              aria-label={`${t("priority")}: ${t(PRIORITY_LABEL[task.priority])}`}
              data-tip={`${t("priority")}: ${t(PRIORITY_LABEL[task.priority])}`}
            >
              <PriorityFlag priority={task.priority} />
            </span>
          ) : null}
          {due ? (
            <span
              className={cn(
                "due",
                due.kind === "overdue" && "is-overdue",
                due.kind === "today" && "is-today",
                (due.kind === "tomorrow" || (due.kind === "upcoming" && due.soon)) && "is-soon",
              )}
            >
              {due.kind === "overdue" ? <CircleAlert size={13} /> : <Calendar size={13} />}
              {due.kind === "done"
                ? formatDayMonth(due.dueDate)
                : due.kind === "overdue"
                  ? t("overdue")
                  : due.kind === "today"
                    ? t("due_today")
                    : due.kind === "tomorrow"
                      ? t("due_tomorrow")
                      : t("due_in", { n: due.days })}
            </span>
          ) : null}
          {subtaskCount > 0 ? (
            <>
              <span
                className={cn("subcount", left === 0 && "is-complete")}
                aria-label={t("subtasks_progress", { done: subtaskCount - left, total: subtaskCount })}
              >
                <ListTodo size={14} />
                {subtaskCount - left}/{subtaskCount}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm expand-btn"
                aria-expanded={showSubtasks}
                aria-label={showSubtasks ? t("collapse_subtasks") : t("expand_subtasks")}
                onClick={props.onExpand}
              >
                <ChevronDown size={18} />
              </button>
            </>
          ) : (
            <span className="side-gap" aria-hidden="true" />
          )}
        </div>
      </div>
      {showSubtasks ? (
        <div className="subtasks">
          {task.subtasks.map((subtask) => (
            <div key={subtask.id} className={cn("subtask", subtask.completed_at && "is-done")}>
              <Checkbox
                size="sm"
                checked={subtask.completed_at !== null}
                label={subtask.title}
                onChange={() => props.onToggleSubtask(subtask.id)}
              />
              <span className="subtask-title">{subtask.title}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
