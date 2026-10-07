"use client";

import { useSyncExternalStore } from "react";

/**
 * Timer flotante. Donde el navegador lo permite (Chrome, Edge) es una ventana propia siempre
 * visible, encima de cualquier otra cosa (Document Picture-in-Picture). Donde no, es un recuadro
 * flotante dentro de la app, que acompaña al cambiar de sección.
 */

type DocumentPictureInPicture = { requestWindow(options?: { width?: number; height?: number }): Promise<Window> };

const api = (): DocumentPictureInPicture | null =>
  typeof window !== "undefined" && "documentPictureInPicture" in window
    ? (window as unknown as { documentPictureInPicture: DocumentPictureInPicture }).documentPictureInPicture
    : null;

export type PipState = {
  /** La ventana flotante abierta, si hay. */
  window: Window | null;
  /** El recuadro flotante dentro de la app está activado. */
  floating: boolean;
};

let state: PipState = { window: null, floating: false };
const listeners = new Set<() => void>();
const emit = (next: Partial<PipState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

/** Atributos de <html> que definen el tema, el acento y el modo examen: la ventana flotante los copia. */
const MIRRORED = ["data-theme", "data-accent", "data-exam", "lang"];

function mirrorAttributes(target: Document) {
  for (const name of MIRRORED) {
    const value = document.documentElement.getAttribute(name);
    if (value === null) target.documentElement.removeAttribute(name);
    else target.documentElement.setAttribute(name, value);
  }
}

/** Copia las hojas de estilo de la app a la ventana nueva (es un documento vacío). */
function copyStyles(target: Document) {
  for (const node of Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))) {
    target.head.append(node.cloneNode(true));
  }
}

export const pipStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  /** ¿El navegador puede abrir una ventana flotante de verdad? */
  isWindowSupported: () => api() !== null,

  /** ¿La ventana flotante tiene el foco? (para no contar como "salir de la página" usar sus botones) */
  hasFocus: () => Boolean(state.window && !state.window.closed && state.window.document.hasFocus()),

  /** Abre el timer flotante. Hay que llamarlo desde un clic: el navegador lo exige. */
  async open(title: string) {
    const pip = api();
    if (!pip) return emit({ floating: true });
    if (state.window && !state.window.closed) return state.window.focus();
    try {
      const opened = await pip.requestWindow({ width: 340, height: 200 });
      opened.document.title = title;
      copyStyles(opened.document);
      mirrorAttributes(opened.document);
      opened.document.body.className = "pip-body";
      // Si cambia el tema o el acento con la ventana abierta, ella también.
      const observer = new MutationObserver(() => mirrorAttributes(opened.document));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: MIRRORED });
      opened.addEventListener("pagehide", () => {
        observer.disconnect();
        emit({ window: null });
      });
      emit({ window: opened, floating: false });
    } catch {
      // Sin permiso o cancelado: queda el recuadro dentro de la app.
      emit({ floating: true });
    }
  },

  close() {
    if (state.window && !state.window.closed) state.window.close();
    emit({ window: null, floating: false });
  },
};

const SERVER: PipState = { window: null, floating: false };

export function usePip(): PipState {
  return useSyncExternalStore(pipStore.subscribe, pipStore.getSnapshot, () => SERVER);
}
