"use client";

import { History, Maximize2, Minimize2, SlidersHorizontal, Timer, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { CommitInput } from "@/components/ui/commit-input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { activeSubjects } from "@/lib/domain/subjects";
import { CUSTOM_LIMITS, tasksCompletedBetween, type PresetKey, type SessionSummary } from "@/lib/domain/timer";
import { useStudyMutations } from "@/lib/queries/study";
import { useSubjects } from "@/lib/queries/subjects";
import { useTasks } from "@/lib/queries/tasks";
import { studyStore, useStudy } from "@/lib/study-store";
import { useDuration } from "./duration";
import { HistoryView } from "./history-view";
import { PhaseRow, TimerControls, TimerRing } from "./timer-display";
import { TodayTasks } from "./today-tasks";

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
  const focusOpen = focusMode && timer.status !== "finished";

  // Pantalla completa mientras dura el modo foco (si el navegador la permite).
  useEffect(() => {
    if (!focusOpen) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    // Salir de pantalla completa con Esc (lo maneja el navegador) también cierra el modo foco.
    const onChange = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [focusOpen]);

  return (
    <PageFrame
      title={t("nav_sessions")}
      actions={
        tab === "session" ? (
          <Button onClick={() => setFocusMode(true)}>
            <Maximize2 size={18} />
            {t("focus_mode")}
          </Button>
        ) : null
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
          <div className="sessions-grid">
            <section className="timer-card" aria-label={t("timer")}>
              <PhaseRow timer={timer} config={setup.config} />
              <TimerRing timer={timer} config={setup.config} now={now} />
              <TimerControls timer={timer} />
              <SessionOptions />
            </section>
            <aside className="side-panel" aria-label={t("today_tasks")}>
              <TodayTasks />
            </aside>
          </div>
        )}
      </div>

      <DialogPrimitive.Root open={focusOpen} onOpenChange={(open) => !open && setFocusMode(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content className="focus-mode" aria-describedby={undefined}>
            <DialogPrimitive.Title className="visually-hidden">{t("focus_mode")}</DialogPrimitive.Title>
            <div className="focus-main">
              <Button className="focus-exit" onClick={() => setFocusMode(false)}>
                <Minimize2 size={18} />
                {t("exit_focus")}
              </Button>
              <PhaseRow timer={timer} config={setup.config} />
              <TimerRing timer={timer} config={setup.config} now={now} size={460} />
              <TimerControls timer={timer} />
            </div>
            <aside className="focus-side" aria-label={t("today_tasks")}>
              <h3>{t("today")}</h3>
              <TodayTasks />
            </aside>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {timer.status === "finished" ? <SummaryDialog summary={timer.summary} /> : null}
    </PageFrame>
  );
}

/** Presets, valores personalizados, materia, sonido y "Terminar sesión". */
function SessionOptions() {
  const t = useTranslations();
  const { timer, setup } = useStudy();
  const subjectsQuery = useSubjects();
  const subjects = activeSubjects(subjectsQuery.data ?? []);
  const locked = timer.status === "active";
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
        <Segmented<PresetKey>
          label={t("preset")}
          value={setup.config.preset}
          disabled={locked}
          onChange={(preset) => studyStore.setPreset(preset)}
          options={[
            { value: "25-5", label: t("preset_pomodoro") },
            { value: "50-10", label: "50/10" },
            { value: "90-20", label: "90/20" },
            { value: "custom", label: t("custom"), icon: <SlidersHorizontal size={16} /> },
          ]}
        />
      </div>
      {setup.config.preset === "custom" ? (
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
      </div>
      {locked ? <p className="field-hint">{t("options_locked")}</p> : null}
      {locked ? (
        <Button variant="ghost" onClick={() => studyStore.finish()}>
          {t("finish_session")}
        </Button>
      ) : null}
    </div>
  );
}

/** Resumen al terminar o detener: tiempos reales, ciclos y tareas tildadas. Guardar o descartar. */
function SummaryDialog({ summary }: { summary: SessionSummary }) {
  const t = useTranslations();
  const duration = useDuration();
  const tasksQuery = useTasks();
  const mutations = useStudyMutations();
  const [saving, setSaving] = useState(false);
  const completed = useMemo(
    () => tasksCompletedBetween(tasksQuery.data ?? [], summary.startedAt, summary.endedAt),
    [tasksQuery.data, summary.startedAt, summary.endedAt],
  );

  async function save() {
    setSaving(true);
    const ok = await mutations.save(summary, completed);
    setSaving(false);
    if (!ok) return;
    studyStore.reset();
    toast(t("session_saved"));
  }

  function discard() {
    studyStore.reset();
    toast(t("session_discarded"));
  }

  return (
    <Dialog open>
      <DialogContent
        title={t("session_summary")}
        size="sm"
        hideClose
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogBody>
          <div className="summary-stats">
            <div className="summary-stat">
              <div className="v">{duration(summary.focusSeconds)}</div>
              <div className="l">{t("focus_time")}</div>
            </div>
            <div className="summary-stat">
              <div className="v">{duration(summary.breakSeconds)}</div>
              <div className="l">{t("breaks")}</div>
            </div>
            <div className="summary-stat">
              <div className="v">{summary.cyclesCompleted}</div>
              <div className="l">{t("cycles_completed")}</div>
            </div>
            <div className="summary-stat">
              <div className="v">{completed.length}</div>
              <div className="l">{t("tasks_completed")}</div>
            </div>
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
