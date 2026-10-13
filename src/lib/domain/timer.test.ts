import { describe, expect, it } from "vitest";
import {
  addCycle,
  adjust,
  advance,
  canAddCycle,
  canUndoFinish,
  clampCustom,
  comeBack,
  configFor,
  elapsedTotals,
  endSession,
  examConfig,
  finish,
  formatClock,
  isIncomplete,
  isTimerState,
  leave,
  overtimeMs,
  pause,
  phaseProgress,
  remainingMs,
  restartPhase,
  resume,
  setHold,
  skipBreak,
  skipFocus,
  start,
  tasksCompletedBetween,
  tick,
  undoFinish,
  worthSaving,
  type ActiveTimer,
  type TimerState,
} from "./timer";

const MIN = 60_000;
const T0 = Date.parse("2026-10-13T18:00:00Z");
const pomodoro = configFor("25-5"); // 25 / 5 × 4

const active = (state: TimerState): ActiveTimer => {
  if (state.status !== "active") throw new Error(`se esperaba un timer activo, llegó ${state.status}`);
  return state;
};

describe("presets", () => {
  it("Pomodoro 25/5 × 4, 50/10 × 3, 90/20 × 2 y Personalizado 40/8 × 3", () => {
    expect(configFor("25-5")).toEqual({ preset: "25-5", focusMinutes: 25, breakMinutes: 5, cycles: 4 });
    expect(configFor("50-10")).toMatchObject({ focusMinutes: 50, breakMinutes: 10, cycles: 3 });
    expect(configFor("90-20")).toMatchObject({ focusMinutes: 90, breakMinutes: 20, cycles: 2 });
    expect(configFor("custom")).toEqual({ preset: "custom", focusMinutes: 40, breakMinutes: 8, cycles: 3 });
  });

  it("el personalizado se acota: foco 5–180, descanso 1–60, ciclos 1–12", () => {
    expect(clampCustom({ focusMinutes: 1, breakMinutes: 0, cycles: 0 })).toEqual({ focusMinutes: 5, breakMinutes: 1, cycles: 1 });
    expect(clampCustom({ focusMinutes: 999, breakMinutes: 999, cycles: 99 })).toEqual({ focusMinutes: 180, breakMinutes: 60, cycles: 12 });
    expect(clampCustom({ focusMinutes: Number.NaN, breakMinutes: 7.6, cycles: 2 })).toEqual({ focusMinutes: 5, breakMinutes: 8, cycles: 2 });
  });
});

