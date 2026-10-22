/**
 * Cuentas con colores hexadecimales ("#rrggbb"), para los temas del horario exportado: mezclar,
 * agregar transparencia y elegir un texto que se lea sobre un fondo. Lo que no es un hex se
 * devuelve tal cual (un `rgba(...)` de los tokens, por ejemplo).
 */

type Rgb = [number, number, number];

export function hexToRgb(color: string): Rgb | null {
  const hex = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color.trim())?.[1];
  return hex ? ([0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16)) as Rgb) : null;
}

const channel = (value: number) =>
  Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Mezcla: `amount` = 0 es `from`, 1 es `to`. */
export function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) return from;
  return rgbToHex([0, 1, 2].map((index) => a[index] + (b[index] - a[index]) * amount) as Rgb);
}

/** El color con transparencia ("#rrggbbaa"). */
export function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  return rgb ? `${rgbToHex(rgb)}${channel(alpha * 255)}` : color;
}

/** Luminancia relativa (WCAG), de 0 (negro) a 1 (blanco). */
export function luminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre dos colores (WCAG): de 1 a 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** De los candidatos, el que más se lee sobre `background`. */
export function readableOn(background: string, candidates: readonly string[]): string {
  return candidates.reduce((best, color) => (contrast(background, color) > contrast(background, best) ? color : best));
}

/** Le quita saturación: 0 lo deja igual, 1 lo vuelve gris (de la misma luminosidad percibida). */
export function desaturate(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const gray = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return rgbToHex(rgb.map((value) => value + (gray - value) * amount) as Rgb);
}

export const isDark = (color: string): boolean => luminance(color) < 0.18;
