/**
 * Dibuja el horario en un <canvas> para exportarlo como fondo de pantalla. La geometría viene
 * de `domain/wallpaper.ts` y el look, del tema elegido (`domain/wallpaper-themes.ts`); acá solo
 * se pinta: fondo, tabla, días (sin fechas), una fila por media hora y los bloques con su ícono,
 * su aula, su comisión y, si se pide, su horario.
 * Los colores de las materias salen de los tokens del diseño, leídos del DOM; el resto lo pone el
 * tema, salvo el fondo personalizado, que elige quien exporta.
 */
import { withAlpha } from "@/lib/domain/color";
import type { WeekItem } from "@/lib/domain/schedule";
import { isColorKey, SUBJECT_COLORS, type ColorKey } from "@/lib/domain/subjects";
import { minutesToTime } from "@/lib/domain/time";
import type { Rect, WallpaperLayout } from "@/lib/domain/wallpaper";
import type { BackgroundPattern, BlockPaint, FontRole, Shadow, Stroke, SubjectTokens, ThemeTokens, WallpaperTheme } from "@/lib/domain/wallpaper-themes";

/** El fondo del tema, con manchas de los colores de las materias, o un color a elección. */
export type WallpaperBackground = "theme" | "glow" | "custom";

/** Las tipografías de los temas, cargadas solo en el exportador (ver `wallpaper-dialog.tsx`). */
const FONT_STACKS: Record<Exclude<FontRole, "sans">, string> = {
  serif: '"Fraunces Variable", "Instrument Serif", Georgia, serif',
  mono: '"JetBrains Mono Variable", ui-monospace, Menlo, monospace',
  rounded: '"Nunito Variable", ui-rounded, system-ui, sans-serif',
  grotesk: '"Space Grotesk Variable", system-ui, sans-serif',
  hand: '"Caveat Variable", "Segoe Print", cursive',
};

/** La familia de una tipografía; `sans` es la de la app (el token `--font-sans`). */
export function fontFamily(role: FontRole, sans: string): string {
  return role === "sans" ? sans : FONT_STACKS[role];
}

/** Lee los tokens de un elemento que está dentro de un `[data-theme]`. */
export function readThemeTokens(probe: HTMLElement): ThemeTokens & { fontSans: string } {
  const style = getComputedStyle(probe);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const subjects = Object.fromEntries(
    SUBJECT_COLORS.map((key) => [
      key,
      {
        solid: token(`--subject-${key}-solid`),
        vivid: token(`--subject-${key}-vivid`),
        soft: token(`--subject-${key}-soft`),
        onSoft: token(`--subject-${key}-on-soft`),
        onSolid: token(`--subject-${key}-on-solid`),
      },
    ]),
  ) as Record<ColorKey, SubjectTokens>;
  return {
    bg: token("--color-bg"),
    surface: token("--color-surface"),
    border: token("--color-border"),
    borderStrong: token("--color-border-strong"),
    text: token("--color-text"),
    textMuted: token("--color-text-muted"),
    textSubtle: token("--color-text-subtle"),
    textDisabled: token("--color-text-disabled"),
    accent: token("--color-accent"),
    subjects,
    fontSans: token("--font-sans"),
  };
}

export type AppTokens = { light: ThemeTokens; dark: ThemeTokens; fontSans: string };

/**
 * Los tokens de la app en claro y en oscuro, sin importar el tema que se esté usando: se leen de
 * dos elementos ocultos que se agregan y se sacan en el momento.
 */
export function readAppTokens(): AppTokens {
  const read = (mode: "light" | "dark") => {
    const host = document.createElement("div");
    host.dataset.theme = mode;
    host.hidden = true;
    const probe = document.createElement("span");
    host.append(probe);
    document.body.append(host);
    const tokens = readThemeTokens(probe);
    host.remove();
    return tokens;
  };
  const light = read("light");
  return { light, dark: read("dark"), fontSans: light.fontSans };
}

