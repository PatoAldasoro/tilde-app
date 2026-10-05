/**
 * Dibuja el horario en un <canvas> para exportarlo como fondo de pantalla. La geometría viene
 * de `domain/wallpaper.ts`; acá solo se pinta: fondo, tabla, días (sin fechas), horas y bloques.
 * Los colores salen de los tokens del diseño, leídos del DOM para el tema elegido.
 */
import { SUBJECT_COLORS, isColorKey, type ColorKey } from "@/lib/domain/subjects";
import { minutesToTime } from "@/lib/domain/time";
import type { Rect, WallpaperLayout } from "@/lib/domain/wallpaper";
import type { WeekItem } from "@/lib/domain/schedule";

export type WallpaperBackground = "glow" | "plain";

type SubjectColors = { solid: string; vivid: string; soft: string; onSoft: string };

export type WallpaperColors = {
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
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
    accent: token("--color-accent"),
    subjects,
    fontSans: token("--font-sans"),
  };
}

/** Lo que se escribe en cada bloque. */
export type WallpaperBlockInfo = {
  title: string;
  room: string | null;
  colorKey: string;
  /** El <svg> del ícono ya dibujado en el DOM, o null. */
  icon: SVGElement | null;
};

export type WallpaperOptions = {
  colors: WallpaperColors;
  background: WallpaperBackground;
  /** Nombre corto de cada día, de lunes (índice 0) a domingo. */
  weekdayLabels: string[];
  info: (item: WeekItem) => WallpaperBlockInfo;
};

/** Agrega transparencia a un color hexadecimal de los tokens. */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  return `#${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
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

function drawIcon(ctx: CanvasRenderingContext2D, svg: SVGElement, x: number, y: number, size: number, color: string) {
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
 * Parte un texto en renglones que entren en `maxWidth` (el primero puede tener una sangría).
 * Devuelve null si alguna palabra no entra entera.
 */
function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, firstIndent: number): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const available = maxWidth - (lines.length === 0 ? firstIndent : 0);
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= available) {
      line = candidate;
      continue;
    }
    if (!line) return null;
    lines.push(line);
    if (ctx.measureText(word).width > maxWidth) return null;
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

/** Recorta un renglón con puntos suspensivos hasta que entre. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut.trimEnd()}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Igual que wrapWords pero cortando las palabras que no entran (último recurso). */
function wrapAnywhere(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, firstIndent: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    const available = maxWidth - (lines.length === 0 ? firstIndent : 0);
    if (ctx.measureText(line + char).width <= available || !line) {
      line += char;
      continue;
    }
    lines.push(line.trim());
    line = char.trim();
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line.trim());
  else if (line && lines.length === maxLines) lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]}…`, maxWidth);
  return lines;
}

function roundedRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, Math.min(radius, rect.width / 2, rect.height / 2));
}

