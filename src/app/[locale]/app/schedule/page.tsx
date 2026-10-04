import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SectionStub } from "@/components/shell/section-stub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_schedule") };
}

export default async function Page() {
  const t = await getTranslations();
  return <SectionStub title={t("nav_schedule")} emptyTitle={t("sched_empty_title")} emptyText={t("sched_empty_text")} icon={<CalendarClock size={32} strokeWidth={1.75} />} width="wide" />;
}
