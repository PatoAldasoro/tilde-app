"use client";

import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useProfile, useToday } from "@/components/providers";
import { SubjectChip } from "@/components/subject-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { formatDayMonth } from "@/lib/domain/dates";
import { activeSubjects, subjectClass } from "@/lib/domain/subjects";
import { buildWrapped, focusEquivalence, wrappedRange, type Wrapped, type WrappedPeriod } from "@/lib/domain/wrapped";
import { useStudySessions, useStudySessionTasks } from "@/lib/queries/study";
import { useSubjects } from "@/lib/queries/subjects";
import { useTasks } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";
import { useDuration } from "./duration";

type WrappedDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** "Wrapped": el resumen de la semana, el mes o el cuatrimestre, contado en tarjetas. */
export function WrappedDialog({ open, onOpenChange }: WrappedDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent size="lg" title={t("wrapped_title")} description={t("wrapped_desc")}>
          <WrappedStory onStart={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

type Slide = { key: string; kicker: string; big: ReactNode; lines: ReactNode[]; className?: string };

function WrappedStory({ onStart }: { onStart: () => void }) {
  const t = useTranslations();
  const today = useToday();
  const timeZone = useProfile().timezone;
  const sessionsQuery = useStudySessions();
  const linksQuery = useStudySessionTasks();
  const tasksQuery = useTasks();
  const subjectsQuery = useSubjects();
  const [period, setPeriod] = useState<WrappedPeriod>("week");
  const [offset, setOffset] = useState(0);
  // La tarjeta visible se recuerda por período: al cambiar de período se vuelve a la portada.
  const [position, setPosition] = useState<{ key: string; index: number }>({ key: "", index: 0 });

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const range = useMemo(() => wrappedRange(period, today, offset), [period, today, offset]);
  const wrapped = useMemo(
    () =>
      buildWrapped(range, {
        sessions: sessionsQuery.data ?? [],
        sessionTasks: linksQuery.data ?? [],
        tasks: tasksQuery.data ?? [],
        subjects: activeSubjects(subjects),
        timeZone,
        today,
      }),
    [range, sessionsQuery.data, linksQuery.data, tasksQuery.data, subjects, timeZone, today],
  );

  const rangeLabel =
    period === "term" && range.term
      ? t("wrapped_term_label", { term: String(range.term.index), year: String(range.term.year) })
      : t("wrapped_range", { from: formatDayMonth(range.from), to: formatDayMonth(range.to) });
  const slides = useSlides(wrapped, rangeLabel);
  const storyKey = `${period}:${offset}`;
  const index = position.key === storyKey ? Math.min(position.index, slides.length - 1) : 0;
  const go = (next: number) => setPosition({ key: storyKey, index: Math.max(0, Math.min(slides.length - 1, next)) });
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else return;
    event.preventDefault();
  }

  return (
    <>
      <DialogBody>
        <div className="wrapped-bar">
          <Segmented
            label={t("wrapped_period")}
            value={period}
            onChange={(next) => {
              setPeriod(next);
              setOffset(0);
            }}
            options={[
              { value: "week", label: t("wrapped_week") },
              { value: "month", label: t("wrapped_month") },
              { value: "term", label: t("wrapped_term") },
            ]}
          />
          <span className="flex-1" />
          <Button icon variant="ghost" aria-label={t("wrapped_prev_period")} onClick={() => setOffset((value) => value - 1)}>
            <ChevronLeft size={20} />
          </Button>
          <span className="wrapped-range tnum" aria-live="polite">
            {rangeLabel}
          </span>
          <Button icon variant="ghost" aria-label={t("wrapped_next_period")} disabled={offset >= 0} onClick={() => setOffset((value) => value + 1)}>
            <ChevronRight size={20} />
          </Button>
        </div>

        {/* Una tarjeta por vez; se pasa con los botones, los puntos o las flechas del teclado. */}
        <div
          className={cn("wrapped-card", slide.className)}
          role="group"
          aria-roledescription={t("wrapped_slide")}
          aria-label={t("wrapped_slide_of", { n: index + 1, total: slides.length, title: slide.kicker })}
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <span className="wrapped-kicker">{slide.kicker}</span>
          <div className="wrapped-big">{slide.big}</div>
          {slide.lines.map((line, lineIndex) => (
            <p key={lineIndex} className="wrapped-line">
              {line}
            </p>
          ))}
        </div>

        <div className="wrapped-dots" role="tablist" aria-label={t("wrapped_slides")}>
          {slides.map((item, slideIndex) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              className="wrapped-dot"
              aria-selected={slideIndex === index}
              aria-label={item.kicker}
              onClick={() => go(slideIndex)}
            />
          ))}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeft size={18} />
          {t("wrapped_back")}
        </Button>
        <span className="spacer" />
        {isLast ? (
          <Button variant="primary" onClick={onStart}>
            <Play size={16} />
            {t("start_session")}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => go(index + 1)}>
            {t("wrapped_next")}
            <ChevronRight size={18} />
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/** Arma las tarjetas con lo que haya para contar: una tarjeta sin datos no aparece. */
function useSlides(wrapped: Wrapped, rangeLabel: string): Slide[] {
  const t = useTranslations();
  const duration = useDuration();
  const subjects = useSubjects().data ?? [];
  const period = wrapped.range.period;
  const subjectOf = (id: string | null | undefined) => (id ? subjects.find((subject) => subject.id === id) : undefined);
  const weekdays = t("wd_long").split(",");
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  const cover: Slide = {
    key: "cover",
    kicker: rangeLabel,
    big: t(`wrapped_cover_${period}`),
    lines: [wrapped.empty ? t("wrapped_empty") : t("wrapped_cover_line", { sessions: wrapped.sessions, days: wrapped.daysStudied })],
    className: "is-cover",
  };
  const closing: Slide = {
    key: "closing",
    kicker: t("wrapped_closing"),
    big: t(`wrapped_mood_${wrapped.mood}_title`),
    lines: [t(`wrapped_mood_${wrapped.mood}_text`)],
    className: "is-closing",
  };
  if (wrapped.empty) return [cover, closing];

  const slides: Slide[] = [cover];

  if (wrapped.focusSeconds > 0) {
    const change = wrapped.changePercent;
    const previous = t(wrapped.inProgress ? `wrapped_so_far_${period}` : `wrapped_previous_${period}`);
    const equivalence = focusEquivalence(wrapped.focusSeconds);
    slides.push({
      key: "focus",
      kicker: t("focus_time"),
      big: duration(wrapped.focusSeconds),
      lines: [
        change === null
          ? t("wrapped_focus_first")
          : Math.abs(change) <= 5
            ? t("wrapped_focus_same", { previous })
            : change > 0
              ? t("wrapped_focus_up", { percent: change, previous })
              : t("wrapped_focus_down", { percent: Math.abs(change), previous }),
        ...(equivalence ? [t(`wrapped_equivalence_${equivalence.kind}`, { n: equivalence.count })] : []),
      ],
    });
  }

  const top = subjectOf(wrapped.topSubject?.subjectId);
  if (wrapped.topSubject && top) {
    const forgotten = subjectOf(wrapped.forgottenSubjectId);
    slides.push({
      key: "subject",
      kicker: t("wrapped_subject"),
      big: top.name,
      lines: [
        t("wrapped_subject_line", { share: wrapped.topSubject.share, time: duration(wrapped.topSubject.seconds) }),
        ...(forgotten
          ? [
              <span key="forgotten">
                <SubjectChip subject={forgotten} className="mr-2 align-middle" />
                {t("wrapped_subject_forgotten")}
              </span>,
            ]
          : []),
      ],
      className: cn("is-subject", subjectClass(top.color_key)),
    });
  }

  if (wrapped.bestWeekday) {
    slides.push({
      key: "rhythm",
      kicker: t("wrapped_rhythm"),
      big: capitalize(weekdays[wrapped.bestWeekday.weekday - 1]),
      lines: [
        t("wrapped_best_day", { time: duration(wrapped.bestWeekday.seconds) }),
        t("wrapped_streak", { n: wrapped.streak }),
        ...(wrapped.chronotype ? [t(`wrapped_chrono_${wrapped.chronotype}`)] : []),
      ],
    });
  }

  if (wrapped.tasksCompleted > 0 || wrapped.subtasksCompleted > 0) {
    const deliveries = wrapped.onTime + wrapped.late;
    slides.push({
      key: "tasks",
      kicker: t("nav_tasks"),
      big: String(wrapped.tasksCompleted),
      lines: [
        t("wrapped_tasks_line", { tasks: wrapped.tasksCompleted, subtasks: wrapped.subtasksCompleted }),
        ...(deliveries === 0 ? [] : wrapped.late === 0 ? [t("wrapped_all_on_time", { n: deliveries })] : [t("wrapped_late", { on: wrapped.onTime, late: wrapped.late })]),
        ...(wrapped.mostCarried ? [t("wrapped_carried", { title: wrapped.mostCarried.title, days: wrapped.mostCarried.days })] : []),
      ],
    });
  }

  if (wrapped.longestSession && wrapped.longestSession.seconds > 0) {
    slides.push({
      key: "records",
      kicker: t("wrapped_records"),
      big: duration(wrapped.longestSession.seconds),
      lines: [
        t("wrapped_longest", { date: formatDayMonth(wrapped.longestSession.date) }),
        ...(wrapped.minutesPerTask !== null ? [t("wrapped_per_task", { n: wrapped.minutesPerTask })] : []),
        ...(wrapped.exams > 0 ? [t("wrapped_exams", { n: wrapped.exams, aways: wrapped.examAways })] : []),
      ],
    });
  }

  return [...slides, closing];
}
