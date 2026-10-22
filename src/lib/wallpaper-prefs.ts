/**
 * Preferencias del exportador del horario (formato, tema, fondo, color y horarios en los bloques).
 * Se guardan en este dispositivo: son del fondo de pantalla de cada equipo, no del perfil.
 */
import { isWallpaperFormat, normalizeHexColor, type WallpaperFormat } from "@/lib/domain/wallpaper";
import { isWallpaperTheme, type WallpaperThemeKey } from "@/lib/domain/wallpaper-themes";
import type { WallpaperBackground } from "@/lib/wallpaper-canvas";

export type WallpaperPrefs = {
  format: WallpaperFormat;
  theme: WallpaperThemeKey;
  background: WallpaperBackground;
  /** Color del fondo personalizado ("#rrggbb"). */
  color: string;
  /** Escribir el horario en cada bloque; null = solo si alguno no cae en la media hora. */
  times: boolean | null;
};

const STORAGE_KEY = "tilde-wallpaper";
/** Azul noche: un punto de partida que queda bien con la tabla en claro y en oscuro. */
export const DEFAULT_WALLPAPER_COLOR = "#1f2a44";

/**
 * El tema guardado o, de lo que se guardaba antes de que hubiera temas (claro u oscuro, bloques
 * plenos o suaves), el tema equivalente.
 */
function storedTheme(stored: Record<string, unknown>, appTheme: "light" | "dark"): WallpaperThemeKey {
  if (isWallpaperTheme(stored.theme)) return stored.theme;
  const dark = stored.theme === "dark" || (stored.theme !== "light" && appTheme === "dark");
  if (stored.blocks === "soft") return dark ? "soft-dark" : "soft";
  return dark ? "tilde-dark" : "tilde";
}

/** Lo guardado, validado campo por campo; lo que falte o no sirva vuelve al valor por defecto. */
export function readWallpaperPrefs(appTheme: "light" | "dark"): WallpaperPrefs {
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof parsed === "object" && parsed !== null) stored = parsed as Record<string, unknown>;
  } catch {
    // Sin almacenamiento o con un valor roto: valores por defecto.
  }
  return {
    format: isWallpaperFormat(stored.format) ? stored.format : "device",
    theme: storedTheme(stored, appTheme),
    background: stored.background === "glow" || stored.background === "custom" ? stored.background : "theme",
    color: (typeof stored.color === "string" ? normalizeHexColor(stored.color) : null) ?? DEFAULT_WALLPAPER_COLOR,
    times: typeof stored.times === "boolean" ? stored.times : null,
  };
}

export function writeWallpaperPrefs(prefs: WallpaperPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Modo privado estricto: las opciones valen para esta vez.
  }
}
