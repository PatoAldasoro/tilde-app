/** Horas sin zona horaria: "HH:MM" (Postgres `time` devuelve "HH:MM:SS"). Formato 24 h. */

const pad = (n: number) => String(n).padStart(2, "0");

/** Minutos desde la medianoche. Acepta "HH:MM" y "HH:MM:SS". */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Normaliza "HH:MM:SS" a "HH:MM". */
export function normalizeTime(time: string): string {
  return minutesToTime(timeToMinutes(time));
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

/** Opciones de hora entre dos límites, en pasos fijos (por defecto 30 min). */
export function timeOptions(fromMinutes: number, toMinutes: number, step = 30): string[] {
  const out: string[] = [];
  for (let m = fromMinutes; m <= toMinutes; m += step) out.push(minutesToTime(m));
  return out;
}

/**
 * Hora escrita a mano: "14:30", "9:05", "1430", "930" o "14". Devuelve "HH:MM", null si
 * el campo está vacío o "invalid" si no es una hora.
 */
export function parseTimeInput(text: string): string | null | "invalid" {
  const value = text.trim();
  if (value === "") return null;
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(value);
  if (!match) return "invalid";
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return "invalid";
  return `${pad(hours)}:${pad(minutes)}`;
}
