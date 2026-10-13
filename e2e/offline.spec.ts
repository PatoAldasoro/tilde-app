import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

let user: TestUser;
let db: SupabaseClient<Database>;
let problems: string[];

test.beforeEach(async ({ context, page }) => {
  await freezeToday(context); // hoy = martes 10/03/2026
  user = await signInFreshUser(context);
  db = await userClient(user);
  // Lo guardado en el dispositivo no puede hacer que React encuentre otra cosa que la que dibujó el servidor.
  problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|Minified React error/i.test(message.text())) problems.push(message.text());
  });
});
test.afterEach(async () => {
  expect(problems).toEqual([]);
  await removeUser(user);
});

const today = (page: Page) => page.locator("section.day-group").filter({ has: page.getByRole("heading", { name: "Hoy" }) });
const titles = (page: Page) => today(page).locator(".task .task-title").allTextContents();
const pill = (page: Page) => page.locator(".sync-pill");
const stored = (page: Page, prefix: string) => page.evaluate((start) => Object.keys(localStorage).filter((key) => key.startsWith(start)), prefix);
const tasksInDb = async () =>
  ((await db.from("tasks").select("title, completed_at").order("sort_order")).data ?? []).map((task) => `${task.title}${task.completed_at ? " ✓" : ""}`);

/** El service worker guarda todas las secciones un rato después de abrir la app: se espera a que termine. */
async function savedForOffline(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const pages = names.find((name) => name.startsWith("tilde-pages"));
          if (!pages) return false;
          const meta = await (await caches.open(pages)).match("/__tilde/meta");
          return meta ? ((await meta.json()) as { warmedAt: number }).warmedAt > 0 : false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

async function goTo(page: Page, section: string) {
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: section, exact: true }).click();
}

async function offline(context: BrowserContext, page: Page) {
  await context.setOffline(true);
  await expect(pill(page)).toContainText("Sin conexión");
}

