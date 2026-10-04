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
