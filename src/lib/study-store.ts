"use client";

import { useSyncExternalStore } from "react";
import { isSoundKind, type SoundKind } from "@/lib/chime";
import {
  adjust,
  comeBack,
  CUSTOM_DEFAULT,
  clampCustom,
  configFor,
  DEFAULT_CONFIG,
  EXAM_DEFAULT_MINUTES,
  examConfig,
  finish,
  IDLE,
  isExam,
  isTimerState,
  leave,
  pause,
  restartPhase,
  resume,
  skipBreak,
  skipFocus,
  start,
  tick,
  worthSaving,
  type PresetKey,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from "@/lib/domain/timer";

/**
 * Estado de la sesión de estudio en curso. Vive fuera de React para que el timer siga al
 * cambiar de sección, y se guarda en localStorage para recuperarlo al recargar.
 * La lógica es la de src/lib/domain/timer.ts; acá solo se le pasa el reloj.
 */

type Durations = Omit<TimerConfig, "preset">;

export type StudySetup = {
  config: TimerConfig;
  /** Últimos valores del preset Personalizado. */
  custom: Durations;
  subjectId: string | null;
  filterBySubject: boolean;
  sound: boolean;
  /** Qué sonido avisa el fin de cada fase y a qué volumen (0 a 1). */
  soundKind: SoundKind;
  volume: number;
  /** Modo examen: duración elegida, el preset de estudio al que se vuelve y si suena la alarma al salir de la página. */
  examMinutes: number;
  studyPreset: Exclude<PresetKey, "exam">;
  awayAlarm: boolean;
};

export type StudySnapshot = { setup: StudySetup; timer: TimerState; now: number };

const STORAGE_KEY = "tilde-study";

const INITIAL: StudySnapshot = {
  setup: {
    config: DEFAULT_CONFIG,
    custom: CUSTOM_DEFAULT,
    subjectId: null,
    filterBySubject: false,
    sound: true,
    soundKind: "chime",
    volume: 0.5,
    examMinutes: EXAM_DEFAULT_MINUTES,
    studyPreset: "25-5",
    awayAlarm: true,
  },
  timer: IDLE,
  now: 0,
};

let snapshot: StudySnapshot = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<StudySnapshot>;
    const merged = { ...INITIAL.setup, ...(typeof saved.setup === "object" && saved.setup ? saved.setup : {}) };
    // Lo guardado puede venir de una versión anterior o estar tocado a mano: se valida lo que tiene valores cerrados.
    const setup: StudySetup = {
      ...merged,
      soundKind: isSoundKind(merged.soundKind) ? merged.soundKind : INITIAL.setup.soundKind,
      volume: typeof merged.volume === "number" && merged.volume >= 0 && merged.volume <= 1 ? merged.volume : INITIAL.setup.volume,
    };
    snapshot = { setup, timer: isTimerState(saved.timer) ? saved.timer : IDLE, now: Date.now() };
  } catch {
    // Estado guardado ilegible: se arranca de cero.
  }
}

function commit(next: Partial<StudySnapshot>, persist = true) {
  snapshot = { ...snapshot, ...next, now: Date.now() };
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ setup: snapshot.setup, timer: snapshot.timer }));
    } catch {
      // Sin almacenamiento: el timer funciona igual, pero no sobrevive a una recarga.
    }
  }
  listeners.forEach((listener) => listener());
}

const getSnapshot = () => {
  if (!loaded) load();
  return snapshot;
};

