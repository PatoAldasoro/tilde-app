"use client";

import { ChevronsLeft, ChevronsRight, ClockPlus, Coffee, GraduationCap, Pause, PictureInPicture2, Play, RotateCcw, SkipForward, Square, Target, TimerReset } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useProfile } from "@/components/providers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatClock, isExam, phaseProgress, remainingMs, type ActiveTimer, type TimerConfig, type TimerState } from "@/lib/domain/timer";
import { pipStore, usePip } from "@/lib/pip-store";
import { studyStore } from "@/lib/study-store";
import { cn } from "@/lib/utils";
import { useDuration } from "./duration";

type TimerProps = { timer: TimerState; config: TimerConfig; now: number };

const activeOf = (timer: TimerState): ActiveTimer | null => (timer.status === "active" ? timer : null);

/** Píldora de fase + "Ciclo 2 de 4" con puntos. En modo examen, la píldora y la duración. */
export function PhaseRow({ timer, config }: Omit<TimerProps, "now">) {
  const t = useTranslations();
  const duration = useDuration();
  const active = activeOf(timer);
  const current = active?.config ?? config;
  const cycles = current.cycles;
  const cycle = active?.cycle ?? 1;

  if (isExam(current)) {
    return (
      <div className="phase-row" aria-live="polite">
        <span className={cn("phase-pill", !active && "is-idle")}>
          <GraduationCap size={16} />
          {active ? t("phase_exam") : t("exam_ready")}
        </span>
        <span className="cycle-label tnum">{t("exam_plan", { v: duration(current.focusMinutes * 60) })}</span>
      </div>
    );
  }

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

/** Textos compartidos por el anillo y el timer flotante: reloj, fase y lo que va debajo. */
function useTimerTexts({ timer, config, now }: TimerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const timeZone = useProfile().timezone;
  const active = activeOf(timer);
  const current = active?.config ?? config;
  const exam = isExam(current);
  const left = active ? remainingMs(active, now) : current.focusMinutes * 60_000;
  const clock = formatClock(left, { hours: exam });
  const phaseLabel = !active ? t(exam ? "exam_ready" : "ready") : exam ? t("phase_exam") : t(active.phase === "break" ? "phase_break" : "phase_focus");
  const endsAt = (ms: number) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(ms));
  const sub = !active
    ? exam
      ? t("exam_no_pause")
      : t("focus_cycles_plan", { n: current.cycles, f: current.focusMinutes, b: current.breakMinutes })
    : !active.running
      ? t("paused")
      : t("ends_at", { time: endsAt(active.phaseEndsAt ?? now) });
  return { active, exam, clock, phaseLabel, sub, fraction: active ? phaseProgress(active, now) : 0 };
}

/** Anillo de progreso con el tiempo restante. El gráfico es un SVG propio, no un ícono. */
export function TimerRing({ timer, config, now, size = 340 }: TimerProps & { size?: number }) {
  const t = useTranslations();
  const { active, exam, clock, phaseLabel, sub, fraction } = useTimerTexts({ timer, config, now });
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const away = active?.awayCount ?? 0;

  return (
    <div
      className={cn("timer-ring", !active ? "is-idle" : active.phase === "break" && "is-break", exam && "is-long")}
      role="timer"
      aria-label={t("timer_status", { phase: phaseLabel, time: clock })}
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
      <span className="timer-sub">
        {sub}
        {exam && away > 0 ? ` · ${t("exam_away_count", { n: away })}` : ""}
      </span>
    </div>
  );
}

/**
 * Timer flotante: el mismo borde de progreso que el anillo, pero en un rectángulo redondeado
 * que ocupa todo el marco (la ventana flotante es rectangular). Con lo justo para usarlo sin
 * volver a la app: el tiempo, la fase y pausar o reanudar.
 */
