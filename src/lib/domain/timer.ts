/**
 * Timer de las sesiones de estudio, basado en timestamps.
 *
 * No se acumulan ticks de setInterval: se guarda el instante en que termina la fase
 * (`phaseEndsAt`) y el restante se calcula contra el reloj. Así el timer no deriva aunque la
 * pestaña quede en segundo plano, y el estado (un objeto JSON plano) se puede persistir y
 * recuperar al recargar. Todas las funciones son puras: reciben `now` en milisegundos.
 */

export type PresetKey = "25-5" | "50-10" | "90-20" | "custom";

export type TimerConfig = {
  preset: PresetKey;
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
};

type Durations = Omit<TimerConfig, "preset">;

export const PRESETS: Record<Exclude<PresetKey, "custom">, Durations> = {
  "25-5": { focusMinutes: 25, breakMinutes: 5, cycles: 4 },
  "50-10": { focusMinutes: 50, breakMinutes: 10, cycles: 3 },
  "90-20": { focusMinutes: 90, breakMinutes: 20, cycles: 2 },
};

export const CUSTOM_DEFAULT: Durations = { focusMinutes: 40, breakMinutes: 8, cycles: 3 };

export const CUSTOM_LIMITS = {
  focusMinutes: [5, 180],
  breakMinutes: [1, 60],
  cycles: [1, 12],
} as const;

export const DEFAULT_CONFIG: TimerConfig = { preset: "25-5", ...PRESETS["25-5"] };

export function configFor(preset: PresetKey, custom: Durations = CUSTOM_DEFAULT): TimerConfig {
  return preset === "custom" ? { preset, ...clampCustom(custom) } : { preset, ...PRESETS[preset] };
}

export function clampCustom(values: Durations): Durations {
  const clamp = (value: number, [min, max]: readonly [number, number]) =>
    Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
  return {
    focusMinutes: clamp(values.focusMinutes, CUSTOM_LIMITS.focusMinutes),
    breakMinutes: clamp(values.breakMinutes, CUSTOM_LIMITS.breakMinutes),
    cycles: clamp(values.cycles, CUSTOM_LIMITS.cycles),
  };
}

export type Phase = "focus" | "break";

export type ActiveTimer = {
  status: "active";
  config: TimerConfig;
  subjectId: string | null;
  /** Instante en que arrancó la sesión. */
  startedAt: number;
  phase: Phase;
  /** Ciclo en curso, desde 1. */
  cycle: number;
  running: boolean;
  /** En marcha: cuándo termina la fase. En pausa: null. */
  phaseEndsAt: number | null;
  /** En pausa: lo que le falta a la fase. En marcha: null. */
  remainingMs: number | null;
  /** En marcha: desde cuándo corre el tramo actual (para sumar el tiempo real). */
  segmentStartedAt: number | null;
  /** Tiempo real ya contabilizado (tramos cerrados). */
  focusMs: number;
  breakMs: number;
  /** Fases de foco terminadas. */
  cyclesCompleted: number;
};

export type SessionSummary = {
  preset: PresetKey;
  subjectId: string | null;
  startedAt: number;
  endedAt: number;
  focusSeconds: number;
  breakSeconds: number;
  cyclesCompleted: number;
};

export type TimerState = { status: "idle" } | ActiveTimer | { status: "finished"; summary: SessionSummary };

export type TimerEvent =
  | { type: "break-started"; minutes: number }
  | { type: "focus-started"; cycle: number; cycles: number }
  | { type: "finished" };

export const IDLE: TimerState = { status: "idle" };

const MINUTE = 60_000;
const phaseDuration = (config: TimerConfig, phase: Phase) => (phase === "focus" ? config.focusMinutes : config.breakMinutes) * MINUTE;

/** Inicia una sesión: primer foco, ciclo 1. */
export function start(config: TimerConfig, subjectId: string | null, now: number): ActiveTimer {
  return {
    status: "active",
    config,
    subjectId,
    startedAt: now,
    phase: "focus",
    cycle: 1,
    running: true,
    phaseEndsAt: now + phaseDuration(config, "focus"),
    remainingMs: null,
    segmentStartedAt: now,
    focusMs: 0,
    breakMs: 0,
    cyclesCompleted: 0,
  };
}

/** Suma al total de la fase el tramo que corrió hasta `until`. */
function closeSegment(timer: ActiveTimer, until: number): ActiveTimer {
  if (!timer.running || timer.segmentStartedAt === null) return timer;
  const elapsed = Math.max(0, until - timer.segmentStartedAt);
  return timer.phase === "focus" ? { ...timer, focusMs: timer.focusMs + elapsed } : { ...timer, breakMs: timer.breakMs + elapsed };
}

function toSummary(timer: ActiveTimer, endedAt: number): SessionSummary {
  return {
    preset: timer.config.preset,
    subjectId: timer.subjectId,
    startedAt: timer.startedAt,
    endedAt,
    focusSeconds: Math.round(timer.focusMs / 1000),
    breakSeconds: Math.round(timer.breakMs / 1000),
    cyclesCompleted: timer.cyclesCompleted,
  };
}

