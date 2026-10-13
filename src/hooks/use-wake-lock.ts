"use client";

import { useEffect } from "react";

/**
 * Mantiene la pantalla encendida mientras `active` (Screen Wake Lock): el equipo no la apaga ni
 * la bloquea por inactividad. El navegador suelta el permiso solo cuando la pestaña deja de verse;
 * al volver se pide de nuevo. Donde la API no existe, o el sistema la niega (ahorro de batería),
 * no pasa nada: la sesión sigue igual.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let pending = false;
    let stopped = false;

    const acquire = async () => {
      if (stopped || pending || sentinel || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (stopped) return void lock.release().catch(() => undefined);
        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Sin permiso: se vuelve a intentar la próxima vez que la pestaña pase al frente.
      } finally {
        pending = false;
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
