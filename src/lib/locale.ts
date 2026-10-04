import { LOCALE_COOKIE, type Locale } from "@/i18n/routing";

/** Guarda el idioma elegido en la cookie que lee src/proxy.ts (un año). */
export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
