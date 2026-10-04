"use client";

import type { ReactNode } from "react";
import { Empty } from "@/components/ui/empty";
import { PageFrame } from "./app-shell";

type SectionStubProps = { title: string; emptyTitle: string; emptyText?: string; icon: ReactNode; width?: "std" | "narrow" | "wide" };

/** Sección todavía sin contenido: marco + estado vacío. Se reemplaza al implementar cada fase. */
export function SectionStub({ title, emptyTitle, emptyText, icon, width }: SectionStubProps) {
  return (
    <PageFrame title={title} width={width}>
      <Empty icon={icon} title={emptyTitle} text={emptyText} />
    </PageFrame>
  );
}
