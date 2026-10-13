"use client";

import { dehydrate, hydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";

/**
 * Copia en el dispositivo de lo último que se leyó (y de lo que se cambió sin conexión): con eso
 * la app abre y se puede usar aunque no haya red. Es una copia de la caché de TanStack Query,
 * guardada por usuario; al cerrar sesión se borra.
 */

/** Cambiar cuando cambie la forma de lo guardado: una copia de otra versión se ignora. */
const VERSION = 1;
const SAVE_DELAY_MS = 800;
/** Lo que se guarda: las tablas del usuario, su perfil y los feriados. No los .ics de calendarios vinculados (son grandes y se vuelven a bajar). */
const SKIPPED_KEYS = new Set(["feed-ics"]);

const storageKey = (userId: string) => `tilde-cache:${userId}`;
type Stored = { version: number; savedAt: number; state: DehydratedState };

function read(userId: string): Stored | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const stored = parsed as Partial<Stored>;
    if (stored.version !== VERSION || typeof stored.state !== "object" || stored.state === null) return null;
    return stored as Stored;
  } catch {
    return null;
  }
}

type RestoreOptions = {
  /** Clave del perfil y momento en que el servidor armó la página (el perfil llega con ella). */
  profileKey: readonly unknown[];
  serverNow: string;
  /** Hay cambios sin subir: lo guardado acá es más nuevo que cualquier cosa que traiga la página. */
  hasPending: boolean;
};

/** Carga en la caché lo guardado en el dispositivo. Devuelve false si no había nada. */
export function restoreCache(client: QueryClient, userId: string, { profileKey, serverNow, hasPending }: RestoreOptions): boolean {
  const stored = read(userId);
  if (!stored) return false;
  hydrate(client, stored.state);
  // Lo guardado sirve para mostrar algo ya (y para andar sin conexión), pero no cuenta como recién
  // leído: con red, cada pantalla lo vuelve a pedir al abrirse.
  void client.invalidateQueries({ predicate: (query) => JSON.stringify(query.queryKey) !== JSON.stringify(profileKey), refetchType: "none" });
  // El perfil viene con la página. Si la página salió de la copia sin conexión (es vieja), o hay
  // cambios del perfil sin subir, manda el perfil guardado en el dispositivo.
  const saved = stored.state.queries.find((query) => JSON.stringify(query.queryKey) === JSON.stringify(profileKey));
  const pageTime = Date.parse(serverNow);
  if (saved?.state.data !== undefined && (hasPending || saved.state.dataUpdatedAt > pageTime)) {
    client.setQueryData(profileKey, saved.state.data);
  }
  return true;
}

/** Guarda la caché cada vez que cambia (con una pequeña espera) y al ocultar o cerrar la pestaña. */
export function persistCache(client: QueryClient, userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let enabled = true;

  const save = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!enabled) return;
    try {
      const state = dehydrate(client, {
        shouldDehydrateQuery: (query) => query.state.status === "success" && !SKIPPED_KEYS.has(String(query.queryKey[0])),
        shouldDehydrateMutation: () => false,
      });
      localStorage.setItem(storageKey(userId), JSON.stringify({ version: VERSION, savedAt: Date.now(), state } satisfies Stored));
    } catch {
      // Sin lugar o sin permiso. Una copia vieja a medias es peor que ninguna: se borra y no se insiste.
      enabled = false;
      try {
        localStorage.removeItem(storageKey(userId));
      } catch {
        // Nada que hacer.
      }
    }
  };
  const schedule = () => {
    timer ??= setTimeout(save, SAVE_DELAY_MS);
  };
  const flush = () => {
    if (timer !== undefined) save();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" || event.type === "added" || event.type === "removed") schedule();
  });
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    unsubscribe();
    flush();
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Borra la copia de un usuario (al cerrar sesión) o la de todos (al llegar a la landing sin sesión). */
export function clearCache(userId?: string) {
  try {
    if (userId) return localStorage.removeItem(storageKey(userId));
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("tilde-cache:")) localStorage.removeItem(key);
    }
  } catch {
    // Sin almacenamiento no hay nada guardado.
  }
}