/** Lo que se escribe en cada bloque. */
export type WallpaperBlockInfo = {
  title: string;
  /** Aula: va en una pastilla debajo del nombre. */
  room: string | null;
  /** Comisión: va en la esquina de arriba a la derecha. */
  badge: string | null;
  /** "18:50–21:33": va debajo del nombre si se eligió mostrar los horarios. */
  time: string;
  colorKey: string;
  /** El <svg> del ícono ya dibujado en el DOM, o null. */
  icon: SVGElement | null;
};

export type WallpaperOptions = {
  theme: WallpaperTheme;
  /** El token `--font-sans` (la tipografía de la app). */
  fontSans: string;
  background: WallpaperBackground;
  /** Color del fondo personalizado ("#rrggbb"). */
  customColor: string;
  /** Escribir el horario en cada bloque (además de la grilla de media hora). */
  showTimes: boolean;
  /** Nombre corto de cada día, de lunes (índice 0) a domingo. */
  weekdayLabels: string[];
  /** Rótulo de la columna de horas. */
  timeLabel: string;
  info: (item: WeekItem) => WallpaperBlockInfo;
};

type Context = CanvasRenderingContext2D;

/** Separación entre letras, donde el navegador la soporta en canvas. */
function setLetterSpacing(ctx: Context, px: number) {
  if ("letterSpacing" in ctx) (ctx as Context & { letterSpacing: string }).letterSpacing = `${px.toFixed(2)}px`;
}

/** "lun" → "LUN" en los temas en mayúsculas, "Lun" en los demás. */
function caseLabel(text: string, caps: boolean): string {
  return caps ? text.toUpperCase() : text.charAt(0).toUpperCase() + text.slice(1);
}

/** Las formas de un ícono de Lucide (viewBox de 24) como trazos de canvas. */
function iconPaths(svg: SVGElement): Path2D[] {
  const paths: Path2D[] = [];
  for (const element of Array.from(svg.children)) {
    const number = (name: string) => Number(element.getAttribute(name) ?? 0);
    const path = new Path2D();
    switch (element.tagName.toLowerCase()) {
      case "path":
        paths.push(new Path2D(element.getAttribute("d") ?? ""));
        continue;
      case "circle":
        path.arc(number("cx"), number("cy"), number("r"), 0, Math.PI * 2);
        break;
      case "ellipse":
        path.ellipse(number("cx"), number("cy"), number("rx"), number("ry"), 0, 0, Math.PI * 2);
        break;
      case "rect":
        path.roundRect(number("x"), number("y"), number("width"), number("height"), number("rx") || number("ry"));
        break;
      case "line":
        path.moveTo(number("x1"), number("y1"));
        path.lineTo(number("x2"), number("y2"));
        break;
      case "polyline":
      case "polygon": {
        const points = (element.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
        for (let index = 0; index + 1 < points.length; index += 2) {
          if (index === 0) path.moveTo(points[0], points[1]);
          else path.lineTo(points[index], points[index + 1]);
        }
        if (element.tagName.toLowerCase() === "polygon") path.closePath();
        break;
      }
      default:
        continue;
    }
    paths.push(path);
  }
  return paths;
}

function drawIcon(ctx: Context, svg: SVGElement, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  for (const path of iconPaths(svg)) ctx.stroke(path);
  ctx.restore();
}

/**
 * Parte un texto en renglones sin cortar palabras; `widthOf` da el ancho disponible de cada
 * renglón. Devuelve null si alguna palabra no entra entera.
 */
function wrapWords(ctx: Context, text: string, widthOf: (line: number) => number): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= widthOf(lines.length)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width > widthOf(lines.length)) return null;
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

