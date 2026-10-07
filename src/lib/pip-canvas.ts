/**
 * Dibuja el timer flotante en un <canvas>. Ese canvas se transmite como video y el navegador lo
 * muestra en su ventana de imagen en imagen (la misma de los reproductores de video): sin marco,
 * siempre encima. Como ahí no hay HTML, el timer se pinta a mano con los tokens del diseño.
 */

/** Tamaño del cuadro: 16:9, al doble de su tamaño lógico para que el texto salga nítido. */
export const PIP_FRAME = { width: 960, height: 540, unit: 2 } as const;

export type PipTone = "idle" | "focus" | "break";

export type PipModel = {
  /** "18:24" o, en modo examen, "1:39:59". */
  clock: string;
  /** "Foco", "Descanso", "Examen"… */
  phase: string;
  /** "Ciclo 2 de 4", "En pausa"… */
  detail: string;
  /** Fracción transcurrida de la fase (0 a 1): cuánto del borde va pintado. */
  fraction: number;
  tone: PipTone;
};

type Colors = { bg: string; surface: string; track: string; bar: string; phase: string; text: string; muted: string; font: string };

/** Los colores salen de <html>: siguen al tema, al acento elegido y al rojo del modo examen. */
function readColors(tone: PipTone): Colors {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const dark = document.documentElement.dataset.theme === "dark";
  return {
    bg: token("--color-bg"),
    surface: token("--color-surface"),
    track: token(dark ? "--color-surface-active" : "--color-surface-sunken"),
    bar: token(tone === "break" ? "--color-success" : tone === "idle" ? "--color-border-strong" : "--color-accent"),
    phase: token(tone === "break" ? "--color-success-text" : tone === "idle" ? "--color-text-muted" : "--color-accent-text"),
    text: token("--color-text"),
    muted: token("--color-text-muted"),
    font: token("--font-sans"),
  };
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut.trimEnd()}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Pinta un cuadro completo: fondo, tarjeta, borde de progreso en rectángulo redondeado, fase y reloj. */
export function drawPipFrame(canvas: HTMLCanvasElement, model: PipModel) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height, unit: u } = PIP_FRAME;
  const colors = readColors(model.tone);
  const font = (weight: number, size: number) => `${weight} ${Math.round(size * u)}px ${colors.font}`;

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // La tarjeta y su borde: un rectángulo redondeado que ocupa todo el cuadro.
  const inset = 12 * u;
  const stroke = 8 * u;
  const radius = 34 * u;
  const card = { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2 };
  const path = () => {
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.width, card.height, radius);
  };
  path();
  ctx.fillStyle = colors.surface;
  ctx.fill();
  ctx.lineWidth = stroke;
  ctx.setLineDash([]);
  ctx.strokeStyle = colors.track;
  ctx.stroke();

  // El progreso recorre el perímetro, como el anillo del timer grande.
  const fraction = Math.max(0, Math.min(1, model.fraction));
  if (fraction > 0) {
    const perimeter = 2 * (card.width + card.height - 4 * radius) + 2 * Math.PI * radius;
    path();
    ctx.lineCap = "round";
    ctx.setLineDash([perimeter * fraction, perimeter]);
    ctx.strokeStyle = colors.bar;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = "butt";
  }

  const padX = 40 * u;
  const top = card.y + 50 * u;
  const inner = width - padX * 2;
  ctx.textBaseline = "middle";

  // Arriba, la fase a la izquierda y el detalle a la derecha. Si no entran los dos, el que se
  // achica (y, en última instancia, se recorta) es el detalle.
  ctx.font = font(600, 22);
  const phase = fit(ctx, model.phase, inner * 0.7);
  const phaseWidth = ctx.measureText(phase).width;
  ctx.textAlign = "left";
  ctx.fillStyle = colors.phase;
  ctx.fillText(phase, padX, top);

  const room = inner - phaseWidth - 16 * u;
  for (let size = 20; size >= 15; size -= 1) {
    ctx.font = font(400, size);
    if (ctx.measureText(model.detail).width <= room) break;
  }
  ctx.textAlign = "right";
  ctx.fillStyle = colors.muted;
  ctx.fillText(fit(ctx, model.detail, room), width - padX, top);

  // El reloj, lo más grande que entre (con horas en el modo examen es más largo).
  let size = 150;
  let cells = clockCells(ctx, model.clock, size * u);
  for (; size > 60; size -= 6) {
    ctx.font = font(300, size);
    cells = clockCells(ctx, model.clock, size * u);
    if (cells.total <= inner) break;
  }
  ctx.textAlign = "center";
  ctx.fillStyle = colors.text;
  let x = width / 2 - cells.total / 2;
  for (const cell of cells.items) {
    ctx.fillText(cell.char, x + cell.width / 2, card.y + card.height / 2 + 26 * u);
    x += cell.width + cells.tracking;
  }
}

/**
 * El canvas no tiene cifras tabulares: cada dígito va en una celda del ancho del más ancho, así el
 * reloj no baila cuando cambia un número. Con el mismo interletrado apretado del timer grande.
 */
function clockCells(ctx: CanvasRenderingContext2D, clock: string, fontSize: number) {
  const digit = Math.max(...Array.from("0123456789", (char) => ctx.measureText(char).width));
  const tracking = -0.04 * fontSize;
  const items = Array.from(clock, (char) => ({ char, width: /\d/.test(char) ? digit : ctx.measureText(char).width }));
  const total = items.reduce((sum, item) => sum + item.width, 0) + tracking * Math.max(0, items.length - 1);
  return { items, tracking, total };
}
