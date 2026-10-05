/**
 * npm run screenshots
 *
 * Captura cada sección de la app con la cuenta demo, en claro y en oscuro, y deja las imágenes en
 * public/landing/ (las usa la landing). Son capturas reales de la app corriendo.
 *
 * Requisitos: Supabase local levantado, `npm run seed:demo` ya corrido y la app en marcha
 * (`npm run dev` o `npm run build && npm run start`). El login de Google no se puede automatizar:
 * la sesión se crea con scripts/lib/test-session.ts, que solo funciona en local o test.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { DEMO_CLOCK, DEMO_EMAIL, DEMO_PASSWORD, DEMO_TODAY } from "./lib/demo";
import { sessionCookies, userClient } from "./lib/test-session";

const BASE_URL = process.env.SCREENSHOTS_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "public", "landing");
/** Mismo tamaño que el marco de captura del diseño (16 : 9,4 a 1440 px). */
const VIEWPORT = { width: 1440, height: 846 };

type Shot = { name: string; path: string; ready: string; prepare?: (page: Page) => Promise<void> };

const SHOTS: Shot[] = [
  { name: "subjects", path: "/app", ready: ".subject-card" },
  { name: "schedule", path: "/app/schedule", ready: ".sched-block.is-skipped" },
  {
    name: "tasks",
    path: "/app/todo",
    ready: ".task",
    prepare: async (page) => {
      await page.locator(".expand-btn").nth(1).click();
    },
  },
  { name: "calendar", path: "/app/calendar", ready: ".ev.cat-feriado" },
  { name: "grades", path: "/app?tab=grades", ready: "table.grades" },
  {
    name: "sessions",
    path: "/app/study",
    ready: ".mini-task",
    prepare: async (page) => {
      // Una sesión de Física II en pleno foco: 25:00 → 18:24.
      await page.locator(".timer-card select").selectOption({ label: "Física II" });
      await page.locator(".timer-card .play-btn").click();
      await page.clock.fastForward("06:36");
      await page.waitForFunction(() => document.querySelector(".timer-card .timer-time")?.textContent?.startsWith("18:"));
    },
  },
];

async function main() {
  const reachable = await fetch(BASE_URL, { redirect: "manual" }).then(() => true, () => false);
  if (!reachable) throw new Error(`La app no responde en ${BASE_URL}. Levantarla con "npm run dev" y volver a correr.`);

  const user = { id: "", email: DEMO_EMAIL, password: DEMO_PASSWORD };
  const db = await userClient(user).catch(() => null);
  const subjects = db ? await db.from("subjects").select("id", { count: "exact", head: true }) : null;
  if (!subjects?.count) throw new Error('La cuenta demo no existe o está vacía. Correr primero "npm run seed:demo".');

  await mkdir(OUT_DIR, { recursive: true });
  const cookies = await sessionCookies(user);
  const browser = await chromium.launch();
  try {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        colorScheme: theme,
        locale: "es-AR",
        timezoneId: "America/Argentina/Buenos_Aires",
        reducedMotion: "reduce",
      });
      // El reloj del navegador queda en el "hoy" de la demo, así las capturas salen siempre iguales.
      await context.clock.install({ time: new Date(`${DEMO_TODAY}T${DEMO_CLOCK}:00-03:00`) });
      await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: BASE_URL })));
      const page = await context.newPage();

      for (const shot of SHOTS) {
        await page.goto(BASE_URL + shot.path);
        await page.waitForSelector(shot.ready);
        await shot.prepare?.(page);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState("networkidle");
        const file = path.join(OUT_DIR, `${shot.name}-${theme}.png`);
        await page.screenshot({ path: file });
        console.log(`✓ ${path.relative(process.cwd(), file)}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
