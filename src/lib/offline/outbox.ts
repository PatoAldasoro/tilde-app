"use client";

import { useSyncExternalStore } from "react";
import {
  classifyFailure,
  compactOps,
  entryTables,
  parseOutbox,
  retryDelayMs,
  type OpFailure,
  type OutboxEntry,
  type WriteOp,
} from "@/lib/domain/outbox";
import { getSupabase } from "@/lib/supabase/client";

/**
 * La cola de cambios pendientes de este dispositivo (ver `domain/outbox.ts` para las reglas).
 *
 * - `enqueue` anota un cambio que ya se aplicó en la caché local.
 * - Con conexión, la cola se sube en orden, de a una entrada. Sin conexión (o si el servidor no
 *   responde) queda guardada en `localStorage` y se reintenta sola: al volver la red, al volver a
 *   la pestaña y con una espera que crece hasta un minuto.
 * - Mientras haya algo en la cola no se lee nada del servidor (`whenIdle`): lo que devolvería
 *   todavía no tiene esos cambios y pisaría lo que se ve en pantalla.
 */

/**
 * - idle: no hay nada pendiente.
 * - syncing: se está subiendo.
 * - offline: el dispositivo no tiene red; lo pendiente espera.
 * - waiting: hay red pero el servidor no respondió; se reintenta solo.
 */
export type SyncStatus = "idle" | "syncing" | "offline" | "waiting";
export type OutboxState = {
  pending: number;
  status: SyncStatus;
  online: boolean;
  /** Ya se cargó lo guardado en el dispositivo: recién ahí las pantallas leen datos. */
  ready: boolean;
};

export type SettledInfo = { synced: number; rejected: number; delayed: boolean };
type Handlers = {
  /** La cola quedó vacía: estas tablas se tienen que volver a leer. `info` dice qué pasó con lo pendiente. */
  onSettled: (tables: string[], info: SettledInfo) => void;
};

const storageKey = (userId: string) => `tilde-outbox:${userId}`;
const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

let userId: string | null = null;
let handlers: Handlers | null = null;
/** La cola en memoria: se usa si el navegador no deja guardar (modo privado estricto). */
let memory: OutboxEntry[] = [];
let storageWorks = true;
let state: OutboxState = { pending: 0, status: "idle", online: true, ready: false };
let draining = false;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
/** Operaciones ya subidas de la entrada en curso, para no repetirlas en un reintento. */
const progress = new Map<string, number>();
const touched = new Set<string>();
let tally = { synced: 0, rejected: 0, delayed: false };
const listeners = new Set<() => void>();
let idleWaiters: (() => void)[] = [];
let ready = false;
let readyWaiters: (() => void)[] = [];

function load(): OutboxEntry[] {
  if (!userId) return [];
  if (!storageWorks) return memory;
  try {
    return parseOutbox(localStorage.getItem(storageKey(userId)));
  } catch {
    storageWorks = false;
    return memory;
  }
}

function save(queue: OutboxEntry[]) {
  memory = queue;
  if (!userId || !storageWorks) return;
  try {
    if (queue.length === 0) localStorage.removeItem(storageKey(userId));
    else localStorage.setItem(storageKey(userId), JSON.stringify(queue));
  } catch {
    // Sin lugar o sin permiso: la cola sigue en memoria mientras la pestaña esté abierta.
    storageWorks = false;
  }
}

function emit(status: SyncStatus = state.status) {
  const pending = load().length;
  const online = isOnline();
  const next: SyncStatus = pending === 0 ? "idle" : status === "idle" ? (online ? "waiting" : "offline") : status;
  if (pending !== state.pending || next !== state.status || online !== state.online || ready !== state.ready) {
    state = { pending, status: next, online, ready };
    listeners.forEach((listener) => listener());
  }
  if (pending === 0 && idleWaiters.length > 0) {
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }
}

async function runOp(op: WriteOp): Promise<OpFailure | null> {
  try {
    const db = getSupabase();
    // El cliente tipado no admite un nombre de tabla genérico.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (name: string) => db.from(name as never) as any;
    const result: { error: { message?: string; code?: string } | null; status?: number } =
      op.kind === "insert"
        ? // Un alta repetida (un reintento de algo que sí había llegado) se ignora en vez de fallar.
          await table(op.table).upsert(op.rows, { onConflict: "id", ignoreDuplicates: true })
        : op.kind === "update"
          ? await table(op.table).update(op.patch).eq("id", op.id)
          : op.kind === "delete"
            ? await table(op.table).delete().in("id", op.ids)
            : op.kind === "task_order"
              ? await db.rpc("set_task_order", { task_ids: op.ids, sort_orders: op.orders })
              : await table("profiles").update(op.patch).eq("user_id", userId);
    if (!result.error) return null;
    return { status: result.status ?? 0, code: result.error.code ?? "", message: result.error.message ?? "" };
  } catch (error) {
    return { status: 0, code: "", message: error instanceof Error ? error.message : String(error) };
  }
}

