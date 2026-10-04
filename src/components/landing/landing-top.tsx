"use client";

import { Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { GoogleButton } from "@/components/google-button";
import { Logo } from "@/components/logo";
import { useSwitchLocale } from "@/components/shell/preferences";
import { toast } from "@/components/ui/toast";
import { useScrolled } from "@/hooks/use-scrolled";
import { setThemePreference } from "@/hooks/use-theme";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Avisa si el login volvió con error (/?error=auth). */
function AuthErrorNotice() {
  const t = useTranslations();
  const error = useSearchParams().get("error");
  useEffect(() => {
    if (error) toast(t("auth_error"));
  }, [error, t]);
  return null;
}

/** Barra superior fija de la landing: logo, idioma, tema y "Continuar con Google". */
export function LandingTop() {
  const t = useTranslations();
  const locale = useLocale();
  const scrolled = useScrolled();
  const switchLocale = useSwitchLocale();

  return (
    <header className={cn("landing-top", scrolled && "is-scrolled")}>
      <Link href="/" className="logo-link text-inherit" aria-label="Tilde">
        <Logo size={30} />
      </Link>
      <span className="grow" />
      <label className="visually-hidden" htmlFor="landing-lang">
        {t("language")}
      </label>
      <select
        id="landing-lang"
        className="select lang-select w-auto"
        value={locale}
        onChange={(event) => switchLocale(event.target.value as Locale)}
      >
        <option value="es" lang="es">
          Español
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={t("toggle_theme")}
        data-tip={t("toggle_theme")}
        data-tip-pos="bottom"
        onClick={() => setThemePreference(document.documentElement.dataset.theme === "dark" ? "light" : "dark")}
      >
        <Moon size={20} className="theme-icon-light" />
        <Sun size={20} className="theme-icon-dark" />
      </button>
      <GoogleButton />
      <Suspense>
        <AuthErrorNotice />
      </Suspense>
    </header>
  );
}
