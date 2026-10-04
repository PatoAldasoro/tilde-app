"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowDownWideNarrow, Calendar, CircleCheckBig, Ellipsis, GripVertical, ListChecks, SquareCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToday } from "@/components/providers";
import { PageFrame } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { DateField } from "@/components/ui/date-field";
import { Empty } from "@/components/ui/empty";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { LoadError, Skeletons } from "@/components/ui/query-state";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import { useFlip } from "@/hooks/use-flip";
import { addDays, formatDayMonth, weekdayOf, type IsoDate } from "@/lib/domain/dates";
import { progressOf } from "@/lib/domain/progress";
import { activeSubjects, subjectClass } from "@/lib/domain/subjects";
import {
  canDropOnDay,
  daysInRange,
  isCompleted,
  isDaily,
  moveItem,
  orderPatches,
  priorityOrderPatches,
  tasksForDay,
  type DayTask,
} from "@/lib/domain/tasks";
import type { Task } from "@/lib/domain/types";
import { useSubjects } from "@/lib/queries/subjects";
import { useTaskMutations, useTasks } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";
import { DayGroup, type RowHandlers } from "./day-group";
import { useDayLabel } from "./labels";
import { TaskRow } from "./task-row";
import { TaskSheet } from "./task-sheet";
import { taskCollision, taskKeyboardCoordinates, type DragData, type DropData } from "./tasks-dnd";

type Mode = "general" | "subject";
type Range = "today" | "week" | "date";
type DropTarget = { day: IsoDate; index: number };
type DragState = { taskId: string; fromDay: IsoDate; target: DropTarget | null; blockedDay: IsoDate | null };

/**
 * Altura del arrastre para comparar con las filas: el puntero (mouse, lápiz o dedo) o, con
 * teclado, el centro de la fila levantada. `delta` ya viene corregido por el auto-scroll.
 */
function dragY(event: DragMoveEvent | DragEndEvent): number | null {
  const start = event.activatorEvent;
  if (start instanceof MouseEvent) return start.clientY + event.delta.y;
  if (typeof TouchEvent !== "undefined" && start instanceof TouchEvent && start.touches[0]) {
    return start.touches[0].clientY + event.delta.y;
  }
  const rect = event.active.rect.current.translated;
  return rect ? rect.top + rect.height / 2 : null;
}

const pendingOf = (entries: DayTask[]) => entries.filter((entry) => !isCompleted(entry.task)).map((entry) => entry.task);