/** Milisegundos que le quedan a la fase actual. */
export function remainingMs(timer: ActiveTimer, now: number): number {
  if (!timer.running) return timer.remainingMs ?? 0;
  return Math.max(0, (timer.phaseEndsAt ?? now) - now);
}

/** Fracción transcurrida de la fase (0 a 1), para el anillo. */
export function phaseProgress(timer: ActiveTimer, now: number): number {
  const total = phaseDuration(timer.config, timer.phase);
  return Math.min(1, Math.max(0, 1 - remainingMs(timer, now) / total));
}

/** Tiempo real de foco y descanso hasta `now`, contando el tramo en curso. */
export function elapsedTotals(timer: ActiveTimer, now: number): { focusMs: number; breakMs: number } {
  const closed = closeSegment(timer, Math.min(now, timer.phaseEndsAt ?? now));
  return { focusMs: closed.focusMs, breakMs: closed.breakMs };
}

export function pause(timer: ActiveTimer, now: number): ActiveTimer {
  if (!timer.running) return timer;
  const closed = closeSegment(timer, now);
  return { ...closed, running: false, remainingMs: remainingMs(timer, now), phaseEndsAt: null, segmentStartedAt: null };
}

export function resume(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.running) return timer;
  return { ...timer, running: true, phaseEndsAt: now + (timer.remainingMs ?? 0), remainingMs: null, segmentStartedAt: now };
}

/**
 * Avanza el timer hasta `now`. Si desde el último llamado terminó una o varias fases (pestaña en
 * segundo plano, equipo suspendido), las recorre todas: cada fase nueva empieza donde terminó la
 * anterior. Devuelve los eventos ocurridos, en orden, para el sonido y los avisos.
 */
export function tick(state: TimerState, now: number): { state: TimerState; events: TimerEvent[] } {
  const events: TimerEvent[] = [];
  if (state.status !== "active" || !state.running) return { state, events };

  let timer = state;
  while (timer.phaseEndsAt !== null && now >= timer.phaseEndsAt) {
    const endedAt: number = timer.phaseEndsAt;
    const closed = closeSegment(timer, endedAt);
    if (timer.phase === "focus") {
      const cyclesCompleted = closed.cyclesCompleted + 1;
      if (timer.cycle >= timer.config.cycles) {
        events.push({ type: "finished" });
        return { state: { status: "finished", summary: toSummary({ ...closed, cyclesCompleted }, endedAt) }, events };
      }
      timer = {
        ...closed,
        cyclesCompleted,
        phase: "break",
        phaseEndsAt: endedAt + phaseDuration(timer.config, "break"),
        segmentStartedAt: endedAt,
      };
      events.push({ type: "break-started", minutes: timer.config.breakMinutes });
    } else {
      timer = {
        ...closed,
        phase: "focus",
        cycle: timer.cycle + 1,
        phaseEndsAt: endedAt + phaseDuration(timer.config, "focus"),
        segmentStartedAt: endedAt,
      };
      events.push({ type: "focus-started", cycle: timer.cycle, cycles: timer.config.cycles });
    }
  }
  return { state: timer, events };
}

/** Saltar el descanso: solo durante un descanso. Empieza el foco del ciclo siguiente. */
export function skipBreak(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.phase !== "break") return timer;
  const closed = closeSegment(timer, now);
  const duration = phaseDuration(timer.config, "focus");
  return {
    ...closed,
    phase: "focus",
    cycle: timer.cycle + 1,
    phaseEndsAt: timer.running ? now + duration : null,
    remainingMs: timer.running ? null : duration,
    segmentStartedAt: timer.running ? now : null,
  };
}

/** Terminar o detener la sesión en cualquier momento: devuelve el resumen con los tiempos reales. */
export function finish(timer: ActiveTimer, now: number): SessionSummary {
  return toSummary(closeSegment(timer, now), now);
}

/** "MM:SS" (los minutos pueden pasar de 59: 90:00). Redondea hacia arriba para no mostrar 00:00 antes de tiempo. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Tareas tildadas entre el inicio y el fin de la sesión. */
export function tasksCompletedBetween<T extends { completed_at: string | null }>(tasks: readonly T[], startedAt: number, endedAt: number): T[] {
  return tasks.filter((task) => {
    if (!task.completed_at) return false;
    const at = Date.parse(task.completed_at);
    return at >= startedAt && at <= endedAt;
  });
}

/** ¿Es un estado válido, por ejemplo recién leído de localStorage? */
export function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  if (state.status === "idle") return true;
  if (state.status === "finished") return typeof state.summary === "object" && state.summary !== null;
  if (state.status !== "active") return false;
  const config = state.config as Record<string, unknown> | undefined;
  return (
    typeof config === "object" &&
    config !== null &&
    [config.focusMinutes, config.breakMinutes, config.cycles, state.startedAt, state.cycle, state.focusMs, state.breakMs].every(
      (number) => typeof number === "number" && Number.isFinite(number),
    ) &&
    (state.phase === "focus" || state.phase === "break") &&
    typeof state.running === "boolean" &&
    (state.running ? typeof state.phaseEndsAt === "number" : typeof state.remainingMs === "number")
  );
}
