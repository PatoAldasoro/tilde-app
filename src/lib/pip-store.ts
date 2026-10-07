"use client";

import { useSyncExternalStore } from "react";
import { PIP_FRAME } from "@/lib/pip-canvas";

/**
 * Timer flotante. Es la ventana de imagen en imagen de los videos del navegador: sin marco,
 * siempre encima de todo. El timer se dibuja en un canvas (`pip-canvas.ts`) que se transmite como
 * video. Si el navegador no tiene esa API o la rechaza, queda un recuadro flotante dentro de la
 * app, que acompaña al cambiar de sección.
 */

export type PipState = {
  /** El timer está en la ventana de imagen en imagen. */
  video: boolean;
  /** El recuadro flotante dentro de la app está activado. */
  floating: boolean;
};

let state: PipState = { video: false, floating: false };
let canvas: HTMLCanvasElement | null = null;
let video: HTMLVideoElement | null = null;
/** El video sigue al timer: en marcha o detenido, para que el botón de la ventana muestre lo que va a hacer. */
let playing = true;
let settle: ReturnType<typeof setTimeout> | null = null;
/** Lo que se espera a que el último cuadro llegue a la ventana antes de detener el video. */
const SETTLE_MS = 250;

/** Lo que pide la ventana con su botón de reproducir y pausar. */
export type PipControl = "play" | "pause";
let onControl: ((action: PipControl) => void) | null = null;
let closing: ReturnType<typeof setTimeout> | null = null;
/**
 * Al cerrar la ventana, el navegador primero detiene el video y enseguida avisa el cierre. Una
 * pausa del video recién se toma como "pausar el timer" si pasado este tiempo la ventana sigue ahí.
 */
const CLOSE_GRACE_MS = 400;
const listeners = new Set<() => void>();
const emit = (next: Partial<PipState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

function release() {
  if (settle) clearTimeout(settle);
  if (closing) clearTimeout(closing);
  settle = null;
  closing = null;
  playing = true;
  if (video) {
    (video.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    video.remove();
  }
  video = null;
  canvas = null;
}

const isVideoSupported = () =>
  typeof document !== "undefined" && document.pictureInPictureEnabled === true && "requestPictureInPicture" in HTMLVideoElement.prototype;

export const pipStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  /** ¿El navegador tiene ventana de imagen en imagen? */
  isVideoSupported,

  /**
   * Quién atiende el botón de reproducir y pausar de la ventana, en los navegadores donde ese botón
   * maneja el video directamente (en los demás llega por Media Session). Con null, la ventana no
   * maneja nada: si algo detiene el video, se lo vuelve a poner en marcha.
   */
  setControls(handler: ((action: PipControl) => void) | null) {
    onControl = handler;
  },

  /**
   * Pinta un cuadro nuevo en la ventana y deja el video en marcha o detenido, igual que el timer.
   * Un video detenido no muestra cuadros nuevos: se lo reanuda lo justo para que llegue este.
   */
  present(paint: (target: HTMLCanvasElement) => void, shouldPlay: boolean) {
    const player = video;
    if (!canvas || !player) return;
    paint(canvas);
    playing = shouldPlay;
    if (settle) clearTimeout(settle);
    settle = null;
    if (shouldPlay) {
      // Si el navegador lo acaba de detener, primero se resuelve si fue el botón de pausa o el cierre de la ventana.
      if (player.paused && !closing) void player.play().catch(() => undefined);
      return;
    }
    if (player.paused) void player.play().catch(() => undefined);
    settle = setTimeout(() => {
      settle = null;
      if (video === player && !playing) player.pause();
    }, SETTLE_MS);
  },

  /**
   * Abre el timer flotante. Hay que llamarlo desde un clic: el navegador lo exige.
   * `paint` dibuja el primer cuadro (el video necesita uno para arrancar).
   */
  async open(paint: (target: HTMLCanvasElement) => void) {
    if (!isVideoSupported()) return emit({ floating: true });
    if (state.video) return;
    try {
      const frame = document.createElement("canvas");
      frame.width = PIP_FRAME.width;
      frame.height = PIP_FRAME.height;
      paint(frame);
      const player = document.createElement("video");
      player.muted = true;
      player.playsInline = true;
      player.srcObject = frame.captureStream();
      // Tiene que estar en la página, pero no se ve: lo que se mira es la ventana flotante.
      player.setAttribute("aria-hidden", "true");
      player.className = "pip-source";
      document.body.append(player);
      canvas = frame;
      video = player;
      await player.play();
      await player.requestPictureInPicture();
      player.addEventListener("leavepictureinpicture", () => {
        release();
        emit({ video: false });
      });
      player.addEventListener("pause", () => {
        if (!playing) return; // lo detuvo present(), igual que el timer
        if (closing) clearTimeout(closing);
        closing = setTimeout(() => {
          closing = null;
          if (video !== player || document.pictureInPictureElement !== player || !player.paused || !playing) return;
          // La ventana sigue abierta: fue su botón de pausa.
          onControl?.("pause");
          // Si el timer no se pausó (un examen, o no había quién lo atienda), el reloj no puede quedar congelado.
          setTimeout(() => {
            if (video === player && playing && player.paused) void player.play().catch(() => undefined);
          }, SETTLE_MS);
        }, CLOSE_GRACE_MS);
      });
      player.addEventListener("play", () => {
        if (playing || settle) return; // lo puso en marcha present()
        onControl?.("play"); // el botón de reproducir de la ventana, con el timer en pausa
      });
      emit({ video: true, floating: false });
    } catch {
      // Sin permiso o sin soporte real: queda el recuadro dentro de la app.
      release();
      emit({ video: false, floating: true });
    }
  },

  close() {
    if (video && document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => undefined);
    release();
    emit({ video: false, floating: false });
  },
};

const SERVER: PipState = { video: false, floating: false };

export function usePip(): PipState {
  return useSyncExternalStore(pipStore.subscribe, pipStore.getSnapshot, () => SERVER);
}
