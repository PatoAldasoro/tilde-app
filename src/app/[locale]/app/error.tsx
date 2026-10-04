"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <main id="main" className="empty min-h-screen justify-center">
      <h1 className="empty-title">{t("error_title")}</h1>
      <p className="empty-text">{t("error_text")}</p>
      <Button variant="primary" onClick={reset}>
        {t("retry")}
      </Button>
    </main>
  );
}
