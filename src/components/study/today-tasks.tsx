"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useToday } from "@/components/providers";
import { SubjectChip } from "@/components/subject-chip";
import { TaskCheckbox } from "@/components/tasks/task-row";
import { TaskSortMenu } from "@/components/tasks/task-sort-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeletons } from "@/components/ui/query-state";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { nextExamBySubject } from "@/lib/domain/calendar";
import { activeSubjects, isArchived, type SubjectBadge } from "@/lib/domain/subjects";
import { isCompleted, orderPatches, pendingSubtasks, sortDayTasks, sortOrderPatches, tasksForDay, type SortContext } from "@/lib/domain/tasks";
import type { Task } from "@/lib/domain/types";
import { useCalendarEvents } from "@/lib/queries/calendar";
import { useSubjects } from "@/lib/queries/subjects";
import { useTaskMutations, useTasks } from "@/lib/queries/tasks";
import { studyStore, useStudy } from "@/lib/study-store";
import { setTaskSort, useTaskSort } from "@/lib/task-sort-prefs";
import { cn } from "@/lib/utils";

/**
 * La tarea arrastrada se mueve solo hacia arriba y hacia abajo, y nunca más allá de la lista de
 * pendientes: si se pasara del final, agrandaría el panel y el desplazamiento automático
 * seguiría bajando sin fin.
 */
const withinList: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 };
  const min = containerNodeRect.top - draggingNodeRect.top;
  const max = containerNodeRect.bottom - draggingNodeRect.bottom;
  return { ...transform, x: 0, y: Math.min(Math.max(transform.y, min), max) };
};

/**
 * Las tareas de hoy (tasksForDay) para tildar durante la sesión; con materia elegida se pueden
 * filtrar. Se ordenan con los mismos criterios que Tareas (y el criterio es el mismo en los dos
 * lados). Con "Mi orden", las pendientes se reordenan arrastrando desde el asa.
 */
export function TodayTasks() {
  const t = useTranslations();
  const today = useToday();
  const { setup } = useStudy();
  const tasksQuery = useTasks();
  const subjectsQuery = useSubjects();
  const calendarQuery = useCalendarEvents();
  const mutations = useTaskMutations();
  const sort = useTaskSort();
  const manual = sort === "manual";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const chosen = setup.subjectId ? subjectMap.get(setup.subjectId) : undefined;

  const sortContext = useMemo<SortContext>(
    () => ({
      subjectRank: new Map(activeSubjects(subjects).map((subject, index) => [subject.id, index])),
      nextExam: nextExamBySubject(calendarQuery.data ?? [], today),
    }),
    [subjects, calendarQuery.data, today],
  );
  const entries = useMemo(() => {
    const archived = new Set(subjects.filter(isArchived).map((subject) => subject.id));
    const visible = (tasksQuery.data ?? []).filter((task) => !task.subject_id || !archived.has(task.subject_id));
    const list = tasksForDay(visible, today, today);
    const shown = setup.filterBySubject && setup.subjectId ? list.filter((entry) => entry.task.subject_id === setup.subjectId) : list;
    return sortDayTasks(shown, sort, sortContext);
  }, [tasksQuery.data, subjects, today, setup.filterBySubject, setup.subjectId, sort, sortContext]);
  const pending = useMemo(() => entries.map((entry) => entry.task).filter((task) => !isCompleted(task)), [entries]);
  const pendingIds = pending.map((task) => task.id);
  const done = entries.length - pending.length;

  const setOpen = (taskId: string, open: boolean) =>
    setExpanded((current) => {
      if (current.has(taskId) === open) return current;
      const next = new Set(current);
      if (open) next.add(taskId);
      else next.delete(taskId);
      return next;
    });

  /** Deja el criterio elegido como orden propio de las pendientes de hoy y vuelve a "Mi orden". */
  function saveSortAsMine() {
    mutations.reorder(sortOrderPatches(pending, sort, sortContext));
    setTaskSort("manual");
    toast(t("sort_saved"));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = pendingIds.indexOf(String(active.id));
    const to = pendingIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    mutations.reorder(orderPatches(arrayMove(pending, from, to)));
  }

  const titleOf = (id: string | number) => pending.find((task) => task.id === id)?.title ?? "";
  const positionOf = (id: string | number) => pendingIds.indexOf(String(id)) + 1;
  const rowProps = (task: Task) => ({
    task,
    subject: task.subject_id ? subjectMap.get(task.subject_id) : undefined,
    open: task.subtasks.length > 0 && expanded.has(task.id),
    onOpenChange: (open: boolean) => setOpen(task.id, open),
    onToggle: () => void mutations.toggle(task),
    onToggleSubtask: (subtaskId: string) => mutations.toggleSubtask(task, subtaskId),
  });

  return (
    <>
      <div className="side-panel-head">
        <div className="t">
          <span className="flex items-center gap-2">
            {t("today_tasks")}
            <span className="badge tnum">
              {done}/{entries.length}
            </span>
          </span>
          <TaskSortMenu sort={sort} onSave={saveSortAsMine} canSave={pending.length > 0} compact />
        </div>
        {chosen ? (
          <Switch checked={setup.filterBySubject} onChange={(value) => studyStore.setFilterBySubject(value)}>
            {t("only_subject", { name: chosen.name })}
          </Switch>
        ) : (
          <span className="field-hint">{t("pick_subject_to_filter")}</span>
        )}
        {manual ? null : (
          <p className="sort-note" role="status">
            <span className="field-hint">{t("sort_hint", { name: t(`sort_${sort}`) })}</span>
            <Button variant="ghost" size="sm" onClick={() => setTaskSort("manual")}>
              {t("sort_back")}
            </Button>
          </p>
        )}
      </div>
      <div className="side-panel-body">
        {tasksQuery.isError ? (
          <p className="day-empty p-4" role="alert">
            {t("load_error")}
          </p>
        ) : tasksQuery.isPending ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeletons count={3} className="h-9" label={t("tasks_loading")} />
          </div>
        ) : entries.length === 0 ? (
          <p className="day-empty p-4">{t("no_tasks_today")}</p>
        ) : null}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[withinList]}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: t("today_tasks_dnd") },
            announcements: {
              onDragStart: ({ active }) => t("dnd_picked", { title: titleOf(active.id) }),
              onDragOver: ({ over }) => (over ? t("subject_dnd_over", { position: positionOf(over.id), total: pendingIds.length }) : undefined),
              onDragEnd: ({ active, over }) =>
                over
                  ? t("subject_dnd_dropped", { name: titleOf(active.id), position: positionOf(over.id), total: pendingIds.length })
                  : t("dnd_cancelled"),
              onDragCancel: () => t("dnd_cancelled"),
            },
          }}
        >
          <SortableContext items={pendingIds} strategy={verticalListSortingStrategy}>
            {/* El contenedor de las pendientes: hasta acá llega el arrastre (ver withinList). */}
            <div className="mini-sortable">
              {pending.map((task) =>
                manual ? (
                  <SortableMiniTask key={task.id} {...rowProps(task)} />
                ) : (
                  <MiniTask key={task.id} {...rowProps(task)} grip={<span className="grip mini-grip" aria-disabled="true" />} />
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
        {entries
          .filter((entry) => isCompleted(entry.task))
          .map(({ task }) => (
            <MiniTask key={task.id} {...rowProps(task)} grip={<span className="grip mini-grip" aria-disabled="true" />} />
          ))}
      </div>
    </>
  );
}

type MiniTaskProps = {
  task: Task;
  subject?: SubjectBadge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  onToggleSubtask: (subtaskId: string) => void;
};

/** Tarea pendiente: se arrastra (mouse, dedo o teclado) solo desde el asa, así tildar y hacer scroll siguen iguales. */
function SortableMiniTask(props: MiniTaskProps) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <MiniTask
      {...props}
      groupRef={setNodeRef}
      className={isDragging ? "is-dragging" : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      grip={
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="grip mini-grip"
          {...attributes}
          {...listeners}
          aria-label={t("drag_mini_task", { title: props.task.title })}
          aria-roledescription={t("drag_handle")}
        >
          <GripVertical size={16} />
        </button>
      }
    />
  );
}

