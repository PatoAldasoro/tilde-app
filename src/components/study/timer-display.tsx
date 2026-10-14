"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  Coffee,
  GraduationCap,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Square,
  Target,
  TimerReset,
} from "lucide-react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useProfile } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { displayClock, formatClock, isExam, phaseProgress, type ActiveTimer, type TimerConfig, type TimerState } from "@/lib/domain/timer";
import { drawPipFrame, type PipModel } from "@/lib/pip-canvas";
import { pipStore, usePip } from "@/lib/pip-store";
import { studyStore, useStudy } from "@/lib/study-store";
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
  // La fase ya cumplió su tiempo y espera que la pasen a mano: el reloj cuenta el tiempo de más.
  const waiting = active?.waiting ?? false;
  const clock = active ? displayClock(active, now) : formatClock(current.focusMinutes * 60_000, { hours: exam });
  const phaseLabel = !active ? t(exam ? "exam_ready" : "ready") : exam ? t("phase_exam") : t(active.phase === "break" ? "phase_break" : "phase_focus");
  const endsAt = (ms: number) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(ms));
  const sub = !active
    ? exam
      ? t("exam_straight")
      : t("focus_cycles_plan", { n: current.cycles, f: current.focusMinutes, b: current.breakMinutes })
    : waiting
      ? active.running
        ? t("extra_time")
        : `${t("extra_time")} · ${t("paused")}`
      : !active.running
        ? t("paused")
        : t("ends_at", { time: endsAt(active.phaseEndsAt ?? now) });
  return { active, exam, waiting, clock, phaseLabel, sub, fraction: active ? phaseProgress(active, now) : 0 };
}

/** Lo que muestra el timer flotante cuando va en la ventana de imagen en imagen (se dibuja en un canvas). */
export function usePipModel(): PipModel {
  const t = useTranslations();
  const { timer, setup, now } = useStudy();
  const { active, exam, waiting, clock, phaseLabel, sub, fraction } = useTimerTexts({ timer, config: setup.config, now });
  const detail = !active || !active.running || exam || waiting ? sub : t("cycle_of", { n: active.cycle, total: active.config.cycles });
  return { clock, phase: phaseLabel, detail, fraction, tone: !active ? "idle" : active.phase === "break" ? "break" : "focus" };
}

