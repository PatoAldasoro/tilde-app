import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScheduleView } from "@/components/schedule/schedule-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_schedule") };
}

export default function Page() {
  return <ScheduleView />;
}
