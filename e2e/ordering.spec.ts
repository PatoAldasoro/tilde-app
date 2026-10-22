import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

let user: TestUser;
let db: SupabaseClient<Database>;

test.beforeEach(async ({ context }) => {
  await freezeToday(context); // hoy = martes 10/03/2026
  user = await signInFreshUser(context);
  db = await userClient(user);
});
test.afterEach(async () => removeUser(user));

const today = (page: Page) => page.locator("section.day-group").filter({ has: page.getByRole("heading", { name: "Hoy" }) });
const titles = (group: Locator) => group.locator(".task .task-title").allTextContents();
const order = async () => ((await db.from("tasks").select("title, sort_order").order("sort_order")).data ?? []).map((row) => row.title);

async function chooseSort(page: Page, name: string) {
  await page.getByRole("button", { name: /^Ordenar/ }).click();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
}

test("ordenar las tareas: cada criterio, sin arrastre fuera de «Mi orden» y guardar como mi orden", async ({ page }) => {
  const subjects = await db
    .from("subjects")
    .insert([
      { name: "Química", color_key: "turquesa", sort_order: 1 },
      { name: "Álgebra", color_key: "frambuesa", sort_order: 2 },
    ])
    .select("id, name");
  const quimica = subjects.data!.find((subject) => subject.name === "Química")!.id;
  const algebra = subjects.data!.find((subject) => subject.name === "Álgebra")!.id;
  // Álgebra rinde antes que Química; el recuperatorio tentativo y el parcial que ya pasó no cuentan.
  const events = await db.from("calendar_events").insert([
    { subject_id: quimica, category: "parcial", title: "", date: "2026-03-20", confirmed: true },
    { subject_id: algebra, category: "parcial", title: "", date: "2026-03-12", confirmed: true },
    { subject_id: quimica, category: "recuperatorio", title: "", date: "2026-03-11", confirmed: false },
    { subject_id: quimica, category: "parcial", title: "", date: "2026-03-02", confirmed: true },
  ]);
  expect(events.error).toBeNull();
  const tasks = await db.from("tasks").insert([
    { title: "Baja", planned_date: "2026-03-10", sort_order: 1, priority: "low", subject_id: quimica, due_date: null, lead_days: null, created_at: "2026-03-01T10:00:00Z" },
    { title: "Sin prioridad", planned_date: "2026-03-10", sort_order: 2, priority: "none", subject_id: null, due_date: null, lead_days: null, created_at: "2026-03-03T10:00:00Z" },
    { title: "Alta", planned_date: "2026-03-10", sort_order: 3, priority: "high", subject_id: algebra, due_date: null, lead_days: null, created_at: "2026-03-02T10:00:00Z" },
    { title: "Entrega", planned_date: null, sort_order: 4, priority: "medium", subject_id: null, due_date: "2026-03-11", lead_days: 3, created_at: "2026-03-04T10:00:00Z" },
  ]);
  expect(tasks.error).toBeNull();

  await page.goto("/app/todo");
  const list = today(page);
  // Mi orden: el de siempre, con las asas para arrastrar.
  await expect.poll(() => titles(list)).toEqual(["Baja", "Sin prioridad", "Alta", "Entrega"]);
  await expect(list.locator("button.grip")).toHaveCount(4);
  await expect(page.getByText(/^Orden:/)).toHaveCount(0);

  await chooseSort(page, "Prioridad");
  await expect.poll(() => titles(list)).toEqual(["Alta", "Entrega", "Baja", "Sin prioridad"]);
  // Con otro criterio no se arrastra, y la pantalla lo dice.
  await expect(list.locator("button.grip")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Orden: Prioridad" })).toContainText("Para arrastrar las tareas, volver a «Mi orden».");
  await expect(page.getByRole("button", { name: "Ordenar. Ahora: Prioridad" })).toContainText("Prioridad");

  await chooseSort(page, "Fecha límite");
  await expect.poll(() => titles(list)).toEqual(["Entrega", "Baja", "Sin prioridad", "Alta"]);
  await chooseSort(page, "Examen más cercano");
  await expect.poll(() => titles(list)).toEqual(["Alta", "Baja", "Sin prioridad", "Entrega"]);
  await chooseSort(page, "Materia");
  await expect.poll(() => titles(list)).toEqual(["Baja", "Alta", "Sin prioridad", "Entrega"]);
  await chooseSort(page, "Más antiguas");
  await expect.poll(() => titles(list)).toEqual(["Baja", "Alta", "Sin prioridad", "Entrega"]);
  await chooseSort(page, "Más nuevas");
  await expect.poll(() => titles(list)).toEqual(["Entrega", "Sin prioridad", "Alta", "Baja"]);
  await chooseSort(page, "Nombre (A–Z)");
  await expect.poll(() => titles(list)).toEqual(["Alta", "Baja", "Entrega", "Sin prioridad"]);

  // Mirar con otro criterio no toca el orden propio…
  expect(await order()).toEqual(["Baja", "Sin prioridad", "Alta", "Entrega"]);
  // …y el criterio elegido se recuerda en el dispositivo.
  await page.reload();
  await expect.poll(() => titles(list)).toEqual(["Alta", "Baja", "Entrega", "Sin prioridad"]);
  await expect(page.getByRole("button", { name: "Ordenar. Ahora: Nombre (A–Z)" })).toBeVisible();

  // Volver a mi orden desde el aviso.
  await page.getByRole("button", { name: "Volver a mi orden" }).click();
  await expect.poll(() => titles(list)).toEqual(["Baja", "Sin prioridad", "Alta", "Entrega"]);
  await expect(list.locator("button.grip")).toHaveCount(4);

  // Guardar un criterio como orden propio: queda así, se vuelve a «Mi orden» y se puede seguir arrastrando.
  await chooseSort(page, "Prioridad");
  await page.getByRole("button", { name: /^Ordenar/ }).click();
  await page.getByRole("menuitem", { name: "Guardar como mi orden" }).click();
  await expect(page.locator(".toast")).toContainText("Guardado como mi orden");
  await expect(page.getByRole("button", { name: "Ordenar. Ahora: Mi orden" })).toBeVisible();
  await expect.poll(() => titles(list)).toEqual(["Alta", "Entrega", "Baja", "Sin prioridad"]);
  await expect(list.locator("button.grip")).toHaveCount(4);
  await expect.poll(order).toEqual(["Alta", "Entrega", "Baja", "Sin prioridad"]);
});

test("sesión de estudio: las tareas de hoy se reordenan arrastrando, y es el mismo orden de Tareas", async ({ page }) => {
  const inserted = await db.from("tasks").insert([
    { title: "Uno", planned_date: "2026-03-10", sort_order: 1 },
    { title: "Dos", planned_date: "2026-03-10", sort_order: 2 },
    { title: "Tres", planned_date: "2026-03-10", sort_order: 3 },
    { title: "Ya hecha", planned_date: "2026-03-10", sort_order: 0, completed_at: "2026-03-10T12:00:00Z" },
  ]);
  expect(inserted.error).toBeNull();
  await page.goto("/app/study");
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  const names = () => panel.locator(".mt-title").allTextContents();
  await expect.poll(names).toEqual(["Uno", "Dos", "Tres", "Ya hecha"]);
  // Las completadas quedan al fondo y no se mueven.
  await expect(panel.locator("button.mini-grip")).toHaveCount(3);

  // Con el teclado: Espacio la levanta, las flechas la mueven, Espacio la suelta.
  const grip = panel.getByRole("button", { name: "Mover «Uno»" });
  await grip.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
  await expect.poll(names).toEqual(["Dos", "Tres", "Uno", "Ya hecha"]);
  await expect.poll(order).toEqual(["Ya hecha", "Dos", "Tres", "Uno"]);

  // Con el mouse, desde el asa.
  const from = await panel.getByRole("button", { name: "Mover «Tres»" }).boundingBox();
  const to = await panel.locator(".mini-task-group").first().boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2, from!.y - 8, { steps: 4 });
  await page.mouse.move(to!.x + 20, to!.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect.poll(names).toEqual(["Tres", "Dos", "Uno", "Ya hecha"]);
  await expect.poll(order).toEqual(["Ya hecha", "Tres", "Dos", "Uno"]);

  // Tildar y desplegar siguen funcionando, y sigue igual durante una sesión en curso.
  await page.locator(".timer-card").getByRole("button", { name: "Iniciar", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Marcar como completada: Dos" }).click();
  await expect.poll(names).toEqual(["Tres", "Uno", "Ya hecha", "Dos"]);

  // En Tareas se ve el mismo orden.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Tareas", exact: true }).click();
  await expect.poll(() => today(page).locator(".task .task-title").allTextContents()).toEqual(["Tres", "Uno", "Ya hecha", "Dos"]);
});

test("sesión de estudio: arrastrar más allá del final no estira el panel ni sigue bajando", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 700 });
  await db.from("tasks").insert(Array.from({ length: 12 }, (_, index) => ({ title: `Tarea ${index + 1}`, planned_date: "2026-03-10", sort_order: index + 1 })));
  await page.goto("/app/study");
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  await expect(panel.locator(".mini-task")).toHaveCount(12);
  const body = panel.locator(".side-panel-body");
  const height = () => body.evaluate((element) => element.scrollHeight);
  const before = await height();

  // Se lleva la primera hasta el borde de abajo de la pantalla y se espera.
  const grip = await panel.getByRole("button", { name: "Mover «Tarea 1»" }).boundingBox();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + 20, { steps: 4 });
  await page.mouse.move(grip!.x + grip!.width / 2, 698, { steps: 8 });
  await page.waitForTimeout(1500);
  expect(await height()).toBe(before);
  const scrolled = await body.evaluate((element) => element.scrollTop);
  expect(scrolled).toBeLessThanOrEqual(before - (await body.evaluate((element) => element.clientHeight)));
  await page.mouse.up();
  await expect.poll(() => panel.locator(".mt-title").last().textContent()).toBe("Tarea 1");
});

