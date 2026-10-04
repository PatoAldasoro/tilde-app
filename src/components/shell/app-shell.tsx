"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";
import { Drawer } from "./drawer";
import { SettingsDialog } from "./settings-dialog";

type ShellValue = { drawerOpen: boolean; openDrawer: () => void; openSettings: () => void };

const ShellContext = createContext<ShellValue | null>(null);

/** Marco de la app con sesión: drawer de navegación y diálogo de Ajustes. */
export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const value = useMemo<ShellValue>(
    () => ({ drawerOpen, openDrawer: () => setDrawerOpen(true), openSettings: () => setSettingsOpen(true) }),
    [drawerOpen],
  );
  return (
    <ShellContext.Provider value={value}>
      {children}
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onOpenSettings={() => {
          setDrawerOpen(false);
          setSettingsOpen(true);
        }}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </ShellContext.Provider>
  );
}

type PageFrameProps = {
  title: string;
  /** std: 1200 px · narrow: 860 px (Tareas) · wide: ancho completo (Horario, Calendario). */
  width?: "std" | "narrow" | "wide";
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/** Barra superior fija (menú, título en serif, acciones) + contenido de la sección. */
export function PageFrame({ title, width = "std", sub, actions, children }: PageFrameProps) {
  const t = useTranslations();
  const shell = useContext(ShellContext);
  const scrolled = useScrolled();
  return (
    <div className="app" data-width={width}>
      <header className={cn("topbar", scrolled && "is-scrolled")}>
        <button
          type="button"
          id="menu-btn"
          className="btn btn-ghost btn-icon"
          aria-label={t("open_menu")}
          aria-haspopup="dialog"
          aria-expanded={shell?.drawerOpen ?? false}
          onClick={shell?.openDrawer}
        >
          <Menu size={22} />
        </button>
        <h1 className="topbar-title">{title}</h1>
        {sub ? <span className="topbar-sub">{sub}</span> : null}
        <div className="topbar-spacer" />
        <div className="topbar-actions">{actions}</div>
      </header>
      <main className={cn("page", width === "wide" && "page-wide", width === "narrow" && "page-narrow")} id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
