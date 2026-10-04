"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("scroll", listener, { passive: true });
  return () => window.removeEventListener("scroll", listener);
}

/** true cuando la página se desplazó: la barra superior muestra su borde. */
export function useScrolled(): boolean {
  return useSyncExternalStore(subscribe, () => window.scrollY > 4, () => false);
}
