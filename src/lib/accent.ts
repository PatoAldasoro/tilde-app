import { SUBJECT_COLORS, isColorKey, type ColorKey } from "@/lib/domain/subjects";
import { themeScript } from "@/lib/theme";

/** Color de acento de la app: una clave de la paleta de materias, o null para el naranja original. */
export type Accent = ColorKey | null;

export const ACCENT_STORAGE_KEY = "tilde-accent";

export function toAccent(value: unknown): Accent {
  return isColorKey(value) ? value : null;
}

/** Corre antes del primer pintado (en <head>), igual que el del tema: evita el parpadeo en naranja. */
export const accentScript = `(function(){try{var a=localStorage.getItem("${ACCENT_STORAGE_KEY}");if(/^(${SUBJECT_COLORS.join("|")})$/.test(a||""))document.documentElement.dataset.accent=a}catch(e){}})()`;

/** Lo que corre en <head> antes de pintar: tema y acento. Cada parte es una función autoejecutada; van separadas por ";". */
export const headScript = [themeScript, accentScript].join(";");