test("sesión de estudio: las tareas de hoy se ordenan con los mismos criterios que Tareas", async ({ page }) => {
  await db.from("tasks").insert([
    { title: "Bravo", planned_date: "2026-03-10", sort_order: 1, priority: "low" },
    { title: "Alfa", planned_date: "2026-03-10", sort_order: 2, priority: "high" },
    { title: "Charlie", planned_date: "2026-03-10", sort_order: 3, priority: "medium" },
  ]);
  await page.goto("/app/study");
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  const names = () => panel.locator(".mt-title").allTextContents();
  await expect.poll(names).toEqual(["Bravo", "Alfa", "Charlie"]);
  await expect(panel.locator("button.mini-grip")).toHaveCount(3);

  // Por prioridad: sin asas para arrastrar, con el aviso y la vuelta a «Mi orden».
  await panel.getByRole("button", { name: "Ordenar. Ahora: Mi orden" }).click();
  await page.getByRole("menuitemradio", { name: "Prioridad", exact: true }).click();
  await expect.poll(names).toEqual(["Alfa", "Charlie", "Bravo"]);
  await expect(panel.getByRole("button", { name: "Ordenar. Ahora: Prioridad" })).toContainText("Prioridad");
  await expect(panel.locator("button.mini-grip")).toHaveCount(0);
  await expect(panel.getByText("Orden: Prioridad. Para arrastrar las tareas, volver a «Mi orden».")).toBeVisible();
  await panel.getByRole("button", { name: "Volver a mi orden" }).click();
  await expect.poll(names).toEqual(["Bravo", "Alfa", "Charlie"]);
  await expect(panel.locator("button.mini-grip")).toHaveCount(3);

  // El criterio es el mismo en Tareas.
  await panel.getByRole("button", { name: /^Ordenar/ }).click();
  await page.getByRole("menuitemradio", { name: "Nombre (A–Z)", exact: true }).click();
  await expect.poll(names).toEqual(["Alfa", "Bravo", "Charlie"]);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Tareas", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ordenar. Ahora: Nombre (A–Z)" })).toBeVisible();
  await expect.poll(() => titles(today(page))).toEqual(["Alfa", "Bravo", "Charlie"]);

  // Desde la sesión también se guarda como mi orden.
  await page.goto("/app/study");
  await panel.getByRole("button", { name: /^Ordenar/ }).click();
  await page.getByRole("menuitem", { name: "Guardar como mi orden" }).click();
  await expect(page.getByText("Guardado como mi orden")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Ordenar. Ahora: Mi orden" })).toBeVisible();
  await expect.poll(order).toEqual(["Alfa", "Bravo", "Charlie"]);
  await expect.poll(names).toEqual(["Alfa", "Bravo", "Charlie"]);
});

