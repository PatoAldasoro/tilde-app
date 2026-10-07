/**
 * Sonidos de las sesiones de estudio, generados con la Web Audio API (sin archivos).
 * Cada sonido es una lista de notas: frecuencia, cuándo empieza, cuánto dura y con qué onda.
 */

export const SOUND_KINDS = ["chime", "bell", "arpeggio", "digital", "wood"] as const;
export type SoundKind = (typeof SOUND_KINDS)[number];

export function isSoundKind(value: unknown): value is SoundKind {
  return typeof value === "string" && (SOUND_KINDS as readonly string[]).includes(value);
}

type Note = { frequency: number; at: number; duration: number; wave?: OscillatorType; gain?: number };

const SOUNDS: Record<SoundKind | "alarm", Note[]> = {
  // Dos tonos cortos: el aviso original.
  chime: [
    { frequency: 660, at: 0, duration: 0.5 },
    { frequency: 880, at: 0.18, duration: 0.5 },
  ],
  // Campana: una nota larga con dos armónicos más suaves.
  bell: [
    { frequency: 523.25, at: 0, duration: 2.2 },
    { frequency: 1046.5, at: 0, duration: 1.6, gain: 0.45 },
    { frequency: 1568, at: 0, duration: 1.0, gain: 0.2 },
  ],
  // Tres notas que suben (do, mi, sol).
  arpeggio: [
    { frequency: 523.25, at: 0, duration: 0.35, wave: "triangle" },
    { frequency: 659.25, at: 0.16, duration: 0.35, wave: "triangle" },
    { frequency: 783.99, at: 0.32, duration: 0.7, wave: "triangle" },
  ],
  // Tres bips iguales, como un reloj digital.
  digital: [
    { frequency: 1200, at: 0, duration: 0.12, wave: "square", gain: 0.5 },
    { frequency: 1200, at: 0.2, duration: 0.12, wave: "square", gain: 0.5 },
    { frequency: 1200, at: 0.4, duration: 0.12, wave: "square", gain: 0.5 },
  ],
  // Dos golpes secos y graves, tipo marimba.
  wood: [
    { frequency: 392, at: 0, duration: 0.16, wave: "triangle" },
    { frequency: 293.66, at: 0.14, duration: 0.24, wave: "triangle" },
  ],
  // Modo examen, al salir de la página: seis tonos alternados, ásperos a propósito.
  alarm: Array.from({ length: 6 }, (_, index) => ({
    frequency: index % 2 === 0 ? 880 : 620,
    at: index * 0.16,
    duration: 0.15,
    wave: "sawtooth" as const,
    gain: 0.7,
  })),
};

type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;

function play(notes: Note[], volume: number) {
  try {
    const Constructor: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Constructor) return;
    context ??= new Constructor();
    const audio = context;
    void audio.resume();
    const level = Math.max(0, Math.min(1, volume));
    if (level === 0) return;
    for (const note of notes) {
      const startAt = audio.currentTime + note.at;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = note.wave ?? "sine";
      oscillator.frequency.value = note.frequency;
      const peak = Math.max(0.0002, 0.4 * level * (note.gain ?? 1));
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + note.duration + 0.05);
    }
  } catch {
    // Sin audio disponible: el aviso visual alcanza.
  }
}

/** Aviso de fin de fase con el sonido elegido. `volume` va de 0 a 1. */
export function playSound(kind: SoundKind, volume: number) {
  play(SOUNDS[kind], volume);
}

/** Alarma del modo examen: suena al salir de la página. */
export function playAlarm(volume: number) {
  play(SOUNDS.alarm, Math.max(volume, 0.6));
}
