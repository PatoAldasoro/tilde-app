"use client";

import { Coffee, Pause, Play, RotateCcw, SkipForward, Target } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useProfile } from "@/components/providers";
import { formatClock, phaseProgress, remainingMs, type TimerConfig, type TimerState } from "@/lib/domain/timer";
import { studyStore } from "@/lib/study-store";
import { cn } from "@/lib/utils";

type TimerProps = { timer: TimerState; config: TimerConfig; now: number };

/** Píldora de fase + "Ciclo 2 de 4" con puntos. */
export function PhaseRow({ timer, config }: Omit<TimerProps, "now">) {
  const t = useTranslations();
  const active = timer.status === "active" ? timer : null;
  const cycles = active?.config.cycles ?? config.cycles;
  const cycle = active?.cycle ?? 1;
  return (
    <div className="phase-row" aria-live="polite">
      {!active ? (
        <span className="phase-pill is-idle">
          <Target size={16} />
          {t("ready")}
        </span>
      ) : active.phase === "break" ? (
        <span className="phase-pill is-break">
          <Coffee size={16} />
          {t("phase_break")}
        </span>
      ) : (
        <span className="phase-pill">
          <Target size={16} />
          {t("phase_focus")}
        </span>
      )}
      <span className="cycle-label tnum">
        {t("cycle_of", { n: cycle, total: cycles })}
        <span className="cycle-dots" aria-hidden="true">
          {Array.from({ length: cycles }, (_, index) => (
            <i key={index} className={index + 1 < cycle ? "done" : index + 1 === cycle && active ? "current" : undefined} />
          ))}
        </span>
      </span>
    </div>
  );
}

/** Anillo de progreso con el tiempo restante. El gráfico es un SVG propio, no un ícono. */
export function TimerRing({ timer, config, now, size = 340 }: TimerProps & { size?: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const timeZone = useProfile().timezone;
  const active = timer.status === "active" ? timer : null;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const fraction = active ? phaseProgress(active, now) : 0;
  const left = active ? remainingMs(active, now) : config.focusMinutes * 60_000;
  const clock = formatClock(left);
  const phaseLabel = t(active?.phase === "break" ? "phase_break" : "phase_focus");

  const sub = !active
    ? t("focus_cycles_plan", { n: config.cycles, f: config.focusMinutes, b: config.breakMinutes })
    : !active.running
      ? t("paused")
      : t("ends_at", {
          time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(
            new Date(active.phaseEndsAt ?? now),
          ),
        });

  return (
    <div
      className={cn("timer-ring", !active ? "is-idle" : active.phase === "break" && "is-break")}
      role="timer"
      aria-label={t("timer_status", { phase: active ? phaseLabel : t("ready"), time: clock })}
    >
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="8" />
        <circle
          className="bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span className="timer-time tnum" aria-hidden="true">
        {clock}
      </span>
      <span className="timer-sub">{sub}</span>
    </div>
  );
}

/** Reiniciar · Iniciar/Pausar · Saltar descanso. */
export function TimerControls({ timer }: { timer: TimerState }) {
  const t = useTranslations();
  const active = timer.status === "active" ? timer : null;
  const running = active?.running ?? false;
  const onBreak = active?.phase === "break";
  return (
    <div className="timer-controls">
      <button
        type="button"
        className="round-btn"
        aria-label={t("reset")}
        data-tip={t("reset")}
        disabled={!active}
        onClick={() => studyStore.reset()}
      >
        <RotateCcw size={20} />
      </button>
      <button
        type="button"
        className="play-btn"
        aria-label={running ? t("pause") : active ? t("resume") : t("start")}
        onClick={() => studyStore.toggle()}
      >
        {running ? <Pause size={28} fill="currentColor" strokeWidth={1.5} /> : <Play size={28} fill="currentColor" strokeWidth={1.5} />}
      </button>
      {/* aria-disabled (no disabled): sigue recibiendo foco para explicar por qué no está disponible. */}
      <button
        type="button"
        className="round-btn"
        aria-label={onBreak ? t("skip_break") : `${t("skip_break")}. ${t("skip_break_only")}`}
        data-tip={onBreak ? t("skip_break") : t("skip_break_only")}
        aria-disabled={!onBreak || undefined}
        onClick={() => onBreak && studyStore.skipBreak()}
      >
        <SkipForward size={20} />
      </button>
    </div>
  );
}
