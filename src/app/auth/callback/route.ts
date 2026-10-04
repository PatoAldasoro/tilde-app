import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, localePrefix, routing, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/** Origen público de la app (detrás del proxy de Vercel llega en x-forwarded-host). */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.NODE_ENV === "production" && forwardedHost) {
    return `${request.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

/**
 * Vuelta del login con Google: cambia el código por la sesión (cookies) y lleva a la app
 * en el idioma del perfil. En el primer ingreso el perfil adopta el idioma de la landing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const hinted = searchParams.get("locale");
  const hintedLocale: Locale = isLocale(hinted) ? hinted : routing.defaultLocale;
  const failure = NextResponse.redirect(`${origin}${localePrefix(hintedLocale) || "/"}?error=auth`);

  const code = searchParams.get("code");
  if (!code) return failure;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failure;

  let locale: Locale = hintedLocale;
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale, created_at")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.from("profiles").insert({ user_id: data.user.id, locale });
  } else if (Date.now() - Date.parse(profile.created_at) < 120_000) {
    if (profile.locale !== locale) await supabase.from("profiles").update({ locale }).eq("user_id", data.user.id);
  } else if (isLocale(profile.locale)) {
    locale = profile.locale;
  }

  const response = NextResponse.redirect(`${origin}${localePrefix(locale)}/app`);
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  return response;
}