function drawBackground(ctx: CanvasRenderingContext2D, layout: WallpaperLayout, options: WallpaperOptions, palette: string[]) {
  const { width, height } = layout;
  const { colors } = options;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  if (options.background === "plain") return;

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

/** Pinta el fondo de pantalla completo en el canvas (que queda del tamaño del layout). */
export function drawWallpaper(canvas: HTMLCanvasElement, layout: WallpaperLayout, options: WallpaperOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = layout.width;
  canvas.height = layout.height;
  const { colors } = options;
  const u = layout.unit;
  const portrait = layout.format === "portrait";
  const { table } = layout;
  const bodyLeft = table.x + layout.timeColumnWidth;
  const columnWidth = layout.columns[0]?.width ?? 0;
  const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${colors.fontSans}`;

  const infos = new Map(layout.blocks.map(({ item }) => [item.key, options.info(item)]));
  const colorOf = (key: string): SubjectColors => colors.subjects[isColorKey(key) ? key : "grafito"];
  const palette = [...new Set([...infos.values()].map((info) => colorOf(info.colorKey).vivid))];

  drawBackground(ctx, layout, options, palette);

  // ----- tarjeta de la tabla -----
  const radius = 26 * u;
  ctx.save();
  ctx.shadowColor = colors.dark ? "rgba(0, 0, 0, 0.55)" : "rgba(30, 28, 25, 0.16)";
  ctx.shadowBlur = 70 * u;
  ctx.shadowOffsetY = 26 * u;
  roundedRect(ctx, table, radius);
  ctx.fillStyle = colors.surface;
  ctx.fill();
  ctx.restore();
  roundedRect(ctx, table, radius);
  ctx.lineWidth = Math.max(1, u);
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  // ----- grilla: líneas de hora y de día -----
  ctx.save();
  roundedRect(ctx, table, radius);
  ctx.clip();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = Math.max(1, u);
  ctx.beginPath();
  for (const hour of layout.hours.slice(0, -1)) {
    ctx.moveTo(hour.minutes === layout.startMinutes ? table.x : bodyLeft, hour.y);
    ctx.lineTo(table.x + table.width, hour.y);
  }
  for (const column of layout.columns) {
    ctx.moveTo(column.x, table.y);
    ctx.lineTo(column.x, table.y + table.height);
  }
  ctx.stroke();
  ctx.restore();

  // ----- días: solo el nombre, sin fecha -----
  const dayLabel = Math.min(columnWidth * (portrait ? 0.2 : 0.11), (portrait ? 34 : 30) * u);
  ctx.font = font(600, dayLabel);
  ctx.fillStyle = colors.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const column of layout.columns) {
    const label = options.weekdayLabels[column.weekday - 1] ?? "";
    ctx.fillText(label.charAt(0).toUpperCase() + label.slice(1), column.x + column.width / 2, table.y + layout.headerHeight / 2 + u);
  }

  // ----- horas -----
  const hourHeight = layout.hours.length > 1 ? layout.hours[1].y - layout.hours[0].y : 0;
  const hourLabel = Math.min((portrait ? 21 : 17) * u, hourHeight * 0.34);
  ctx.font = font(500, hourLabel);
  ctx.fillStyle = colors.textSubtle;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  for (const hour of layout.hours.slice(0, -1)) {
    ctx.fillText(minutesToTime(hour.minutes), bodyLeft - 14 * u, hour.y + 8 * u);
  }

  // ----- bloques -----
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const { item, rect } of layout.blocks) {
    const info = infos.get(item.key)!;
    const subject = colorOf(info.colorKey);
    const isEvent = item.kind === "event";
    const blockRadius = 10 * u;

    roundedRect(ctx, rect, blockRadius);
    ctx.fillStyle = isEvent ? colors.surface : subject.soft;
    ctx.fill();
    ctx.save();
    const stroke = (isEvent ? 2 : 1.5) * u;
    ctx.lineWidth = stroke;
    ctx.strokeStyle = isEvent ? subject.solid : withAlpha(subject.solid, 0.5);
    if (isEvent) ctx.setLineDash([7 * u, 5 * u]);
    roundedRect(ctx, { x: rect.x + stroke / 2, y: rect.y + stroke / 2, width: rect.width - stroke, height: rect.height - stroke }, blockRadius);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, rect, blockRadius);
    ctx.clip();

    const titleColor = isEvent ? colors.text : subject.onSoft;
    const metaColor = isEvent ? colors.textMuted : withAlpha(subject.onSoft, 0.86);
    const padX = Math.min(12 * u, rect.width * 0.08);
    const padY = Math.min(10 * u, rect.height * 0.14);
    const innerWidth = rect.width - padX * 2;
    const innerHeight = rect.height - padY * 2;

    // Tamaño del título: el más grande con el que entra sin partir palabras.
    const maxTitle = Math.min(rect.width * (portrait ? 0.15 : 0.085), (portrait ? 30 : 24) * u);
    const minTitle = Math.max((portrait ? 17 : 13) * u, maxTitle * 0.6);
    const time = `${minutesToTime(item.start)}–${minutesToTime(item.end)}`;
    let titleSize = maxTitle;
    let lines: string[] | null = null;
    let showTime = true;
    for (; titleSize >= minTitle; titleSize -= u) {
      ctx.font = font(600, titleSize);
      const iconIndent = info.icon ? titleSize * 1.3 : 0;
      const wrapped = wrapWords(ctx, info.title, innerWidth, iconIndent);
      const metaHeight = titleSize * 0.8 * 1.35;
      if (wrapped && wrapped.length * titleSize * 1.22 + metaHeight <= innerHeight) {
        lines = wrapped;
        break;
      }
    }
    if (!lines) {
      // No entra ni al mínimo: se corta donde haga falta y, si el bloque es muy bajo, se saca la hora.
      titleSize = minTitle;
      ctx.font = font(600, titleSize);
      const iconIndent = info.icon ? titleSize * 1.3 : 0;
      const lineHeight = titleSize * 1.22;
      const metaHeight = titleSize * 0.8 * 1.35;
      showTime = innerHeight >= lineHeight + metaHeight;
      const maxLines = Math.max(1, Math.floor((innerHeight - (showTime ? metaHeight : 0)) / lineHeight));
      const wrapped = wrapWords(ctx, info.title, innerWidth, iconIndent);
      lines = wrapped && wrapped.length <= maxLines ? wrapped : wrapAnywhere(ctx, info.title, innerWidth, iconIndent, maxLines);
    }

    const lineHeight = titleSize * 1.22;
    const metaSize = titleSize * 0.8;
    const iconSize = titleSize * 1.05;
    const iconIndent = info.icon ? titleSize * 1.3 : 0;
    let y = rect.y + padY;
    if (info.icon) drawIcon(ctx, info.icon, rect.x + padX, y + (lineHeight - iconSize) / 2 - titleSize * 0.08, iconSize, isEvent ? subject.solid : titleColor);
    ctx.font = font(600, titleSize);
    ctx.fillStyle = titleColor;
    lines.forEach((line, index) => {
      ctx.fillText(line, rect.x + padX + (index === 0 ? iconIndent : 0), y);
      y += lineHeight;
    });
    if (showTime) {
      ctx.font = font(500, metaSize);
      ctx.fillStyle = metaColor;
      y += metaSize * 0.1;
      ctx.fillText(ellipsize(ctx, time, innerWidth), rect.x + padX, y);
      y += metaSize * 1.35;
      if (info.room && y + metaSize * 1.2 <= rect.y + rect.height - padY) {
        ctx.fillText(ellipsize(ctx, info.room, innerWidth), rect.x + padX, y);
      }
    }
    ctx.restore();
  }
}

/** Espera a que las tipografías del diseño estén listas para el canvas. */
export async function loadWallpaperFonts(colors: WallpaperColors) {
  if (!document.fonts?.load) return;
  await Promise.all([500, 600].map((weight) => document.fonts.load(`${weight} 24px ${colors.fontSans}`))).catch(() => undefined);
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
