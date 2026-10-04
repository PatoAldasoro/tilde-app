import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SectionStub } from "@/components/shell/section-stub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_tasks") };
}

export default async function Page() {
  const t = await getTranslations();
  return <SectionStub title={t("nav_tasks")} emptyTitle={t("tasks_empty_title")} emptyText={t("tasks_empty_text")} icon={<ListChecks size={32} strokeWidth={1.75} />} width="narrow" />;
}
