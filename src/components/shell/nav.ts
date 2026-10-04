import { CalendarClock, CalendarDays, House, ListChecks, Timer, type LucideIcon } from "lucide-react";

type NavKey = "nav_home" | "nav_schedule" | "nav_tasks" | "nav_calendar" | "nav_sessions";

export const NAV_ITEMS: { id: string; href: string; icon: LucideIcon; label: NavKey }[] = [
  { id: "home", href: "/app", icon: House, label: "nav_home" },
  { id: "schedule", href: "/app/schedule", icon: CalendarClock, label: "nav_schedule" },
  { id: "tasks", href: "/app/todo", icon: ListChecks, label: "nav_tasks" },
  { id: "calendar", href: "/app/calendar", icon: CalendarDays, label: "nav_calendar" },
  { id: "sessions", href: "/app/study", icon: Timer, label: "nav_sessions" },
];

export function isNavActive(href: string, pathname: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}
