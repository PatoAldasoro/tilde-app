"use client";

import { useSyncExternalStore } from "react";
import {
  CUSTOM_DEFAULT,
  clampCustom,
  configFor,
  DEFAULT_CONFIG,
  finish,
  IDLE,
  isTimerState,
  pause,
  resume,
  skipBreak,
  start,
  tick,
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
};

export type StudySnapshot = { setup: StudySetup; timer: TimerState; now: number };

const STORAGE_KEY = "tilde-study";

const INITIAL: StudySnapshot = {
  setup: { config: DEFAULT_CONFIG, custom: CUSTOM_DEFAULT, subjectId: null, filterBySubject: false, sound: true },
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
    const setup = { ...INITIAL.setup, ...(typeof saved.setup === "object" && saved.setup ? saved.setup : {}) };
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
  setPreset(preset: PresetKey) {
    const { setup } = getSnapshot();
    commit({ setup: { ...setup, config: configFor(preset, setup.custom) } });
  },

  setCustom(patch: Partial<Durations>) {
    const { setup } = getSnapshot();
    const custom = clampCustom({ ...setup.custom, ...patch });
    commit({ setup: { ...setup, custom, config: configFor("custom", custom) } });
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

  /** Iniciar, pausar o reanudar. */
  toggle() {
    const { setup, timer } = getSnapshot();
    const now = Date.now();
    if (timer.status === "idle") commit({ timer: start(setup.config, setup.subjectId, now) });
    else if (timer.status === "active") commit({ timer: timer.running ? pause(timer, now) : resume(timer, now) });
  },

  reset() {
    commit({ timer: IDLE });
  },

  skipBreak() {
    const { timer } = getSnapshot();
    if (timer.status === "active") commit({ timer: skipBreak(timer, Date.now()) });
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
