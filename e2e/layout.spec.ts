import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

/**
 * Revisión de layout: cada sección desde el teléfono más angosto (320 px) hasta el escritorio
 * (1440 px), en español y en inglés (que ocupa un 20–30 % más), con nombres largos. No tiene que
 * haber scroll horizontal y el botón de menú tiene que quedar arriba a la izquierda.
 */
let user: TestUser;
let db: SupabaseClient<Database>;

const SECTIONS = [
  { path: "/app", ready: ".subject-card" },
  { path: "/app?tab=grades", ready: "table.grades" },
  { path: "/app/schedule", ready: ".sched-block" },
  { path: "/app/todo", ready: ".task" },
  // En el teléfono las fechas de la grilla son puntos: las que se leen están en la lista del mes.
  { path: "/app/calendar", ready: ".ev:visible" },
  { path: "/app/study", ready: ".mini-task" },
  { path: "/app/study?tab=history", ready: ".session-table" },
];

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  user = await signInFreshUser(context, "Persona Con Un Nombre Bastante Largo");
  await context.close();
  db = await userClient(user);
  const long = "Diseño y Procesamiento de Documentos XML con un Nombre Muy Largo";
  const subjects = await db
    .from("subjects")
    .insert([
      { name: long, commission: "Comisión 12 turno noche", teacher: "María de los Ángeles Fernández Etcheverry", term_year: 2026, term_period: 1, credits: 8, color_key: "uva", grade_course: 8.5, grade_final: 9.25, archived_at: null },
      { name: "Programación Orientada a Objetos", commission: "Com. 1", teacher: "Diego Salvatierra", term_year: 2026, term_period: 1, credits: 8, color_key: "pino", grade_course: null, grade_final: null, archived_at: null },
      { name: "Álgebra", commission: null, teacher: null, term_year: 2025, term_period: 2, credits: 6, color_key: "frambuesa", grade_course: 7, grade_final: 8, archived_at: "2026-01-10T12:00:00Z" },
    ])
    .select("id, name");
  const [xml, poo] = [subjects.data!.find((s) => s.name === long)!.id, subjects.data!.find((s) => s.name.startsWith("Programación"))!.id];
  await db.from("schedule_blocks").insert([
    { subject_id: xml, weekday: 2, start_time: "14:00", end_time: "16:00", room: "Laboratorio de computación 3" },
    { subject_id: poo, weekday: 2, start_time: "14:30", end_time: "17:00", room: "Aula 210" },
    { subject_id: poo, weekday: 2, start_time: "15:00", end_time: "16:30", room: "Aula 12" },
  ]);
  const tp = await db
    .from("calendar_events")
    .insert([
      { subject_id: xml, category: "tp", title: "Trabajo práctico integrador con un título larguísimo", date: "2026-03-12", confirmed: true, lead_days: 5 },
      { subject_id: poo, category: "final", title: "", date: "2026-03-12", confirmed: true, lead_days: null },
      { subject_id: xml, category: "recuperatorio", title: "", date: "2026-03-12", confirmed: false, lead_days: null },
      { subject_id: poo, category: "parcial", title: "", date: "2026-03-12", confirmed: true, lead_days: null },
    ])
    .select("id, category");
  const task = await db
    .from("tasks")
    .insert([
      { title: "Entregar el trabajo práctico integrador de transformaciones XSLT con todas sus partes y el informe final", subject_id: xml, priority: "high", planned_date: null, due_date: "2026-03-12", lead_days: 5, sort_order: 1, source_calendar_event_id: tp.data!.find((e) => e.category === "tp")!.id },
      { title: "Leer el capítulo 4", subject_id: poo, priority: "medium", planned_date: "2026-03-08", due_date: null, lead_days: null, sort_order: 2, source_calendar_event_id: null },
    ])
    .select("id");
  await db.from("subtasks").insert([{ task_id: task.data![0].id, title: "Una subtarea con un nombre extenso para ver cómo corta", sort_order: 1 }]);
  await db.from("study_sessions").insert([
    { subject_id: xml, preset: "custom", started_at: "2026-03-09T18:00:00Z", ended_at: "2026-03-09T20:30:00Z", focus_seconds: 7500, break_seconds: 1200, cycles_completed: 3 },
  ]);
});
test.afterAll(async () => removeUser(user));