describe("timestamps", () => {
  it("al iniciar guarda cuándo termina la fase, no un contador", () => {
    const timer = start(pomodoro, "s1", T0);
    expect(timer).toMatchObject({ phase: "focus", cycle: 1, running: true, phaseEndsAt: T0 + 25 * MIN, subjectId: "s1" });
    expect(remainingMs(timer, T0)).toBe(25 * MIN);
  });

  it("el restante se calcula contra el reloj: no deriva si no hubo ticks (pestaña en segundo plano)", () => {
    const timer = start(pomodoro, null, T0);
    // Diez minutos después, sin un solo tick en el medio:
    expect(remainingMs(timer, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(phaseProgress(timer, T0 + 10 * MIN)).toBeCloseTo(0.4, 10);
    expect(tick(timer, T0 + 10 * MIN)).toEqual({ state: timer, events: [] });
  });

  it("pausar congela el restante y reanudar recalcula el fin de fase", () => {
    const paused = pause(start(pomodoro, null, T0), T0 + 10 * MIN);
    expect(paused).toMatchObject({ running: false, remainingMs: 15 * MIN, phaseEndsAt: null, focusMs: 10 * MIN });
    // Media hora en pausa no consume tiempo.
    expect(remainingMs(paused, T0 + 40 * MIN)).toBe(15 * MIN);
    expect(tick(paused, T0 + 40 * MIN).state).toBe(paused);
    const resumed = resume(paused, T0 + 40 * MIN);
    expect(resumed).toMatchObject({ running: true, phaseEndsAt: T0 + 55 * MIN, remainingMs: null });
  });
});

describe("fases y ciclos", () => {
  it("foco → descanso → foco del ciclo siguiente, avisando cada cambio", () => {
    let result = tick(start(pomodoro, null, T0), T0 + 25 * MIN);
    expect(result.events).toEqual([{ type: "break-started", minutes: 5 }]);
    expect(active(result.state)).toMatchObject({ phase: "break", cycle: 1, phaseEndsAt: T0 + 30 * MIN, focusMs: 25 * MIN, cyclesCompleted: 1 });

    result = tick(result.state, T0 + 30 * MIN);
    expect(result.events).toEqual([{ type: "focus-started", cycle: 2, cycles: 4 }]);
    expect(active(result.state)).toMatchObject({ phase: "focus", cycle: 2, phaseEndsAt: T0 + 55 * MIN, breakMs: 5 * MIN });
  });

  it("si pasaron varias fases sin ticks, las recorre todas y encadena los horarios", () => {
    // 62 minutos después: foco (25) + descanso (5) + foco (25) + descanso (5) = 60 → 2 min de foco del ciclo 3.
    const { state, events } = tick(start(pomodoro, null, T0), T0 + 62 * MIN);
    expect(events.map((event) => event.type)).toEqual(["break-started", "focus-started", "break-started", "focus-started"]);
    const timer = active(state);
    expect(timer).toMatchObject({ phase: "focus", cycle: 3, phaseEndsAt: T0 + 85 * MIN, cyclesCompleted: 2 });
    expect(remainingMs(timer, T0 + 62 * MIN)).toBe(23 * MIN);
    expect(elapsedTotals(timer, T0 + 62 * MIN)).toEqual({ focusMs: 52 * MIN, breakMs: 10 * MIN });
  });

  it("al terminar el último foco la sesión queda terminada, sin descanso final", () => {
    const short = { preset: "custom" as const, focusMinutes: 10, breakMinutes: 2, cycles: 2 };
    const { state, events } = tick(start(short, "s1", T0), T0 + 60 * MIN);
    expect(events.map((event) => event.type)).toEqual(["break-started", "focus-started", "finished"]);
    expect(state).toMatchObject({
      status: "finished",
      ended: "completed",
      summary: {
        preset: "custom",
        subjectId: "s1",
        startedAt: T0,
        endedAt: T0 + 22 * MIN, // 10 + 2 + 10: termina cuando terminó la fase, no cuando se miró
        focusSeconds: 20 * 60,
        breakSeconds: 2 * 60,
        cyclesCompleted: 2,
        cycles: 2,
        awayCount: 0,
        awaySeconds: 0,
      },
    });
  });

  it("saltar descanso solo funciona en descanso y arranca el foco siguiente", () => {
    const focusing = start(pomodoro, null, T0);
    expect(skipBreak(focusing, T0 + MIN)).toBe(focusing);

    const onBreak = active(tick(focusing, T0 + 25 * MIN).state);
    const skipped = skipBreak(onBreak, T0 + 27 * MIN);
    expect(skipped).toMatchObject({ phase: "focus", cycle: 2, phaseEndsAt: T0 + 52 * MIN, breakMs: 2 * MIN, focusMs: 25 * MIN });

    // En pausa durante el descanso: queda listo el foco completo, sin correr.
    const pausedBreak = pause(onBreak, T0 + 26 * MIN);
    expect(skipBreak(pausedBreak, T0 + 40 * MIN)).toMatchObject({ phase: "focus", cycle: 2, running: false, remainingMs: 25 * MIN, breakMs: MIN });
  });
});

describe("resumen", () => {
  it("terminar a mano guarda foco y descanso reales, sin contar las pausas", () => {
    let timer = start(pomodoro, "s1", T0);
    timer = pause(timer, T0 + 10 * MIN); // 10 min de foco
    timer = resume(timer, T0 + 20 * MIN); // 10 min en pausa
    timer = active(tick(timer, T0 + 35 * MIN).state); // completa el foco (15 más) → descanso
    const summary = finish(timer, T0 + 37 * MIN); // 2 min de descanso
    expect(summary).toEqual({
      preset: "25-5",
      subjectId: "s1",
      startedAt: T0,
      endedAt: T0 + 37 * MIN,
      focusSeconds: 25 * 60,
      breakSeconds: 2 * 60,
      cyclesCompleted: 1,
      cycles: 4,
      awayCount: 0,
      awaySeconds: 0,
    });
  });

  it("terminar en pausa no suma el tiempo pausado", () => {
    const paused = pause(start(pomodoro, null, T0), T0 + 3 * MIN);
    expect(finish(paused, T0 + 90 * MIN)).toMatchObject({ focusSeconds: 180, breakSeconds: 0, cyclesCompleted: 0, endedAt: T0 + 90 * MIN });
  });

  it("las tareas de la sesión son las tildadas entre el inicio y el fin", () => {
    const at = (minutes: number) => new Date(T0 + minutes * MIN).toISOString();
    const tasks = [
      { id: "antes", completed_at: at(-5) },
      { id: "durante", completed_at: at(12) },
      { id: "justo-al-final", completed_at: at(30) },
      { id: "despues", completed_at: at(31) },
      { id: "pendiente", completed_at: null },
    ];
    expect(tasksCompletedBetween(tasks, T0, T0 + 30 * MIN).map((task) => task.id)).toEqual(["durante", "justo-al-final"]);
  });
});

describe("formato y persistencia", () => {
  it("muestra MM:SS, con minutos que pueden pasar de 59", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(90 * MIN)).toBe("90:00");
    expect(formatClock(18 * MIN + 24_000)).toBe("18:24");
    expect(formatClock(999)).toBe("00:01"); // redondea hacia arriba
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-500)).toBe("00:00");
  });

  it("el estado sobrevive a JSON (localStorage) y sigue donde estaba", () => {
    const saved = JSON.parse(JSON.stringify(pause(start(pomodoro, "s1", T0), T0 + 5 * MIN)));
    expect(isTimerState(saved)).toBe(true);
    expect(remainingMs(resume(saved, T0 + 60 * MIN), T0 + 61 * MIN)).toBe(19 * MIN);

    const running = JSON.parse(JSON.stringify(start(pomodoro, null, T0)));
    expect(isTimerState(running)).toBe(true);
    // Se recarga la página 26 minutos después: ya está en el descanso.
    expect(active(tick(running, T0 + 26 * MIN).state)).toMatchObject({ phase: "break", cycle: 1 });
  });

  it("rechaza estados guardados corruptos", () => {
    for (const bad of [null, 42, {}, { status: "active" }, { status: "active", config: {}, phase: "focus" }, { status: "finished" }]) {
      expect(isTimerState(bad)).toBe(false);
    }
    expect(isTimerState({ status: "idle" })).toBe(true);
  });
});

