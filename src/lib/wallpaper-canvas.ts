/**
 * Dibuja el horario en un <canvas> para exportarlo como fondo de pantalla. La geometría viene
 * de `domain/wallpaper.ts`; acá solo se pinta: fondo, tabla, días (sin fechas), una fila por
 * media hora y los bloques con su ícono, su aula y su comisión.
 * Los colores salen de los tokens del diseño, leídos del DOM para el tema elegido; el único
 * color libre es el del fondo personalizado, que elige quien exporta.
 */
import type { WeekItem } from "@/lib/domain/schedule";
import { SUBJECT_COLORS, isColorKey, type ColorKey } from "@/lib/domain/subjects";
import { minutesToTime } from "@/lib/domain/time";
import type { Rect, WallpaperLayout } from "@/lib/domain/wallpaper";

/** Liso (el fondo del tema), con manchas de los colores de las materias, o un color a elección. */
export type WallpaperBackground = "plain" | "glow" | "custom";
/** Bloques de color pleno o suaves, como en el Horario de la app. */
export type WallpaperBlockStyle = "solid" | "soft";

type SubjectColors = { solid: string; vivid: string; soft: string; onSoft: string; onSolid: string };

export type WallpaperColors = {
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textDisabled: string;
  accent: string;
  subjects: Record<ColorKey, SubjectColors>;
  fontSans: string;
};

/** Lee los tokens de un elemento que está dentro de un `[data-theme]`. */
export function readWallpaperColors(probe: HTMLElement, dark: boolean): WallpaperColors {
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
  ) as Record<ColorKey, SubjectColors>;
  return {
    dark,
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

/** Lo que se escribe en cada bloque. */
export type WallpaperBlockInfo = {
  title: string;
  /** Aula: va en una pastilla debajo del nombre. */
  room: string | null;
  /** Comisión: va en la esquina de arriba a la derecha. */
  badge: string | null;
  colorKey: string;
  /** El <svg> del ícono ya dibujado en el DOM, o null. */
  icon: SVGElement | null;
};

export type WallpaperOptions = {
  colors: WallpaperColors;
  background: WallpaperBackground;
  /** Color del fondo personalizado ("#rrggbb"). */
  customColor: string;
  blockStyle: WallpaperBlockStyle;
  /** Nombre corto de cada día, de lunes (índice 0) a domingo. */
  weekdayLabels: string[];
  /** Rótulo de la columna de horas. */
  timeLabel: string;
  info: (item: WeekItem) => WallpaperBlockInfo;
};

type Context = CanvasRenderingContext2D;

const hexChannels = (color: string) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  return hex ? [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16)) : null;
};

