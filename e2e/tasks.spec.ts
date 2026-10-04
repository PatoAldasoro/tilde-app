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

const day = (title: string | RegExp, page: Page) => page.locator("section.day-group").filter({ has: page.getByRole("heading", { name: title }) });
const row = (page: Page, title: string) => page.locator(".task").filter({ has: page.getByRole("button", { name: title, exact: true }) });
const titles = (group: Locator) => group.locator(".task .task-title").allTextContents();

async function insertTasks(rows: Database["public"]["Tables"]["tasks"]["Insert"][]) {
  const { error } = await db.from("tasks").insert(rows);
  if (error) throw error;
}

test("agregar, completar y progreso del día; el progreso de la materia coincide", async ({ page }) => {
  const subject = await db.from("subjects").insert({ name: "Física II", color_key: "mandarina" }).select("id").single();
  await page.goto("/app/todo");
  await expect(page.getByRole("heading", { name: "Nada pendiente" })).toBeVisible();

  const today = day("Hoy", page);
  const add = today.getByPlaceholder("Agregar tarea");
  for (const title of ["Leer capítulo 4", "Resolver guía 3"]) {
    await add.fill(title);
    await add.press("Enter");
  }
  await expect(today.locator(".task")).toHaveCount(2);
  await expect(page.locator(".today-card .pct")).toHaveText("0 %");

  // Asignar materia desde el panel de detalle.
  await page.getByRole("button", { name: "Leer capítulo 4", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Detalle de la tarea" });
  await sheet.getByLabel("Materia").selectOption(subject.data!.id);
  await sheet.getByRole("radio", { name: "Alta" }).click();
  await sheet.getByRole("button", { name: "Listo" }).click();
  await expect(row(page, "Leer capítulo 4")).toContainText("Física II");
  await expect(row(page, "Leer capítulo 4").getByRole("img", { name: "Prioridad: Alta" })).toBeVisible();

  // Completar: queda en gris y baja al fondo del día.
  await page.getByRole("checkbox", { name: "Marcar como completada: Leer capítulo 4" }).click();
  await expect(row(page, "Leer capítulo 4")).toHaveClass(/is-done/);
  expect(await titles(today)).toEqual(["Resolver guía 3", "Leer capítulo 4"]);
  await expect(page.locator(".today-card .pct")).toHaveText("50 %");
  await expect(today.locator(".day-count")).toHaveText("1/2");

  // El progreso de la materia en Inicio coincide con el de sus tareas.
  await page.goto("/app");
  const card = page.getByRole("article", { name: "Física II" });
  await expect(card).toContainText("100 %");
  await expect(card).toContainText("1 de 1 tarea completada");

  await page.goto("/app/todo");
  await page.getByRole("checkbox", { name: "Marcar como completada: Resolver guía 3" }).click();
  await expect(page.getByText("Todo listo por hoy")).toBeVisible();
});

test("arrastre, ventana de fecha límite y vencidas", async ({ page }) => {
  await insertTasks([
    { title: "De ayer", planned_date: "2026-03-09", sort_order: 1 },
    { title: "De hace tres días", planned_date: "2026-03-07", sort_order: 2 },
    { title: "Para el jueves", planned_date: "2026-03-12", sort_order: 3 },
    { title: "Entrega con ventana", due_date: "2026-03-12", lead_days: 1, sort_order: 4 },
    { title: "Entrega vencida", due_date: "2026-03-06", lead_days: 2, sort_order: 5 },
    { title: "Entrega de hoy", due_date: "2026-03-10", lead_days: 0, sort_order: 6 },
  ]);
  await page.goto("/app/todo");

  const today = day("Hoy", page);
  await expect.poll(() => titles(today)).toEqual(["De ayer", "De hace tres días", "Entrega vencida", "Entrega de hoy"]);
  await expect(row(page, "De ayer")).toContainText("de ayer");
  await expect(row(page, "De hace tres días")).toContainText("hace 3 días");
  await expect(row(page, "Entrega vencida")).toContainText("Vencida");
  await expect(row(page, "Entrega de hoy")).toContainText("Vence hoy");

  // El arrastre solo afecta a hoy.
  await expect.poll(() => titles(day("Mañana", page))).toEqual(["Entrega con ventana"]);
  await expect(day("Mañana", page).locator(".task")).toContainText("Entrega en 2 días");
  await expect.poll(() => titles(day("Jueves", page))).toEqual(["Para el jueves", "Entrega con ventana"]);
  await expect.poll(() => titles(day("Viernes", page))).toEqual([]);

  // Completar una entrega: ese día se ve en gris y deja de aparecer en los siguientes.
  await day("Mañana", page).getByRole("checkbox", { name: "Marcar como completada: Entrega con ventana" }).click();
  await expect.poll(() => titles(day("Mañana", page))).toEqual([]);
  await expect.poll(() => titles(day("Jueves", page))).toEqual(["Para el jueves"]);
  await expect(today.locator(".task.is-done")).toContainText("Entrega con ventana");

  // Filtros de fecha: hoy y fecha puntual.
  await page.getByRole("radio", { name: "Hoy", exact: true }).click();
  await expect(page.locator("section.day-group")).toHaveCount(1);
  await page.getByRole("radio", { name: "Fecha", exact: true }).click();
  await page.getByRole("button", { name: "Elegir fecha" }).click();
  await page.getByRole("button", { name: "jueves, 12 de marzo de 2026" }).click();
  await expect(page.locator("section.day-group")).toHaveCount(1);
  expect(await titles(page.locator("section.day-group"))).toEqual(["Para el jueves"]);
});

test("subtareas: bloquean la tarea, la completan sola y la reabren", async ({ page }) => {
  const task = await db.from("tasks").insert({ title: "TP de circuitos", planned_date: "2026-03-10", sort_order: 1 }).select("id").single();
  await db.from("subtasks").insert([
    { task_id: task.data!.id, title: "Armar el informe", sort_order: 1 },
    { task_id: task.data!.id, title: "Revisar cálculos", sort_order: 2 },
  ]);
  await page.goto("/app/todo");

  const main = page.getByRole("checkbox", { name: /TP de circuitos/ }).first();
  await expect(main).toHaveAttribute("aria-disabled", "true");
  await expect(main).toHaveAttribute("data-tip", "Faltan 2 subtareas para poder completarla");
  // aria-disabled: sigue recibiendo el clic para poder explicar por qué no se completa.
  await main.click({ force: true });
  await expect(main).toHaveClass(/tip-open/);
  await expect(main).toHaveAttribute("aria-checked", "false");
  // Progreso por unidades: 2 subtareas = 2 unidades.
  await expect(day("Hoy", page).locator(".day-count")).toHaveText("0/2");

  await page.getByRole("button", { name: "Ver subtareas" }).click();
  await page.getByRole("checkbox", { name: "Armar el informe" }).click();
  await expect(main).toHaveAttribute("data-tip", "Falta 1 subtarea para poder completarla");
  await expect(day("Hoy", page).locator(".day-count")).toHaveText("1/2");
  await page.getByRole("checkbox", { name: "Revisar cálculos" }).click();
  // Al completar la última, la tarea se completa sola.
  await expect(page.getByRole("checkbox", { name: "Marcar como pendiente: TP de circuitos" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Todo listo por hoy")).toBeVisible();

  // Al desmarcar una subtarea, la principal vuelve a pendiente.
  await page.getByRole("checkbox", { name: "Armar el informe" }).click();
  await expect(page.getByRole("checkbox", { name: /TP de circuitos/ }).first()).toHaveAttribute("aria-checked", "false");

  // Agregar y quitar subtareas desde el detalle.
  await page.getByRole("button", { name: "TP de circuitos", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Detalle de la tarea" });
  await sheet.getByPlaceholder("Agregar subtarea").fill("Entregar");
  await sheet.getByPlaceholder("Agregar subtarea").press("Enter");
  await expect(sheet.locator(".sub-edit .subtask")).toHaveCount(3);
  await sheet.getByRole("button", { name: "Quitar subtarea: Entregar" }).click();
  await expect(sheet.locator(".sub-edit .subtask")).toHaveCount(2);
});

test("reordenar y mover entre días con el teclado", async ({ page }) => {
  await insertTasks([
    { title: "Uno", planned_date: "2026-03-10", sort_order: 1 },
    { title: "Dos", planned_date: "2026-03-10", sort_order: 2 },
    { title: "Tres", planned_date: "2026-03-10", sort_order: 3 },
    { title: "Entrega", due_date: "2026-03-10", lead_days: 0, sort_order: 4 },
  ]);
  await page.goto("/app/todo");
  const today = day("Hoy", page);
  await expect.poll(() => titles(today)).toEqual(["Uno", "Dos", "Tres", "Entrega"]);

  // Atajos del asa: flechas reordenan sin levantar.
  const grip = (title: string) => page.getByRole("button", { name: new RegExp(`^Mover «${title}»`) });
  await grip("Uno").first().focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => titles(today)).toEqual(["Dos", "Uno", "Tres", "Entrega"]);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => titles(today)).toEqual(["Dos", "Tres", "Uno", "Entrega"]);
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => titles(today)).toEqual(["Dos", "Uno", "Tres", "Entrega"]);

  // Av Pág mueve la tarea diaria al día siguiente.
  await page.keyboard.press("PageDown");
  await expect.poll(() => titles(day("Mañana", page))).toEqual(["Uno"]);
  await expect(page.getByText("Movida a mañana (11/03)")).toBeVisible();
  // Re Pág la devuelve a hoy, pero no la deja ir antes de hoy.
  await page.keyboard.press("PageUp");
  await expect.poll(() => titles(today)).toEqual(["Dos", "Tres", "Entrega", "Uno"]);
  await page.keyboard.press("PageUp");
  await expect.poll(() => titles(today)).toEqual(["Dos", "Tres", "Entrega", "Uno"]);

  // Una tarea con fecha límite no cambia de día.
  await grip("Entrega").first().focus();
  await page.keyboard.press("PageDown");
  await expect.poll(() => titles(day("Mañana", page))).toEqual([]);

  // Sensor de teclado de dnd-kit: Espacio levanta, flechas mueven, Espacio suelta.
  await grip("Dos").first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".task.is-lifted")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(today.locator(".insert-line")).toBeVisible();
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await expect.poll(() => titles(today)).toEqual(["Tres", "Entrega", "Dos", "Uno"]);

  // El orden se guardó.
  await page.reload();
  await expect.poll(() => titles(day("Hoy", page))).toEqual(["Tres", "Entrega", "Dos", "Uno"]);
});

async function dragTo(page: Page, handle: Locator, target: Locator, where: "above" | "below") {
  // Las filas se reacomodan con una animación (FLIP): se espera a que terminen antes de medir.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const y = where === "above" ? to.y + 6 : to.y + to.height - 6;
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x + 60, y, { steps: 12 });
  await page.mouse.move(to.x + 60, y + (where === "above" ? -1 : 1), { steps: 2 });
  await page.mouse.up();
}

test("arrastrar con el puntero: reordenar, mover de día y bloqueo de las entregas", async ({ page }) => {
  // Pantalla alta: así el auto-scroll del arrastre no mueve los destinos durante el test.
  await page.setViewportSize({ width: 1366, height: 1300 });
  await insertTasks([
    { title: "Uno", planned_date: "2026-03-10", sort_order: 1 },
    { title: "Dos", planned_date: "2026-03-10", sort_order: 2 },
    { title: "Tres", planned_date: "2026-03-10", sort_order: 3 },
    { title: "Entrega", due_date: "2026-03-10", lead_days: 0, sort_order: 4 },
    { title: "Del miércoles", planned_date: "2026-03-11", sort_order: 5 },
  ]);
  await page.goto("/app/todo");
  const today = day("Hoy", page);
  const tomorrow = day("Mañana", page);
  const grip = (title: string) => page.getByRole("button", { name: new RegExp(`^Mover «${title}»`) }).first();

  // Dentro del día.
  await dragTo(page, grip("Uno"), row(page, "Tres"), "below");
  await expect.poll(() => titles(today)).toEqual(["Dos", "Tres", "Uno", "Entrega"]);

  // A otro día: cambia planned_date.
  await dragTo(page, grip("Dos"), row(page, "Del miércoles"), "above");
  await expect.poll(() => titles(tomorrow)).toEqual(["Dos", "Del miércoles"]);
  await expect.poll(() => titles(today)).toEqual(["Tres", "Uno", "Entrega"]);
  const moved = await db.from("tasks").select("planned_date").eq("title", "Dos").single();
  expect(moved.data?.planned_date).toBe("2026-03-11");

  // Una entrega no se puede soltar en otro día.
  await dragTo(page, grip("Entrega"), row(page, "Del miércoles"), "below");
  await expect.poll(() => titles(tomorrow)).toEqual(["Dos", "Del miércoles"]);
  await expect.poll(() => titles(today)).toEqual(["Tres", "Uno", "Entrega"]);
  // …pero sí se reordena dentro de su día.
  await dragTo(page, grip("Entrega"), row(page, "Tres"), "above");
  await expect.poll(() => titles(today)).toEqual(["Entrega", "Tres", "Uno"]);
});

test("ordenar por prioridad, vista por materia y borrado con deshacer", async ({ page }) => {
  const subjects = await db
    .from("subjects")
    .insert([
      { name: "Química", color_key: "turquesa", created_at: "2026-03-01T10:00:00Z" },
      { name: "Álgebra", color_key: "frambuesa", created_at: "2026-03-01T11:00:00Z" },
    ])
    .select("id, name");
  const quimica = subjects.data!.find((s) => s.name === "Química")!.id;
  const algebra = subjects.data!.find((s) => s.name === "Álgebra")!.id;
  await insertTasks([
    { title: "Baja", planned_date: "2026-03-10", sort_order: 1, priority: "low", subject_id: quimica },
    { title: "Sin prioridad", planned_date: "2026-03-10", sort_order: 2, priority: "none", subject_id: null },
    { title: "Alta", planned_date: "2026-03-10", sort_order: 3, priority: "high", subject_id: algebra },
    { title: "Media", planned_date: "2026-03-11", sort_order: 4, priority: "medium", subject_id: quimica },
  ]);
  await page.goto("/app/todo");
  const today = day("Hoy", page);

  await page.getByRole("button", { name: "Ordenar por prioridad" }).click();
  await expect.poll(() => titles(today)).toEqual(["Alta", "Baja", "Sin prioridad"]);

  // Por materia.
  await page.getByRole("radio", { name: "Por materia" }).click();
  await page.getByRole("radio", { name: "Química" }).click();
  await expect.poll(() => titles(today)).toEqual(["Baja"]);
  await expect.poll(() => titles(day("Mañana", page))).toEqual(["Media"]);
  // Agregar rápido en esta vista asigna la materia.
  await today.getByPlaceholder("Agregar tarea").fill("Nueva de química");
  await today.getByPlaceholder("Agregar tarea").press("Enter");
  await expect(row(page, "Nueva de química")).toContainText("Química");

  // "Borrar todas" respeta el filtro activo (3 tareas de Química) y se puede deshacer.
  await page.getByRole("button", { name: "Más opciones" }).click();
  await page.getByRole("menuitem", { name: "Borrar todas (3)" }).click();
  const confirmDialog = page.getByRole("alertdialog", { name: "¿Borrar 3 tareas?" });
  await confirmDialog.getByRole("button", { name: "Borrar 3 tareas" }).click();
  await expect(today.locator(".task")).toHaveCount(0);
  await expect(page.getByText("3 tareas borradas")).toBeVisible();
  await page.getByRole("radio", { name: "General" }).click();
  await expect.poll(() => titles(today)).toEqual(["Alta", "Sin prioridad"]);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(() => titles(today)).toEqual(["Alta", "Baja", "Sin prioridad", "Nueva de química"]);

  // Modo selección: Borrar (N) con confirmación.
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page.getByRole("checkbox", { name: "Seleccionar: Alta" }).click();
  await page.getByRole("checkbox", { name: "Seleccionar: Baja" }).click();
  await expect(page.getByText("2 seleccionadas")).toBeVisible();
  await page.getByRole("button", { name: "Borrar (2)" }).click();
  await page.getByRole("alertdialog", { name: "¿Borrar 2 tareas?" }).getByRole("button", { name: "Borrar 2 tareas" }).click();
  await expect.poll(() => titles(today)).toEqual(["Sin prioridad", "Nueva de química"]);
  const left = await db.from("tasks").select("title");
  expect(left.data?.map((t) => t.title).sort()).toEqual(["Media", "Nueva de química", "Sin prioridad"]);
});
