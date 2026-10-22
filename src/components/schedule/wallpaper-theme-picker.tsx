"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { WallpaperTheme, WallpaperThemeKey } from "@/lib/domain/wallpaper-themes";
import { drawThemeSwatch, fontFamily } from "@/lib/wallpaper-canvas";

type ThemePickerProps = {
  themes: WallpaperTheme[];
  value: WallpaperThemeKey;
  onChange: (theme: WallpaperThemeKey) => void;
  fontSans: string;
  /** Cambia cuando terminan de cargar las tipografías: las muestras se vuelven a dibujar. */
  fontsReady: boolean;
  labelledBy: string;
};

/** Los temas como tarjetas con su muestra (radiogroup: las flechas se mueven entre ellas). */
export function WallpaperThemePicker({ themes, value, onChange, fontSans, fontsReady, labelledBy }: ThemePickerProps) {
  const t = useTranslations();
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvases = groupRef.current?.querySelectorAll<HTMLCanvasElement>("canvas[data-theme-key]") ?? [];
    for (const canvas of canvases) {
      const theme = themes.find((entry) => entry.key === canvas.dataset.themeKey);
      if (!theme) continue;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio) || 200;
      canvas.height = Math.round(canvas.clientHeight * ratio) || 120;
      drawThemeSwatch(canvas, theme, fontSans);
    }
  }, [themes, fontSans, fontsReady]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = themes.findIndex((theme) => theme.key === value);
    const next = themes[(index + step + themes.length) % themes.length];
    onChange(next.key);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[themes.indexOf(next)]?.focus();
  }

  return (
    <div ref={groupRef} className="theme-picker" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {themes.map((theme) => (
        <button
          key={theme.key}
          type="button"
          role="radio"
          className="theme-card"
          aria-checked={theme.key === value}
          tabIndex={theme.key === value ? 0 : -1}
          onClick={() => onChange(theme.key)}
        >
          <canvas className="theme-swatch" data-theme-key={theme.key} aria-hidden="true" />
          <span className="theme-name" style={{ fontFamily: fontFamily(theme.font, fontSans) }}>
            {t(`wallpaper_theme_${theme.key.replace("-", "_") as "tilde"}`)}
          </span>
        </button>
      ))}
    </div>
  );
}
