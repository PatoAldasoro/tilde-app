import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CalendarView } from "@/components/calendar/calendar-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_calendar") };
}

export default function Page() {
  return <CalendarView />;
}
