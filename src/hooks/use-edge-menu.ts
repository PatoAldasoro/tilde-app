"use client";

import { useEffect } from "react";
import { EDGE_INTENT_IDLE, edgeIntentCancel, edgeIntentDue, edgeIntentMove } from "@/lib/domain/edge-intent";

/** Con algo modal abierto (diálogo, menú, modo foco) el borde no abre nada. */
const BLOCKERS = '[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]';
/** Recién se escribió en un campo: el mouse pudo moverse sin querer. */
const TYPING_MS = 800;

/**
 * Abre el menú al llevar el mouse al borde izquierdo con intención (ver edge-intent.ts).
 * Solo mouse: en táctil no hay puntero que "llegue" al borde.
 */
export function useEdgeIntent(enabled: boolean, onIntent: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let state = EDGE_INTENT_IDLE;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastKey = -Infinity;

    const cancel = () => {
      clearTimeout(timer);
      state = edgeIntentCancel(state);
    };
    const check = () => {
      const now = performance.now();
      if (!edgeIntentDue(state, now)) return;
      state = { ...EDGE_INTENT_IDLE };
      if (!document.hasFocus() || now - lastKey < TYPING_MS || document.querySelector(BLOCKERS)) return;
      onIntent();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      // Con un botón apretado se está arrastrando o seleccionando texto.
      if (event.buttons !== 0) return cancel();
      const step = edgeIntentMove(state, { x: event.clientX, y: event.clientY, t: performance.now() });
      state = step.state;
      clearTimeout(timer);
      if (step.fireAt !== null) timer = setTimeout(check, Math.max(0, step.fireAt - performance.now()));
    };
    const onKey = (event: KeyboardEvent) => {
      // Solo cuenta escribir en un campo: Esc o un atajo no deberían frenar el gesto.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) {
        lastKey = performance.now();
      }
    };

    const root = document.documentElement;
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", onKey);
    // El puntero salió de la ventana: iba hacia otro lado.
    root.addEventListener("mouseleave", cancel);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", onKey);
      root.removeEventListener("mouseleave", cancel);
    };
  }, [enabled, onIntent]);
}

/** Margen a la derecha del menú dentro del cual todavía se considera "sobre el menú". */
const LEAVE_MARGIN = 56;
const LEAVE_MS = 320;

/**
 * Un menú que se abrió solo por el borde se cierra solo al alejar el mouse. Si se usa
 * (un clic adentro o el teclado), queda abierto como si se hubiera abierto con el botón.
 */
export function useAutoCloseOnLeave(active: boolean, elementId: string, onLeave: () => void, onUsed: () => void) {
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const width = document.getElementById(elementId)?.offsetWidth ?? 0;
      if (event.clientX <= width + LEAVE_MARGIN) return stop();
      timer ??= setTimeout(onLeave, LEAVE_MS);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (document.getElementById(elementId)?.contains(event.target as Node)) onUsed();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onUsed);
    return () => {
      stop();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onUsed);
    };
  }, [active, elementId, onLeave, onUsed]);
}