type MiniTaskViewProps = MiniTaskProps & {
  grip: ReactNode;
  groupRef?: (node: HTMLDivElement | null) => void;
  className?: string;
  style?: CSSProperties;
};

function MiniTask({ task, subject, open, onOpenChange, onToggle, onToggleSubtask, grip, groupRef, className, style }: MiniTaskViewProps) {
  const t = useTranslations();
  const total = task.subtasks.length;
  const left = pendingSubtasks(task);
  return (
    <div ref={groupRef} className={cn("mini-task-group", className)} style={style} data-task={task.id}>
      <div className={cn("mini-task", isCompleted(task) && "is-done")}>
        {grip}
        {/* Bloqueada por subtareas pendientes: al tocarla se despliegan para poder tildarlas. */}
        <TaskCheckbox task={task} size="sm" onToggle={onToggle} onBlocked={() => onOpenChange(true)} />
        {/* Si no entran lado a lado (tarea con subtareas), la materia baja a un segundo renglón. */}
        <span className="mt-main">
          <span className="mt-title">{task.title}</span>
          {subject ? <SubjectChip subject={subject} /> : null}
        </span>
        {total > 0 ? (
          <>
            <span className={cn("subcount", left === 0 && "is-complete")} aria-label={t("subtasks_progress", { done: total - left, total })}>
              <ListTodo size={14} />
              {total - left}/{total}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm expand-btn"
              aria-expanded={open}
              aria-label={`${open ? t("collapse_subtasks") : t("expand_subtasks")}: ${task.title}`}
              onClick={() => onOpenChange(!open)}
            >
              <ChevronDown size={18} />
            </button>
          </>
        ) : null}
      </div>
      {open ? (
        <div className="mini-subtasks">
          {task.subtasks.map((subtask) => (
            <div key={subtask.id} className={cn("subtask", subtask.completed_at && "is-done")}>
              <Checkbox size="sm" checked={subtask.completed_at !== null} label={subtask.title} onChange={() => onToggleSubtask(subtask.id)} />
              <span className="subtask-title">{subtask.title}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
