"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/segmented";
import { setThemePreference, useThemePreference } from "@/hooks/use-theme";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { writeLocaleCookie } from "@/lib/locale";
import type { ThemePreference } from "@/lib/theme";

type ThemeSegmentedProps = { onSaved?: (theme: ThemePreference) => void };

/** Selector de tema: claro, oscuro o sistema. */
export function ThemeSegmented({ onSaved }: ThemeSegmentedProps) {
  const t = useTranslations();
  const theme = useThemePreference();
  return (
    <Segmented
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

export function LocaleSegmented({ onSaved }: { onSaved?: (locale: Locale) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const switchLocale = useSwitchLocale(onSaved);
  return (
    <Segmented
      label={t("language")}
      value={locale}
      onChange={switchLocale}
      options={[
        { value: "es", label: "Español", lang: "es" },
        { value: "en", label: "English", lang: "en" },
      ]}
    />
  );
}