describe("ajustar el tiempo a mano", () => {
  it("adelantar le quita tiempo a la fase y lo cuenta como foco (se estudió con el timer frenado)", () => {
    const paused = pause(start(pomodoro, null, T0), T0 + 5 * MIN);
    const moved = adjust(paused, 10 * MIN, T0 + 40 * MIN);
    expect(remainingMs(moved, T0 + 40 * MIN)).toBe(10 * MIN);
    expect(moved.focusMs).toBe(15 * MIN);
    expect(moved.running).toBe(false);
  });

  it("atrasar le devuelve tiempo a la fase y lo descuenta (el timer corrió sin que se estudiara)", () => {
    const timer = start(pomodoro, null, T0);
    const moved = adjust(timer, -5 * MIN, T0 + 12 * MIN);
    expect(remainingMs(moved, T0 + 12 * MIN)).toBe(18 * MIN);
    expect(elapsedTotals(moved, T0 + 12 * MIN).focusMs).toBe(7 * MIN);
    // Sigue corriendo desde ahí.
    expect(remainingMs(moved, T0 + 13 * MIN)).toBe(17 * MIN);
    expect(elapsedTotals(moved, T0 + 13 * MIN).focusMs).toBe(8 * MIN);
  });

  it("no pasa del principio ni del final de la fase", () => {
    const timer = start(pomodoro, null, T0);
    const rewound = adjust(timer, -60 * MIN, T0 + 3 * MIN);
    expect(remainingMs(rewound, T0 + 3 * MIN)).toBe(25 * MIN);
    expect(elapsedTotals(rewound, T0 + 3 * MIN).focusMs).toBe(0);

    const forwarded = adjust(timer, 60 * MIN, T0 + 3 * MIN);
    expect(remainingMs(forwarded, T0 + 3 * MIN)).toBe(0);
    expect(forwarded.focusMs).toBe(25 * MIN);
    // Al llegar al final, el tick la cierra como una fase completa.
    const { state, events } = tick(forwarded, T0 + 3 * MIN);
    expect(active(state).phase).toBe("break");
    expect(active(state).cyclesCompleted).toBe(1);
    expect(events).toEqual([{ type: "break-started", minutes: 5 }]);
  });

  it("también ajusta el descanso, sin tocar el foco", () => {
    const onBreak = active(tick(start(pomodoro, null, T0), T0 + 25 * MIN).state);
    const moved = adjust(onBreak, 2 * MIN, T0 + 26 * MIN);
    expect(remainingMs(moved, T0 + 26 * MIN)).toBe(2 * MIN);
    expect(moved.focusMs).toBe(25 * MIN);
    expect(moved.breakMs).toBe(3 * MIN);
  });

  it("volver a empezar la fase conserva el tiempo real ya contado", () => {
    const again = restartPhase(start(pomodoro, null, T0), T0 + 10 * MIN);
    expect(remainingMs(again, T0 + 10 * MIN)).toBe(25 * MIN);
    expect(elapsedTotals(again, T0 + 12 * MIN).focusMs).toBe(12 * MIN);
  });

  it("cortar el foco pasa al descanso sin contar el ciclo como completado", () => {
    const state = skipFocus(start(pomodoro, null, T0), T0 + 10 * MIN);
    const onBreak = active(state);
    expect(onBreak.phase).toBe("break");
    expect(onBreak.cyclesCompleted).toBe(0);
    expect(onBreak.focusMs).toBe(10 * MIN);
    expect(remainingMs(onBreak, T0 + 10 * MIN)).toBe(5 * MIN);
    // En el descanso no hace nada.
    expect(skipFocus(onBreak, T0 + 11 * MIN)).toBe(onBreak);
  });

  it("cortar el foco del último ciclo termina la sesión", () => {
    const single = start({ preset: "custom", focusMinutes: 30, breakMinutes: 5, cycles: 1 }, null, T0);
    const state = skipFocus(single, T0 + 12 * MIN);
    expect(state.status).toBe("finished");
    if (state.status === "finished") expect(state.summary).toMatchObject({ focusSeconds: 720, cyclesCompleted: 0, cycles: 1 });
  });
});

