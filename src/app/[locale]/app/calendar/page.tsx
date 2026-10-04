import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SectionStub } from "@/components/shell/section-stub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_calendar") };
}

export default async function Page() {
  const t = await getTranslations();
  return <SectionStub title={t("nav_calendar")} emptyTitle={t("nav_calendar")} emptyText={t("cal_empty")} icon={<CalendarDays size={32} strokeWidth={1.75} />} width="wide" />;
}
