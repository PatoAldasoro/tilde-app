import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { sessionCookies, userClient, type TestUser } from "../scripts/lib/test-session";
import { freezeToday, removeUser, signInFreshUser } from "./session";

/**
 * Accesibilidad automática (axe, WCAG 2.2 AA y buenas prácticas): la landing, privacidad y términos, cada
 * sección de la app y las superposiciones principales, en el teléfono y en el escritorio. No reemplaza probar
 * con un lector de pantalla, pero atrapa contraste, nombres, roles, títulos y tamaños de toque.
 */
let user: TestUser;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const PUBLIC = ["/", "/en", "/privacy", "/en/terms"];
const APP = ["/app", "/app?tab=grades", "/app/schedule", "/app/todo", "/app/calendar", "/app/study", "/app/study?tab=history"];

async function expectNoViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(summary, label).toEqual([]);
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  user = await signInFreshUser(context, "Usuaria Accesible");
  await context.close();
  const db = await userClient(user);
  const ok = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  const subjectId = ok(await db.from("subjects").insert({ name: "Física II", teacher: "Laura Benítez", credits: 8, color_key: "mandarina", grade_course: 8 }).select("id").single())!.id;
  ok(await db.from("schedule_blocks").insert({ subject_id: subjectId, weekday: 2, start_time: "14:00", end_time: "16:00", room: "Aula 110" }));
  ok(
    await db.from("calendar_events").insert([
      { subject_id: subjectId, category: "parcial", title: "", date: "2026-03-12", confirmed: true, lead_days: null },
      { subject_id: subjectId, category: "recuperatorio", title: "", date: "2026-03-20", confirmed: false, lead_days: null },
    ]),
  );
  ok(
    await db.from("tasks").insert([
      { title: "Resolver la guía 4", subject_id: subjectId, priority: "high", planned_date: "2026-03-10", sort_order: 1, completed_at: null },
      { title: "Leer el capítulo 2", subject_id: null, priority: "medium", planned_date: "2026-03-10", sort_order: 2, completed_at: "2026-03-10T12:00:00Z" },
    ]),
  );
  ok(await db.from("study_sessions").insert({ subject_id: subjectId, preset: "custom", started_at: "2026-03-09T18:00:00Z", ended_at: "2026-03-09T19:00:00Z", focus_seconds: 3000, break_seconds: 600, cycles_completed: 2 }));
});
test.afterAll(async () => removeUser(user));

for (const width of [390, 1366]) {
  test(`axe a ${width} px: landing, privacidad, términos y cada sección de la app`, async ({ browser }) => {
    test.setTimeout(240_000);
    const phone = width < 768;
    const context = await browser.newContext({
      viewport: { width, height: 860 },
      locale: "es-AR",
      timezoneId: "America/Argentina/Buenos_Aires",
      reducedMotion: "reduce",
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
    });
    await freezeToday(context);
    const page = await context.newPage();
    for (const path of PUBLIC) {
      await page.goto(baseURL + path);
      await expectNoViolations(page, `${path} a ${width}`);
    }
    await context.clearCookies();
    await context.addCookies((await sessionCookies(user)).map((cookie) => ({ ...cookie, url: baseURL })));
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of APP) {
        await page.goto(baseURL + path);
        await page.waitForSelector("h1");
        await page.waitForLoadState("networkidle");
        await expectNoViolations(page, `${path} (${theme}) a ${width}`);
      }
    }

    // Superposiciones: menú, Ajustes, el panel de una materia y el de una tarea.
    await page.goto(baseURL + "/app");
    await page.locator("#menu-btn").click();
    await expect(page.locator("#drawer")).toBeVisible();
    await expectNoViolations(page, `menú a ${width}`);
    await page.locator("#drawer").getByRole("button", { name: "Ajustes" }).click();
    await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
    await expectNoViolations(page, `Ajustes a ${width}`);
    await page.keyboard.press("Escape");
    await page.locator(".subject-card .card-open").first().click();
    await expect(page.locator(".sheet")).toBeVisible();
    await expectNoViolations(page, `panel de materia a ${width}`);
    await page.goto(baseURL + "/app/todo");
    await page.locator(".task-title").first().click();
    await expect(page.locator(".sheet")).toBeVisible();
    await expectNoViolations(page, `panel de tarea a ${width}`);
    await context.close();
  });
}
