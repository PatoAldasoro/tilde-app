/**
 * Sesiones de prueba para e2e, seed y screenshots. El login de Google no se puede automatizar,
 * así que se crea un usuario con email y contraseña usando el service role de Supabase.
 *
 * SOLO para entorno local o de test: se niega a correr en producción y, salvo que se pida
 * explícitamente (TILDE_ALLOW_REMOTE_TEST=1, para un proyecto de test dedicado), contra
 * cualquier Supabase que no sea el local.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { loadEnv, requireEnv } from "./env";

export type TestUser = { id: string; email: string; password: string };
export type SessionCookie = { name: string; value: string };

function assertSafeEnvironment(url: string) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Las sesiones de prueba no se pueden usar en producción.");
  }
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
  if (!isLocal && process.env.TILDE_ALLOW_REMOTE_TEST !== "1") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL (${url}) no es el Supabase local. Para un proyecto de test dedicado, exportar TILDE_ALLOW_REMOTE_TEST=1.`,
    );
  }
}

export function supabaseEnv() {
  loadEnv();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  assertSafeEnvironment(url);
  return { url, anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY") };
}

/** Cliente con service role: saltea RLS. Solo para preparar datos de prueba. */
export function adminClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = supabaseEnv();
  return createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Crea el usuario si no existe (o le actualiza la contraseña) y devuelve sus credenciales. */
export async function ensureTestUser(email: string, password: string, fullName: string): Promise<TestUser> {
  const admin = adminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.data.user) return { id: created.data.user.id, email, password };

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const existing = data.users.find((user) => user.email === email);
  if (!existing) throw created.error ?? new Error(`No se pudo crear ${email}`);
  await admin.auth.admin.updateUserById(existing.id, { password, user_metadata: { full_name: fullName } });
  return { id: existing.id, email, password };
}

export async function deleteTestUser(id: string) {
  await adminClient().auth.admin.deleteUser(id);
}

/** Cliente autenticado como el usuario (pasa por RLS, igual que el navegador). */
export async function userClient(user: TestUser): Promise<SupabaseClient<Database>> {
  const { url, anonKey } = supabaseEnv();
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

/** Inicia sesión y devuelve las cookies que espera @supabase/ssr, para inyectarlas en Playwright. */
export async function sessionCookies(user: TestUser): Promise<SessionCookie[]> {
  const { url, anonKey } = supabaseEnv();
  const jar = new Map<string, string>();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value }));
}