describe("sesiones incompletas", () => {
  it("el resumen dice cuántos ciclos estaban planeados", () => {
    const summary = finish(start(pomodoro, null, T0), T0 + 30 * MIN);
    expect(summary).toMatchObject({ cycles: 4, cyclesCompleted: 0, focusSeconds: 1800 });
    expect(isIncomplete(summary)).toBe(true);
    expect(isIncomplete({ cycles: 4, cyclesCompleted: 4 })).toBe(false);
    // Un resumen viejo, sin el dato, no se marca como incompleto.
    expect(isIncomplete({ cyclesCompleted: 1 })).toBe(false);
  });

  it("vale la pena guardarla a partir de un minuto de foco", () => {
    const timer = start(pomodoro, null, T0);
    expect(worthSaving(timer, T0 + 59_000)).toBe(false);
    expect(worthSaving(timer, T0 + 60_000)).toBe(true);
  });
});

describe("modo examen", () => {
  const exam = examConfig(120);

  it("es un solo bloque sin descansos: 1:30, 2, 2:30 o 3 horas", () => {
    expect(exam).toEqual({ preset: "exam", focusMinutes: 120, breakMinutes: 0, cycles: 1 });
    expect(examConfig(180).focusMinutes).toBe(180);
    expect(examConfig(45).focusMinutes).toBe(120);
  });

  it("corre de corrido y termina solo al cumplirse el tiempo", () => {
    const timer = start(exam, null, T0);
    expect(tick(timer, T0 + 119 * MIN).state).toBe(timer);
    const { state, events } = tick(timer, T0 + 120 * MIN);
    expect(events).toEqual([{ type: "finished" }]);
    expect(state.status === "finished" && state.summary).toMatchObject({ preset: "exam", focusSeconds: 7200, breakSeconds: 0, cyclesCompleted: 1 });
  });

  it("cuenta las salidas de la página y el tiempo afuera", () => {
    let timer = start(exam, null, T0);
    timer = leave(timer, T0 + 10 * MIN);
    // Dos avisos seguidos de la misma salida (pestaña oculta + ventana sin foco) cuentan una vez.
    expect(leave(timer, T0 + 10 * MIN + 500)).toBe(timer);
    timer = comeBack(timer, T0 + 11 * MIN);
    timer = leave(timer, T0 + 30 * MIN);
    timer = comeBack(timer, T0 + 30 * MIN + 30_000);
    expect(timer).toMatchObject({ awayCount: 2, awayMs: 90_000, awaySince: null });
    expect(comeBack(timer, T0 + 40 * MIN)).toBe(timer);
    expect(finish(timer, T0 + 50 * MIN)).toMatchObject({ awayCount: 2, awaySeconds: 90 });
  });

  it("si termina estando afuera, ese tiempo también se cuenta", () => {
    const timer = leave(start(exam, null, T0), T0 + 100 * MIN);
    const { state } = tick(timer, T0 + 125 * MIN);
    expect(state.status === "finished" && state.summary).toMatchObject({ awayCount: 1, awaySeconds: 20 * 60 });
  });

  it("fuera del modo examen, o en pausa, salir no se registra", () => {
    const study = start(pomodoro, null, T0);
    expect(leave(study, T0 + MIN)).toBe(study);
    const paused = pause(start(exam, null, T0), T0 + MIN);
    expect(leave(paused, T0 + 2 * MIN)).toBe(paused);
  });

  it("el reloj largo muestra horas", () => {
    expect(formatClock(120 * MIN, { hours: true })).toBe("2:00:00");
    expect(formatClock(61 * MIN + 5000, { hours: true })).toBe("1:01:05");
    expect(formatClock(59_001, { hours: true })).toBe("0:01:00");
  });
});

