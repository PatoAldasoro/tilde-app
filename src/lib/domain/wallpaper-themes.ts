/**
 * Temas del horario exportado: cada uno es un look completo (fondo, tabla, bloques, tipografía,
 * esquinas). Los colores de los bloques salen siempre de la paleta de la materia (sus tokens), así
 * cada materia se reconoce en cualquier tema; el resto de los colores es propio de cada tema.
 * Es contenido que se descarga, no interfaz: por eso acá sí hay colores escritos a mano
 * (CLAUDE.md, regla 6). El dibujo está en `src/lib/wallpaper-canvas.ts`.
 */
import { desaturate, isDark, mix, readableOn, withAlpha } from "./color";
import { isColorKey, type ColorKey } from "./subjects";

export const WALLPAPER_THEMES = [
  "tilde",
  "tilde-dark",
  "soft",
  "soft-dark",
  "simple",
  "pastel",
  "editorial",
  "brutal",
  "neon",
  "notebook",
  "chalk",
  "mono",
  "sunset",
] as const;

export type WallpaperThemeKey = (typeof WALLPAPER_THEMES)[number];

export const isWallpaperTheme = (value: unknown): value is WallpaperThemeKey => WALLPAPER_THEMES.includes(value as WallpaperThemeKey);

/** Los tokens de una materia (`--subject-<color>-*`). */
export type SubjectTokens = { solid: string; vivid: string; soft: string; onSoft: string; onSolid: string };

/** Los tokens de la app que usan los temas, en claro o en oscuro. */
export type ThemeTokens = {
  bg: string;
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textDisabled: string;
  accent: string;
  subjects: Record<ColorKey, SubjectTokens>;
};

/** Tipografías: `sans` es la de la app; las demás se cargan solo para exportar. */
export type FontRole = "sans" | "serif" | "mono" | "rounded" | "grotesk" | "hand";

/** Medidas en unidades de diseño (ver `domain/wallpaper.ts`). */
export type Shadow = { color: string; blur: number; x: number; y: number };
export type Stroke = { color: string; width: number; dash?: boolean };

export type BackgroundPattern =
  | { kind: "plain" }
  | { kind: "gradient"; stops: string[] }
  | { kind: "grid"; color: string; step: number }
  | { kind: "dots"; color: string; step: number }
  /** Polvo de tiza: puntitos al azar (siempre los mismos). */
  | { kind: "dust"; color: string };

/** Cómo se pinta un bloque. */
export type BlockPaint = {
  fill: string | null;
  ink: string;
  iconInk: string;
  stroke: Stroke | null;
  /** Franja de color a la izquierda. */
  bar: string | null;
  /** Fondo de las pastillas (aula, comisión, horario). */
  chip: string;
  /** Halo alrededor (neón). */
  glow: string | null;
};

export type WallpaperTheme = {
  key: WallpaperThemeKey;
  dark: boolean;
  /** Los tokens de las materias que usa (claros u oscuros). */
  palette: Record<ColorKey, SubjectTokens>;
  font: FontRole;
  titleWeight: number;
  /** Agranda el texto en las tipografías chicas de por sí (la manuscrita). */
  fontScale: number;
  /** Días y "HORA" en mayúsculas. */
  caps: boolean;
  background: { color: string; pattern: BackgroundPattern };
  /** Intensidad de las manchas del fondo "Con color". */
  glow: number;
  table: {
    fill: string | null;
    stroke: Stroke | null;
    radius: number;
    shadow: Shadow | null;
    /** Banda del encabezado (días). */
    headerFill: string | null;
    headerInk: string;
    /** "HORA". */
    cornerInk: string;
    headerRule: Stroke;
    hourLine: string | null;
    halfLine: string | null;
    halfDash: boolean;
    columnLine: string | null;
    /** Línea entre las horas y los días (el margen rojo del cuaderno). */
    timeRule: Stroke | null;
    timeInk: string;
    timeInkMinor: string;
  };
  block: { radius: number; shadow: Shadow | null; paint: (subject: SubjectTokens, isEvent: boolean) => BlockPaint };
  /** Los colores que se ven en la muestra del selector (fondo, tabla y tres bloques). */
  swatch: string[];
};

