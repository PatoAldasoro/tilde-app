"use client";

import { Ellipsis, History, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useProfile, useToday } from "@/components/providers";
import { SubjectChip } from "@/components/subject-chip";
import { SubjectMark } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { Empty } from "@/components/ui/empty";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { LoadError, Skeletons } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast";
import { dateInTimeZone, formatDayMonth, weekdayOf } from "@/lib/domain/dates";
import { focusBySubject, newestFirst, totalFocus, weeklyFocus } from "@/lib/domain/sessions";
import { subjectClass } from "@/lib/domain/subjects";
import { useStudyMutations, useStudySessions, useStudySessionTasks } from "@/lib/queries/study";
import { useSubjects } from "@/lib/queries/subjects";
import type { StudySessionRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useDuration } from "./duration";
import { SessionFormDialog, type SessionFormTarget } from "./session-form-dialog";

/** Historial: foco por semana (8 semanas), foco por materia y la lista de sesiones guardadas, que se pueden corregir. */
export function HistoryView({ onStart }: { onStart: () => void }) {
  const t = useTranslations();
  const today = useToday();
  const timeZone = useProfile().timezone;
  const duration = useDuration();
  const sessionsQuery = useStudySessions();
  const linksQuery = useStudySessionTasks();
  const subjectsQuery = useSubjects();
  const mutations = useStudyMutations();
  const [form, setForm] = useState<SessionFormTarget | null>(null);

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const subjects = useMemo(() => new Map((subjectsQuery.data ?? []).map((subject) => [subject.id, subject])), [subjectsQuery.data]);
  const taskCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of linksQuery.data ?? []) counts.set(link.session_id, (counts.get(link.session_id) ?? 0) + 1);
    return counts;
  }, [linksQuery.data]);
  const weeks = useMemo(() => weeklyFocus(sessions, today, timeZone), [sessions, today, timeZone]);
  const bySubject = useMemo(() => focusBySubject(sessions), [sessions]);
  const ordered = useMemo(() => newestFirst(sessions), [sessions]);
  const formDialog = <SessionFormDialog target={form} subjects={subjectsQuery.data ?? []} onClose={() => setForm(null)} />;

  async function remove(session: StudySessionRow, label: string) {
    const ok = await confirm({ title: t("session_delete_q", { date: label }), body: t("session_delete_body"), confirmLabel: t("delete"), danger: true });
    if (!ok) return;
    const deleted = mutations.remove(session.id);
    toast(t("session_deleted"), { action: { label: t("undo"), onAction: () => mutations.restore(deleted) } });
  }

  if (sessionsQuery.isError) return <LoadError onRetry={() => void sessionsQuery.refetch()} />;
  if (sessionsQuery.isPending) {
    return (
      <div className="history-grid">
        <Skeletons count={2} className="h-[280px] rounded-md" label={t("history_loading")} />
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <>
        <Empty icon={<History size={32} strokeWidth={1.75} />} title={t("history_empty_title")} text={t("history_empty_text")}>
          <div className="btn-row justify-center">
            <Button variant="primary" onClick={onStart}>
              <Play size={16} />
              {t("start_session")}
            </Button>
            <Button onClick={() => setForm("new")}>
              <Plus size={18} />
              {t("session_add")}
            </Button>
          </div>
        </Empty>
        {formDialog}
      </>
    );
  }

  const weekdayShort = t("wd_short").split(",");
  const maxWeek = Math.max(...weeks.map((week) => week.focusSeconds), 3600);
  const maxSubject = Math.max(...bySubject.map((entry) => entry.focusSeconds), 1);

  return (
    <>
      <div className="history-grid">
        <section className="panel" aria-labelledby="history-weeks">
          <div className="panel-head">
            <span className="panel-title" id="history-weeks">
              {t("focus_per_week")}
            </span>
            <span className="panel-sub">{t("this_week_total", { v: duration(weeks[weeks.length - 1].focusSeconds) })}</span>
          </div>
          <div className="bars">
            {weeks.map((week, index) => {
              const current = index === weeks.length - 1;
              const label = t("bar_week", { week: t("week_of", { date: formatDayMonth(week.weekStart) }), value: duration(week.focusSeconds) });
              return (
                <div className="bar-col" key={week.weekStart}>
                  {current ? <span className="bar-val">{duration(week.focusSeconds)}</span> : null}
                  <div
                    className={cn("bar", current && "is-current")}
                    style={{ height: `${(week.focusSeconds / maxWeek) * 100}%` }}
                    tabIndex={0}
                    role="img"
                    aria-label={label}
                    data-tip={label}
                  />
                </div>
              );
            })}
          </div>
          <div className="bars-x" aria-hidden="true">
            {weeks.map((week) => (
              <span key={week.weekStart}>{formatDayMonth(week.weekStart)}</span>
            ))}
          </div>
        </section>
        <section className="panel" aria-labelledby="history-subjects">
          <div className="panel-head">
            <span className="panel-title" id="history-subjects">
              {t("per_subject")}
            </span>
            <span className="panel-sub">{t("total_v", { v: duration(totalFocus(sessions)) })}</span>
          </div>
          <div className="hbar-list">
            {bySubject.map((entry) => {
              const subject = entry.subjectId ? subjects.get(entry.subjectId) : undefined;
              return (
                <div className={cn("hbar", subject && subjectClass(subject.color_key))} key={entry.subjectId ?? "none"}>
                  <span className="name">
                    <SubjectMark icon={subject?.icon} size={14} dotClassName={subject ? undefined : "bg-border-strong"} />
                    <span>{subject?.name ?? t("no_subject")}</span>
                  </span>
                  <span className="val">{duration(entry.focusSeconds)}</span>
                  <Progress
                    size="xs"
                    value={Math.round((entry.focusSeconds / maxSubject) * 100)}
                    label={subject?.name ?? t("no_subject")}
                    bar={subject ? "var(--s-vivid)" : "var(--color-border-strong)"}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="section-label">{t("saved_sessions")}</h2>
        <Button variant="ghost" onClick={() => setForm("new")}>
          <Plus size={18} />
          {t("session_add")}
        </Button>
      </div>
      <div className="table-wrap">
        <table className="session-table">
          <caption className="visually-hidden">{t("saved_sessions")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("date")}</th>
              <th scope="col">{t("subject")}</th>
              <th scope="col">{t("preset")}</th>
              <th scope="col" className="num">
                {t("focus")}
              </th>
              <th scope="col" className="num">
                {t("breaks")}
              </th>
              <th scope="col" className="num">
                {t("cycles")}
              </th>
              <th scope="col" className="num">
                {t("tasks_done")}
              </th>
              <th scope="col" className="num">
                {t("subtasks")}
              </th>
              {/* Sin texto visible: el nombre va en aria-label (un texto oculto con position: absolute se sale del scroll de la tabla). */}
              <th scope="col" aria-label={t("more_options")} />
            </tr>
          </thead>
          <tbody>
            {ordered.map((session) => {
              const day = dateInTimeZone(session.started_at, timeZone);
              const subject = session.subject_id ? subjects.get(session.subject_id) : undefined;
              const dayLabel = `${weekdayShort[weekdayOf(day) - 1]} ${formatDayMonth(day)}`;
              const exam = session.preset === "exam";
              return (
                <tr key={session.id}>
                  <td className="tnum">{dayLabel}</td>
                  <td>{subject ? <SubjectChip subject={subject} /> : <span className="subtle">{t("no_subject")}</span>}</td>
                  <td className="tnum">
                    {exam ? (
                      <span className="badge badge-danger" title={t("exam_away_count", { n: session.away_count })}>
                        {t("mode_exam")}
                        {session.away_count > 0 ? ` · ${t("exam_away_count", { n: session.away_count })}` : ""}
                      </span>
                    ) : session.preset === "custom" ? (
                      t("custom")
                    ) : (
                      session.preset.replace("-", "/")
                    )}
                  </td>
                  <td className="num">{duration(session.focus_seconds)}</td>
                  <td className="num">{duration(session.break_seconds)}</td>
                  <td className="num">{session.cycles_completed}</td>
                  <td className="num">{taskCount.get(session.id) ?? 0}</td>
                  <td className="num">{session.subtasks_completed}</td>
                  <td className="actions">
                    <Menu>
                      <MenuTrigger className="btn btn-ghost btn-icon" aria-label={t("session_options", { date: dayLabel })}>
                        <Ellipsis size={20} />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem
                          icon={<Pencil size={18} />}
                          onSelect={() => setForm({ session, links: (linksQuery.data ?? []).filter((link) => link.session_id === session.id) })}
                        >
                          {t("edit")}
                        </MenuItem>
                        <MenuItem icon={<Trash2 size={18} />} danger onSelect={() => void remove(session, dayLabel)}>
                          {t("delete")}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {formDialog}
    </>
  );
}