export function MiniTimer({ timer, config, now }: TimerProps) {
  const t = useTranslations();
  const { active, exam, clock, phaseLabel, sub, fraction } = useTimerTexts({ timer, config, now });
  const running = active?.running ?? false;
  const onBreak = active?.phase === "break";
  const detail = active && !exam ? t("cycle_of", { n: active.cycle, total: active.config.cycles }) : sub;

  return (
    <div
      className={cn("mini-timer", !active ? "is-idle" : onBreak && "is-break", exam && "is-long")}
      role="timer"
      aria-label={t("timer_status", { phase: phaseLabel, time: clock })}
    >
      <svg className="mini-timer-border" aria-hidden="true" focusable="false">
        <rect className="track" />
        <rect className="bar" pathLength={1} style={{ strokeDashoffset: 1 - fraction }} />
      </svg>
      <div className="mini-timer-body">
        <span className="mini-timer-phase">
          <strong>{phaseLabel}</strong>
          <span className="tnum">{detail}</span>
        </span>
        <span className="mini-timer-time tnum" aria-hidden="true">
          {clock}
        </span>
        <div className="mini-timer-controls">
          {exam && active ? (
            <button type="button" className="round-btn is-sm" aria-label={t("exam_finish")} title={t("exam_finish")} onClick={() => studyStore.finish()}>
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className="round-btn is-sm is-primary"
              aria-label={running ? t("pause") : active ? t("resume") : t("start")}
              onClick={() => studyStore.toggle()}
            >
              {running ? <Pause size={18} fill="currentColor" strokeWidth={1.5} /> : <Play size={18} fill="currentColor" strokeWidth={1.5} />}
            </button>
          )}
          {onBreak ? (
            <button type="button" className="round-btn is-sm" aria-label={t("skip_break")} title={t("skip_break")} onClick={() => studyStore.skipBreak()}>
              <SkipForward size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Ajustar el tiempo a mano: adelantar, atrasar, cortar el foco o volver a empezar la fase. */
function AdjustPopover({ active }: { active: ActiveTimer | null }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const exam = active !== null && isExam(active.config);
  const available = active !== null && !exam;
  const reason = exam ? t("adjust_not_in_exam") : t("adjust_needs_session");
  const step = (minutes: number, label: string, icon: React.ReactNode, iconFirst: boolean) => (
    <button type="button" className="btn btn-secondary adjust-step" onClick={() => studyStore.adjust(minutes)}>
      {iconFirst ? icon : null}
      <span className="tnum">{label}</span>
      {iconFirst ? null : icon}
    </button>
  );
  const act = (run: () => void) => () => {
    setOpen(false);
    run();
  };

  return (
    <Popover open={open && available} onOpenChange={(next) => setOpen(next && available)}>
      <PopoverTrigger asChild>
        {/* aria-disabled (no disabled): sigue recibiendo foco para explicar por qué no está disponible. */}
        <button
          type="button"
          className="round-btn"
          aria-label={available ? t("adjust_time") : `${t("adjust_time")}. ${reason}`}
          data-tip={available ? t("adjust_time") : reason}
          aria-disabled={!available || undefined}
        >
          <ClockPlus size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="popover-pad adjust-pop" align="center">
        <strong className="text-body-s">{t("adjust_time")}</strong>
        <div className="adjust-row" role="group" aria-label={t("adjust_back")}>
          <span className="adjust-label">{t("adjust_back")}</span>
          {step(-5, t("min_short", { n: 5 }), <ChevronsLeft size={16} />, true)}
          {step(-1, t("min_short", { n: 1 }), <ChevronsLeft size={16} />, true)}
        </div>
        <div className="adjust-row" role="group" aria-label={t("adjust_forward")}>
          <span className="adjust-label">{t("adjust_forward")}</span>
          {step(1, t("min_short", { n: 1 }), <ChevronsRight size={16} />, false)}
          {step(5, t("min_short", { n: 5 }), <ChevronsRight size={16} />, false)}
        </div>
        <p className="field-hint">{t("adjust_hint")}</p>
        <div className="menu-sep" />
        {active?.phase === "focus" ? (
          <button type="button" className="menu-item" onClick={act(() => studyStore.skipFocus())}>
            <Coffee size={18} />
            <span>{active.cycle >= active.config.cycles ? t("end_focus_last") : t("end_focus")}</span>
          </button>
        ) : (
          <button type="button" className="menu-item" onClick={act(() => studyStore.skipBreak())}>
            <SkipForward size={18} />
            <span>{t("skip_break")}</span>
          </button>
        )}
        <button type="button" className="menu-item" onClick={act(() => studyStore.restartPhase())}>
          <TimerReset size={18} />
          <span>{t("restart_phase")}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Reiniciar · Ajustar el tiempo · Iniciar/Pausar · Saltar descanso · Timer flotante.
 * `onStart` avisa que la sesión acaba de arrancar desde este botón (un clic del usuario).
 */
export function TimerControls({ timer, onStart }: { timer: TimerState; onStart?: () => void }) {
  const t = useTranslations();
  const pip = usePip();
  const active = activeOf(timer);
  const exam = active !== null && isExam(active.config);
  const running = active?.running ?? false;
  const onBreak = active?.phase === "break";
  const floating = pip.window !== null || pip.floating;
  const skipTip = exam ? t("skip_not_in_exam") : onBreak ? t("skip_break") : t("skip_break_only");

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
      <AdjustPopover active={active} />
      {exam ? (
        // Un examen no se pausa: lo único que se puede hacer es entregarlo.
        <button type="button" className="play-btn" aria-label={t("exam_finish")} data-tip={t("exam_finish")} onClick={() => studyStore.finish()}>
          <Square size={24} fill="currentColor" strokeWidth={1.5} />
        </button>
      ) : (
        <button
          type="button"
          className="play-btn"
          aria-label={running ? t("pause") : active ? t("resume") : t("start")}
          onClick={() => {
            studyStore.toggle();
            if (!active) onStart?.();
          }}
        >
          {running ? <Pause size={28} fill="currentColor" strokeWidth={1.5} /> : <Play size={28} fill="currentColor" strokeWidth={1.5} />}
        </button>
      )}
      <button
        type="button"
        className="round-btn"
        aria-label={onBreak ? t("skip_break") : `${t("skip_break")}. ${skipTip}`}
        data-tip={skipTip}
        aria-disabled={!onBreak || undefined}
        onClick={() => onBreak && studyStore.skipBreak()}
      >
        <SkipForward size={20} />
      </button>
      <button
        type="button"
        className="round-btn"
        aria-label={t("floating_timer")}
        aria-pressed={floating}
        data-tip={floating ? t("floating_timer_close") : t("floating_timer_hint")}
        onClick={() => (floating ? pipStore.close() : void pipStore.open(t("floating_timer")))}
      >
        <PictureInPicture2 size={20} />
      </button>
    </div>
  );
}
