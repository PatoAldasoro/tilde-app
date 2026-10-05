import type { MetadataRoute } from "next";
import { localePrefix, routing } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** La landing en ambos idiomas, cada una con sus alternativas hreflang. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (locale: (typeof routing.locales)[number]) => `${SITE_URL}${localePrefix(locale) || "/"}`;
  const languages = Object.fromEntries(routing.locales.map((locale) => [locale, url(locale)]));
  return routing.locales.map((locale) => ({
    url: url(locale),
    changeFrequency: "monthly",
    priority: locale === routing.defaultLocale ? 1 : 0.8,
    alternates: { languages },
  }));
}
