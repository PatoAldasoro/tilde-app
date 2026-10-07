"use client";

import { Maximize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { isExam } from "@/lib/domain/timer";
import { drawPipFrame } from "@/lib/pip-canvas";
import { pipStore, usePip } from "@/lib/pip-store";
import { studyStore, useStudy } from "@/lib/study-store";
import { MiniTimer, usePipModel } from "./timer-display";

/**
 * El timer flotante, en cualquiera de sus dos formas:
 * - la ventana de imagen en imagen del navegador (sin marco, siempre encima): acá se pinta cada
 *   cuadro del video y se conecta su botón de pausa;
 * - o, si el navegador no la tiene, un recuadro dentro de la app que aparece al salir de Sesiones
 *   con una sesión en curso.
 */
export function FloatingTimer() {
  const t = useTranslations();
  const pip = usePip();
  const pathname = usePathname();
  const { timer, setup, now } = useStudy();
  const model = usePipModel();
  const active = timer.status === "active" ? timer : null;
  const running = active?.running ?? false;
  // Un examen no se maneja desde la ventana flotante: pausarlo queda en el menú del reloj, y empezarlo
  // tiene que ser desde la app (pasa a pantalla completa). Ahí la ventana no muestra botón.
  const controllable = timer.status !== "finished" && !isExam(active ? active.config : setup.config);
  // El video va en marcha o detenido igual que el timer: así el botón de la ventana muestra lo que hace.
  const playing = running || !controllable;
  const frame = useRef({ model, playing });

  // Cada cambio de lo que se muestra es un cuadro nuevo; con el timer en pausa no hay ninguno.
  const { clock, phase, detail, fraction, tone } = model;
  useEffect(() => {
    const next = { clock, phase, detail, fraction, tone };
    frame.current = { model: next, playing };
    if (pip.video) pipStore.present((canvas) => drawPipFrame(canvas, next), playing);
  }, [pip.video, clock, phase, detail, fraction, tone, playing]);

  // Con el timer quieto no hay cuadros nuevos: si cambia el tema o el acento, se repinta igual.
  useEffect(() => {
    if (!pip.video) return;
    const observer = new MutationObserver(() => pipStore.present((canvas) => drawPipFrame(canvas, frame.current.model), frame.current.playing));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "data-exam"] });
    return () => observer.disconnect();
  }, [pip.video]);

  // El botón de reproducir y pausar de la ventana maneja el timer, no el video. Según el navegador
  // llega como acción de Media Session (que solo muestra el botón si están las dos) o como una pausa
  // del video mismo, que avisa `pipStore`.
  useEffect(() => {
    if (!pip.video || !controllable) return;
    const play = () => {
      const current = studyStore.getSnapshot().timer;
      if (current.status !== "active" || !current.running) studyStore.toggle();
    };
    const pause = () => studyStore.pause();
    pipStore.setControls((action) => (action === "pause" ? pause() : play()));
    const session = "mediaSession" in navigator ? navigator.mediaSession : null;
    session?.setActionHandler("play", play);
    session?.setActionHandler("pause", pause);
    return () => {
      pipStore.setControls(null);
      session?.setActionHandler("play", null);
      session?.setActionHandler("pause", null);
    };
  }, [pip.video, controllable]);

  useEffect(() => {
    if (!pip.video || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    return () => {
      navigator.mediaSession.playbackState = "none";
    };
  }, [pip.video, playing]);

  // Lo que se lee en los controles multimedia del sistema.
  useEffect(() => {
    if (!pip.video || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: `${model.phase} · ${model.detail}`, artist: "Tilde" });
  }, [pip.video, model.phase, model.detail]);

  if (pip.video || !pip.floating || pathname === "/app/study" || !active) return null;
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