test("con el timer corriendo se pide que la pantalla no se apague; en pausa y al terminar se suelta", async ({ page, context }) => {
  // El permiso de verdad depende del equipo: acá se registra cuándo se pide y cuándo se suelta.
  await context.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __wake: string[] }).__wake = log;
    const fake = {
      request: async (type: string) => {
        log.push(`request:${type}`);
        const sentinel = new EventTarget() as EventTarget & { released: boolean; release: () => Promise<void> };
        sentinel.released = false;
        sentinel.release = async () => {
          if (sentinel.released) return;
          sentinel.released = true;
          log.push("release");
          sentinel.dispatchEvent(new Event("release"));
        };
        (window as unknown as { __sentinel: typeof sentinel }).__sentinel = sentinel;
        return sentinel;
      },
    };
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: fake });
  });
  const log = () => page.evaluate(() => (window as unknown as { __wake: string[] }).__wake);
  await page.goto("/app/study");
  const card = page.locator(".timer-card");
  // Sin sesión no se pide nada.
  await expect(card.getByRole("button", { name: "Iniciar", exact: true })).toBeVisible();
  expect(await log()).toEqual([]);

  await card.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect.poll(log).toEqual(["request:screen"]);
  await card.getByRole("button", { name: "Pausar" }).click();
  await expect.poll(log).toEqual(["request:screen", "release"]);
  await card.getByRole("button", { name: "Reanudar" }).click();
  await expect.poll(log).toEqual(["request:screen", "release", "request:screen"]);

  // El navegador lo suelta al ocultar la pestaña: al volver se pide de nuevo.
  await page.evaluate(() => (window as unknown as { __sentinel: { release: () => Promise<void> } }).__sentinel.release());
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(log).toEqual(["request:screen", "release", "request:screen", "release", "request:screen"]);

  // Sigue al cambiar de sección (el timer vive en toda la app) y se suelta al terminar.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Tareas", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/todo$/);
  expect((await log()).length).toBe(5);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Sesiones de estudio", exact: true }).click();
  await card.getByRole("button", { name: "Terminar sesión" }).click();
  await expect.poll(async () => (await log()).at(-1)).toBe("release");
  expect((await log()).filter((entry) => entry.startsWith("request")).length).toBe(3);
});
