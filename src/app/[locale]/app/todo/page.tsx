import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TasksView } from "@/components/tasks/tasks-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_tasks") };
}

export default function Page() {
  return <TasksView />;
}