/** Tareas: lista por día con progreso, filtros, subtareas, drag & drop, selección y borrado. */
export function TasksView() {
  const t = useTranslations();
  const today = useToday();
  const dayLabel = useDayLabel(today);
  const tasksQuery = useTasks();
  const subjectsQuery = useSubjects();
  const mutations = useTaskMutations();

  const [mode, setMode] = useState<Mode>("general");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("week");
  const [pickedDate, setPickedDate] = useState<IsoDate | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  useFlip(listRef, drag === null);

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const active = useMemo(() => activeSubjects(subjects), [subjects]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const chosenSubject = active.some((subject) => subject.id === subjectFilter) ? subjectFilter : (active[0]?.id ?? null);

  // Las tareas de materias archivadas no aparecen en Tareas.
  const allTasks = useMemo(() => {
    const archivedIds = new Set(subjects.filter((subject) => subject.archived_at !== null).map((subject) => subject.id));
    return (tasksQuery.data ?? []).filter((task) => !task.subject_id || !archivedIds.has(task.subject_id));
  }, [tasksQuery.data, subjects]);
  const tasks = useMemo(
    () => (mode === "subject" ? allTasks.filter((task) => task.subject_id === chosenSubject) : allTasks),
    [allTasks, mode, chosenSubject],
  );
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const days = daysInRange(range, today, pickedDate);
  const lists = useMemo(() => {
    const visibleDays = daysInRange(range, today, pickedDate);
    return new Map(visibleDays.map((day) => [day, tasksForDay(tasks, day, today)]));
  }, [tasks, range, today, pickedDate]);
  const todayEntries = useMemo(() => tasksForDay(tasks, today, today), [tasks, today]);
  const todayProgress = progressOf(todayEntries.map((entry) => entry.task));
  const allDone = todayProgress.total > 0 && todayProgress.done === todayProgress.total;
  const visibleIds = useMemo(() => [...new Set([...lists.values()].flatMap((entries) => entries.map((entry) => entry.task.id)))], [lists]);
  const openTask = openTaskId ? ((tasksQuery.data ?? []).find((task) => task.id === openTaskId) ?? null) : null;

  // Esc sale del modo selección.
  useEffect(() => {
    if (!selecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setSelecting(false);
      setSelected(new Set());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selecting]);

  // ---------- acciones ----------

  const toggleIn = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  async function deleteTasks(ids: string[]) {
    if (ids.length === 0) return;
    const ok = await confirm({
      title: t("delete_tasks_q", { n: ids.length }),
      body: t("delete_tasks_body"),
      confirmLabel: t("delete_tasks", { n: ids.length }),
      danger: true,
    });
    if (!ok) return;
    const deleted = mutations.remove(ids);
    setSelecting(false);
    setSelected(new Set());
    setOpenTaskId(null);
    toast(t("tasks_deleted", { n: ids.length }), { action: { label: t("undo"), onAction: () => mutations.restore(deleted) } });
  }

  function sortByPriority() {
    mutations.reorder(priorityOrderPatches(tasks));
    toast(t("sorted_priority"));
  }

  function focusGrip(taskId: string, day: IsoDate) {
    requestAnimationFrame(() => document.getElementById(`grip-${taskId}-${day}`)?.focus());
  }

  /** Aplica un movimiento: reordena dentro del día destino y, si cambió de día, mueve la tarea. */
  function applyMove(task: Task, fromDay: IsoDate, target: DropTarget) {
    const pending = pendingOf(lists.get(target.day) ?? tasksForDay(tasks, target.day, today));
    const desired = moveItem(pending, task, target.index);
    const moved = target.day !== fromDay && isDaily(task);
    mutations.reorder(orderPatches(desired), moved ? { id: task.id, planned_date: target.day } : undefined);
    if (moved) toast(t("moved_to", { day: dayLabel(target.day, { lowercase: true }), date: formatDayMonth(target.day) }));
  }

  const handlers: RowHandlers = {
    onToggle: (task) => void mutations.toggle(task),
    onToggleSubtask: (task, subtaskId) => mutations.toggleSubtask(task, subtaskId),
    onOpen: (task) => setOpenTaskId(task.id),
    onSelect: (task) => setSelected((current) => toggleIn(current, task.id)),
    onExpand: (task) => setExpanded((current) => toggleIn(current, task.id)),
    onGripKey: (task, day, key) => {
      if (key === "ArrowUp" || key === "ArrowDown") {
        const pending = pendingOf(lists.get(day) ?? []);
        const index = pending.findIndex((item) => item.id === task.id);
        const next = index + (key === "ArrowUp" ? -1 : 1);
        if (index < 0 || next < 0 || next >= pending.length) return;
        applyMove(task, day, { day, index: next });
        focusGrip(task.id, day);
        return;
      }
      // Re Pág / Av Pág: solo las tareas diarias cambian de día, y nunca antes de hoy.
      const targetDay = addDays(day, key === "PageUp" ? -1 : 1);
      if (!isDaily(task) || targetDay < today) return;
      const pendingThere = pendingOf(lists.get(targetDay) ?? tasksForDay(tasks, targetDay, today));
      applyMove(task, day, { day: targetDay, index: pendingThere.length });
      focusGrip(task.id, targetDay);
    },
  };

  // ---------- drag & drop ----------

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: taskKeyboardCoordinates }),
  );

  function targetFor(event: DragMoveEvent | DragEndEvent): Pick<DragState, "target" | "blockedDay"> {
    const { active: dragged, over } = event;
    const origin = dragged.data.current as DragData | undefined;
    const destination = over?.data.current as DropData | undefined;
    const task = origin ? taskById.get(origin.taskId) : undefined;
    if (!origin || !destination || !over || !task) return { target: null, blockedDay: null };
    if (!canDropOnDay(task, origin.day, destination.day)) return { target: null, blockedDay: destination.day };

    const dayPending = pendingOf(lists.get(destination.day) ?? []);
    const others = dayPending.filter((item) => item.id !== task.id);
    if (destination.type === "day") return { target: { day: destination.day, index: others.length }, blockedDay: null };
    if (destination.taskId === task.id) {
      return { target: { day: destination.day, index: dayPending.findIndex((item) => item.id === task.id) }, blockedDay: null };
    }
    // Antes o después según la mitad vertical de la fila destino.
    const index = others.findIndex((item) => item.id === destination.taskId);
    const y = dragY(event);
    const after = y !== null && y > over.rect.top + over.rect.height / 2;
    return { target: { day: destination.day, index: index + (after ? 1 : 0) }, blockedDay: null };
  }

  function onDragStart(event: DragStartEvent) {
    const origin = event.active.data.current as DragData;
    setDrag({ taskId: origin.taskId, fromDay: origin.day, target: null, blockedDay: null });
  }

  function onDragMove(event: DragMoveEvent) {
    const next = targetFor(event);
    setDrag((current) => {
      if (!current) return current;
      const same =
        current.blockedDay === next.blockedDay &&
        current.target?.day === next.target?.day &&
        current.target?.index === next.target?.index;
      return same ? current : { ...current, ...next };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const origin = event.active.data.current as DragData | undefined;
    const { target } = targetFor(event);
    setDrag(null);
    const task = origin ? taskById.get(origin.taskId) : undefined;
    if (!origin || !task || !target) return;
    applyMove(task, origin.day, target);
    focusGrip(task.id, target.day);
  }

  const dragTask = drag ? taskById.get(drag.taskId) : undefined;
  const dragTarget = drag?.target ?? null;
  const positionOf = (target: DropTarget) => ({
    position: target.index + 1,
    total: pendingOf(lists.get(target.day) ?? []).filter((item) => item.id !== drag?.taskId).length + 1,
    day: dayLabel(target.day, { lowercase: true }),
  });

  // ---------- render ----------

  const isPending = tasksQuery.isPending || subjectsQuery.isPending;
  const isError = tasksQuery.isError || subjectsQuery.isError;
  const hasTasks = (tasksQuery.data?.length ?? 0) > 0;
  const weekdayLong = t("wd_long").split(",")[weekdayOf(today) - 1];

  return (
    <PageFrame
      title={t("nav_tasks")}
      width="narrow"
      actions={
        selecting ? null : (
          <>
            <Button variant="ghost" onClick={sortByPriority} disabled={tasks.length === 0}>
              <ArrowDownWideNarrow size={18} />
              {t("sort_priority")}
            </Button>
            <Button
              disabled={visibleIds.length === 0}
              onClick={() => {
                setSelecting(true);
                setSelected(new Set());
              }}
            >
              <SquareCheck size={18} />
              {t("select")}
            </Button>
            <Menu>
              <MenuTrigger className="btn btn-ghost btn-icon" aria-label={t("more_options")}>
                <Ellipsis size={20} />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Trash2 size={18} />} danger disabled={visibleIds.length === 0} onSelect={() => void deleteTasks(visibleIds)}>
                  {t("delete_all_n", { n: visibleIds.length })}
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        )
      }
    >
      <div className="toolbar">
        <Segmented
          label={t("view")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "general", label: t("general") },
            { value: "subject", label: t("by_subject") },
          ]}
        />
        <Segmented
          label={t("date_filter")}
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: t("f_today") },
            { value: "week", label: t("f_week") },
            { value: "date", label: t("f_date"), icon: <Calendar size={16} /> },
          ]}
        />
        {range === "date" ? (
          <DateField className="w-[180px]" aria-label={t("pick_date")} value={pickedDate ?? today} today={today} onChange={(day) => setPickedDate(day)} />
        ) : null}
      </div>

      {mode === "subject" ? (
        active.length > 0 ? (
          <div className="subject-filter -mt-2 mb-5" role="radiogroup" aria-label={t("subject")}>
            {active.map((subject) => (
              <button
                key={subject.id}
                type="button"
                role="radio"
                className={cn("chip-toggle", subjectClass(subject.color_key))}
                aria-checked={chosenSubject === subject.id}
                title={subject.name}
                onClick={() => setSubjectFilter(subject.id)}
              >
                <span className="dot" />
                <span className="max-w-[180px] truncate">{subject.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="notice -mt-2 mb-5">{t("subject_filter_empty")}</p>
        )
      ) : null}

      {isError ? (
        <LoadError onRetry={() => { tasksQuery.refetch(); void subjectsQuery.refetch(); }} />
      ) : isPending ? (
        <div className="flex flex-col gap-2">
          <Skeletons count={5} className="h-12" label={t("tasks_loading")} />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={taskCollision}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDrag(null)}
          accessibility={{
            screenReaderInstructions: { draggable: t("dnd_instructions") },
            announcements: {
              onDragStart: () => (dragTask ? t("dnd_picked", { title: dragTask.title }) : undefined),
              onDragOver: () => (drag?.blockedDay ? t("dnd_blocked") : dragTarget ? t("dnd_over", positionOf(dragTarget)) : undefined),
              onDragEnd: () =>
                dragTask && dragTarget ? t("dnd_dropped", { title: dragTask.title, ...positionOf(dragTarget) }) : t("dnd_cancelled"),
              onDragCancel: () => t("dnd_cancelled"),
            },
          }}
        >
          <div className="tasks-layout" ref={listRef}>
            {!hasTasks ? (
              <Empty icon={<ListChecks size={32} strokeWidth={1.75} />} title={t("tasks_empty_title")} text={t("tasks_empty_text")} />
            ) : allDone ? (
              <div className="all-done" role="status">
                <CircleCheckBig size={32} />
                <div>
                  <strong>{t("all_done_title")}</strong>
                  <span>{t("all_done_text", { n: todayProgress.total })}</span>
                </div>
              </div>
            ) : (
              <section className="today-card" aria-label={t("today_progress")}>
                <div>
                  <div className="lbl">{t("today_summary", { day: t("today"), weekday: weekdayLong, date: formatDayMonth(today) })}</div>
                  <div className="k tnum">
                    {todayProgress.done}
                    <small>/ {todayProgress.total}</small>
                  </div>
                </div>
                <div>
                  <div className="lbl">
                    <span>{t("today_progress")}</span>
                    <span className="tnum">{t("pending_count", { n: todayProgress.total - todayProgress.done })}</span>
                  </div>
                  <Progress size="lg" value={todayProgress.percent} label={t("today_progress")} />
                </div>
                <div className="pct tnum">{todayProgress.percent} %</div>
              </section>
            )}
            {(hasTasks ? days : [today]).map((day) => (
              <DayGroup
                key={day}
                day={day}
                today={today}
                entries={lists.get(day) ?? tasksForDay(tasks, day, today)}
                subjects={subjectMap}
                expanded={expanded}
                selecting={selecting}
                selected={selected}
                dragging={drag ? { taskId: drag.taskId, fromDay: drag.fromDay } : null}
                dropIndex={dragTarget?.day === day ? dragTarget.index : null}
                blocked={Boolean(drag && dragTask && !canDropOnDay(dragTask, drag.fromDay, day))}
                handlers={handlers}
                onQuickAdd={(targetDay, title) =>
                  mutations.create({ title, planned_date: targetDay, subject_id: mode === "subject" ? chosenSubject : null })
                }
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null} className="drag-overlay">
            {drag && dragTask ? (
              <TaskRow
                task={dragTask}
                day={drag.fromDay}
                today={today}
                carriedDays={0}
                subject={dragTask.subject_id ? subjectMap.get(dragTask.subject_id) : undefined}
                expanded={false}
                selecting={false}
                selected={false}
                className="is-lifted"
                grip={
                  <span className="grip opacity-100">
                    <GripVertical size={18} />
                  </span>
                }
                onToggle={() => undefined}
                onToggleSubtask={() => undefined}
                onOpen={() => undefined}
                onSelect={() => undefined}
                onExpand={() => undefined}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {selecting ? (
        <div className="select-bar" role="toolbar" aria-label={t("selection")}>
          <span className="count" aria-live="polite">
            {t("selected_count", { n: selected.size })}
          </span>
          <Button variant="ghost" onClick={() => setSelected(new Set(visibleIds))}>
            {t("select_all")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSelecting(false);
              setSelected(new Set());
            }}
          >
            {t("cancel")}
          </Button>
          <Button variant="danger" disabled={selected.size === 0} onClick={() => void deleteTasks([...selected])}>
            <Trash2 size={18} />
            {t("delete_n", { n: selected.size })}
          </Button>
        </div>
      ) : null}

      <TaskSheet task={openTask} subjects={subjects} onClose={() => setOpenTaskId(null)} onDelete={(task) => void deleteTasks([task.id])} />
    </PageFrame>
  );
}
