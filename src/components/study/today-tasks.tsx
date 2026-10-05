"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useToday } from "@/components/providers";
import { SubjectChip } from "@/components/subject-chip";
import { TaskCheckbox } from "@/components/tasks/task-row";
import { Skeletons } from "@/components/ui/query-state";
import { Switch } from "@/components/ui/switch";
import { isArchived } from "@/lib/domain/subjects";
import { isCompleted, tasksForDay } from "@/lib/domain/tasks";
import { useSubjects } from "@/lib/queries/subjects";
import { useTaskMutations, useTasks } from "@/lib/queries/tasks";
import { studyStore, useStudy } from "@/lib/study-store";
import { cn } from "@/lib/utils";

/** Las tareas de hoy (tasksForDay) para tildar durante la sesión; con materia elegida se pueden filtrar. */
export function TodayTasks() {
  const t = useTranslations();
  const today = useToday();
  const { setup } = useStudy();
  const tasksQuery = useTasks();
  const subjectsQuery = useSubjects();
  const mutations = useTaskMutations();

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const chosen = setup.subjectId ? subjectMap.get(setup.subjectId) : undefined;
  const entries = useMemo(() => {
    const archived = new Set(subjects.filter(isArchived).map((subject) => subject.id));
    const visible = (tasksQuery.data ?? []).filter((task) => !task.subject_id || !archived.has(task.subject_id));
    const list = tasksForDay(visible, today, today);
    return setup.filterBySubject && setup.subjectId ? list.filter((entry) => entry.task.subject_id === setup.subjectId) : list;
  }, [tasksQuery.data, subjects, today, setup.filterBySubject, setup.subjectId]);
  const done = entries.filter((entry) => isCompleted(entry.task)).length;

  return (
    <>
      <div className="side-panel-head">
        <div className="t">
          <span>{t("today_tasks")}</span>
          <span className="badge tnum">
            {done}/{entries.length}
          </span>
        </div>
        {chosen ? (
          <Switch checked={setup.filterBySubject} onChange={(value) => studyStore.setFilterBySubject(value)}>
            {t("only_subject", { name: chosen.name })}
          </Switch>
        ) : (
          <span className="field-hint">{t("pick_subject_to_filter")}</span>
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
        {entries.map(({ task }) => {
          const subject = task.subject_id ? subjectMap.get(task.subject_id) : undefined;
          return (
            <div key={task.id} className={cn("mini-task", isCompleted(task) && "is-done")}>
              <TaskCheckbox task={task} size="sm" onToggle={() => mutations.toggle(task)} />
              <span className="mt-title">{task.title}</span>
              {subject ? <SubjectChip subject={subject} /> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