const BLACK = "#000000";
const WHITE = "#ffffff";

/** Los tokens de una materia, con "grafito" para lo que no es una clave de la paleta. */
export function subjectTokens(tokens: ThemeTokens, colorKey: string): SubjectTokens {
  return tokens.subjects[isColorKey(colorKey) ? colorKey : "grafito"];
}

/** Bloques plenos o suaves, como en el Horario de la app. */
function tildeTheme(key: WallpaperThemeKey, tokens: ThemeTokens, dark: boolean, soft: boolean): WallpaperTheme {
  return {
    key,
    dark,
    palette: tokens.subjects,
    font: "sans",
    titleWeight: 600,
    fontScale: 1,
    caps: true,
    background: { color: tokens.bg, pattern: { kind: "plain" } },
    glow: dark ? 0.26 : 0.3,
    table: {
      fill: tokens.surface,
      stroke: { color: tokens.borderStrong, width: 1 },
      radius: 14,
      shadow: { color: dark ? "rgba(0, 0, 0, 0.45)" : "rgba(30, 28, 25, 0.12)", blur: 48, x: 0, y: 16 },
      headerFill: null,
      headerInk: tokens.textMuted,
      cornerInk: tokens.textSubtle,
      headerRule: { color: tokens.borderStrong, width: 1 },
      hourLine: tokens.border,
      halfLine: withAlpha(tokens.border, 0.55),
      halfDash: false,
      columnLine: tokens.border,
      timeRule: null,
      timeInk: tokens.textMuted,
      timeInkMinor: tokens.textDisabled,
    },
    block: {
      radius: 9,
      shadow: null,
      paint: (subject, isEvent) => {
        if (!soft) {
          return { fill: subject.solid, ink: subject.onSolid, iconInk: subject.onSolid, stroke: null, bar: null, chip: `rgba(0, 0, 0, ${isDark(subject.onSolid) ? 0.12 : 0.2})`, glow: null };
        }
        return isEvent
          ? { fill: tokens.surface, ink: tokens.text, iconInk: subject.solid, stroke: { color: subject.solid, width: 2, dash: true }, bar: null, chip: withAlpha(subject.solid, dark ? 0.26 : 0.16), glow: null }
          : { fill: subject.soft, ink: subject.onSoft, iconInk: subject.onSoft, stroke: { color: withAlpha(subject.solid, 0.5), width: 1.5 }, bar: null, chip: withAlpha(subject.solid, dark ? 0.26 : 0.16), glow: null };
      },
    },
    swatch: [tokens.bg, tokens.surface, ...(soft ? ["cielo", "lima", "frambuesa"].map((color) => tokens.subjects[color as ColorKey].soft) : ["cielo", "lima", "frambuesa"].map((color) => tokens.subjects[color as ColorKey].solid))],
  };
}

/**
 * Todos los temas, armados con los tokens de la app en claro y en oscuro (los de las materias
 * cambian entre uno y otro). Los temas que no son "Tilde" usan la paleta clara salvo el neón.
 */
