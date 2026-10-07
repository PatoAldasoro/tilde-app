"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { usePathname, useRouter } from "@/i18n/navigation";
import { playAlarm, playSound } from "@/lib/chime";
import { formatClock, isExam, remainingMs, type TimerEvent } from "@/lib/domain/timer";
import { pipStore } from "@/lib/pip-store";
import { studyStore, useStudy } from "@/lib/study-store";

type Translate = ReturnType<typeof useTranslations>;

/** Lo último que necesita el avance del timer para avisar (lo mantiene al día StudyTimerRunner). */
const latest: { t: Translate | null; push: ((path: string) => void) | null; pathname: string } = { t: null, push: null, pathname: "" };

/**
 * Avanza el timer hasta ahora y avisa los cambios de fase (sonido y toast). Lo llaman el
 * intervalo de la página y el de la ventana flotante: cuando la pestaña queda en segundo plano el
 * navegador le frena los timers, pero la ventana flotante sigue visible y los suyos no.
 */
export function advanceStudyTimer() {
  const events: TimerEvent[] = studyStore.tick();
  if (events.length === 0) return;
  const { setup } = studyStore.getSnapshot();
  if (setup.sound) playSound(setup.soundKind, setup.volume);
  const { t, push, pathname } = latest;
  if (!t) return;
  // Si pasaron varias fases de golpe (pestaña dormida), alcanza con avisar la última.
  const last = events[events.length - 1];
  if (last.type === "break-started") toast(t("break_started", { n: last.minutes }));
  else if (last.type === "focus-started") toast(t("focus_started", { n: last.cycle, total: last.cycles }));
  else if (pathname !== "/app/study") {
    toast(t("session_finished"), { action: { label: t("see_summary"), onAction: () => push?.("/app/study") } });
  }
}

/**
 * Mantiene vivo el timer en toda la app: lo avanza (aunque se esté en otra sección), avisa los
 * cambios de fase, muestra el tiempo restante en el título de la pestaña y, en modo examen,
 * registra las salidas de la página.
 */
export function StudyTimerRunner() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { timer, now } = useStudy();
  const active = timer.status === "active";
  const exam = timer.status === "active" && isExam(timer.config);
  const pageTitle = useRef<string | null>(null);
  const ownTitle = useRef<string | null>(null);
  useEffect(() => {
    latest.t = t;
    latest.push = (path) => router.push(path);
    latest.pathname = pathname;
  });

  useEffect(() => {
    if (!active) return;
    advanceStudyTimer();
    const interval = setInterval(advanceStudyTimer, 500);
    document.addEventListener("visibilitychange", advanceStudyTimer);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", advanceStudyTimer);
    };
  }, [active]);

  // Modo examen: el acento pasa al rojo de examen en toda la app mientras dura…
  useEffect(() => {
    if (!exam) return;
    document.documentElement.dataset.exam = "";
    return () => {
      delete document.documentElement.dataset.exam;
    };
  }, [exam]);

  // …y salir de la página (otra pestaña, otra ventana) queda anotado y suena la alarma.
  useEffect(() => {
    if (!exam) return;
    const onLeave = () => {
      // Usar los botones de la ventana flotante no es irse.
      if (pipStore.hasFocus()) return;
      if (!studyStore.leave()) return;
      const { setup } = studyStore.getSnapshot();
      if (setup.awayAlarm) playAlarm(setup.volume);
    };
    const onReturn = () => {
      if (document.hidden) return;
      const count = studyStore.comeBack();
      if (count !== null && latest.t) toast(latest.t("exam_away_toast", { n: count }));
    };
    const onVisibility = () => (document.hidden ? onLeave() : onReturn());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onLeave);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("focus", onReturn);
    };
  }, [exam]);

  // Título de la pestaña: "18:24 · Foco · Tilde" mientras hay una sesión; al terminar vuelve el de la página.
  useEffect(() => {
    if (timer.status !== "active") {
      if (pageTitle.current !== null && document.title === ownTitle.current) document.title = pageTitle.current;
      pageTitle.current = null;
      ownTitle.current = null;
      return;
    }
    const examMode = isExam(timer.config);
    const phase = examMode ? t("phase_exam") : timer.running ? t(timer.phase === "focus" ? "phase_focus" : "phase_break") : t("paused");
    const title = t("timer_title", { time: formatClock(remainingMs(timer, now), { hours: examMode }), phase });
    if (document.title !== ownTitle.current) pageTitle.current = document.title;
    document.title = title;
    ownTitle.current = title;
  });

  return null;
}
