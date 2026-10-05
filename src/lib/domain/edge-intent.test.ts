import { describe, expect, it } from "vitest";
import { EDGE_INTENT, EDGE_INTENT_IDLE, edgeIntentCancel, edgeIntentDue, edgeIntentMove, type EdgeIntentState, type PointerSample } from "./edge-intent";

/** Pasa una serie de muestras y devuelve el último paso. */
function run(samples: PointerSample[], from: EdgeIntentState = EDGE_INTENT_IDLE) {
  let step = { state: from, fireAt: null as number | null };
  for (const sample of samples) step = edgeIntentMove(step.state, sample);
  return step;
}

/** Recorrido recto de (x0, y0) a (x1, y1) en `ms`, una muestra cada 16 ms, empezando en `t0`. */
function path(x0: number, y0: number, x1: number, y1: number, ms: number, t0 = 0): PointerSample[] {
  const steps = Math.max(1, Math.round(ms / 16));
  return Array.from({ length: steps + 1 }, (_, index) => ({
    x: Math.round(x0 + ((x1 - x0) * index) / steps),
    y: Math.round(y0 + ((y1 - y0) * index) / steps),
    t: t0 + (ms * index) / steps,
  }));
}

describe("edge intent", () => {
  it("un gesto decidido hacia la izquierda abre tras una pausa corta", () => {
    const step = run(path(600, 400, 0, 410, 160));
    expect(step.fireAt).toBe(160 + EDGE_INTENT.flickDwell);
    expect(edgeIntentDue(step.state, 160 + EDGE_INTENT.flickDwell - 1)).toBe(false);
    expect(edgeIntentDue(step.state, 160 + EDGE_INTENT.flickDwell)).toBe(true);
  });

  it("llegar despacio exige quedarse más tiempo", () => {
    const step = run(path(300, 400, 2, 400, 1500));
    const entered = step.state.pending!.since;
    expect(step.fireAt).toBe(entered + EDGE_INTENT.slowDwell);
    expect(edgeIntentDue(step.state, entered + EDGE_INTENT.flickDwell)).toBe(false);
  });

  it("llegar en diagonal o bajando por el costado no cuenta", () => {
    expect(run(path(300, 100, 0, 700, 200)).fireAt).toBeNull();
    // Arranca lejos (queda armado), se acerca en diagonal y baja pegado al borde.
    const along = run([...path(400, 100, 30, 600, 900), ...path(30, 600, 4, 900, 600, 900)]);
    expect(along.fireAt).toBeNull();
  });

  it("irse del borde antes de tiempo cancela la espera", () => {
    const atEdge = run(path(600, 400, 0, 400, 160));
    const back = edgeIntentMove(atEdge.state, { x: 40, y: 400, t: 200 });
    expect(back.fireAt).toBeNull();
    expect(edgeIntentDue(back.state, 1000)).toBe(false);
  });

  it("deslizarse a lo largo del borde reinicia la espera, y más larga", () => {
    const atEdge = run(path(600, 400, 0, 400, 160));
    const sliding = edgeIntentMove(atEdge.state, { x: 0, y: 400 + EDGE_INTENT.drift + 1, t: 220 });
    expect(sliding.fireAt).toBe(220 + EDGE_INTENT.slowDwell);
    // Un temblor chico no la reinicia.
    const still = edgeIntentMove(atEdge.state, { x: 1, y: 405, t: 220 });
    expect(still.fireAt).toBe(atEdge.fireAt);
  });

  it("arranca desarmado: con el puntero ya en el borde no pasa nada", () => {
    expect(run([{ x: 0, y: 300, t: 0 }, { x: 2, y: 302, t: 400 }]).fireAt).toBeNull();
    // Un vaivén corto cerca del borde tampoco lo arma.
    expect(run([...path(0, 300, 60, 300, 100), ...path(60, 300, 0, 300, 100, 100)]).fireAt).toBeNull();
  });

  it("después de alejarse vuelve a estar disponible", () => {
    const away = run([...path(0, 300, 500, 300, 300), ...path(500, 300, 0, 300, 150, 300)]);
    expect(away.fireAt).not.toBeNull();
  });

  it("cancelar descarta el recorrido pero no desarma", () => {
    const atEdge = run(path(600, 400, 0, 400, 160));
    const cancelled = edgeIntentCancel(atEdge.state);
    expect(cancelled).toEqual({ trail: [], pending: null, armed: true });
    // Sin recorrido previo, seguir en el borde no dispara.
    expect(edgeIntentMove(cancelled, { x: 0, y: 400, t: 400 }).fireAt).toBeNull();
  });

  it("solo mira el recorrido reciente", () => {
    // Fue rápido hacia la izquierda, se detuvo a mitad de camino un rato largo y recién después llegó.
    const samples = [...path(900, 400, 200, 400, 150), { x: 200, y: 400, t: 1200 }, ...path(200, 400, 0, 400, 900, 1200)];
    const step = run(samples);
    expect(step.state.pending?.dwell).toBe(EDGE_INTENT.slowDwell);
  });
});
