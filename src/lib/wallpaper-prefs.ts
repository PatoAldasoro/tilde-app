/**
 * Preferencias del exportador del horario (formato, tema, fondo, color y estilo de los bloques).
 * Se guardan en este dispositivo: son del fondo de pantalla de cada equipo, no del perfil.
 */
import { isWallpaperFormat, normalizeHexColor, type WallpaperFormat } from "@/lib/domain/wallpaper";
import type { WallpaperBackground, WallpaperBlockStyle } from "@/lib/wallpaper-canvas";

export type WallpaperPrefs = {
  format: WallpaperFormat;
  theme: "light" | "dark";
  background: WallpaperBackground;
  /** Color del fondo personalizado ("#rrggbb"). */
  color: string;
  blocks: WallpaperBlockStyle;
};

const STORAGE_KEY = "tilde-wallpaper";
/** Azul noche: un punto de partida que queda bien con la tabla en claro y en oscuro. */
export const DEFAULT_WALLPAPER_COLOR = "#1f2a44";

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
    format: isWallpaperFormat(stored.format) ? stored.format : "16x9",
    theme: stored.theme === "light" || stored.theme === "dark" ? stored.theme : appTheme,
    background: stored.background === "glow" || stored.background === "custom" || stored.background === "plain" ? stored.background : "plain",
    color: (typeof stored.color === "string" ? normalizeHexColor(stored.color) : null) ?? DEFAULT_WALLPAPER_COLOR,
    blocks: stored.blocks === "soft" ? "soft" : "solid",
  };
}

export function writeWallpaperPrefs(prefs: WallpaperPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Modo privado estricto: las opciones valen para esta vez.
  }
}