/** Recorta un renglón con puntos suspensivos hasta que entre. */
function ellipsize(ctx: Context, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut.trimEnd()}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Último recurso: parte donde haga falta y termina en puntos suspensivos. */
function wrapAnywhere(ctx: Context, text: string, widthOf: (line: number) => number, maxLines: number): string[] {
  const lines: string[] = [];
  let rest = text.trim();
  while (rest && lines.length < maxLines) {
    const width = widthOf(lines.length);
    if (lines.length === maxLines - 1 || ctx.measureText(rest).width <= width) {
      lines.push(ellipsize(ctx, rest, width));
      break;
    }
    let cut = rest.length;
    while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > width) cut -= 1;
    // Mejor cortar en un espacio, si hay uno razonablemente cerca.
    const space = rest.lastIndexOf(" ", cut);
    if (space > cut * 0.5) cut = space;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return lines;
}

function roundedRect(ctx: Context, rect: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2)));
}

/**
 * La sombra de una forma, solo por fuera: así una tabla o un bloque translúcidos no se oscurecen
 * por dentro. La forma se dibuja fuera del canvas y la sombra se corre hasta su lugar.
 */
function castShadow(ctx: Context, rect: Rect, radius: number, shadow: Shadow, u: number) {
  const { width, height } = ctx.canvas;
  const far = width + height;
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, r);
  ctx.clip("evenodd");
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = shadow.blur * u;
  ctx.shadowOffsetX = shadow.x * u + far;
  ctx.shadowOffsetY = shadow.y * u;
  roundedRect(ctx, { ...rect, x: rect.x - far }, r);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.restore();
}

/** Un borde por dentro de la forma (así no se sale de su lugar en la grilla). */
function strokeInside(ctx: Context, rect: Rect, radius: number, stroke: Stroke, u: number) {
  const width = stroke.width * u;
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke.color;
  ctx.setLineDash(stroke.dash ? [7 * u, 5 * u] : []);
  roundedRect(ctx, { x: rect.x + width / 2, y: rect.y + width / 2, width: rect.width - width, height: rect.height - width }, Math.max(0, radius - width / 2));
  ctx.stroke();
  ctx.restore();
}

/** Generador de números al azar con semilla: el polvo de tiza sale igual cada vez. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function drawPattern(ctx: Context, pattern: BackgroundPattern, width: number, height: number, u: number) {
  switch (pattern.kind) {
    case "plain":
      return;
    case "gradient": {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      pattern.stops.forEach((stop, index) => gradient.addColorStop(index / Math.max(1, pattern.stops.length - 1), stop));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    case "grid": {
      const step = pattern.step * u;
      ctx.beginPath();
      for (let x = (width % step) / 2; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = (height % step) / 2; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.lineWidth = Math.max(1, u);
      ctx.strokeStyle = pattern.color;
      ctx.stroke();
      return;
    }
    case "dots": {
      const step = pattern.step * u;
      const radius = Math.max(1, 2.2 * u);
      ctx.fillStyle = pattern.color;
      for (let y = (height % step) / 2; y < height; y += step) {
        for (let x = (width % step) / 2; x < width; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }
    case "dust": {
      const random = seeded(7);
      const count = Math.round((width * height) / (420 * u * u));
      ctx.fillStyle = pattern.color;
      for (let index = 0; index < count; index += 1) {
        ctx.beginPath();
        ctx.arc(random() * width, random() * height, (0.6 + random() * 2.2) * u, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
  }
}

function drawBackground(ctx: Context, width: number, height: number, u: number, options: WallpaperOptions, tints: string[]) {
  const { theme } = options;
  ctx.fillStyle = options.background === "custom" ? options.customColor : theme.background.color;
  ctx.fillRect(0, 0, width, height);
  if (options.background === "custom") return;
  drawPattern(ctx, theme.background.pattern, width, height, u);
  if (options.background !== "glow") return;

  // Manchas suaves con los colores de las materias del horario (o los de la muestra del tema).
  const palette = tints.length > 0 ? tints : theme.swatch.slice(2);
  const reach = Math.max(width, height);
  const spots = [
    { x: width * 0.08, y: height * 0.1, radius: reach * 0.55 },
    { x: width * 0.94, y: height * 0.92, radius: reach * 0.6 },
    { x: width * 0.9, y: height * 0.06, radius: reach * 0.4 },
    { x: width * 0.06, y: height * 0.95, radius: reach * 0.42 },
  ];
  spots.forEach((spot, index) => {
    const tint = palette[index % palette.length];
    const gradient = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.radius);
    gradient.addColorStop(0, withAlpha(tint, theme.glow));
    gradient.addColorStop(0.55, withAlpha(tint, theme.glow * 0.35));
    gradient.addColorStop(1, withAlpha(tint, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

/** La forma de un bloque: halo, sombra, relleno, franja y borde. Sin texto. */
function paintBlockShape(ctx: Context, rect: Rect, theme: WallpaperTheme, paint: BlockPaint, u: number) {
  const radius = theme.block.radius * u;
  if (paint.glow) castShadow(ctx, rect, radius, { color: withAlpha(paint.glow, 0.85), blur: 18, x: 0, y: 0 }, u);
  if (theme.block.shadow) castShadow(ctx, rect, radius, theme.block.shadow, u);
  if (paint.fill) {
    roundedRect(ctx, rect, radius);
    ctx.fillStyle = paint.fill;
    ctx.fill();
  }
  if (paint.bar) {
    ctx.save();
    roundedRect(ctx, rect, radius);
    ctx.clip();
    ctx.fillStyle = paint.bar;
    ctx.fillRect(rect.x, rect.y, Math.max(2, 5 * u), rect.height);
    ctx.restore();
  }
  if (paint.stroke) strokeInside(ctx, rect, radius, paint.stroke, u);
}