/** Agrega transparencia a un color hexadecimal de los tokens. */
function withAlpha(color: string, alpha: number): string {
  return hexChannels(color) ? `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : color;
}

/** ¿Es un color oscuro? (para elegir cuánto oscurecer la pastilla que va encima) */
function isDarkColor(color: string): boolean {
  const channels = hexChannels(color);
  return channels ? (0.299 * channels[0] + 0.587 * channels[1] + 0.114 * channels[2]) / 255 < 0.5 : false;
}

/** Separación entre letras, donde el navegador la soporta en canvas. */
function setLetterSpacing(ctx: Context, px: number) {
  if ("letterSpacing" in ctx) (ctx as Context & { letterSpacing: string }).letterSpacing = `${px.toFixed(2)}px`;
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

function drawBackground(ctx: Context, layout: WallpaperLayout, options: WallpaperOptions, palette: string[]) {
  const { width, height } = layout;
  const { colors } = options;
  ctx.fillStyle = options.background === "custom" ? options.customColor : colors.bg;
  ctx.fillRect(0, 0, width, height);
  if (options.background !== "glow") return;

  // Manchas suaves con los colores de las materias del horario (o el acento si no hay ninguna).
  const tints = palette.length > 0 ? palette : [colors.accent];
  const reach = Math.max(width, height);
  const spots = [
    { x: width * 0.08, y: height * 0.1, radius: reach * 0.55 },
    { x: width * 0.94, y: height * 0.92, radius: reach * 0.6 },
    { x: width * 0.9, y: height * 0.06, radius: reach * 0.4 },
    { x: width * 0.06, y: height * 0.95, radius: reach * 0.42 },
  ];
  const strength = colors.dark ? 0.26 : 0.3;
  spots.forEach((spot, index) => {
    const tint = tints[index % tints.length];
    const gradient = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.radius);
    gradient.addColorStop(0, withAlpha(tint, strength));
    gradient.addColorStop(0.55, withAlpha(tint, strength * 0.35));
    gradient.addColorStop(1, withAlpha(tint, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

type BlockPaint = { rect: Rect; item: WeekItem; info: WallpaperBlockInfo; subject: SubjectColors };

/**
 * Un bloque: ícono y nombre, el aula en una pastilla y la comisión en la esquina. En horizontal
 * el contenido va a la izquierda, con el ícono al lado del nombre; en vertical (columnas
 * angostas) va centrado, con el ícono arriba. No lleva horario: lo da la grilla de media hora.
 */
function drawBlock(ctx: Context, layout: WallpaperLayout, options: WallpaperOptions, { rect, item, info, subject }: BlockPaint) {
  const { colors } = options;
  const u = layout.unit;
  const portrait = layout.portrait;
  const solid = options.blockStyle === "solid";
  const isEvent = item.kind === "event";
  const radius = 9 * u;
  const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${colors.fontSans}`;

  // ----- fondo -----
  roundedRect(ctx, rect, radius);
  if (solid) {
    ctx.fillStyle = subject.solid;
    ctx.fill();
  } else {
    ctx.fillStyle = isEvent ? colors.surface : subject.soft;
    ctx.fill();
    ctx.save();
    const stroke = (isEvent ? 2 : 1.5) * u;
    ctx.lineWidth = stroke;
    ctx.strokeStyle = isEvent ? subject.solid : withAlpha(subject.solid, 0.5);
    if (isEvent) ctx.setLineDash([7 * u, 5 * u]);
    roundedRect(ctx, { x: rect.x + stroke / 2, y: rect.y + stroke / 2, width: rect.width - stroke, height: rect.height - stroke }, radius);
    ctx.stroke();
    ctx.restore();
  }
  const ink = solid ? subject.onSolid : isEvent ? colors.text : subject.onSoft;
  const iconInk = !solid && isEvent ? subject.solid : ink;
  const chipFill = solid ? `rgba(0, 0, 0, ${isDarkColor(ink) ? 0.12 : 0.2})` : withAlpha(subject.solid, colors.dark ? 0.26 : 0.16);

  ctx.save();
  roundedRect(ctx, rect, radius);
  ctx.clip();
  ctx.textBaseline = "middle";

  const padX = Math.min(12 * u, rect.width * 0.09);
  const padY = Math.min(9 * u, rect.height * 0.12);
  const innerWidth = rect.width - padX * 2;
  const innerHeight = rect.height - padY * 2;
  const maxTitle = Math.max(13 * u, Math.min(rect.width * (portrait ? 0.135 : 0.062), (portrait ? 21 : 23) * u));
  const minTitle = Math.max(11 * u, maxTitle * 0.62);

  // ----- comisión: esquina de arriba a la derecha -----
  let badge: (Rect & { text: string; size: number }) | null = null;
  if (info.badge) {
    const size = Math.max(10 * u, Math.min(maxTitle * 0.64, 14 * u));
    ctx.font = font(700, size);
    const height = size * 1.75;
    const text = ellipsize(ctx, info.badge, rect.width * 0.5);
    const width = Math.max(height, ctx.measureText(text).width + size * 0.9);
    const inset = Math.min(7 * u, rect.height * 0.1);
    badge = { x: rect.x + rect.width - inset - width, y: rect.y + inset, width, height, text, size };
    // En un bloque muy bajo o muy angosto la comisión taparía el nombre: no se dibuja.
    if (height + inset * 2 > rect.height * 0.62 || width > rect.width * 0.55) badge = null;
  }

  // ----- nombre: el tamaño más grande con el que entra sin cortar palabras -----
  const hasIcon = info.icon !== null;
  const measure = (titleSize: number, reserve: number, withIcon: boolean) => {
    const lineHeight = titleSize * 1.22;
    const iconSize = titleSize * (portrait ? 1.45 : 1.12);
    const indent = withIcon && !portrait ? iconSize + titleSize * 0.42 : 0;
    const stack = withIcon && portrait ? iconSize + titleSize * 0.3 : 0;
    // En horizontal el primer renglón comparte el ancho con el ícono y, si hace falta, con la comisión.
    const widthOf = (line: number) => innerWidth - (line === 0 ? indent + reserve : 0);
    return { lineHeight, iconSize, indent, stack, widthOf };
  };
  const fit = (reserve: number) => {
    for (let titleSize = maxTitle; titleSize >= minTitle; titleSize -= u) {
      ctx.font = font(600, titleSize);
      const metrics = measure(titleSize, reserve, hasIcon);
      const lines = wrapWords(ctx, info.title, metrics.widthOf);
      if (lines && metrics.stack + lines.length * metrics.lineHeight <= innerHeight) return { titleSize, lines, withIcon: hasIcon, ...metrics };
    }
    // No entra ni al tamaño mínimo: se corta. Si el bloque es muy bajo, el ícono de arriba se va primero.
    ctx.font = font(600, minTitle);
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
  const roomSize = (titleSize: number) => Math.max(10.5 * u, titleSize * 0.72);
  const contentHeight = (text: typeof layoutText, withRoom: boolean) =>
    text.stack + text.lines.length * text.lineHeight + (withRoom ? text.titleSize * 0.34 + roomSize(text.titleSize) * 1.8 : 0);
  let showRoom = Boolean(info.room) && contentHeight(layoutText, true) <= innerHeight;
  let top = rect.y + (rect.height - contentHeight(layoutText, showRoom)) / 2;

  if (badge && top < badge.y + badge.height + 2 * u) {
    if (portrait) {
      // Contenido centrado: si choca con la comisión, baja; si no hay lugar, la comisión no va.
      const lowered = badge.y + badge.height + 3 * u;
      if (lowered + contentHeight(layoutText, showRoom) <= rect.y + rect.height - padY) top = lowered;
      else if (lowered + contentHeight(layoutText, false) <= rect.y + rect.height - padY) {
        showRoom = false;
        top = lowered;
      } else badge = null;
    } else {
      // Contenido a la izquierda: el primer renglón le deja lugar.
      layoutText = fit(badge.width + 8 * u);
      showRoom = Boolean(info.room) && contentHeight(layoutText, true) <= innerHeight;
      top = rect.y + (rect.height - contentHeight(layoutText, showRoom)) / 2;
    }
  }

  const { titleSize, lines, lineHeight, iconSize, indent, stack, withIcon } = layoutText;
  const centerX = rect.x + rect.width / 2;
  let y = top;

  if (withIcon && info.icon) {
    if (portrait) drawIcon(ctx, info.icon, centerX - iconSize / 2, y, iconSize, iconInk);
    else drawIcon(ctx, info.icon, rect.x + padX, y + (lineHeight - iconSize) / 2, iconSize, iconInk);
  }
  y += stack;

  ctx.font = font(600, titleSize);
  ctx.fillStyle = ink;
  ctx.textAlign = portrait ? "center" : "left";
  lines.forEach((line, index) => {
    ctx.fillText(line, portrait ? centerX : rect.x + padX + (index === 0 ? indent : 0), y + lineHeight / 2 + titleSize * 0.04);
    y += lineHeight;
  });

  if (showRoom && info.room) {
    const size = roomSize(titleSize);
    ctx.font = font(500, size);
    const height = size * 1.8;
    const text = ellipsize(ctx, info.room, innerWidth - size * 1.2);
    const width = ctx.measureText(text).width + size * 1.2;
    const x = portrait ? centerX - width / 2 : rect.x + padX;
    y += titleSize * 0.34;
    roundedRect(ctx, { x, y, width, height }, 5 * u);
    ctx.fillStyle = chipFill;
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    ctx.fillText(text, x + size * 0.6, y + height / 2 + size * 0.05);
  }

  if (badge) {
    roundedRect(ctx, badge, 5 * u);
    ctx.fillStyle = chipFill;
    ctx.fill();
    ctx.font = font(700, badge.size);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.fillText(badge.text, badge.x + badge.width / 2, badge.y + badge.height / 2 + badge.size * 0.05);
  }
  ctx.restore();
}

/** Pinta el fondo de pantalla completo en el canvas (que queda del tamaño del layout). */
export function drawWallpaper(canvas: HTMLCanvasElement, layout: WallpaperLayout, options: WallpaperOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = layout.width;
  canvas.height = layout.height;
  const { colors } = options;
  const u = layout.unit;
  const portrait = layout.portrait;
  const { table } = layout;
  const bodyTop = table.y + layout.headerHeight;
  const bodyLeft = table.x + layout.timeColumnWidth;
  const columnWidth = layout.columns[0]?.width ?? 0;
  const rowHeight = layout.rows[0]?.height ?? 0;
  const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${colors.fontSans}`;

  const colorOf = (key: string): SubjectColors => colors.subjects[isColorKey(key) ? key : "grafito"];
  const paints: BlockPaint[] = layout.blocks.map(({ item, rect }) => {
    const info = options.info(item);
    return { item, rect, info, subject: colorOf(info.colorKey) };
  });
  drawBackground(ctx, layout, options, [...new Set(paints.map((paint) => paint.subject.vivid))]);

  // ----- la tabla -----
  const radius = 14 * u;
  ctx.save();
  ctx.shadowColor = colors.dark ? "rgba(0, 0, 0, 0.45)" : "rgba(30, 28, 25, 0.12)";
  ctx.shadowBlur = 48 * u;
  ctx.shadowOffsetY = 16 * u;
  roundedRect(ctx, table, radius);
  ctx.fillStyle = colors.surface;
  ctx.fill();
  ctx.restore();

  // ----- grilla: una línea por media hora (las de hora entera, más marcadas) y una por día -----
  ctx.save();
  roundedRect(ctx, table, radius);
  ctx.clip();
  const line = Math.max(1, u);
  ctx.lineWidth = line;
  const stroke = (color: string, draw: () => void) => {
    ctx.beginPath();
    draw();
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  stroke(withAlpha(colors.border, 0.55), () => {
    for (const row of layout.rows) {
      if (row.isHour) continue;
      ctx.moveTo(table.x, row.y);
      ctx.lineTo(table.x + table.width, row.y);
    }
  });
  stroke(colors.border, () => {
    for (const row of layout.rows) {
      if (!row.isHour || row.y === bodyTop) continue;
      ctx.moveTo(table.x, row.y);
      ctx.lineTo(table.x + table.width, row.y);
    }
    for (const column of layout.columns) {
      ctx.moveTo(column.x, table.y);
      ctx.lineTo(column.x, table.y + table.height);
    }
  });
  stroke(colors.borderStrong, () => {
    ctx.moveTo(table.x, bodyTop);
    ctx.lineTo(table.x + table.width, bodyTop);
  });
  ctx.restore();
  roundedRect(ctx, table, radius);
  ctx.lineWidth = line;
  ctx.strokeStyle = colors.borderStrong;
  ctx.stroke();

  // ----- encabezado: "Hora" y los días, sin fecha -----
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const headerY = table.y + layout.headerHeight / 2 + u;
  const timeHeader = (portrait ? 13.5 : 12.5) * u;
  ctx.font = font(600, timeHeader);
  setLetterSpacing(ctx, timeHeader * 0.1);
  ctx.fillStyle = colors.textSubtle;
  ctx.fillText(options.timeLabel.toUpperCase(), table.x + layout.timeColumnWidth / 2, headerY);
  const dayLabel = Math.min(columnWidth * 0.2, (portrait ? 19 : 18) * u);
  ctx.font = font(600, dayLabel);
  setLetterSpacing(ctx, dayLabel * 0.07);
  ctx.fillStyle = colors.textMuted;
  for (const column of layout.columns) {
    ctx.fillText((options.weekdayLabels[column.weekday - 1] ?? "").toUpperCase(), column.x + column.width / 2, headerY);
  }
  setLetterSpacing(ctx, 0);

  // ----- horas: cada media hora, las enteras más fuertes -----
  const timeSize = Math.min((portrait ? 19 : 15.5) * u, rowHeight * 0.56);
  ctx.textAlign = "right";
  for (const row of layout.rows) {
    ctx.font = font(row.isHour ? 600 : 400, timeSize);
    ctx.fillStyle = row.isHour ? colors.textMuted : colors.textDisabled;
    ctx.fillText(minutesToTime(row.minutes), bodyLeft - (portrait ? 16 : 13) * u, row.y + row.height / 2 + u);
  }

  // ----- bloques -----
  for (const paint of paints) drawBlock(ctx, layout, options, paint);
}

/** Espera a que las tipografías del diseño estén listas para el canvas. */
export async function loadWallpaperFonts(colors: WallpaperColors) {
  if (!document.fonts?.load) return;
  await Promise.all([400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 24px ${colors.fontSans}`))).catch(() => undefined);
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
