import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, localePrefix, routing, type Locale } from "@/i18n/routing";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const handleI18n = createIntlMiddleware(routing);

function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const [, first, ...others] = pathname.split("/");
  if (isLocale(first)) return { locale: first, rest: `/${others.join("/")}`.replace(/\/$/, "") || "/" };
  return { locale: null, rest: pathname.replace(/(.)\/$/, "$1") };
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale: pathLocale, rest } = splitLocale(pathname);

  // 1. Idioma elegido (cookie): las URL sin prefijo respetan la preferencia guardada.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!pathLocale && isLocale(cookieLocale) && cookieLocale !== routing.defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${cookieLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 2. Sesión: renueva el token si hace falta y deja las cookies listas para el render.
  type PendingCookie = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };
  const pending: PendingCookie[] = [];
  let signedIn = false;
  if (isSupabaseConfigured) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          pending.push(...list);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  // 3. Guardas: la app pide sesión; la landing con sesión lleva a la app.
  const prefix = localePrefix(pathLocale ?? routing.defaultLocale);
  const isApp = rest === "/app" || rest.startsWith("/app/");
  let response: NextResponse;
  if (isApp && !signedIn) {
    response = NextResponse.redirect(new URL(prefix || "/", request.url));
  } else if (rest === "/" && signedIn) {
    response = NextResponse.redirect(new URL(`${prefix}/app`, request.url));
  } else {
    response = handleI18n(request);
  }
  pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export const config = {
  // Todo menos API, auth, archivos internos de Next y archivos estáticos.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
