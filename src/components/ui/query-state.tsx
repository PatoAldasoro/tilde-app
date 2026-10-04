"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./button";

/** Aviso de error de carga con "Reintentar". */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="notice notice-danger" role="alert">
      <CircleAlert size={18} />
      <span className="grow">{t("load_error")}</span>
      <Button size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}

/** Bloques de carga con la forma aproximada del contenido. */
export function Skeletons({ count, className, label }: { count: number; className?: string; label?: string }) {
  const t = useTranslations();
  return (
    <div role="status" aria-label={label ?? t("loading")} className="contents">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`skeleton ${className ?? ""}`} />
      ))}
    </div>
  );
}
