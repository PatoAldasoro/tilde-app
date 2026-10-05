"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { Progress } from "@/components/ui/progress";
import { diffDays, formatDayMonth, weekdayOf, type IsoDate } from "@/lib/domain/dates";
import { progressOf } from "@/lib/domain/progress";
import type { SubjectBadge } from "@/lib/domain/subjects";
import { isCompleted, isDaily, type DayTask } from "@/lib/domain/tasks";
import type { Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { useDayLabel } from "./labels";
import { TaskRow, type TaskRowProps } from "./task-row";
import type { DragData, DropData } from "./tasks-dnd";

export type RowHandlers = {
  onToggle: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onOpen: (task: Task) => void;
  onSelect: (task: Task) => void;
  onExpand: (task: Task) => void;
  /** Atajos del asa sin levantar la tarea: ↑/↓ reordenan, Re Pág/Av Pág cambian de día. */
  onGripKey: (task: Task, day: IsoDate, key: "ArrowUp" | "ArrowDown" | "PageUp" | "PageDown") => void;
};

type DayGroupProps = {
  day: IsoDate;
  today: IsoDate;
  entries: DayTask[];
  subjects: Map<string, SubjectBadge>;
  expanded: Set<string>;
  selecting: boolean;
  selected: Set<string>;
  /** Tarea que se está arrastrando (id) y desde qué día. */
  dragging: { taskId: string; fromDay: IsoDate } | null;
  /** Posición de inserción dentro de las pendientes de este día (sin contar la arrastrada). */
  dropIndex: number | null;
  /** El día no acepta la tarea que se arrastra (tiene fecha límite y es de otro día). */
  blocked: boolean;
  handlers: RowHandlers;
  onQuickAdd: (day: IsoDate, title: string) => void;
};

/** Un día de la lista: encabezado con progreso, agregar rápido y sus tareas. */
export function DayGroup(props: DayGroupProps) {
  const { day, today, entries, subjects, expanded, selecting, selected, dragging, dropIndex, blocked, handlers } = props;
  const t = useTranslations();
  const headingId = useId();
  const dayLabel = useDayLabel(today);
  const progress = progressOf(entries.map((entry) => entry.task));
  const pendingCount = entries.filter((entry) => !isCompleted(entry.task)).length;
  const { setNodeRef } = useDroppable({
    id: `day:${day}`,
    data: { type: "day", day, empty: pendingCount === 0 } satisfies DropData,
  });

  const diff = diffDays(today, day);
  const weekday = t("wd_short").split(",")[weekdayOf(day) - 1];
  const sourceId = dragging?.fromDay === day ? dragging.taskId : null;
  const items = withInsertLine(entries, dropIndex, sourceId);

  return (
    <section
      ref={setNodeRef}
      className={cn("day-group", dropIndex !== null && "is-drop-target", blocked && "is-drop-blocked")}
      aria-labelledby={headingId}
      data-day={day}
    >
      <div className="day-head">
        <h2 className="day-title" id={headingId}>
          {dayLabel(day)}
        </h2>
        <span className="day-date">{diff === 0 || diff === 1 ? `${weekday} ${formatDayMonth(day)}` : formatDayMonth(day)}</span>
        <span className="grow" />
        <span className="day-count tnum" aria-label={t("done_of", { done: progress.done, total: progress.total })}>
          {progress.done}/{progress.total}
        </span>
        <Progress
          size="xs"
          value={progress.percent}
          label={t("day_progress")}
          bar={progress.percent === 100 ? "var(--color-success)" : undefined}
        />
      </div>
      {selecting ? null : (
        <QuickAdd label={t("quick_add_label", { day: dayLabel(day, { lowercase: true }) })} onAdd={(title) => props.onQuickAdd(day, title)} />
      )}
      <div className="task-list">
        {items.length === 0 ? <p className="day-empty">{diff === 0 ? t("day_empty_today") : t("day_empty")}</p> : null}
        {items.map((item) => {
          if (item === "line") return <div key="insert-line" className="insert-line" aria-hidden="true" />;
          const { task, carriedDays } = item;
          const rowProps = {
            task,
            day,
            today,
            carriedDays,
            subject: task.subject_id ? subjects.get(task.subject_id) : undefined,
            expanded: expanded.has(task.id),
            selecting,
            selected: selected.has(task.id),
            onToggle: () => handlers.onToggle(task),
            onToggleSubtask: (subtaskId: string) => handlers.onToggleSubtask(task, subtaskId),
            onOpen: () => handlers.onOpen(task),
            onSelect: () => handlers.onSelect(task),
            onExpand: () => handlers.onExpand(task),
          } satisfies TaskRowProps;
          return isCompleted(task) || selecting ? (
            <TaskRow key={task.id} {...rowProps} grip={<span className="grip" aria-disabled="true" />} />
          ) : (
            <DraggableRow
              key={task.id}
              rowProps={rowProps}
              isSource={task.id === sourceId}
              onGripKey={(key) => handlers.onGripKey(task, day, key)}
            />
          );
        })}
      </div>
    </section>
  );
}

/**
 * Intercala la línea de inserción: va antes de la pendiente número `dropIndex` (sin contar la
 * que se arrastra) y, si cae al final, antes de las completadas.
 */
function withInsertLine(entries: DayTask[], dropIndex: number | null, sourceId: string | null): (DayTask | "line")[] {
  if (dropIndex === null) return entries;
  const items: (DayTask | "line")[] = [];
  let pendingSeen = 0;
  let placed = false;
  for (const entry of entries) {
    const done = isCompleted(entry.task);
    const isSource = entry.task.id === sourceId;
    if (!placed && (done || (!isSource && pendingSeen === dropIndex))) {
      items.push("line");
      placed = true;
    }
    if (!done && !isSource) pendingSeen += 1;
    items.push(entry);
  }
  if (!placed) items.push("line");
  return items;
}

const GRIP_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown"] as const;
type GripKey = (typeof GRIP_KEYS)[number];

type DraggableRowProps = { rowProps: TaskRowProps; isSource: boolean; onGripKey: (key: GripKey) => void };

/** Fila pendiente: se arrastra solo desde el asa (puntero, touch o teclado) y también es destino. */
function DraggableRow({ rowProps, isSource, onGripKey }: DraggableRowProps) {
  const t = useTranslations();
  const { task, day } = rowProps;
  const id = `${task.id}@${day}`;
  const { attributes, listeners, isDragging, setNodeRef: setDragRef, setActivatorNodeRef } = useDraggable({
    id,
    data: { taskId: task.id, day, daily: isDaily(task) } satisfies DragData,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id, data: { type: "row", taskId: task.id, day } satisfies DropData });

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const key = GRIP_KEYS.find((candidate) => candidate === event.key);
    if (key && !isDragging) {
      event.preventDefault();
      onGripKey(key);
      return;
    }
    listeners?.onKeyDown?.(event);
  }

  return (
    <TaskRow
      {...rowProps}
      rowRef={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={isSource ? "is-dragging-source" : undefined}
      grip={
        <button
          type="button"
          ref={setActivatorNodeRef}
          id={`grip-${task.id}-${day}`}
          className="grip"
          {...attributes}
          {...listeners}
          aria-label={t("drag_task", { title: task.title })}
          aria-roledescription={t("drag_handle")}
          onKeyDown={onKeyDown}
        >
          <GripVertical size={18} />
        </button>
      }
    />
  );
}

function QuickAdd({ label, onAdd }: { label: string; onAdd: (title: string) => void }) {
  const t = useTranslations();
  const id = useId();
  const [title, setTitle] = useState("");
  return (
    <div className="quick-add">
      <Plus size={18} />
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={title}
        maxLength={300}
        placeholder={t("quick_add_ph")}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !title.trim()) return;
          onAdd(title.trim());
          setTitle("");
        }}
      />
      <span className="kbd" aria-hidden="true">
        Enter
      </span>
    </div>
  );
}