async function expectNoOverflow(page: Page, label: string, width: number) {
  // La página mide lo que la pantalla. En un teléfono, algo que se pasa del borde no muestra una barra:
  // agranda la página entera, así que no alcanza con comparar contra window.innerWidth.
  const [inner, scroll] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
  expect(inner, `ancho de la página en ${label}`).toBe(width);
  expect(scroll, `scroll horizontal en ${label}`).toBeLessThanOrEqual(width);
  const menu = await page.locator("#menu-btn").boundingBox();
  expect(menu, `botón de menú en ${label}`).not.toBeNull();
  expect(menu!.x).toBeLessThan(48);
  expect(menu!.y).toBeLessThan(24);
  expect(menu!.width).toBeGreaterThanOrEqual(40);
  expect(menu!.height).toBeGreaterThanOrEqual(40);
}

for (const locale of ["es", "en"] as const) {
  for (const width of [320, 360, 390, 600, 768, 1024, 1366, 1440]) {
    test(`layout ${locale} a ${width} px: sin scroll horizontal en ninguna sección`, async ({ browser }) => {
      const phone = width < 1024;
      const context = await browser.newContext({
        viewport: { width, height: phone ? 780 : 800 },
        locale: "es-AR",
        timezoneId: "America/Argentina/Buenos_Aires",
        ...(phone ? { hasTouch: true, isMobile: true } : {}),
      });
      await freezeToday(context);
      const { sessionCookies } = await import("../scripts/lib/test-session");
      const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
      await context.addCookies((await sessionCookies(user)).map((cookie) => ({ ...cookie, url: baseURL })));
      const page = await context.newPage();
      const prefix = locale === "en" ? "/en" : "";
      for (const section of SECTIONS) {
        await page.goto(baseURL + prefix + section.path);
        await page.waitForSelector(section.ready);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expectNoOverflow(page, `${locale} ${width} ${section.path}`, width);
      }
      // Con el drawer, un diálogo y el panel de tarea abiertos tampoco se desborda.
      await page.goto(baseURL + prefix + "/app/todo");
      await page.waitForSelector(".task");
      await page.locator(".task-title").first().click();
      await page.waitForSelector(".sheet");
      await expectNoOverflow(page, `${locale} ${width} panel de tarea`, width);
      await page.keyboard.press("Escape");
      await page.locator("#menu-btn").click();
      await page.waitForSelector("#drawer");
      // El drawer entra deslizándose: se espera a que termine y queda pegado a la izquierda, superpuesto.
      await expect.poll(async () => (await page.locator("#drawer").boundingBox())?.x).toBe(0);
      // Nunca más ancho que la pantalla: siempre queda una franja para cerrarlo tocando afuera.
      expect((await page.locator("#drawer").boundingBox())!.width).toBe(Math.min(296, width - 48));
      await expectNoOverflow(page, `${locale} ${width} menú`, width);
      await context.close();
    });
  }
}

test("touch: arrastrar una tarea con el dedo la reordena", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1180, height: 1000 }, hasTouch: true, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });
  await freezeToday(context);
  const touchUser = await signInFreshUser(context, "Usuaria Touch");
  const touchDb = await userClient(touchUser);
  await touchDb.from("tasks").insert([
    { title: "Uno", planned_date: "2026-03-10", sort_order: 1 },
    { title: "Dos", planned_date: "2026-03-10", sort_order: 2 },
    { title: "Tres", planned_date: "2026-03-10", sort_order: 3 },
  ]);
  const page = await context.newPage();
  await page.goto("/app/todo");
  const today = page.locator("section.day-group").first();
  await expect.poll(() => today.locator(".task-title").allTextContents()).toEqual(["Uno", "Dos", "Tres"]);

  const grip = (await page.getByRole("button", { name: /^Mover «Uno»/ }).first().boundingBox())!;
  const target = (await page.locator(".task").filter({ hasText: "Tres" }).boundingBox())!;
  const client = await context.newCDPSession(page);
  const touch = (type: string, x: number, y: number) =>
    client.send("Input.dispatchTouchEvent", { type: type as "touchStart", touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  const end = { x: start.x + 40, y: target.y + target.height - 6 };
  await touch("touchStart", start.x, start.y);
  await page.waitForTimeout(220); // el sensor táctil espera un instante para no pelear con el scroll
  for (let step = 1; step <= 10; step += 1) {
    await touch("touchMove", start.x + ((end.x - start.x) * step) / 10, start.y + ((end.y - start.y) * step) / 10);
    await page.waitForTimeout(20);
  }
  await expect(page.locator(".task.is-lifted")).toBeVisible();
  await touch("touchEnd", end.x, end.y);

  await expect.poll(() => today.locator(".task-title").allTextContents()).toEqual(["Dos", "Tres", "Uno"]);
  await removeUser(touchUser);
  await context.close();
});
