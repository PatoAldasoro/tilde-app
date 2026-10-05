/**
 * Abrir el menú lateral llevando el mouse al borde izquierdo, sin que moleste.
 *
 * Llegar al borde no alcanza: se mira cómo llegó el puntero y cuánto se queda.
 * - Gesto decidido (un tramo largo, rápido y casi horizontal hacia la izquierda): alcanza con
 *   una pausa corta contra el borde.
 * - Llegada lenta pero hacia la izquierda: hace falta quedarse bastante más.
 * - Llegada en diagonal o bordeando el costado (camino a otro control): no cuenta.
 * - Si durante la espera el puntero se desliza a lo largo del borde, la espera vuelve a empezar.
 * - Después de abrirse (o de cerrarse el menú) hay que alejarse del borde para volver a armarlo.
 *
 * Quien lo usa cancela además cuando hay un botón apretado (arrastre, selección de texto),
 * cuando el puntero sale de la ventana y cuando hay un diálogo abierto.
 */

export type PointerSample = { x: number; y: number; /** milisegundos */ t: number };

export type EdgeIntentConfig = {
  /** Ancho de la zona pegada al borde. */
  edge: number;
  /** Distancia del borde a la que el gesto vuelve a estar disponible. */
  rearm: number;
  /** Cuánto del recorrido previo se analiza. */
  window: number;
  /** Gesto decidido: recorrido mínimo hacia la izquierda y proporción horizontal/vertical. */
  flickDistance: number;
  flickRatio: number;
  flickDwell: number;
  /** Llegada lenta: recorrido mínimo y espera. */
  slowDistance: number;
  slowDwell: number;
  /** Movimiento vertical tolerado mientras espera. */
  drift: number;
};

export const EDGE_INTENT: EdgeIntentConfig = {
  edge: 6,
  rearm: 96,
  window: 320,
  flickDistance: 140,
  flickRatio: 2,
  flickDwell: 90,
  slowDistance: 40,
  slowDwell: 480,
  drift: 28,
};

export type EdgeIntentState = {
  /** Últimas posiciones del puntero (dentro de `window`). */
  trail: PointerSample[];
  /** Espera en curso: desde cuándo, a qué altura y cuánto tiene que durar. */
  pending: { since: number; y: number; dwell: number } | null;
  armed: boolean;
};

/** Arranca desarmado: el primer movimiento lejos del borde lo arma. */
export const EDGE_INTENT_IDLE: EdgeIntentState = { trail: [], pending: null, armed: false };

export type EdgeIntentStep = {
  state: EdgeIntentState;
  /** Momento en que habría que abrir el menú si el puntero no se mueve más; null si no hay espera. */
  fireAt: number | null;
};

/** Procesa un movimiento del puntero. */
export function edgeIntentMove(state: EdgeIntentState, sample: PointerSample, config: EdgeIntentConfig = EDGE_INTENT): EdgeIntentStep {
  const trail = [...state.trail.filter((point) => sample.t - point.t <= config.window), sample];

  if (!state.armed) {
    return { state: { trail, pending: null, armed: sample.x >= config.rearm }, fireAt: null };
  }
  if (sample.x > config.edge) {
    return { state: { trail, pending: null, armed: true }, fireAt: null };
  }

  let pending = state.pending;
  if (!pending) {
    // Entró a la zona: ¿cómo venía? Se mide desde el punto más alejado del recorrido reciente.
    const origin = trail.reduce((far, point) => (point.x > far.x ? point : far), sample);
    const dx = origin.x - sample.x;
    const dy = Math.abs(origin.y - sample.y);
    if (dx >= config.flickDistance && dx >= config.flickRatio * dy) {
      pending = { since: sample.t, y: sample.y, dwell: config.flickDwell };
    } else if (dx >= config.slowDistance && dx >= dy) {
      pending = { since: sample.t, y: sample.y, dwell: config.slowDwell };
    }
  } else if (Math.abs(sample.y - pending.y) > config.drift) {
    // Se desliza a lo largo del borde: va hacia otro lado. La espera vuelve a empezar, y larga.
    pending = { since: sample.t, y: sample.y, dwell: config.slowDwell };
  }

  return { state: { trail, pending, armed: true }, fireAt: pending ? pending.since + pending.dwell : null };
}

/** ¿Ya se cumplió la espera? */
export function edgeIntentDue(state: EdgeIntentState, now: number): boolean {
  return state.armed && state.pending !== null && now >= state.pending.since + state.pending.dwell;
}

/** Corta la espera en curso (botón apretado, el puntero salió de la ventana…). */
export function edgeIntentCancel(state: EdgeIntentState): EdgeIntentState {
  return { trail: [], pending: null, armed: state.armed };
}
