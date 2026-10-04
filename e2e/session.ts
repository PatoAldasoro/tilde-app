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
