"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/segmented";
import { setThemePreference, useThemePreference } from "@/hooks/use-theme";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, routing, type Locale } from "@/i18n/routing";
import { writeLocaleCookie } from "@/lib/locale";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeSegmentedProps = { onSaved?: (theme: ThemePreference) => void; className?: string };

/** Selector de tema: claro, oscuro o sistema. */
export function ThemeSegmented({ onSaved, className }: ThemeSegmentedProps) {
  const t = useTranslations();
  const theme = useThemePreference();
  return (
    <Segmented
      className={className}
      label={t("theme")}
      value={theme}
      onChange={(next) => {
        setThemePreference(next);
        onSaved?.(next);
      }}
      options={[
        { value: "light", label: t("theme_light"), icon: <Sun size={16} /> },
        { value: "dark", label: t("theme_dark"), icon: <Moon size={16} /> },
        { value: "system", label: t("theme_system"), icon: <Monitor size={16} /> },
      ]}
    />
  );
}

/** Cambia de idioma: cookie + misma página con el otro prefijo. */
export function useSwitchLocale(onSaved?: (locale: Locale) => void) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useLocale();
  return (next: Locale) => {
    if (next === current) return;
    writeLocaleCookie(next);
    onSaved?.(next);
    router.replace(pathname, { locale: next });
  };
}

type LocaleSelectProps = { id: string; className?: string; onSaved?: (locale: Locale) => void };

/** Selector de idioma: una lista desplegable con todos los idiomas de la app. */
export function LocaleSelect({ id, className, onSaved }: LocaleSelectProps) {
  const locale = useLocale();
  const switchLocale = useSwitchLocale(onSaved);
  return (
    <select id={id} className={cn("select", className)} value={locale} onChange={(event) => switchLocale(event.target.value as Locale)}>
      {routing.locales.map((code) => (
        <option key={code} value={code} lang={code}>
          {LOCALE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