test("sin conexión: se sigue usando, los cambios sobreviven a recargar y a cambiar de sección, y se suben al volver", async ({ page, context }) => {
  await db.from("tasks").insert([
    { title: "Uno", planned_date: "2026-03-10", sort_order: 1 },
    { title: "Dos", planned_date: "2026-03-10", sort_order: 2 },
  ]);
  await page.goto("/app/todo");
  await expect.poll(() => titles(page)).toEqual(["Uno", "Dos"]);
  // Con conexión y todo subido no hay ningún aviso.
  await expect(pill(page)).toHaveCount(0);
  await savedForOffline(page);

  await offline(context, page);
  await expect(page.locator(".toast")).toContainText("Sin conexión. Se puede seguir usando");

  // Tildar, agregar y cambiar una preferencia: todo responde igual que siempre.
  await today(page).getByRole("checkbox", { name: "Marcar como completada: Uno" }).click();
  await today(page).getByPlaceholder("Agregar tarea").fill("Hecha en el viaje");
  await today(page).getByPlaceholder("Agregar tarea").press("Enter");
  await expect.poll(() => titles(page)).toEqual(["Dos", "Hecha en el viaje", "Uno"]);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("radio", { name: "Oscuro" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // El aviso dice cuánto falta subir, y al servidor no llegó nada.
  await expect(pill(page)).toHaveAccessibleName("Sin conexión. 3 cambios sin subir");
  await pill(page).click();
  await expect(page.locator(".sync-pop")).toContainText("los cambios se guardan en este dispositivo y se suben solos al volver la conexión");
  await expect(page.locator(".sync-pop")).toContainText("3 cambios sin subir");
  await page.keyboard.press("Escape");
  expect(await tasksInDb()).toEqual(["Uno", "Dos"]);

  // Recargar sin conexión: la pantalla abre igual, con lo que se hizo.
  await page.reload();
  await expect.poll(() => titles(page)).toEqual(["Dos", "Hecha en el viaje", "Uno"]);
  await expect(today(page).locator(".task.is-done .task-title")).toHaveText(["Uno"]);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(pill(page)).toHaveAccessibleName("Sin conexión. 3 cambios sin subir");

  // Cambiar de sección sin conexión: también abren, con los mismos datos.
  await goTo(page, "Sesiones de estudio");
  await expect(page).toHaveURL(/\/app\/study$/);
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  await expect(panel.locator(".mt-title")).toHaveText(["Dos", "Hecha en el viaje", "Uno"]);
  await goTo(page, "Horario");
  await expect(page).toHaveURL(/\/app\/schedule$/);
  await expect(page.getByRole("group", { name: "Horario de la semana" })).toBeVisible();
  await goTo(page, "Calendario");
  await expect(page.getByRole("grid")).toBeVisible();
  await goTo(page, "Inicio");
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  await goTo(page, "Tareas");
  await expect.poll(() => titles(page)).toEqual(["Dos", "Hecha en el viaje", "Uno"]);

  // Vuelve la conexión: se sube todo, en orden, y se avisa.
  await context.setOffline(false);
  await expect(page.locator(".toast")).toContainText("Se subieron 3 cambios pendientes");
  await expect(pill(page)).toHaveCount(0);
  await expect.poll(tasksInDb).toEqual(["Uno ✓", "Dos", "Hecha en el viaje"]);
  await expect.poll(async () => (await db.from("profiles").select("theme").single()).data?.theme).toBe("dark");
  expect(await stored(page, "tilde-outbox:")).toEqual([]);
});

test("sin conexión: un cambio que el servidor rechaza se descarta, se avisa y la pantalla vuelve a lo que hay", async ({ page, context }) => {
  const inserted = await db
    .from("tasks")
    .insert([
      { title: "Sigue", planned_date: "2026-03-10", sort_order: 1 },
      { title: "Borrada en otro lado", planned_date: "2026-03-10", sort_order: 2 },
    ])
    .select("id, title");
  const ghost = inserted.data!.find((task) => task.title === "Borrada en otro lado")!.id;
  await page.goto("/app/todo");
  await expect.poll(() => titles(page)).toEqual(["Sigue", "Borrada en otro lado"]);

  await offline(context, page);
  // Mientras tanto, desde otro dispositivo se borra esa tarea.
  await db.from("tasks").delete().eq("id", ghost);
  // Acá, sin saberlo, se le agrega una subtarea, y además se hace un cambio que sí vale.
  await today(page).getByRole("button", { name: "Borrada en otro lado", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Detalle de la tarea" });
  await sheet.getByPlaceholder("Agregar subtarea").fill("No tiene dónde ir");
  await sheet.getByPlaceholder("Agregar subtarea").press("Enter");
  await expect(sheet.locator(".subtask")).toHaveCount(1);
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await today(page).getByRole("checkbox", { name: "Marcar como completada: Sigue" }).click();
  await expect(pill(page)).toHaveAccessibleName("Sin conexión. 2 cambios sin subir");

  await context.setOffline(false);
  await expect(page.locator(".toast")).toContainText("Un cambio no se pudo guardar y se descartó.");
  // Lo rechazado no traba lo demás: el otro cambio se sube y la lista queda como está en el servidor.
  await expect.poll(() => titles(page)).toEqual(["Sigue"]);
  await expect.poll(tasksInDb).toEqual(["Sigue ✓"]);
  await expect(pill(page)).toHaveCount(0);
  expect((await db.from("subtasks").select("id")).data).toEqual([]);
});

test("cerrar sesión: avisa si hay cambios sin subir y no deja nada de la cuenta en el dispositivo", async ({ page, context }) => {
  await db.from("tasks").insert({ title: "Pendiente", planned_date: "2026-03-10", sort_order: 1 });
  await page.goto("/app/todo");
  await expect.poll(() => titles(page)).toEqual(["Pendiente"]);
  await savedForOffline(page);
  // Con la app abierta hay una copia de los datos y de las pantallas en el dispositivo.
  await expect.poll(() => stored(page, "tilde-cache:")).toEqual([`tilde-cache:${user.id}`]);

  const signOut = async () => {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.locator("#drawer").getByRole("button", { name: "Ajustes" }).click();
    await page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Cerrar sesión" }).click();
  };

  await offline(context, page);
  await today(page).getByRole("checkbox", { name: "Marcar como completada: Pendiente" }).click();
  await signOut();
  const warning = page.getByRole("alertdialog", { name: "¿Cerrar sesión con cambios sin subir?" });
  await expect(warning).toContainText("Hay 1 cambio que todavía no se subió. Al cerrar sesión se pierden.");
  await warning.getByRole("button", { name: "Cancelar" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/app\/todo$/);

  // Con conexión se sube lo pendiente y ya no hay nada que avisar.
  await context.setOffline(false);
  await expect(pill(page)).toHaveCount(0);
  await expect.poll(tasksInDb).toEqual(["Pendiente ✓"]);
  await signOut();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Tilde", level: 1 })).toBeVisible();
  expect(await stored(page, "tilde-cache:")).toEqual([]);
  expect(await stored(page, "tilde-outbox:")).toEqual([]);
  expect(await page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith("tilde-pages")))).toEqual([]);
});

test("recargar con conexión trae lo último del servidor, no lo guardado en el dispositivo", async ({ page }) => {
  await db.from("tasks").insert({ title: "Original", planned_date: "2026-03-10", sort_order: 1 });
  await page.goto("/app/todo");
  await expect.poll(() => titles(page)).toEqual(["Original"]);
  await expect.poll(() => stored(page, "tilde-cache:")).toHaveLength(1);
  // Otro dispositivo agrega una tarea; acá se recarga enseguida.
  await db.from("tasks").insert({ title: "Desde el teléfono", planned_date: "2026-03-10", sort_order: 2 });
  await page.reload();
  await expect.poll(() => titles(page)).toEqual(["Original", "Desde el teléfono"]);
});