export function wallpaperTheme(key: WallpaperThemeKey, light: ThemeTokens, dark: ThemeTokens): WallpaperTheme {
  const sample = (tokens: ThemeTokens, pick: (subject: SubjectTokens) => string) => ["cielo", "lima", "frambuesa"].map((color) => pick(tokens.subjects[color as ColorKey]));
  switch (key) {
    case "tilde":
      return tildeTheme(key, light, false, false);
    case "tilde-dark":
      return tildeTheme(key, dark, true, false);
    case "soft":
      return tildeTheme(key, light, false, true);
    case "soft-dark":
      return tildeTheme(key, dark, true, true);

    // Blanco, sin sombras ni esquinas redondeadas: una franja de color a la izquierda de cada bloque.
    case "simple": {
      const ink = "#141414";
      const tint = (subject: SubjectTokens) => mix(subject.vivid, WHITE, 0.86);
      return {
        key,
        dark: false,
        palette: light.subjects,
        font: "sans",
        titleWeight: 600,
        fontScale: 1,
        caps: true,
        background: { color: WHITE, pattern: { kind: "plain" } },
        glow: 0.22,
        table: {
          fill: WHITE,
          stroke: { color: "#e3e3e3", width: 1 },
          radius: 0,
          shadow: null,
          headerFill: null,
          headerInk: ink,
          cornerInk: "#8a8a8a",
          headerRule: { color: ink, width: 2 },
          hourLine: "#e6e6e6",
          halfLine: "#f3f3f3",
          halfDash: false,
          columnLine: "#ececec",
          timeRule: null,
          timeInk: "#5c5c5c",
          timeInkMinor: "#b3b3b3",
        },
        block: {
          radius: 2,
          shadow: null,
          paint: (subject, isEvent) => ({
            fill: isEvent ? WHITE : tint(subject),
            ink,
            iconInk: subject.solid,
            stroke: isEvent ? { color: subject.solid, width: 1.5, dash: true } : null,
            bar: subject.solid,
            chip: "rgba(0, 0, 0, 0.07)",
            glow: null,
          }),
        },
        swatch: [WHITE, WHITE, ...sample(light, tint)],
      };
    }

    // Colores pastel, todo bien redondeado y una tipografía redonda.
    case "pastel": {
      const cream = "#fff6ec";
      const fill = (subject: SubjectTokens) => mix(subject.vivid, WHITE, 0.68);
      const ink = (subject: SubjectTokens) => mix(subject.solid, BLACK, 0.42);
      return {
        key,
        dark: false,
        palette: light.subjects,
        font: "rounded",
        titleWeight: 700,
        fontScale: 1.04,
        caps: false,
        background: { color: cream, pattern: { kind: "dots", color: "#f1dcc7", step: 34 } },
        glow: 0.34,
        table: {
          fill: WHITE,
          stroke: null,
          radius: 32,
          shadow: { color: "rgba(150, 105, 60, 0.13)", blur: 60, x: 0, y: 20 },
          headerFill: null,
          headerInk: "#8c7666",
          cornerInk: "#bba597",
          headerRule: { color: "#f0e4d8", width: 2 },
          hourLine: "#f3ebe3",
          halfLine: null,
          halfDash: false,
          columnLine: null,
          timeRule: null,
          timeInk: "#9c8778",
          timeInkMinor: "#d2c3b7",
        },
        block: {
          radius: 20,
          shadow: null,
          paint: (subject, isEvent) => ({
            fill: isEvent ? WHITE : fill(subject),
            ink: ink(subject),
            iconInk: ink(subject),
            stroke: isEvent ? { color: fill(subject), width: 3 } : null,
            bar: null,
            chip: "rgba(255, 255, 255, 0.6)",
            glow: null,
          }),
        },
        swatch: [cream, WHITE, ...sample(light, fill)],
      };
    }

    // Papel, tinta negra, serif y esquinas rectas: como una página impresa.
    case "editorial": {
      const paper = "#f2ede3";
      const ink = "#191714";
      const fill = (subject: SubjectTokens) => mix(desaturate(subject.vivid, 0.35), paper, 0.62);
      return {
        key,
        dark: false,
        palette: light.subjects,
        font: "serif",
        titleWeight: 600,
        fontScale: 1.06,
        caps: true,
        background: { color: paper, pattern: { kind: "plain" } },
        glow: 0.2,
        table: {
          fill: paper,
          stroke: { color: ink, width: 1.5 },
          radius: 0,
          shadow: null,
          headerFill: null,
          headerInk: ink,
          cornerInk: withAlpha(ink, 0.55),
          headerRule: { color: ink, width: 2.5 },
          hourLine: withAlpha(ink, 0.28),
          halfLine: withAlpha(ink, 0.13),
          halfDash: true,
          columnLine: withAlpha(ink, 0.22),
          timeRule: null,
          timeInk: ink,
          timeInkMinor: withAlpha(ink, 0.42),
        },
        block: {
          radius: 0,
          shadow: null,
          paint: (subject, isEvent) => ({
            fill: isEvent ? paper : fill(subject),
            ink,
            iconInk: ink,
            stroke: { color: ink, width: 1.5, dash: isEvent },
            bar: null,
            chip: withAlpha(ink, 0.08),
            glow: null,
          }),
        },
        swatch: [paper, paper, ...sample(light, fill)],
      };
    }

    // Bordes gruesos, sombras duras sin desenfoque y colores plenos sobre amarillo.
    case "brutal": {
      const yellow = "#ffd84d";
      return {
        key,
        dark: false,
        palette: light.subjects,
        font: "grotesk",
        titleWeight: 700,
        fontScale: 1,
        caps: true,
        background: { color: yellow, pattern: { kind: "plain" } },
        glow: 0.3,
        table: {
          fill: WHITE,
          stroke: { color: BLACK, width: 3 },
          radius: 0,
          shadow: { color: BLACK, blur: 0, x: 12, y: 12 },
          headerFill: BLACK,
          headerInk: WHITE,
          cornerInk: yellow,
          headerRule: { color: BLACK, width: 3 },
          hourLine: withAlpha(BLACK, 0.3),
          halfLine: withAlpha(BLACK, 0.1),
          halfDash: false,
          columnLine: withAlpha(BLACK, 0.3),
          timeRule: { color: BLACK, width: 3 },
          timeInk: BLACK,
          timeInkMinor: withAlpha(BLACK, 0.4),
        },
        block: {
          radius: 0,
          shadow: { color: BLACK, blur: 0, x: 5, y: 5 },
          paint: (subject, isEvent) => {
            const ink = readableOn(subject.vivid, [BLACK, WHITE]);
            return isEvent
              ? { fill: WHITE, ink: BLACK, iconInk: BLACK, stroke: { color: BLACK, width: 2.5, dash: true }, bar: subject.vivid, chip: withAlpha(subject.vivid, 0.3), glow: null }
              : { fill: subject.vivid, ink, iconInk: ink, stroke: { color: BLACK, width: 2.5 }, bar: null, chip: "rgba(255, 255, 255, 0.55)", glow: null };
          },
        },
        swatch: [yellow, WHITE, ...sample(light, (subject) => subject.vivid)],
      };
    }

    // Noche, trazos que brillan y tipografía monoespaciada.
    case "neon": {
      const night = "#08070f";
      const neon = (subject: SubjectTokens) => subject.solid;
      return {
        key,
        dark: true,
        palette: dark.subjects,
        font: "mono",
        titleWeight: 600,
        fontScale: 0.94,
        caps: true,
        background: { color: night, pattern: { kind: "grid", color: "#14132a", step: 48 } },
        glow: 0.22,
        table: {
          fill: "rgba(13, 12, 26, 0.9)",
          stroke: { color: "#2c2a52", width: 1.5 },
          radius: 12,
          shadow: { color: "rgba(124, 92, 255, 0.25)", blur: 70, x: 0, y: 0 },
          headerFill: null,
          headerInk: "#b5b1ff",
          cornerInk: "#6e6aa8",
          headerRule: { color: "#3b3870", width: 1.5 },
          hourLine: "#211f40",
          halfLine: "#16152c",
          halfDash: true,
          columnLine: "#1d1b38",
          timeRule: null,
          timeInk: "#8f8bd6",
          timeInkMinor: "#46437a",
        },
        block: {
          radius: 10,
          shadow: null,
          paint: (subject, isEvent) => ({
            fill: withAlpha(neon(subject), isEvent ? 0.06 : 0.14),
            ink: mix(neon(subject), WHITE, 0.45),
            iconInk: neon(subject),
            stroke: { color: neon(subject), width: 2, dash: isEvent },
            bar: null,
            chip: withAlpha(neon(subject), 0.22),
            glow: neon(subject),
          }),
        },
        swatch: [night, "#0d0c1a", ...sample(dark, neon)],
      };
    }

    // Hoja rayada sobre un escritorio, letra manuscrita y bloques de resaltador.
    case "notebook": {
      const desk = "#e8dcc6";
      const page = "#fffdf6";
      const ink = "#22305e";
      const marker = (subject: SubjectTokens) => withAlpha(subject.vivid, 0.38);
      return {
        key,
        dark: false,
        palette: light.subjects,
        font: "hand",
        titleWeight: 700,
        fontScale: 1.3,
        caps: false,
        background: { color: desk, pattern: { kind: "plain" } },
        glow: 0.3,
        table: {
          fill: page,
          stroke: null,
          radius: 4,
          shadow: { color: "rgba(90, 64, 30, 0.2)", blur: 34, x: 0, y: 12 },
          headerFill: null,
          headerInk: ink,
          cornerInk: withAlpha(ink, 0.6),
          headerRule: { color: "#9dbbe4", width: 2 },
          hourLine: "#b9d0ee",
          halfLine: "#dce8f6",
          halfDash: false,
          columnLine: null,
          timeRule: { color: "#ec9c9c", width: 2 },
          timeInk: ink,
          timeInkMinor: withAlpha(ink, 0.45),
        },
        block: {
          radius: 4,
          shadow: null,
          paint: (subject, isEvent) => ({
            fill: isEvent ? null : marker(subject),
            ink,
            iconInk: ink,
            stroke: isEvent ? { color: mix(subject.vivid, ink, 0.25), width: 2, dash: true } : null,
            bar: null,
            chip: withAlpha(ink, 0.09),
            glow: null,
          }),
        },
        swatch: [desk, page, ...sample(light, (subject) => mix(subject.vivid, page, 0.6))],
      };
    }

    // Pizarrón verde, tiza de colores y letra manuscrita.
    case "chalk": {
      const board = "#24382e";
      const chalk = "#f4f1e6";
      const color = (subject: SubjectTokens) => mix(subject.vivid, WHITE, 0.42);
      return {
        key,
        dark: true,
        palette: light.subjects,
        font: "hand",
        titleWeight: 600,
        fontScale: 1.3,
        caps: false,
        background: { color: board, pattern: { kind: "dust", color: "rgba(255, 255, 255, 0.05)" } },
        glow: 0.18,
        table: {
          fill: "rgba(255, 255, 255, 0.03)",
          stroke: { color: "rgba(244, 241, 230, 0.6)", width: 2 },
          radius: 6,
          shadow: null,
          headerFill: null,
          headerInk: chalk,
          cornerInk: "rgba(244, 241, 230, 0.6)",
          headerRule: { color: "rgba(244, 241, 230, 0.55)", width: 2 },
          hourLine: "rgba(244, 241, 230, 0.2)",
          halfLine: "rgba(244, 241, 230, 0.09)",
          halfDash: true,
          columnLine: "rgba(244, 241, 230, 0.16)",
          timeRule: null,
          timeInk: "rgba(244, 241, 230, 0.85)",
          timeInkMinor: "rgba(244, 241, 230, 0.4)",
        },
        block: {
          radius: 8,
          shadow: null,
          paint: (subject, isEvent) => ({
            fill: withAlpha(color(subject), isEvent ? 0.05 : 0.16),
            ink: chalk,
            iconInk: color(subject),
            stroke: { color: color(subject), width: 2.5, dash: isEvent },
            bar: null,
            chip: withAlpha(color(subject), 0.22),
            glow: null,
          }),
        },
        swatch: [board, "#2a3f34", ...sample(light, color)],
      };
    }

    // Blanco y negro: todas las materias iguales, distinguidas por su nombre.
    case "mono": {
      const ink = "#121212";
      return {
        key,
        dark: false,
        palette: light.subjects,
        font: "grotesk",
        titleWeight: 600,
        fontScale: 1,
        caps: true,
        background: { color: "#ececec", pattern: { kind: "plain" } },
        glow: 0.22,
        table: {
          fill: WHITE,
          stroke: { color: ink, width: 1.5 },
          radius: 12,
          shadow: null,
          headerFill: null,
          headerInk: ink,
          cornerInk: "#8c8c8c",
          headerRule: { color: ink, width: 1.5 },
          hourLine: "#dddddd",
          halfLine: "#f0f0f0",
          halfDash: false,
          columnLine: "#e6e6e6",
          timeRule: null,
          timeInk: ink,
          timeInkMinor: "#a8a8a8",
        },
        block: {
          radius: 10,
          shadow: null,
          paint: (_subject, isEvent) =>
            isEvent
              ? { fill: WHITE, ink, iconInk: ink, stroke: { color: ink, width: 2, dash: true }, bar: null, chip: "rgba(0, 0, 0, 0.07)", glow: null }
              : { fill: ink, ink: WHITE, iconInk: WHITE, stroke: null, bar: null, chip: "rgba(255, 255, 255, 0.18)", glow: null },
        },
        swatch: ["#ececec", WHITE, ink, "#5a5a5a", ink],
      };
    }

    // Degradado de atardecer y una tabla de vidrio.
    case "sunset": {
      const stops = ["#ffb88c", "#de6262", "#5b3e96"];
      const ink = "#3d2a4d";
      return {
        key,
        dark: false,
        palette: light.subjects,
        font: "sans",
        titleWeight: 600,
        fontScale: 1,
        caps: true,
        background: { color: stops[1], pattern: { kind: "gradient", stops } },
        glow: 0.18,
        table: {
          fill: "rgba(255, 255, 255, 0.8)",
          stroke: { color: "rgba(255, 255, 255, 0.95)", width: 1.5 },
          radius: 26,
          shadow: { color: "rgba(60, 20, 70, 0.28)", blur: 60, x: 0, y: 24 },
          headerFill: null,
          headerInk: ink,
          cornerInk: withAlpha(ink, 0.55),
          headerRule: { color: withAlpha(ink, 0.25), width: 1.5 },
          hourLine: withAlpha(ink, 0.13),
          halfLine: withAlpha(ink, 0.06),
          halfDash: false,
          columnLine: withAlpha(ink, 0.1),
          timeRule: null,
          timeInk: withAlpha(ink, 0.85),
          timeInkMinor: withAlpha(ink, 0.4),
        },
        block: {
          radius: 16,
          shadow: { color: "rgba(60, 20, 70, 0.18)", blur: 14, x: 0, y: 5 },
          paint: (subject, isEvent) => {
            const ink2 = readableOn(subject.solid, [WHITE, "#1a1020"]);
            return isEvent
              ? { fill: "rgba(255, 255, 255, 0.7)", ink, iconInk: subject.solid, stroke: { color: subject.solid, width: 2, dash: true }, bar: null, chip: withAlpha(subject.solid, 0.16), glow: null }
              : { fill: subject.solid, ink: ink2, iconInk: ink2, stroke: null, bar: null, chip: "rgba(255, 255, 255, 0.22)", glow: null };
          },
        },
        swatch: [stops[0], "#fbeef0", ...sample(light, (subject) => subject.solid)],
      };
    }
  }
}