export const studyStore = {
  getSnapshot,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Cambia el preset (solo con el timer detenido). */
  setPreset(preset: Exclude<PresetKey, "exam">) {
    const { setup } = getSnapshot();
    commit({ setup: { ...setup, studyPreset: preset, config: configFor(preset, setup.custom) } });
  },

  setCustom(patch: Partial<Durations>) {
    const { setup } = getSnapshot();
    const custom = clampCustom({ ...setup.custom, ...patch });
    commit({ setup: { ...setup, custom, studyPreset: "custom", config: configFor("custom", custom) } });
  },

  /** Entra o sale del modo examen (solo con el timer detenido). Al salir vuelve al preset de estudio anterior. */
  setExamMode(exam: boolean) {
    const { setup } = getSnapshot();
    commit({ setup: { ...setup, config: exam ? examConfig(setup.examMinutes) : configFor(setup.studyPreset, setup.custom) } });
  },

  setExamMinutes(minutes: number) {
    const { setup } = getSnapshot();
    const config = examConfig(minutes);
    commit({ setup: { ...setup, examMinutes: config.focusMinutes, config } });
  },

  setAwayAlarm(awayAlarm: boolean) {
    commit({ setup: { ...getSnapshot().setup, awayAlarm } });
  },

  setSubject(subjectId: string | null) {
    const { setup, timer } = getSnapshot();
    commit({
      setup: { ...setup, subjectId, filterBySubject: subjectId ? setup.filterBySubject : false },
      timer: timer.status === "active" ? { ...timer, subjectId } : timer,
    });
  },

  setFilterBySubject(filterBySubject: boolean) {
    commit({ setup: { ...getSnapshot().setup, filterBySubject } });
  },

  setSound(sound: boolean) {
    commit({ setup: { ...getSnapshot().setup, sound } });
  },

  setSoundKind(soundKind: SoundKind) {
    commit({ setup: { ...getSnapshot().setup, soundKind } });
  },

  setVolume(volume: number) {
    commit({ setup: { ...getSnapshot().setup, volume: Math.max(0, Math.min(1, volume)) } });
  },

  /**
   * Iniciar, pausar o reanudar: el botón grande. Un examen en marcha no se pausa desde acá
   * (para eso está `pause()`, que la interfaz deja en un submenú); reanudarlo, sí.
   */
  toggle() {
    const { setup, timer } = getSnapshot();
    const now = Date.now();
    if (timer.status === "idle") commit({ timer: start(setup.config, setup.subjectId, now) });
    else if (timer.status !== "active") return;
    else if (!timer.running) commit({ timer: resume(timer, now) });
    else if (!isExam(timer.config)) commit({ timer: pause(timer, now) });
  },

  /** Pausa explícita, también para un examen. */
  pause() {
    const { timer } = getSnapshot();
    if (timer.status === "active" && timer.running) commit({ timer: pause(timer, Date.now()) });
  },

  /**
   * Reiniciar. Si ya hay tiempo de foco que vale la pena, no se tira: queda el resumen para
   * decidir si guardar la sesión (incompleta) o descartarla.
   */
  reset() {
    const { timer } = getSnapshot();
    const now = Date.now();
    if (timer.status === "active" && worthSaving(timer, now)) commit({ timer: { status: "finished", summary: finish(timer, now) } });
    else commit({ timer: IDLE });
  },

  /** Vuelve al estado inicial sin preguntar (después de guardar o de descartar el resumen). */
  clear() {
    commit({ timer: IDLE });
  },

  skipBreak() {
    const { timer } = getSnapshot();
    if (timer.status === "active") commit({ timer: skipBreak(timer, Date.now()) });
  },

  /** Cortar el foco y pasar al descanso (o terminar, si era el último ciclo). */
  skipFocus() {
    const { timer } = getSnapshot();
    if (timer.status === "active" && !isExam(timer.config)) commit({ timer: skipFocus(timer, Date.now()) });
  },

  /** Adelantar (minutos positivos) o atrasar (negativos) la fase en curso. */
  adjust(minutes: number) {
    const { timer } = getSnapshot();
    if (timer.status === "active" && !isExam(timer.config)) commit({ timer: adjust(timer, minutes * 60_000, Date.now()) });
  },

  restartPhase() {
    const { timer } = getSnapshot();
    if (timer.status === "active" && !isExam(timer.config)) commit({ timer: restartPhase(timer, Date.now()) });
  },

  /** Modo examen: se salió de la página. Devuelve true si es una salida nueva. */
  leave(): boolean {
    const { timer } = getSnapshot();
    if (timer.status !== "active") return false;
    const next = leave(timer, Date.now());
    if (next === timer) return false;
    commit({ timer: next });
    return true;
  },

  /** Modo examen: volvió a la página. Devuelve cuántas salidas lleva, o null si no estaba afuera. */
  comeBack(): number | null {
    const { timer } = getSnapshot();
    if (timer.status !== "active" || timer.awaySince == null) return null;
    const next = comeBack(timer, Date.now());
    commit({ timer: next });
    return next.awayCount ?? 0;
  },

  /** Terminar o detener: deja el resumen listo para guardar o descartar. */
  finish() {
    const { timer } = getSnapshot();
    if (timer.status === "active") commit({ timer: { status: "finished", summary: finish(timer, Date.now()) } });
  },

  /** Avanza el timer hasta ahora y devuelve los cambios de fase ocurridos. */
  tick(): TimerEvent[] {
    const current = getSnapshot();
    const { state, events } = tick(current.timer, Date.now());
    commit({ timer: state }, state !== current.timer);
    return events;
  },
};

export function useStudy(): StudySnapshot {
  return useSyncExternalStore(studyStore.subscribe, studyStore.getSnapshot, () => INITIAL);
}
