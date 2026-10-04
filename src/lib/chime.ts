/** Aviso de fin de fase: dos tonos cortos (660 y 880 Hz) generados con la Web Audio API, sin archivos. */

type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;

export function playChime() {
  try {
    const Constructor: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Constructor) return;
    context ??= new Constructor();
    const audio = context;
    void audio.resume();
    [660, 880].forEach((frequency, index) => {
      const startAt = audio.currentTime + index * 0.18;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.5);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.55);
    });
  } catch {
    // Sin audio disponible: el aviso visual alcanza.
  }
}
