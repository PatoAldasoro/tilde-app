import { describe, expect, it } from "vitest";
import { contrast, desaturate, hexToRgb, luminance, mix, readableOn, withAlpha } from "./color";
import { SUBJECT_COLORS } from "./subjects";
import { isWallpaperTheme, WALLPAPER_THEMES, wallpaperTheme, type ThemeTokens } from "./wallpaper-themes";

/** Tokens de prueba: los de la app en claro y en oscuro, con dos materias reales y el resto en gris. */
function tokens(dark: boolean): ThemeTokens {
  const subject = dark
    ? { solid: "#84a8fe", vivid: "#84a8fe", soft: "#1f2c4c", onSoft: "#b3cafe", onSolid: "#131211" }
    : { solid: "#486fda", vivid: "#5e8afe", soft: "#e9f0ff", onSoft: "#405ead", onSolid: "#ffffff" };
  return {
    bg: dark ? "#131211" : "#faf9f7",
    surface: dark ? "#1c1b19" : "#ffffff",
    border: dark ? "#2e2c29" : "#e7e4df",
    borderStrong: dark ? "#3d3a36" : "#d6d2cb",
    text: dark ? "#f2f0ec" : "#1e1c19",
    textMuted: dark ? "#b4afa7" : "#5f5a53",
    textSubtle: dark ? "#8d877e" : "#7d776f",
    textDisabled: dark ? "#5c5852" : "#b2ada6",
    accent: "#e26f04",
    subjects: Object.fromEntries(SUBJECT_COLORS.map((key) => [key, subject])) as ThemeTokens["subjects"],
  };
}

const light = tokens(false);
const dark = tokens(true);

describe("colores", () => {
  it("mezcla, transparencia y gris", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(withAlpha("#123456", 0.5)).toBe("#12345680");
    expect(withAlpha("rgba(0, 0, 0, 0.5)", 0.2)).toBe("rgba(0, 0, 0, 0.5)");
    const [r, g, b] = hexToRgb(desaturate("#ff0000", 1))!;
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("contraste y el texto que más se lee", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(readableOn("#ffd84d", ["#000000", "#ffffff"])).toBe("#000000");
    expect(readableOn("#1f2a44", ["#000000", "#ffffff"])).toBe("#ffffff");
  });
});

describe("temas del horario exportado", () => {
  it("son trece y se reconocen por su clave", () => {
    expect(WALLPAPER_THEMES).toHaveLength(13);
    expect(new Set(WALLPAPER_THEMES).size).toBe(WALLPAPER_THEMES.length);
    expect(isWallpaperTheme("neon")).toBe(true);
    expect(isWallpaperTheme("light")).toBe(false);
  });

  it("los de la app usan sus tokens: claro, oscuro, plenos o suaves", () => {
    const tilde = wallpaperTheme("tilde", light, dark);
    expect([tilde.dark, tilde.background.color, tilde.table.fill]).toEqual([false, light.bg, light.surface]);
    expect(tilde.block.paint(light.subjects.cobalto, false).fill).toBe(light.subjects.cobalto.solid);
    const night = wallpaperTheme("tilde-dark", light, dark);
    expect([night.dark, night.background.color]).toEqual([true, dark.bg]);
    expect(night.palette).toBe(dark.subjects);
    const soft = wallpaperTheme("soft", light, dark).block.paint(light.subjects.cobalto, false);
    expect([soft.fill, soft.ink]).toEqual([light.subjects.cobalto.soft, light.subjects.cobalto.onSoft]);
  });

  for (const key of WALLPAPER_THEMES) {
    it(`${key}: el texto de los bloques se lee sobre su relleno`, () => {
      const theme = wallpaperTheme(key, light, dark);
      for (const isEvent of [false, true]) {
        const paint = theme.block.paint(theme.palette.cobalto, isEvent);
        // Sin relleno (o translúcido), el texto va sobre la tabla; si la tabla es translúcida, sobre el fondo.
        const opaque = (color: string | null) => (color && /^#[0-9a-f]{6}$/i.test(color) ? color : null);
        const under = opaque(paint.fill) ?? opaque(theme.table.fill) ?? theme.background.color;
        expect(contrast(under, paint.ink), `${key} ${isEvent ? "actividad" : "clase"}`).toBeGreaterThanOrEqual(3);
      }
      // Encabezado y horas también se leen.
      const header = theme.table.headerFill ?? (theme.table.fill && /^#/.test(theme.table.fill) ? theme.table.fill : theme.background.color);
      expect(contrast(header, theme.table.headerInk.slice(0, 7))).toBeGreaterThanOrEqual(3);
      expect(theme.swatch.length).toBeGreaterThanOrEqual(5);
    });
  }
});
