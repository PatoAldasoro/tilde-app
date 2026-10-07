"use client";

import { Maximize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/navigation";
import { pipStore, usePip } from "@/lib/pip-store";
import { useStudy } from "@/lib/study-store";
import { MiniTimer } from "./timer-display";
import { advanceStudyTimer } from "./timer-runner";

/**
 * El timer flotante, en cualquiera de sus dos formas:
 * - una ventana propia siempre visible (Chrome y Edge), dibujada desde acá con un portal;
 * - o un recuadro dentro de la app, que aparece al salir de Sesiones con una sesión en curso.
 */
export function FloatingTimer() {
  const t = useTranslations();
  const pip = usePip();
  const pathname = usePathname();
  const { timer, setup, now } = useStudy();

  // La pestaña en segundo plano tiene los timers frenados; la ventana flotante, no: el reloj lo mueve ella.
  useEffect(() => {
    const target = pip.window;
    if (!target) return;
    const interval = target.setInterval(advanceStudyTimer, 500);
    return () => target.clearInterval(interval);
  }, [pip.window]);

  if (pip.window) return createPortal(<MiniTimer timer={timer} config={setup.config} now={now} />, pip.window.document.body);

  if (!pip.floating || pathname === "/app/study" || timer.status !== "active") return null;
  return (
    <aside className="floating-timer" aria-label={t("floating_timer")}>
      <MiniTimer timer={timer} config={setup.config} now={now} />
      <div className="floating-timer-actions">
        <Link href="/app/study" className="btn btn-ghost btn-icon btn-sm" aria-label={t("floating_timer_open")} title={t("floating_timer_open")}>
          <Maximize2 size={16} />
        </Link>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("floating_timer_close")} title={t("floating_timer_close")} onClick={() => pipStore.close()}>
          <X size={16} />
        </button>
      </div>
    </aside>
  );
}
