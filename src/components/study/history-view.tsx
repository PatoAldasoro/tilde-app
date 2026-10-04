"use client";

import { History, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useProfile, useToday } from "@/components/providers";
import { SubjectChip } from "@/components/subject-chip";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { LoadError, Skeletons } from "@/components/ui/query-state";
import { dateInTimeZone, formatDayMonth, weekdayOf } from "@/lib/domain/dates";
import { focusBySubject, totalFocus, weeklyFocus } from "@/lib/domain/sessions";
import { subjectClass } from "@/lib/domain/subjects";
import { useStudySessions, useStudySessionTasks } from "@/lib/queries/study";
import { useSubjects } from "@/lib/queries/subjects";
import { cn } from "@/lib/utils";
import { useDuration } from "./duration";

/** Historial: foco por semana (8 semanas), foco por materia y la lista de sesiones guardadas. */
export function HistoryView({ onStart }: { onStart: () => void }) {
  const t = useTranslations();
  const today = useToday();
  const timeZone = useProfile().timezone;
  const duration = useDuration();
  const sessionsQuery = useStudySessions();
  const linksQuery = useStudySessionTasks();
  const subjectsQuery = useSubjects();

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const subjects = useMemo(() => new Map((subjectsQuery.data ?? []).map((subject) => [subject.id, subject])), [subjectsQuery.data]);
  const taskCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of linksQuery.data ?? []) counts.set(link.session_id, (counts.get(link.session_id) ?? 0) + 1);
    return counts;
  }, [linksQuery.data]);
  const weeks = useMemo(() => weeklyFocus(sessions, today, timeZone), [sessions, today, timeZone]);
  const bySubject = useMemo(() => focusBySubject(sessions), [sessions]);

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
      <Empty icon={<History size={32} strokeWidth={1.75} />} title={t("history_empty_title")} text={t("history_empty_text")}>
        <Button variant="primary" onClick={onStart}>
          <Play size={16} />
          {t("start_session")}
        </Button>
      </Empty>
    );
  }

  const weekdayShort = t("wd_short").split(",");
  const maxWeek = Math.max(...weeks.map((week) => week.focusSeconds), 3600);
  const maxSubject = Math.max(...bySubject.map((entry) => entry.focusSeconds), 1);
  const newestFirst = [...sessions].reverse();

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
                    <i className={cn("dot", !subject && "bg-border-strong")} />
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
      <h2 className="section-label mb-3">{t("saved_sessions")}</h2>
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
            </tr>
          </thead>
          <tbody>
            {newestFirst.map((session) => {
              const day = dateInTimeZone(session.started_at, timeZone);
              const subject = session.subject_id ? subjects.get(session.subject_id) : undefined;
              return (
                <tr key={session.id}>
                  <td className="tnum">
                    {weekdayShort[weekdayOf(day) - 1]} {formatDayMonth(day)}
                  </td>
                  <td>{subject ? <SubjectChip subject={subject} /> : <span className="subtle">{t("no_subject")}</span>}</td>
                  <td className="tnum">{session.preset === "custom" ? t("custom") : session.preset.replace("-", "/")}</td>
                  <td className="num">{duration(session.focus_seconds)}</td>
                  <td className="num">{duration(session.break_seconds)}</td>
                  <td className="num">{session.cycles_completed}</td>
                  <td className="num">{taskCount.get(session.id) ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
