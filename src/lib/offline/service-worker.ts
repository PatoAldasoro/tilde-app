"use client";

import { localePrefix, type Locale } from "@/i18n/routing";

/**
 * El service worker (`public/sw.js`) guarda las pantallas de la app y sus archivos, para que abran
 * sin conexión. Los datos no pasan por él: viven en la caché de consultas (`cache.ts`) y en la
 * cola de cambios (`outbox.ts`).
 */

const SECTIONS = ["/app", "/app/schedule", "/app/todo", "/app/calendar", "/app/study"];
const supported = () => typeof navigator !== "undefined" && "serviceWorker" in navigator;

function post(message: Record<string, unknown>) {
  if (!supported()) return;
  void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(message)).catch(() => undefined);
}

/**
 * Registra el service worker y le pide que deje guardadas todas las secciones, también las que
 * todavía no se abrieron. Solo en producción: en desarrollo guardaría versiones viejas del código,
 * así que ahí se quita el que haya quedado de una prueba anterior.
 */
export function registerServiceWorker(locale: string): (() => void) | undefined {
  if (!supported()) return;
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DISABLE_SW === "1") {
    void unregisterServiceWorker();
    return;
  }
  const prefix = localePrefix(locale as Locale);
  const paths = SECTIONS.map((path) => `${prefix}${path}`);
  let cancelled = false;
  const timer = setTimeout(() => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => {
        if (!cancelled && navigator.onLine) post({ type: "warm", paths });
      })
      .catch(() => undefined);
  }, 1500);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

async function unregisterServiceWorker() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("tilde-")).map((name) => caches.delete(name)));
    }
  } catch {
    // Sin permiso para tocar el almacenamiento: no hay nada que limpiar.
  }
}

/** Borra las pantallas guardadas: llevan datos de la cuenta (nombre, correo, preferencias). */
export async function purgeSavedPages() {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("tilde-pages")).map((name) => caches.delete(name)));
  } catch {
    // Sin permiso: nada guardado.
  }
}