type BlockToPaint = { rect: Rect; item: WeekItem; info: WallpaperBlockInfo; paint: BlockPaint };

/**
 * Un bloque: ícono y nombre, el horario (si se pidió), el aula en una pastilla y la comisión en
 * la esquina. En horizontal el contenido va a la izquierda, con el ícono al lado del nombre; en
 * vertical (columnas angostas) va centrado, con el ícono arriba.
 */
function drawBlock(ctx: Context, layout: WallpaperLayout, options: WallpaperOptions, { rect, info, paint }: BlockToPaint) {
  const { theme } = options;
  const u = layout.unit;
  const portrait = layout.portrait;
  const family = fontFamily(theme.font, options.fontSans);
  const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${family}`;
  const scale = theme.fontScale;

  paintBlockShape(ctx, rect, theme, paint, u);
  const { ink, iconInk, chip } = paint;
  // La franja de la izquierda le resta lugar al texto.
  const inner = paint.bar ? { ...rect, x: rect.x + 4 * u, width: rect.width - 4 * u } : rect;

  ctx.save();
  roundedRect(ctx, rect, theme.block.radius * u);
  ctx.clip();
  ctx.textBaseline = "middle";

  const padX = Math.min(12 * u, inner.width * 0.09);
  const padY = Math.min(9 * u, inner.height * 0.12);
  const innerWidth = inner.width - padX * 2;
  const innerHeight = inner.height - padY * 2;
  const maxTitle = Math.max(13 * u, Math.min(inner.width * (portrait ? 0.135 : 0.062), (portrait ? 21 : 23) * u)) * scale;
  const minTitle = Math.max(11 * u * scale, maxTitle * 0.62);

  // ----- comisión: esquina de arriba a la derecha -----
  let badge: (Rect & { text: string; size: number }) | null = null;
  if (info.badge) {
    const size = Math.max(10 * u, Math.min(maxTitle * 0.64, 14 * u * scale));
    ctx.font = font(700, size);
    const height = size * 1.75;
    const text = ellipsize(ctx, info.badge, inner.width * 0.5);
    const width = Math.max(height, ctx.measureText(text).width + size * 0.9);
    const inset = Math.min(7 * u, inner.height * 0.1);
    badge = { x: inner.x + inner.width - inset - width, y: inner.y + inset, width, height, text, size };
    // En un bloque muy bajo o muy angosto la comisión taparía el nombre: no se dibuja.
    if (height + inset * 2 > inner.height * 0.62 || width > inner.width * 0.55) badge = null;
  }

  // ----- nombre: el tamaño más grande con el que entra sin cortar palabras -----
  const hasIcon = info.icon !== null;
  const measure = (titleSize: number, reserve: number, withIcon: boolean) => {
    const lineHeight = titleSize * 1.22;
    const iconSize = (titleSize / scale) * (portrait ? 1.45 : 1.12);
    const indent = withIcon && !portrait ? iconSize + titleSize * 0.42 : 0;
    const stack = withIcon && portrait ? iconSize + titleSize * 0.3 : 0;
    // En horizontal el primer renglón comparte el ancho con el ícono y, si hace falta, con la comisión.
    const widthOf = (line: number) => innerWidth - (line === 0 ? indent + reserve : 0);
    return { lineHeight, iconSize, indent, stack, widthOf };
  };
  const fit = (reserve: number) => {
    for (let titleSize = maxTitle; titleSize >= minTitle; titleSize -= u) {
      ctx.font = font(theme.titleWeight, titleSize);
      const metrics = measure(titleSize, reserve, hasIcon);
      const lines = wrapWords(ctx, info.title, metrics.widthOf);
      if (lines && metrics.stack + lines.length * metrics.lineHeight <= innerHeight) return { titleSize, lines, withIcon: hasIcon, ...metrics };
    }
    // No entra ni al tamaño mínimo: se corta. Si el bloque es muy bajo, el ícono de arriba se va primero.
    ctx.font = font(theme.titleWeight, minTitle);
    let withIcon = hasIcon;
    let metrics = measure(minTitle, reserve, withIcon);
    if (withIcon && portrait && metrics.stack + metrics.lineHeight > innerHeight) {
      withIcon = false;
      metrics = measure(minTitle, reserve, false);
    }
    const maxLines = Math.max(1, Math.floor((innerHeight - metrics.stack) / metrics.lineHeight));
    const whole = wrapWords(ctx, info.title, metrics.widthOf);
    const lines = whole && whole.length <= maxLines ? whole : wrapAnywhere(ctx, info.title, metrics.widthOf, maxLines);
    return { titleSize: minTitle, lines, withIcon, ...metrics };
  };

  let layoutText = fit(0);
  const smallSize = (titleSize: number) => Math.max(10.5 * u * scale, titleSize * 0.72);
  const timeHeight = (text: typeof layoutText) => smallSize(text.titleSize) * 1.35 + text.titleSize * 0.12;
  const roomHeight = (text: typeof layoutText) => text.titleSize * 0.34 + smallSize(text.titleSize) * 1.8;
  const contentHeight = (text: typeof layoutText, withTime: boolean, withRoom: boolean) =>
    text.stack + text.lines.length * text.lineHeight + (withTime ? timeHeight(text) : 0) + (withRoom ? roomHeight(text) : 0);
  // Primero el horario (si se pidió) y después el aula, mientras entren.
  const fits = (text: typeof layoutText, withTime: boolean, withRoom: boolean, room = innerHeight) => contentHeight(text, withTime, withRoom) <= room;
  let showTime = options.showTimes && fits(layoutText, true, false);
  let showRoom = Boolean(info.room) && fits(layoutText, showTime, true);
  let top = inner.y + (inner.height - contentHeight(layoutText, showTime, showRoom)) / 2;

  if (badge && top < badge.y + badge.height + 2 * u) {
    if (portrait) {
      // Contenido centrado: si choca con la comisión, baja; si no hay lugar, la comisión no va.
      const lowered = badge.y + badge.height + 3 * u;
      const room = inner.y + inner.height - padY - lowered;
      if (fits(layoutText, showTime, showRoom, room)) top = lowered;
      else if (fits(layoutText, showTime, false, room)) {
        showRoom = false;
        top = lowered;
      } else badge = null;
    } else {
      // Contenido a la izquierda: el primer renglón le deja lugar.
      layoutText = fit(badge.width + 8 * u);
      showTime = options.showTimes && fits(layoutText, true, false);
      showRoom = Boolean(info.room) && fits(layoutText, showTime, true);
      top = inner.y + (inner.height - contentHeight(layoutText, showTime, showRoom)) / 2;
    }
  }

  const { titleSize, lines, lineHeight, iconSize, indent, stack, withIcon } = layoutText;
  const centerX = inner.x + inner.width / 2;
  let y = top;

  if (withIcon && info.icon) {
    if (portrait) drawIcon(ctx, info.icon, centerX - iconSize / 2, y, iconSize, iconInk);
    else drawIcon(ctx, info.icon, inner.x + padX, y + (lineHeight - iconSize) / 2, iconSize, iconInk);
  }
  y += stack;

  ctx.font = font(theme.titleWeight, titleSize);
  ctx.fillStyle = ink;
  ctx.textAlign = portrait ? "center" : "left";
  lines.forEach((line, index) => {
    ctx.fillText(line, portrait ? centerX : inner.x + padX + (index === 0 ? indent : 0), y + lineHeight / 2 + titleSize * 0.04);
    y += lineHeight;
  });

  if (showTime) {
    const size = smallSize(titleSize);
    y += titleSize * 0.12;
    ctx.font = font(500, size);
    ctx.globalAlpha = 0.85;
    ctx.fillText(ellipsize(ctx, info.time, innerWidth), portrait ? centerX : inner.x + padX, y + (size * 1.35) / 2);
    ctx.globalAlpha = 1;
    y += size * 1.35;
  }

  if (showRoom && info.room) {
    const size = smallSize(titleSize);
    ctx.font = font(500, size);
    const height = size * 1.8;
    const text = ellipsize(ctx, info.room, innerWidth - size * 1.2);
    const width = ctx.measureText(text).width + size * 1.2;
    const x = portrait ? centerX - width / 2 : inner.x + padX;
    y += titleSize * 0.34;
    roundedRect(ctx, { x, y, width, height }, Math.min(5 * u, theme.block.radius * u));
    ctx.fillStyle = chip;
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    ctx.fillText(text, x + size * 0.6, y + height / 2 + size * 0.05);
  }

  if (badge) {
    roundedRect(ctx, badge, Math.min(5 * u, theme.block.radius * u));
    ctx.fillStyle = chip;
    ctx.fill();
    ctx.font = font(700, badge.size);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.fillText(badge.text, badge.x + badge.width / 2, badge.y + badge.height / 2 + badge.size * 0.05);
  }
  ctx.restore();
}

/** La tabla: sombra, relleno, banda del encabezado, líneas de la grilla y borde. */
function drawTable(ctx: Context, layout: WallpaperLayout, theme: WallpaperTheme) {
  const u = layout.unit;
  const { table } = theme;
  const rect = layout.table;
  const radius = table.radius * u;
  const bodyTop = rect.y + layout.headerHeight;
  const bodyLeft = rect.x + layout.timeColumnWidth;
  if (table.shadow) castShadow(ctx, rect, radius, table.shadow, u);

  ctx.save();
  roundedRect(ctx, rect, radius);
  if (table.fill) {
    ctx.fillStyle = table.fill;
    ctx.fill();
  }
  ctx.clip();
  if (table.headerFill) {
    ctx.fillStyle = table.headerFill;
    ctx.fillRect(rect.x, rect.y, rect.width, layout.headerHeight);
  }
  const line = Math.max(1, u);
  const stroke = (color: string | null, width: number, dash: boolean, draw: () => void) => {
    if (!color) return;
    ctx.beginPath();
    draw();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.setLineDash(dash ? [4 * u, 4 * u] : []);
    ctx.stroke();
  };
  // Una línea por media hora (las de hora entera, más marcadas) y una por día.
  stroke(table.halfLine, line, table.halfDash, () => {
    for (const row of layout.rows) {
      if (row.isHour) continue;
      ctx.moveTo(rect.x, row.y);
      ctx.lineTo(rect.x + rect.width, row.y);
    }
  });
  stroke(table.hourLine, line, false, () => {
    for (const row of layout.rows) {
      if (!row.isHour || row.y === bodyTop) continue;
      ctx.moveTo(rect.x, row.y);
      ctx.lineTo(rect.x + rect.width, row.y);
    }
  });
  stroke(table.columnLine, line, false, () => {
    for (const column of layout.columns) {
      ctx.moveTo(column.x, table.headerFill ? bodyTop : rect.y);
      ctx.lineTo(column.x, rect.y + rect.height);
    }
  });
  if (table.timeRule) {
    stroke(table.timeRule.color, table.timeRule.width * u, false, () => {
      ctx.moveTo(bodyLeft, rect.y);
      ctx.lineTo(bodyLeft, rect.y + rect.height);
    });
  }
  stroke(table.headerRule.color, table.headerRule.width * u, false, () => {
    ctx.moveTo(rect.x, bodyTop);
    ctx.lineTo(rect.x + rect.width, bodyTop);
  });
  ctx.restore();
  if (table.stroke) strokeInside(ctx, rect, radius, table.stroke, u);
}

/** Pinta el fondo de pantalla completo en el canvas (que queda del tamaño del layout). */
export function drawWallpaper(canvas: HTMLCanvasElement, layout: WallpaperLayout, options: WallpaperOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = layout.width;
  canvas.height = layout.height;
  const { theme } = options;
  const u = layout.unit;
  const portrait = layout.portrait;
  const rect = layout.table;
  const bodyLeft = rect.x + layout.timeColumnWidth;
  const columnWidth = layout.columns[0]?.width ?? 0;
  const rowHeight = layout.rows[0]?.height ?? 0;
  const family = fontFamily(theme.font, options.fontSans);
  const font = (weight: number, size: number) => `${weight} ${Math.round(size * theme.fontScale)}px ${family}`;

  const colorOf = (key: string): SubjectTokens => theme.palette[isColorKey(key) ? key : "grafito"];
  const blocks: BlockToPaint[] = layout.blocks.map(({ item, rect: blockRect }) => {
    const info = options.info(item);
    return { item, rect: blockRect, info, paint: theme.block.paint(colorOf(info.colorKey), item.kind === "event") };
  });
  drawBackground(ctx, layout.width, layout.height, u, options, [...new Set(blocks.map((block) => colorOf(block.info.colorKey).vivid))]);
  drawTable(ctx, layout, theme);

  // ----- encabezado: "Hora" y los días, sin fecha -----
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const headerY = rect.y + layout.headerHeight / 2 + u;
  const timeHeader = (portrait ? 13.5 : 12.5) * u;
  ctx.font = font(600, timeHeader);
  setLetterSpacing(ctx, theme.caps ? timeHeader * 0.1 : 0);
  ctx.fillStyle = theme.table.cornerInk;
  ctx.fillText(caseLabel(options.timeLabel, theme.caps), rect.x + layout.timeColumnWidth / 2, headerY);
  const dayLabel = Math.min(columnWidth * 0.2, (portrait ? 19 : 18) * u);
  ctx.font = font(theme.font === "hand" ? 700 : 600, dayLabel);
  setLetterSpacing(ctx, theme.caps ? dayLabel * 0.07 : 0);
  ctx.fillStyle = theme.table.headerInk;
  for (const column of layout.columns) {
    ctx.fillText(caseLabel(options.weekdayLabels[column.weekday - 1] ?? "", theme.caps), column.x + column.width / 2, headerY);
  }
  setLetterSpacing(ctx, 0);

  // ----- horas: cada media hora, las enteras más fuertes -----
  const timeSize = Math.min((portrait ? 19 : 15.5) * u, (rowHeight * 0.56) / theme.fontScale);
  ctx.textAlign = "right";
  for (const row of layout.rows) {
    ctx.font = font(row.isHour ? 600 : 400, timeSize);
    ctx.fillStyle = row.isHour ? theme.table.timeInk : theme.table.timeInkMinor;
    ctx.fillText(minutesToTime(row.minutes), bodyLeft - (portrait ? 16 : 13) * u, row.y + row.height / 2 + u);
  }

  // ----- bloques -----
  for (const block of blocks) drawBlock(ctx, layout, options, block);
}

/**
 * La muestra de un tema para el selector: su fondo, una tabla chica y tres bloques con sus
 * colores. `canvas` ya tiene su tamaño en píxeles.
 */
export function drawThemeSwatch(canvas: HTMLCanvasElement, theme: WallpaperTheme, fontSans: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const u = width / 200;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.background.color;
  ctx.fillRect(0, 0, width, height);
  drawPattern(ctx, theme.background.pattern, width, height, u * 0.35);

  const table: Rect = { x: 18 * u, y: 14 * u, width: width - 36 * u, height: height - 28 * u };
  const radius = Math.min(theme.table.radius, 16) * u * 0.5;
  if (theme.table.shadow) castShadow(ctx, table, radius, { ...theme.table.shadow, blur: theme.table.shadow.blur * 0.2, x: theme.table.shadow.x * 0.3, y: theme.table.shadow.y * 0.25 }, u);
  roundedRect(ctx, table, radius);
  if (theme.table.fill) {
    ctx.fillStyle = theme.table.fill;
    ctx.fill();
  }
  const header = 16 * u;
  ctx.save();
  roundedRect(ctx, table, radius);
  ctx.clip();
  if (theme.table.headerFill) {
    ctx.fillStyle = theme.table.headerFill;
    ctx.fillRect(table.x, table.y, table.width, header);
  }
  ctx.fillStyle = theme.table.headerRule.color;
  ctx.fillRect(table.x, table.y + header, table.width, Math.max(1, theme.table.headerRule.width * u * 0.5));
  ctx.restore();
  if (theme.table.stroke) strokeInside(ctx, table, radius, { ...theme.table.stroke, width: Math.max(0.6, theme.table.stroke.width * 0.6) }, u);

  // "Aa" con la tipografía del tema, en el encabezado.
  ctx.font = `${theme.titleWeight} ${Math.round(11 * u * theme.fontScale)}px ${fontFamily(theme.font, fontSans)}`;
  ctx.fillStyle = theme.table.headerInk;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Aa", table.x + 8 * u, table.y + header / 2 + u);

  const colors: ColorKey[] = ["cielo", "lima", "frambuesa"];
  const columnWidth = (table.width - 16 * u) / 3;
  const small = { ...theme, block: { ...theme.block, radius: theme.block.radius * 0.5 } };
  colors.forEach((color, index) => {
    const top = table.y + header + (8 + index * 9) * u;
    const rect: Rect = { x: table.x + 8 * u + columnWidth * index + 2 * u, y: top, width: columnWidth - 4 * u, height: Math.min(table.y + table.height - 6 * u - top, 30 * u) };
    const paint = theme.block.paint(theme.palette[color], false);
    paintBlockShape(ctx, rect, small, { ...paint, stroke: paint.stroke ? { ...paint.stroke, width: paint.stroke.width * 0.6 } : null }, u * 0.6);
  });
}

/** Espera a que la tipografía del tema esté lista para el canvas. */
export async function loadWallpaperFont(role: FontRole, fontSans: string) {
  if (!document.fonts?.load) return;
  const family = fontFamily(role, fontSans);
  await Promise.all([400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 24px ${family}`, "Aá09"))).catch(() => undefined);
}

/** Descarga el canvas como PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("toBlob"));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, "image/png");
  });
}
