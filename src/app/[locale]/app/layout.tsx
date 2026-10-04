import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AppProviders, type SessionUser } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { redirect } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/** Todo /app pide sesión. Carga el usuario y su perfil una vez, en el servidor. */
export default async function AppLayout({ children, params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : routing.defaultLocale;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/", locale });

  let { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    // El trigger de la base crea el perfil al registrarse; esto cubre cuentas anteriores a la migración.
    const created = await supabase.from("profiles").insert({ user_id: user.id, locale }).select("*").single();
    profile = created.data;
  }
  if (!profile) throw new Error("No se pudo cargar el perfil");

  const meta = user.user_metadata ?? {};
  const sessionUser: SessionUser = {
    id: user.id,
    name: meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "Tilde",
    email: user.email ?? "",
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };

  return (
    <AppProviders user={sessionUser} profile={profile} serverNow={new Date().toISOString()}>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
