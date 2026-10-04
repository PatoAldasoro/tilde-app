import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { HomeView } from "@/components/home/home-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_home") };
}

export default function Page() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  );
}
