import { CalendarClock, CalendarDays, House, ListChecks, Timer, type LucideIcon } from "lucide-react";

type NavKey = "nav_home" | "nav_schedule" | "nav_tasks" | "nav_calendar" | "nav_sessions";

/** `short`: el nombre que entra en la barra de secciones del pie cuando el completo es largo. */
export const NAV_ITEMS: { id: string; href: string; icon: LucideIcon; label: NavKey; short?: "nav_sessions_short" }[] = [
  { id: "home", href: "/app", icon: House, label: "nav_home" },
  { id: "schedule", href: "/app/schedule", icon: CalendarClock, label: "nav_schedule" },
  { id: "tasks", href: "/app/todo", icon: ListChecks, label: "nav_tasks" },
  { id: "calendar", href: "/app/calendar", icon: CalendarDays, label: "nav_calendar" },
  { id: "sessions", href: "/app/study", icon: Timer, label: "nav_sessions", short: "nav_sessions_short" },
];

export function isNavActive(href: string, pathname: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}
