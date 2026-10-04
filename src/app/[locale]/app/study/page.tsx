import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StudyView } from "@/components/study/study-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_sessions") };
}

export default function Page() {
  return (
    <Suspense>
      <StudyView />
    </Suspense>
  );
}
