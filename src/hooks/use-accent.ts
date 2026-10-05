"use client";

import { useSyncExternalStore } from "react";
import { ACCENT_STORAGE_KEY, toAccent, type Accent } from "@/lib/accent";

const listeners = new Set<() => void>();

function readAccent(): Accent {
  try {
    return toAccent(localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function applyAccent(accent: Accent) {
  if (accent) document.documentElement.dataset.accent = accent;
  else delete document.documentElement.dataset.accent;
}

/** Guarda el color de acento en el dispositivo y lo aplica en <html data-accent>. */
export function setAccentPreference(accent: Accent) {
  try {
    if (accent) localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    else localStorage.removeItem(ACCENT_STORAGE_KEY);
  } catch {
    // Sin almacenamiento (modo privado estricto): el acento vale para esta carga.
  }
  applyAccent(accent);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Otra pestaña cambió el acento.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ACCENT_STORAGE_KEY) return;
    applyAccent(readAccent());
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAccentPreference(): Accent {
  return useSyncExternalStore(subscribe, readAccent, () => null);
}
