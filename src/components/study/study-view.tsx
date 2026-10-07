"use client";

import { BookOpenCheck, GraduationCap, History, Maximize2, Minimize2, Play, SlidersHorizontal, Sparkles, Timer, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { CommitInput } from "@/components/ui/commit-input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { playSound, SOUND_KINDS, type SoundKind } from "@/lib/chime";
import { activeSubjects } from "@/lib/domain/subjects";
import { CUSTOM_LIMITS, EXAM_MINUTES, isExam, isIncomplete, tasksCompletedBetween, type PresetKey, type SessionSummary } from "@/lib/domain/timer";
import { useStudyMutations } from "@/lib/queries/study";
import { useSubjects } from "@/lib/queries/subjects";
import { useTasks } from "@/lib/queries/tasks";
import { studyStore, useStudy } from "@/lib/study-store";
import { cn } from "@/lib/utils";
import { useDuration } from "./duration";
import { HistoryView } from "./history-view";
import { PhaseRow, TimerControls, TimerRing } from "./timer-display";
import { TodayTasks } from "./today-tasks";
import { WrappedDialog } from "./wrapped-dialog";

function setTab(tab: "session" | "history") {
  const url = new URL(window.location.href);
  if (tab === "history") url.searchParams.set("tab", "history");
  else url.searchParams.delete("tab");
  window.history.pushState(null, "", url);
}

/** Sesiones de estudio: timer con presets, tareas de hoy, modo foco, resumen e historial. */
export function StudyView() {
  const t = useTranslations();
  const tab = useSearchParams().get("tab") === "history" ? "history" : "session";
  const { timer, setup, now } = useStudy();
  const [focusMode, setFocusMode] = useState(false);
  // Examen para el que se abrió solo el modo foco (su instante de inicio): vale mientras ese examen siga en curso.
  const [examFocusFor, setExamFocusFor] = useState<number | null>(null);
  const [wrapped, setWrapped] = useState(false);
  const exam = isExam(timer.status === "active" ? timer.config : setup.config);
  const locked = timer.status === "active";
  const examRunning = timer.status === "active" && isExam(timer.config);
  const focusOpen = (focusMode || (examRunning && examFocusFor === timer.startedAt)) && timer.status !== "finished";
  const closeFocus = () => {
    setFocusMode(false);
    setExamFocusFor(null);
  };
  // Al empezar un examen se pasa solo a pantalla completa (el clic en "Iniciar" es lo que el navegador exige para permitirlo).
  const onStart = () => {
    const started = studyStore.getSnapshot().timer;
    if (started.status === "active" && isExam(started.config)) setExamFocusFor(started.startedAt);
  };

  // Pantalla completa mientras dura el modo foco (si el navegador la permite).
  useEffect(() => {
    if (!focusOpen) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    // Salir de pantalla completa con Esc (lo maneja el navegador) también cierra el modo foco.
    const onChange = () => {
      if (document.fullscreenElement) return;
      setFocusMode(false);
      setExamFocusFor(null);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [focusOpen]);

  return (
    <PageFrame
      title={t("nav_sessions")}
      actions={
        <>
          <Button variant="ghost" onClick={() => setWrapped(true)}>
            <Sparkles size={18} />
            {t("wrapped")}
          </Button>
          {tab === "session" ? (
            <Button onClick={() => setFocusMode(true)}>
              <Maximize2 size={18} />
              {t("focus_mode")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="tabs mb-6" role="tablist" aria-label={t("sessions_tabs")}>
        <button type="button" role="tab" id="tab-session" className="tab" aria-selected={tab === "session"} aria-controls="study-panel" onClick={() => setTab("session")}>
          <Timer size={18} />
          {t("tab_session")}
        </button>
        <button type="button" role="tab" id="tab-history" className="tab" aria-selected={tab === "history"} aria-controls="study-panel" onClick={() => setTab("history")}>
          <History size={18} />
          {t("tab_history")}
        </button>
      </div>

      <div id="study-panel" role="tabpanel" aria-labelledby={tab === "history" ? "tab-history" : "tab-session"}>
        {tab === "history" ? (
          <HistoryView onStart={() => setTab("session")} />
        ) : (
          <div className={cn("sessions-grid", examRunning && "is-exam")}>
            {/* data-exam: en modo examen el acento de la tarjeta pasa al rojo de examen. */}
            <section className="timer-card" aria-label={t("timer")} data-exam={exam ? "" : undefined}>
              <Segmented
                label={t("session_mode")}
                value={exam ? "exam" : "study"}
                disabled={locked}
                onChange={(mode) => studyStore.setExamMode(mode === "exam")}
                options={[
                  { value: "study", label: t("mode_study"), icon: <BookOpenCheck size={16} /> },
                  { value: "exam", label: t("mode_exam"), icon: <GraduationCap size={16} /> },
                ]}
              />
              <PhaseRow timer={timer} config={setup.config} />
              <TimerRing timer={timer} config={setup.config} now={now} />
              <TimerControls timer={timer} onStart={onStart} />
              <SessionOptions />
            </section>
            {/* Durante un examen la lista de tareas no se muestra: en un examen no hay pendientes a la vista. */}
            {examRunning ? null : (
              <aside className="side-panel" aria-label={t("today_tasks")}>
                <TodayTasks />
              </aside>
            )}
          </div>
        )}
      </div>

      <DialogPrimitive.Root open={focusOpen} onOpenChange={(open) => !open && closeFocus()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content className={cn("focus-mode", examRunning && "is-exam")} aria-describedby={undefined}>
            <DialogPrimitive.Title className="visually-hidden">{t("focus_mode")}</DialogPrimitive.Title>
            <div className="focus-main">
              <Button className="focus-exit" onClick={closeFocus}>
                <Minimize2 size={18} />
                {t("exit_focus")}
              </Button>
              <PhaseRow timer={timer} config={setup.config} />
              <TimerRing timer={timer} config={setup.config} now={now} size={460} />
              <TimerControls timer={timer} onStart={onStart} />
            </div>
            {examRunning ? null : (
              <aside className="focus-side" aria-label={t("today_tasks")}>
                <h3>{t("today")}</h3>
                <TodayTasks />
              </aside>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {timer.status === "finished" ? <SummaryDialog summary={timer.summary} /> : null}
      <WrappedDialog open={wrapped} onOpenChange={setWrapped} />
    </PageFrame>
  );
}

/** Presets (o la duración del examen), materia, sonido y "Terminar sesión". */
function SessionOptions() {
  const t = useTranslations();
  const duration = useDuration();
  const { timer, setup } = useStudy();
  const subjectsQuery = useSubjects();
  const subjects = activeSubjects(subjectsQuery.data ?? []);
  const locked = timer.status === "active";
  const exam = isExam(locked ? timer.config : setup.config);
  const subjectId = subjects.some((subject) => subject.id === setup.subjectId) ? (setup.subjectId ?? "") : "";

  const customField = (key: keyof typeof CUSTOM_LIMITS, label: string) => (
    <Field label={label} htmlFor={`custom-${key}`}>
      <CommitInput
        id={`custom-${key}`}
        className="input tnum input-number"
        inputMode="numeric"
        maxLength={3}
        disabled={locked}
        value={String(setup.custom[key])}
        onCommit={(text) => {
          if (!/^\d+$/.test(text)) return false;
          studyStore.setCustom({ [key]: Number(text) });
        }}
      />
    </Field>
  );

  return (
    <div className="session-options">
      <div className="row">
        {exam ? (
          <Segmented
            label={t("exam_duration")}
            value={String(setup.examMinutes)}
            disabled={locked}
            onChange={(minutes) => studyStore.setExamMinutes(Number(minutes))}
            options={EXAM_MINUTES.map((minutes) => ({ value: String(minutes), label: duration(minutes * 60) }))}
          />
        ) : (
          <Segmented<Exclude<PresetKey, "exam">>
            label={t("preset")}
            value={setup.studyPreset}
            disabled={locked}
            onChange={(preset) => studyStore.setPreset(preset)}
            options={[
              { value: "25-5", label: t("preset_pomodoro") },
              { value: "50-10", label: "50/10" },
              { value: "90-20", label: "90/20" },
              { value: "custom", label: t("custom"), icon: <SlidersHorizontal size={16} /> },
            ]}
          />
        )}
      </div>
      {!exam && setup.config.preset === "custom" ? (
        <div className="custom-row">
          {customField("focusMinutes", t("focus_min"))}
          {customField("breakMinutes", t("break_min"))}
          {customField("cycles", t("cycles"))}
        </div>
      ) : null}
      <div className="row">
        <select
          className="select w-auto min-w-60"
          aria-label={t("subject")}
          value={subjectId}
          onChange={(event) => studyStore.setSubject(event.target.value || null)}
        >
          <option value="">{t("no_subject_session")}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        <Switch checked={setup.sound} onChange={(value) => studyStore.setSound(value)}>
          <span className="inline-flex items-center gap-2">
            {setup.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {t("sound_on_phase")}
          </span>
        </Switch>
        <SoundPopover />
      </div>
      {exam ? <p className="field-hint max-w-[52ch] text-center">{t("exam_hint")}</p> : null}
      {locked && !exam ? <p className="field-hint">{t("options_locked")}</p> : null}
      {locked && !exam ? (
        <Button variant="ghost" onClick={() => studyStore.finish()}>
          {t("finish_session")}
        </Button>
      ) : null}
    </div>
  );
}

/** Elegir y probar el sonido de fin de fase, el volumen y la alarma del modo examen. */
function SoundPopover() {
  const t = useTranslations();
  const { setup } = useStudy();
  const choose = (kind: SoundKind) => {
    studyStore.setSoundKind(kind);
    // Elegir uno lo hace sonar: así se prueban sin un paso más.
    playSound(kind, setup.volume);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" icon aria-label={t("sound_settings")} data-tip={t("sound_settings")}>
          <SlidersHorizontal size={18} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="popover-pad sound-pop" align="end">
        <strong className="text-body-s" id="sound-kind-label">
          {t("sound_settings")}
        </strong>
        <div className="sound-list" role="radiogroup" aria-labelledby="sound-kind-label">
          {SOUND_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              className="sound-option"
              aria-checked={setup.soundKind === kind}
              onClick={() => choose(kind)}
            >
              <span className="sound-radio" aria-hidden="true" />
              <span className="flex-1">{t(`sound_${kind}`)}</span>
              <Play size={14} className="subtle" aria-hidden="true" />
            </button>
          ))}
        </div>
        <label className="sound-volume">
          <span>{t("sound_volume")}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(setup.volume * 100)}
            aria-valuetext={`${Math.round(setup.volume * 100)} %`}
            onChange={(event) => studyStore.setVolume(Number(event.target.value) / 100)}
            onPointerUp={() => playSound(setup.soundKind, setup.volume)}
            onKeyUp={() => playSound(setup.soundKind, setup.volume)}
          />
        </label>
        <Button className="self-start" onClick={() => playSound(setup.soundKind, setup.volume)}>
          <Play size={16} />
          {t("sound_test")}
        </Button>
        <div className="menu-sep" />
        <Switch checked={setup.awayAlarm} onChange={(value) => studyStore.setAwayAlarm(value)}>
          {t("exam_away_alarm")}
        </Switch>
        <span className="field-hint">{t("exam_away_alarm_hint")}</span>
      </PopoverContent>
    </Popover>
  );
}

/** Resumen al terminar, detener o reiniciar: tiempos reales, ciclos y lo que se tildó. Guardar o descartar. */
function SummaryDialog({ summary }: { summary: SessionSummary }) {
  const t = useTranslations();
  const duration = useDuration();
  const tasksQuery = useTasks();
  const mutations = useStudyMutations();
  const [saving, setSaving] = useState(false);
  const exam = isExam(summary);
  const completed = useMemo(
    () => tasksCompletedBetween(tasksQuery.data ?? [], summary.startedAt, summary.endedAt),
    [tasksQuery.data, summary.startedAt, summary.endedAt],
  );
  const subtasks = useMemo(
    () => tasksCompletedBetween((tasksQuery.data ?? []).flatMap((task) => task.subtasks), summary.startedAt, summary.endedAt),
    [tasksQuery.data, summary.startedAt, summary.endedAt],
  );

  async function save() {
    setSaving(true);
    const ok = await mutations.save(summary, completed, subtasks.length);
    setSaving(false);
    if (!ok) return;
    studyStore.clear();
    toast(t("session_saved"));
  }

  function discard() {
    studyStore.clear();
    toast(t("session_discarded"));
  }

  const stat = (value: string | number, label: string) => (
    <div className="summary-stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );

  return (
    <Dialog open>
      <DialogContent
        title={exam ? t("exam_summary") : t("session_summary")}
        description={isIncomplete(summary) ? t("session_incomplete", { done: summary.cyclesCompleted, total: summary.cycles ?? 0 }) : undefined}
        size="sm"
        hideClose
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogBody>
          <div className="summary-stats">
            {stat(duration(summary.focusSeconds), t("focus_time"))}
            {exam ? stat(summary.awayCount ?? 0, t("exam_aways")) : stat(duration(summary.breakSeconds), t("breaks"))}
            {exam ? stat(duration(summary.awaySeconds ?? 0), t("exam_away_time")) : stat(summary.cyclesCompleted, t("cycles_completed"))}
            {stat(completed.length, t("tasks_completed"))}
            {stat(subtasks.length, t("subtasks_completed"))}
          </div>
          {completed.length > 0 ? (
            <ul className="flex flex-col gap-1 text-body-s text-text-muted">
              {completed.map((task) => (
                <li key={task.id} className="truncate">
                  {task.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">{t("summary_tasks_none")}</p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={discard} disabled={saving}>
            {t("discard")}
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
