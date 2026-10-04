"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { usePathname, useRouter } from "@/i18n/navigation";
import { playChime } from "@/lib/chime";
import { formatClock, remainingMs, type TimerEvent } from "@/lib/domain/timer";
import { studyStore, useStudy } from "@/lib/study-store";

/**
 * Mantiene vivo el timer en toda la app: lo avanza (aunque se esté en otra sección), avisa los
 * cambios de fase con sonido y toast, y muestra el tiempo restante en el título de la pestaña.
 */
export function StudyTimerRunner() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { timer, setup, now } = useStudy();
  const active = timer.status === "active";
  const pageTitle = useRef<string | null>(null);
  const ownTitle = useRef<string | null>(null);
  const latest = useRef({ t, router, pathname, sound: setup.sound });
  useEffect(() => {
    latest.current = { t, router, pathname, sound: setup.sound };
  });

  useEffect(() => {
    if (!active) return;
    const advance = () => {
      const events: TimerEvent[] = studyStore.tick();
      if (events.length === 0) return;
      const { t: translate, router: navigation, pathname: path, sound } = latest.current;
      if (sound) playChime();
      // Si pasaron varias fases de golpe (pestaña dormida), alcanza con avisar la última.
      const last = events[events.length - 1];
      if (last.type === "break-started") toast(translate("break_started", { n: last.minutes }));
      else if (last.type === "focus-started") toast(translate("focus_started", { n: last.cycle, total: last.cycles }));
      else if (path !== "/app/study") {
        toast(translate("session_finished"), {
          action: { label: translate("see_summary"), onAction: () => navigation.push("/app/study") },
        });
      }
    };
    advance();
    const interval = setInterval(advance, 500);
    document.addEventListener("visibilitychange", advance);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", advance);
    };
  }, [active]);

  // Título de la pestaña: "18:24 · Foco · Tilde" mientras hay una sesión; al terminar vuelve el de la página.
  useEffect(() => {
    if (timer.status !== "active") {
      if (pageTitle.current !== null && document.title === ownTitle.current) document.title = pageTitle.current;
      pageTitle.current = null;
      ownTitle.current = null;
      return;
    }
    const phase = timer.running ? t(timer.phase === "focus" ? "phase_focus" : "phase_break") : t("paused");
    const title = t("timer_title", { time: formatClock(remainingMs(timer, now)), phase });
    if (document.title !== ownTitle.current) pageTitle.current = document.title;
    document.title = title;
    ownTitle.current = title;
  });

  return null;
}
