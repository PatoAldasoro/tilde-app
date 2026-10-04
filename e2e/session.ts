import type { BrowserContext } from "@playwright/test";
import { adminClient, deleteTestUser, ensureTestUser, sessionCookies, type TestUser } from "../scripts/lib/test-session";

const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

/** Crea un usuario de prueba nuevo (datos vacíos) y deja la sesión iniciada en el contexto. */
export async function signInFreshUser(context: BrowserContext, name = "Usuaria E2E"): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@tilde.test`;
  const user = await ensureTestUser(email, "e2e-password-123", name);
  const cookies = await sessionCookies(user);
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: baseURL })));
  return user;
}

export async function removeUser(user: TestUser | undefined) {
  if (user) await deleteTestUser(user.id);
}

export { adminClient };

/** "Hoy" fijo para los tests: martes 10/03/2026, 15:00 en Buenos Aires. Siempre en el pasado real. */
export const TEST_NOW = new Date("2026-03-10T15:00:00-03:00");
export const TEST_TODAY = "2026-03-10";

/** Fija el reloj del navegador (el tiempo sigue corriendo desde ahí). */
export async function freezeToday(context: BrowserContext) {
  await context.clock.install({ time: TEST_NOW });
}