describe("pasar de fase a mano", () => {
  const HOLD_FOCUS = { afterFocus: true, afterBreak: false };
  const HOLD_BOTH = { afterFocus: true, afterBreak: true };
  const short = { preset: "custom" as const, focusMinutes: 10, breakMinutes: 2, cycles: 2 };

  it("al cumplirse el foco no pasa solo al descanso: espera, avisa una vez y el tiempo de más cuenta como foco", () => {
    const first = tick(start(pomodoro, null, T0, HOLD_FOCUS), T0 + 25 * MIN + 1);
    expect(first.events).toEqual([{ type: "focus-over", last: false }]);
    const waiting = active(first.state);
    expect(waiting).toMatchObject({ phase: "focus", cycle: 1, waiting: true, running: true, cyclesCompleted: 1 });
    expect(remainingMs(waiting, T0 + 26 * MIN)).toBe(0);
    expect(phaseProgress(waiting, T0 + 26 * MIN)).toBe(1);
    // Siete minutos después sigue esperando, sin avisar de nuevo.
    const later = tick(waiting, T0 + 32 * MIN);
    expect(later.events).toEqual([]);
    expect(later.state).toBe(waiting);
    expect(overtimeMs(waiting, T0 + 32 * MIN)).toBe(7 * MIN);
    expect(elapsedTotals(waiting, T0 + 32 * MIN)).toEqual({ focusMs: 32 * MIN, breakMs: 0 });
  });

  it("al pasarlo, el descanso empieza en ese momento con su duración completa", () => {
    const waiting = active(tick(start(pomodoro, null, T0, HOLD_FOCUS), T0 + 26 * MIN).state);
    const onBreak = active(advance(waiting, T0 + 32 * MIN));
    expect(onBreak).toMatchObject({ phase: "break", cycle: 1, focusMs: 32 * MIN, cyclesCompleted: 1, phaseEndsAt: T0 + 37 * MIN });
    expect(onBreak.waiting).toBeUndefined();
    expect(overtimeMs(onBreak, T0 + 33 * MIN)).toBe(0);
    // Solo el foco espera: el descanso pasa solo al foco siguiente.
    const next = tick(onBreak, T0 + 37 * MIN + 1);
    expect(next.events).toEqual([{ type: "focus-started", cycle: 2, cycles: 4 }]);
    expect(active(next.state)).toMatchObject({ phase: "focus", cycle: 2, breakMs: 5 * MIN });
  });

  it("el descanso también puede esperar: el tiempo de más cuenta como descanso y el foco arranca al tocar", () => {
    const afterFocus = active(advance(active(tick(start(pomodoro, null, T0, HOLD_BOTH), T0 + 25 * MIN).state), T0 + 25 * MIN));
    const over = tick(afterFocus, T0 + 30 * MIN);
    expect(over.events).toEqual([{ type: "break-over" }]);
    const waiting = active(over.state);
    expect(waiting).toMatchObject({ phase: "break", cycle: 1, waiting: true });
    const focus = active(advance(waiting, T0 + 34 * MIN));
    expect(focus).toMatchObject({ phase: "focus", cycle: 2, breakMs: 9 * MIN, focusMs: 25 * MIN, phaseEndsAt: T0 + 59 * MIN });
  });

  it("si pasó mucho tiempo sin mirar, se queda en la primera fase que espera (no recorre las demás)", () => {
    const { state, events } = tick(start(pomodoro, null, T0, HOLD_FOCUS), T0 + 3 * 60 * MIN);
    expect(events).toEqual([{ type: "focus-over", last: false }]);
    expect(active(state)).toMatchObject({ phase: "focus", cycle: 1, waiting: true });
    expect(overtimeMs(active(state), T0 + 3 * 60 * MIN)).toBe(155 * MIN);
  });

  it("pausar durante la espera frena el tiempo de más; al reanudar sigue desde ahí", () => {
    const waiting = active(tick(start(pomodoro, null, T0, HOLD_FOCUS), T0 + 25 * MIN).state);
    const paused = pause(waiting, T0 + 28 * MIN);
    expect(paused).toMatchObject({ running: false, waiting: true, focusMs: 28 * MIN, remainingMs: 0 });
    expect(overtimeMs(paused, T0 + 40 * MIN)).toBe(3 * MIN);
    const back = resume(paused, T0 + 40 * MIN);
    expect(tick(back, T0 + 41 * MIN).state).toBe(back);
    expect(overtimeMs(back, T0 + 42 * MIN)).toBe(5 * MIN);
    expect(elapsedTotals(back, T0 + 42 * MIN).focusMs).toBe(30 * MIN);
    // Pasarlo estando en pausa deja el descanso listo, también en pausa.
    expect(advance(paused, T0 + 50 * MIN)).toMatchObject({ phase: "break", running: false, remainingMs: 5 * MIN, focusMs: 28 * MIN });
  });

  it("el último foco también espera: recién al pasarlo la sesión queda completa, con el tiempo de más contado", () => {
    let state: TimerState = start(short, null, T0, HOLD_FOCUS);
    state = advance(active(tick(state, T0 + 10 * MIN).state), T0 + 10 * MIN); // descanso 10–12
    state = tick(state, T0 + 12 * MIN).state; // foco 2: 12–22
    const over = tick(state, T0 + 22 * MIN);
    expect(over.events).toEqual([{ type: "focus-over", last: true }]);
    expect(over.state.status).toBe("active");
    const done = advance(active(over.state), T0 + 25 * MIN);
    expect(done).toMatchObject({ status: "finished", ended: "completed", summary: { focusSeconds: 23 * 60, cyclesCompleted: 2, cycles: 2, endedAt: T0 + 25 * MIN } });
    // "Terminar sesión" en esa espera es lo mismo: la completó.
    expect(endSession(active(over.state), T0 + 25 * MIN)).toMatchObject({ ended: "completed", summary: { cyclesCompleted: 2 } });
  });

  it("atrasar o volver a empezar una fase que esperaba la reabre: deja de esperar y el ciclo deja de figurar completo", () => {
    const waiting = active(tick(start(pomodoro, null, T0, HOLD_FOCUS), T0 + 25 * MIN).state);
    const back = adjust(waiting, -5 * MIN, T0 + 27 * MIN);
    expect(back).toMatchObject({ phase: "focus", cyclesCompleted: 0, focusMs: 22 * MIN, phaseEndsAt: T0 + 32 * MIN });
    expect(back.waiting).toBeUndefined();
    // Adelantar no tiene nada que quitar: sigue esperando.
    expect(adjust(waiting, 5 * MIN, T0 + 27 * MIN)).toBe(waiting);
    const again = restartPhase(waiting, T0 + 27 * MIN);
    expect(again).toMatchObject({ cyclesCompleted: 0, focusMs: 27 * MIN, phaseEndsAt: T0 + 52 * MIN });
    expect(again.waiting).toBeUndefined();
  });

  it("cortar el foco o saltar el descanso desde una espera es pasarlo, con el ciclo completo", () => {
    const waitingFocus = active(tick(start(pomodoro, null, T0, HOLD_BOTH), T0 + 25 * MIN).state);
    const cut = skipFocus(waitingFocus, T0 + 26 * MIN);
    expect(cut).toMatchObject({ status: "active", phase: "break", cyclesCompleted: 1 });
    const waitingBreak = active(tick(active(cut), T0 + 31 * MIN).state);
    expect(waitingBreak.waiting).toBe(true);
    const skipped = skipBreak(waitingBreak, T0 + 33 * MIN);
    expect(skipped).toMatchObject({ phase: "focus", cycle: 2, breakMs: 7 * MIN });
    expect(skipped.waiting).toBeUndefined();
  });

  it("se activa o desactiva con la sesión en curso, y un examen nunca espera", () => {
    const plain = start(pomodoro, null, T0);
    expect(plain.hold).toBeUndefined();
    const held = setHold(plain, HOLD_FOCUS);
    expect(active(tick(held, T0 + 25 * MIN).state).waiting).toBe(true);
    expect(active(tick(setHold(held, { afterFocus: false, afterBreak: false }), T0 + 25 * MIN).state)).toMatchObject({ phase: "break" });

    const exam = start(examConfig(90), null, T0, HOLD_BOTH);
    expect(exam.hold).toBeUndefined();
    expect(setHold(exam, HOLD_BOTH)).toBe(exam);
    expect(tick(exam, T0 + 90 * MIN).state.status).toBe("finished");
  });
});

