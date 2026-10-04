import { defineRouting } from "next-intl/routing";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // "/" y "/app" en español; "/en" y "/en/app" en inglés. La landing queda indexable en ambos.
  localePrefix: "as-needed",
  // Español por defecto: no se adivina el idioma por Accept-Language. La cookie la maneja src/proxy.ts.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}

/** Prefijo de URL del idioma: "" para español, "/en" para inglés. */
export function localePrefix(locale: Locale): string {
  return locale === routing.defaultLocale ? "" : `/${locale}`;
}
