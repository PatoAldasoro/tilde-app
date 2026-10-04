import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SectionStub } from "@/components/shell/section-stub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_home") };
}

export default async function Page() {
  const t = await getTranslations();
  return <SectionStub title={t("nav_home")} emptyTitle={t("first_run_title")} emptyText={t("first_run_text")} icon={<BookOpen size={32} strokeWidth={1.75} />} />;
}
