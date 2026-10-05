/** Cuenta demo para las capturas de la landing. Solo existe en el Supabase local o de test. */
export const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@tilde.test";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "tilde-demo-local";
export const DEMO_NAME = "Pato Zárate";

/**
 * "Hoy" de la demo: martes 18/08/2026, la semana del feriado del lunes 17/08. Es una fecha fija
 * (y pasada) para que las capturas salgan siempre iguales; scripts/screenshots.ts fija el reloj
 * del navegador en ese día. Se puede cambiar con DEMO_TODAY=AAAA-MM-DD.
 */
export const DEMO_TODAY = process.env.DEMO_TODAY ?? "2026-08-18";
export const DEMO_CLOCK = "16:20";