/** Anillo de progreso con el tiempo restante. El gráfico es un SVG propio, no un ícono. */
export function TimerRing({ timer, config, now, size = 340 }: TimerProps & { size?: number }) {
  const t = useTranslations();
  const { active, exam, waiting, clock, phaseLabel, sub, fraction } = useTimerTexts({ timer, config, now });
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const away = active?.awayCount ?? 0;

  return (
    <div
      className={cn("timer-ring", !active ? "is-idle" : active.phase === "break" && "is-break", exam && "is-long", waiting && "is-waiting")}
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
  const advance = useAdvance(active);
  const detail = active && !exam && !advance ? t("cycle_of", { n: active.cycle, total: active.config.cycles }) : sub;

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
          {advance ? (
            // El timer espera que lo pasen de fase: ese es el botón que importa.
            <button type="button" className="round-btn is-sm is-primary" aria-label={advance.label} title={advance.label} onClick={() => studyStore.advance()}>
              <ChevronsRight size={18} />
            </button>
          ) : exam && running ? (
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
          {onBreak && !advance ? (
            <button type="button" className="round-btn is-sm" aria-label={t("skip_break")} title={t("skip_break")} onClick={() => studyStore.skipBreak()}>
              <SkipForward size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Qué hace el botón que pasa de fase a mano, según dónde está la sesión. */
function useAdvance(active: ActiveTimer | null) {
  const t = useTranslations();
  if (!active?.waiting) return null;
  if (active.phase === "break") return { label: t("advance_focus"), icon: <Target size={20} /> };
  if (active.cycle >= active.config.cycles) return { label: t("advance_finish"), icon: <CircleCheck size={20} /> };
  return { label: t("advance_break"), icon: <Coffee size={20} /> };
}

/**
 * Opciones del timer. Siempre: pasar de fase a mano (que el timer espere al terminar el foco o el
 * descanso). Con una sesión en curso, además: adelantar, atrasar, cortar el foco o volver a empezar
 * la fase. En un examen el tiempo no se toca; ahí está, a propósito un paso más lejos, la pausa.
 */
function OptionsPopover({ active }: { active: ActiveTimer | null }) {
  const t = useTranslations();
  const { setup } = useStudy();
  const [open, setOpen] = useState(false);
  const exam = isExam(active ? active.config : setup.config);
  const label = exam ? t("exam_options") : t("timer_options");
  const step = (minutes: number, text: string, icon: ReactNode, iconFirst: boolean) => (
    <button type="button" className="btn btn-secondary adjust-step" onClick={() => studyStore.adjust(minutes)}>
      {iconFirst ? icon : null}
      <span className="tnum">{text}</span>
      {iconFirst ? null : icon}
    </button>
  );
  const act = (run: () => void) => () => {
    setOpen(false);
    run();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="round-btn" aria-label={label} data-tip={label}>
          <Settings2 size={20} />
        </button>
      </PopoverTrigger>
      {exam ? (
        <PopoverContent className="popover-pad adjust-pop" align="center" aria-label={t("exam_options")}>
          <strong className="text-body-s">{t("exam_options")}</strong>
          {active ? (
            <>
              <p className="field-hint">{t("exam_pause_hint")}</p>
              <div className="menu-sep" />
              {active.running ? (
                <button type="button" className="menu-item" onClick={act(() => studyStore.pause())}>
                  <Pause size={18} />
                  <span>{t("exam_pause")}</span>
                </button>
              ) : (
                <button type="button" className="menu-item" onClick={act(() => studyStore.toggle())}>
                  <Play size={18} />
                  <span>{t("exam_resume")}</span>
                </button>
              )}
              <button type="button" className="menu-item" onClick={act(() => studyStore.finish())}>
                <Square size={18} />
                <span>{t("exam_finish")}</span>
              </button>
            </>
          ) : (
            <p className="field-hint">{t("exam_options_idle")}</p>
          )}
        </PopoverContent>
      ) : (
        <PopoverContent className="popover-pad adjust-pop" align="center" aria-label={t("timer_options")}>
          <strong className="text-body-s">{t("timer_options")}</strong>
          {active ? (
            <>
              <span className="section-label">{t("adjust_time")}</span>
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
              {active.phase === "focus" ? (
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
              <div className="menu-sep" />
            </>
          ) : null}
          {/* Pasar de fase a mano: se puede cambiar antes de empezar o con la sesión en curso. */}
          <span className="section-label">{t("hold_title")}</span>
          <Switch checked={setup.holdFocus} onChange={(value) => studyStore.setHold({ afterFocus: value })}>
            {t("hold_focus")}
          </Switch>
          <Switch checked={setup.holdBreak} onChange={(value) => studyStore.setHold({ afterBreak: value })}>
            {t("hold_break")}
          </Switch>
          <p className="field-hint">{t("hold_hint")}</p>
          {active ? null : <p className="field-hint">{t("timer_options_idle")}</p>}
        </PopoverContent>
      )}
    </Popover>
  );
}

/**
 * Reiniciar · Opciones · Iniciar/Pausar · Saltar descanso · Timer flotante. Y, cuando el timer espera
 * que lo pasen de fase a mano, el botón para hacerlo, bien a la vista arriba de los demás.
 * `onStart` avisa que la sesión acaba de arrancar desde este botón (un clic del usuario).
 */
export function TimerControls({ timer, onStart }: { timer: TimerState; onStart?: () => void }) {
  const t = useTranslations();
  const pip = usePip();
  const pipModel = usePipModel();
  const active = activeOf(timer);
  const exam = active !== null && isExam(active.config);
  const running = active?.running ?? false;
  const onBreak = active?.phase === "break";
  const floating = pip.video || pip.floating;
  const skipTip = exam ? t("skip_not_in_exam") : onBreak ? t("skip_break") : t("skip_break_only");
  const advance = useAdvance(active);

  return (
    <>
      {advance ? (
        <Button variant="accent" size="lg" className="advance-btn" onClick={() => studyStore.advance()}>
          {advance.icon}
          {advance.label}
        </Button>
      ) : null}
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
        <OptionsPopover active={active} />
        {exam && running ? (
          // Un examen en marcha se entrega; pausarlo es posible, pero desde el menú del reloj (un paso más lejos).
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
          onClick={() => (floating ? pipStore.close() : void pipStore.open((canvas) => drawPipFrame(canvas, pipModel)))}
        >
          <PictureInPicture2 size={20} />
        </button>
      </div>
    </>
  );
}
