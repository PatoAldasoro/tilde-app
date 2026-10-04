import { Timer } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SectionStub } from "@/components/shell/section-stub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_sessions") };
}

export default async function Page() {
  const t = await getTranslations();
  return <SectionStub title={t("nav_sessions")} emptyTitle={t("history_empty_title")} emptyText={t("history_empty_text")} icon={<Timer size={32} strokeWidth={1.75} />} width="std" />;
}