async function runEntry(entry: OutboxEntry): Promise<OpFailure | null> {
  for (let index = progress.get(entry.id) ?? 0; index < entry.ops.length; index += 1) {
    const failure = await runOp(entry.ops[index]);
    if (failure) return failure;
    progress.set(entry.id, index + 1);
  }
  return null;
}

/** Una sola pestaña sube la cola a la vez (las demás esperan y encuentran la cola ya vacía). */
function exclusive(run: () => Promise<void>): Promise<void> {
  const name = `tilde-outbox:${userId}`;
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(name, run).then(() => undefined);
  return run();
}

function finish(entry: OutboxEntry) {
  save(load().filter((item) => item.id !== entry.id));
  progress.delete(entry.id);
  entry.tables.forEach((name) => touched.add(name));
}

async function drain() {
  if (draining || !userId) return;
  draining = true;
  clearTimeout(retryTimer);
  try {
    await exclusive(async () => {
      let refreshedSession = false;
      for (;;) {
        const entry = load()[0];
        if (!entry) break;
        if (!isOnline()) {
          tally.delayed = true;
          return emit("offline");
        }
        emit("syncing");
        const failure = await runEntry(entry);
        if (!failure) {
          finish(entry);
          tally.synced += 1;
          attempts = 0;
          continue;
        }
        const kind = classifyFailure(failure, isOnline());
        if (kind === "rejected") {
          finish(entry);
          // El servidor lo rechazó: se descarta y al terminar se relee lo que quedó.
          tally.rejected += 1;
          continue;
        }
        if (kind === "auth" && !refreshedSession) {
          refreshedSession = true;
          await getSupabase().auth.refreshSession().catch(() => undefined);
          continue;
        }
        // No se llegó al servidor: la entrada queda primera en la cola y se reintenta más tarde.
        attempts += 1;
        tally.delayed = true;
        retryTimer = setTimeout(kick, retryDelayMs(attempts));
        return emit(isOnline() ? "waiting" : "offline");
      }
      emit("idle");
      if (touched.size > 0 || tally.synced > 0 || tally.rejected > 0) {
        const tables = [...touched];
        const info = tally;
        touched.clear();
        tally = { synced: 0, rejected: 0, delayed: false };
        handlers?.onSettled(tables, info);
      }
    });
  } finally {
    draining = false;
  }
}

function kick() {
  void drain();
}

function onConnectivity() {
  attempts = 0;
  emit(isOnline() ? state.status : "offline");
  if (isOnline()) kick();
}

function onVisible() {
  if (document.visibilityState === "visible" && state.pending > 0) kick();
}

function onStorage(event: StorageEvent) {
  // Otra pestaña anotó o subió cambios.
  if (userId && event.key === storageKey(userId)) {
    emit();
    kick();
  }
}

export const outbox = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  /** Arranca la cola de este usuario: carga lo que haya quedado guardado y empieza a subirlo. */
  start(user: string, next: Handlers): () => void {
    userId = user;
    handlers = next;
    memory = [];
    storageWorks = true;
    window.addEventListener("online", onConnectivity);
    window.addEventListener("offline", onConnectivity);
    window.addEventListener("focus", onVisible);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    ready = true;
    emit(isOnline() ? "waiting" : "offline");
    const waiters = readyWaiters;
    readyWaiters = [];
    waiters.forEach((resolve) => resolve());
    kick();
    return () => {
      clearTimeout(retryTimer);
      window.removeEventListener("online", onConnectivity);
      window.removeEventListener("offline", onConnectivity);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      handlers = null;
    };
  },

  /** Cuántos cambios de ese usuario quedaron guardados sin subir (se puede consultar antes de `start`). */
  pendingFor(user: string): number {
    try {
      return parseOutbox(localStorage.getItem(storageKey(user))).length;
    } catch {
      return 0;
    }
  },

  /** Anota un cambio que ya se aplicó en pantalla. `alsoRefetch`: tablas que cambian en el servidor por cascada. */
  enqueue(ops: readonly (WriteOp | null | false | undefined)[], alsoRefetch: readonly string[] = []) {
    const list = compactOps(ops);
    if (list.length === 0) return;
    save([...load(), { id: crypto.randomUUID(), createdAt: Date.now(), ops: list, tables: entryTables(list, alsoRefetch) }]);
    emit(isOnline() ? "syncing" : "offline");
    kick();
  },

  /** Se resuelve cuando la app ya cargó lo guardado en el dispositivo y la cola está vacía. */
  async whenIdle(): Promise<void> {
    if (!ready) await new Promise<void>((resolve) => readyWaiters.push(resolve));
    if (load().length === 0) return;
    await new Promise<void>((resolve) => idleWaiters.push(resolve));
  },

  /** Reintentar ya (el botón del aviso de sincronización). */
  retry() {
    attempts = 0;
    kick();
  },

  /** Descarta lo pendiente (al cerrar sesión). */
  clear() {
    clearTimeout(retryTimer);
    progress.clear();
    touched.clear();
    save([]);
    emit("idle");
  },
};

const SERVER_STATE: OutboxState = { pending: 0, status: "idle", online: true, ready: false };

export function useOutbox(): OutboxState {
  return useSyncExternalStore(outbox.subscribe, outbox.getSnapshot, () => SERVER_STATE);
}