describe("terminar, volver atrás y agregar un ciclo", () => {
  it("terminar a mano se puede deshacer: la sesión sigue donde estaba y el rato del resumen no cuenta", () => {
    const running = active(tick(start(pomodoro, "s1", T0), T0 + 10 * MIN).state);
    const ended = endSession(running, T0 + 10 * MIN);
    expect(ended).toMatchObject({ status: "finished", ended: "manual", wasRunning: true, summary: { focusSeconds: 600, cyclesCompleted: 0 } });
    expect(canUndoFinish(ended)).toBe(true);
    expect(canAddCycle(ended)).toBe(false);
    // Dos minutos mirando el resumen: al volver le siguen quedando 15, y cuenta 10 de foco.
    const back = active(undoFinish(ended, T0 + 12 * MIN));
    expect(back).toMatchObject({ phase: "focus", cycle: 1, running: true, focusMs: 10 * MIN, subjectId: "s1", startedAt: T0 });
    expect(remainingMs(back, T0 + 12 * MIN)).toBe(15 * MIN);
    expect(elapsedTotals(back, T0 + 14 * MIN).focusMs).toBe(12 * MIN);
  });

  it("si estaba en pausa al terminarla, vuelve en pausa", () => {
    const paused = pause(start(pomodoro, null, T0), T0 + 4 * MIN);
    const back = active(undoFinish(endSession(paused, T0 + 9 * MIN), T0 + 30 * MIN));
    expect(back).toMatchObject({ running: false, remainingMs: 21 * MIN, focusMs: 4 * MIN });
  });

  it("cortar el foco del último ciclo es terminar a mano: también se puede volver", () => {
    const single = start({ preset: "custom", focusMinutes: 30, breakMinutes: 5, cycles: 1 }, null, T0);
    const state = skipFocus(single, T0 + 12 * MIN);
    expect(canUndoFinish(state)).toBe(true);
    expect(active(undoFinish(state, T0 + 13 * MIN))).toMatchObject({ phase: "focus", focusMs: 12 * MIN });
  });

  it("una sesión que llegó sola al final no se deshace, pero se le puede agregar un ciclo: descanso y un foco más", () => {
    const short = { preset: "custom" as const, focusMinutes: 10, breakMinutes: 2, cycles: 2 };
    const done = tick(start(short, "s1", T0), T0 + 22 * MIN).state;
    expect(done).toMatchObject({ status: "finished", ended: "completed" });
    expect(canUndoFinish(done)).toBe(false);
    expect(undoFinish(done, T0 + 30 * MIN)).toBe(done);
    expect(canAddCycle(done)).toBe(true);

    // Se agrega diez minutos después: ese rato no cuenta ni como foco ni como descanso.
    const more = active(addCycle(done, T0 + 32 * MIN));
    expect(more).toMatchObject({ phase: "break", cycle: 2, running: true, focusMs: 20 * MIN, breakMs: 2 * MIN, cyclesCompleted: 2, startedAt: T0 });
    expect(more.config).toEqual({ ...short, cycles: 3 });
    expect(more.phaseEndsAt).toBe(T0 + 34 * MIN);
    const focus = tick(more, T0 + 34 * MIN);
    expect(focus.events).toEqual([{ type: "focus-started", cycle: 3, cycles: 3 }]);
    const again = tick(focus.state, T0 + 44 * MIN).state;
    expect(again).toMatchObject({ status: "finished", ended: "completed", summary: { focusSeconds: 30 * 60, breakSeconds: 4 * 60, cyclesCompleted: 3, cycles: 3, startedAt: T0 } });
    // Y se puede seguir agregando.
    expect(canAddCycle(again)).toBe(true);
  });

  it("un examen que termina solo no ofrece agregar un ciclo; entregarlo a mano sí se puede deshacer", () => {
    const exam = start(examConfig(90), null, T0);
    const timeUp = tick(exam, T0 + 90 * MIN).state;
    expect(timeUp).toMatchObject({ status: "finished", ended: "completed" });
    expect(canAddCycle(timeUp)).toBe(false);
    expect(addCycle(timeUp, T0 + 95 * MIN)).toBe(timeUp);
    const handedIn = endSession(exam, T0 + 40 * MIN);
    expect(active(undoFinish(handedIn, T0 + 41 * MIN))).toMatchObject({ running: true, focusMs: 40 * MIN });
  });

  it("el resumen con su timer guardado sobrevive a JSON; uno con el timer roto se rechaza", () => {
    const ended = endSession(start(pomodoro, null, T0), T0 + 10 * MIN);
    const revived: unknown = JSON.parse(JSON.stringify(ended));
    expect(isTimerState(revived)).toBe(true);
    expect(canUndoFinish(revived as TimerState)).toBe(true);
    expect(isTimerState({ status: "finished", summary: {}, resumable: { status: "active" } })).toBe(false);
    expect(isTimerState({ status: "finished", summary: {}, resumable: { status: "idle" } })).toBe(false);
    // Un resumen de una versión anterior (sin timer guardado) sigue valiendo, sin volver atrás ni agregar ciclo.
    const old = { status: "finished" as const, summary: ended.summary };
    expect(isTimerState(old)).toBe(true);
    expect(canUndoFinish(old)).toBe(false);
    expect(canAddCycle(old)).toBe(false);
  });
});
