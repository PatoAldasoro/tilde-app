"use client";

import { CloudAlert, CloudOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { outbox, useOutbox } from "@/lib/offline/outbox";
import { cn } from "@/lib/utils";

/**
 * Aviso del estado de la sincronización, en la barra superior. Con conexión y todo subido no se ve.
 * Aparece sin conexión, mientras se sube algo que tarda y si lo pendiente quedó esperando al servidor.
 */
export function SyncStatus() {
  const t = useTranslations();
  const { pending, status, online } = useOutbox();
  if (online && pending === 0) return null;

  const kind = !online ? "offline" : status === "syncing" ? "syncing" : "waiting";
  const title = t(kind === "offline" ? "sync_offline" : kind === "syncing" ? "sync_syncing" : "sync_waiting");
  const text = t(kind === "offline" ? "sync_offline_text" : kind === "syncing" ? "sync_syncing_text" : "sync_waiting_text");
  const Icon = kind === "offline" ? CloudOff : kind === "syncing" ? RefreshCw : CloudAlert;
  const count = pending > 0 ? t("sync_pending", { n: pending }) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn("sync-pill", `is-${kind}`)} aria-label={count ? `${title}. ${count}` : title}>
          <Icon size={16} className={kind === "syncing" ? "spin" : undefined} />
          <span className="sync-pill-label">{title}</span>
          {pending > 0 ? <span className="sync-pill-count tnum">{pending}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="popover-pad sync-pop" align="end">
        <strong className="text-body-s">{title}</strong>
        <p className="field-hint">{text}</p>
        {count ? <p className="text-body-s">{count}</p> : null}
        {online && pending > 0 && kind !== "syncing" ? (
          <Button size="sm" className="self-start" onClick={() => outbox.retry()}>
            <RefreshCw size={16} />
            {t("sync_retry")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
