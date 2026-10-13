"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * false mientras React está hidratando el HTML del servidor (también en las partes que se
 * hidratan más tarde, detrás de un Suspense), true apenas termina. Lo que depende de datos que
 * solo existen en el navegador (lo guardado en el dispositivo) se muestra recién ahí: durante la
 * hidratación tiene que salir lo mismo que dibujó el servidor.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
