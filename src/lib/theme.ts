export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "tilde-theme";

/** Corre antes del primer pintado (en <head>) para evitar el parpadeo de tema. */
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}
