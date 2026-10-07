import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

let user: TestUser;
let db: SupabaseClient<Database>;
let subjectId: string;

test.beforeEach(async ({ context }) => {
  await freezeToday(context); // hoy = martes 10/03/2026, 15:00 (el reloj corre desde ahí)
  user = await signInFreshUser(context);
  db = await userClient(user);
  const subject = await db.from("subjects").insert({ name: "Física II", color_key: "mandarina" }).select("id").single();
  subjectId = subject.data!.id;
});
test.afterEach(async () => removeUser(user));

const time = (page: Page) => page.locator(".timer-card .timer-time");
const card = (page: Page) => page.locator(".timer-card");

test("timer: fases, pausa, saltar descanso y título de la pestaña", async ({ page }) => {
  await page.goto("/app/study");
  await expect(card(page).locator(".phase-pill")).toHaveText("Lista para empezar");
  await expect(time(page)).toHaveText("25:00");
  await expect(card(page)).toContainText("4 ciclos de 25 + 5 min");
  // Saltar descanso solo está disponible en el descanso.
  await expect(card(page).getByRole("button", { name: /Saltar descanso/ })).toHaveAttribute("aria-disabled", "true");

  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(card(page).locator(".phase-pill")).toHaveText("Foco");
  await expect(card(page)).toContainText("Ciclo 1 de 4");
  await expect(card(page)).toContainText("Termina a las 15:25");
  await expect(page).toHaveTitle(/^2[45]:\d\d · Foco · Tilde$/);
  // Con la sesión en curso el preset queda bloqueado.
  await expect(card(page).getByRole("radio", { name: "50/10" })).toBeDisabled();

  // Diez minutos después (sin ticks en el medio) el restante sale del reloj.
  await page.clock.fastForward("10:00");
  await expect(time(page)).toHaveText(/^1[45]:\d\d$/);

  // En pausa el tiempo no corre.
  await card(page).getByRole("button", { name: "Pausar" }).click();
  const paused = await time(page).textContent();
  await page.clock.fastForward("20:00");
  await expect(time(page)).toHaveText(paused!);
  await expect(card(page)).toContainText("En pausa");
  await expect(page).toHaveTitle(/En pausa · Tilde$/);

  // Reanudar y dejar terminar el foco: empieza el descanso.
  await card(page).getByRole("button", { name: "Reanudar" }).click();
  await page.clock.fastForward("15:00");
  await expect(card(page).locator(".phase-pill")).toHaveText("Descanso");
  await expect(page.getByText("Descanso de 5 min")).toBeVisible();
  await expect(time(page)).toHaveText(/^0[45]:\d\d$/);
  await expect(page).toHaveTitle(/Descanso · Tilde$/);

  await card(page).getByRole("button", { name: "Saltar descanso" }).click();
  await expect(card(page).locator(".phase-pill")).toHaveText("Foco");
  await expect(card(page)).toContainText("Ciclo 2 de 4");

  // Reiniciar con foco ya hecho ofrece guardarlo; al descartar vuelve al estado inicial y restaura el título.
  await card(page).getByRole("button", { name: "Reiniciar" }).click();
  await page.getByRole("dialog", { name: "Resumen de la sesión" }).getByRole("button", { name: "Descartar" }).click();
  await expect(card(page).locator(".phase-pill")).toHaveText("Lista para empezar");
  await expect(page).toHaveTitle("Sesiones de estudio · Tilde");
});

test("la sesión sigue al cambiar de sección y sobrevive a una recarga", async ({ page }) => {
  await page.goto("/app/study");
  await card(page).getByRole("radio", { name: "50/10" }).click();
  await expect(time(page)).toHaveText("50:00");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("05:00");

  // Otra sección: el título sigue mostrando el tiempo.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Tareas", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/todo$/);
  await expect(page).toHaveTitle(/^4[45]:\d\d · Foco · Tilde$/);

  // Recargar: la sesión activa se recupera de localStorage.
  await page.clock.fastForward("05:00");
  await page.goto("/app/study");
  await expect(card(page).locator(".phase-pill")).toHaveText("Foco");
  await expect(time(page)).toHaveText(/^(39|40):\d\d$/);
  await expect(card(page).getByRole("radio", { name: "50/10" })).toHaveAttribute("aria-checked", "true");
});

test("tareas de hoy, resumen, guardado e historial", async ({ page }) => {
  await db.from("tasks").insert([
    { title: "Leer capítulo 4", planned_date: "2026-03-10", sort_order: 1, subject_id: subjectId, priority: "none" },
    { title: "Comprar calculadora", planned_date: "2026-03-10", sort_order: 2, subject_id: null, priority: "none" },
    { title: "Para mañana", planned_date: "2026-03-11", sort_order: 3, subject_id: null, priority: "none" },
  ]);
  await page.goto("/app/study");

  // Historial vacío.
  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(page.getByRole("heading", { name: "Sin sesiones guardadas" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar una sesión" }).click();

  // Panel de tareas de hoy; con materia elegida se puede filtrar por ella.
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  await expect(panel.locator(".mini-task")).toHaveCount(2);
  await expect(panel).toContainText("Con una materia elegida se pueden filtrar.");
  await card(page).getByRole("combobox", { name: "Materia" }).selectOption(subjectId);
  await panel.getByRole("switch", { name: "Solo Física II" }).click();
  await expect(panel.locator(".mini-task")).toHaveCount(1);
  await panel.getByRole("switch", { name: "Solo Física II" }).click();

  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("12:00");
  await panel.getByRole("checkbox", { name: "Marcar como completada: Leer capítulo 4" }).click();
  await expect(panel.locator(".mini-task.is-done")).toHaveCount(1);
  await page.clock.fastForward("03:00");

  // Terminar: resumen con los tiempos reales y las tareas tildadas durante la sesión.
  await card(page).getByRole("button", { name: "Terminar sesión" }).click();
  const summary = page.getByRole("dialog", { name: "Resumen de la sesión" });
  await expect(summary.locator(".summary-stat").nth(0)).toContainText("15 min");
  await expect(summary.locator(".summary-stat").nth(2)).toContainText("0"); // no llegó a completar un ciclo
  await expect(summary.locator(".summary-stat").nth(3)).toContainText("1");
  await expect(summary).toContainText("Leer capítulo 4");
  await summary.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Sesión guardada en el historial")).toBeVisible();
  await expect(card(page).locator(".phase-pill")).toHaveText("Lista para empezar");

  const saved = await db.from("study_sessions").select("subject_id, preset, focus_seconds, break_seconds, cycles_completed, started_at, ended_at").single();
  expect(saved.data).toMatchObject({ subject_id: subjectId, preset: "25-5", break_seconds: 0, cycles_completed: 0 });
  expect(saved.data!.focus_seconds).toBeGreaterThanOrEqual(15 * 60);
  expect(saved.data!.focus_seconds).toBeLessThan(15 * 60 + 20);
  expect(Date.parse(saved.data!.ended_at) - Date.parse(saved.data!.started_at)).toBeGreaterThanOrEqual(15 * 60 * 1000);
  const links = await db.from("study_session_tasks").select("title");
  expect(links.data).toEqual([{ title: "Leer capítulo 4" }]);

  // Historial: totales por semana y por materia, y la sesión en la tabla.
  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(page.getByText("Esta semana: 15 min")).toBeVisible();
  await expect(page.getByText("Total: 15 min")).toBeVisible();
  const row = page.locator(".session-table tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("mar 10/03");
  await expect(row).toContainText("Física II");
  await expect(row).toContainText("25/5");
  await expect(page.locator(".bars .bar.is-current")).toHaveAttribute("aria-label", "Semana del 09/03: 15 min");
});

test("preset personalizado: al terminar el último foco se abre el resumen; descartar no guarda", async ({ page }) => {
  await page.goto("/app/study");
  await card(page).getByRole("radio", { name: "Personalizado" }).click();
  await card(page).getByLabel("Foco (min)").fill("10");
  await card(page).getByLabel("Foco (min)").press("Enter");
  await card(page).getByLabel("Descanso (min)").fill("2");
  await card(page).getByLabel("Descanso (min)").press("Enter");
  await card(page).getByLabel("Ciclos").fill("2");
  await card(page).getByLabel("Ciclos").press("Enter");
  await expect(card(page)).toContainText("2 ciclos de 10 + 2 min");
  // Fuera de rango se acota (foco 5–180).
  await card(page).getByLabel("Foco (min)").fill("999");
  await card(page).getByLabel("Foco (min)").press("Enter");
  await expect(card(page).getByLabel("Foco (min)")).toHaveValue("180");
  await card(page).getByLabel("Foco (min)").fill("10");
  await card(page).getByLabel("Foco (min)").press("Enter");

  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  // Pasa todo de golpe (como una pestaña dormida): 10 + 2 + 10 minutos.
  await page.clock.fastForward("30:00");
  const summary = page.getByRole("dialog", { name: "Resumen de la sesión" });
  await expect(summary.locator(".summary-stat").nth(0)).toContainText("20 min");
  await expect(summary.locator(".summary-stat").nth(1)).toContainText("2 min");
  await expect(summary.locator(".summary-stat").nth(2)).toContainText("2");
  await summary.getByRole("button", { name: "Descartar" }).click();
  await expect(summary).toBeHidden();
  expect((await db.from("study_sessions").select("id")).data).toEqual([]);
});

test("modo foco: solo el timer y las tareas de hoy", async ({ page }) => {
  await db.from("tasks").insert([{ title: "Leer capítulo 4", planned_date: "2026-03-10", sort_order: 1 }]);
  await page.goto("/app/study");
  await page.getByRole("button", { name: "Modo foco" }).click();
  const focus = page.getByRole("dialog", { name: "Modo foco" });
  await expect(focus).toBeVisible();
  await expect(focus.locator(".timer-time")).toHaveText("25:00");
  await expect(focus.locator(".mini-task")).toHaveCount(1);
  await focus.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(focus.locator(".phase-pill")).toHaveText("Foco");
  await focus.getByRole("checkbox", { name: "Marcar como completada: Leer capítulo 4" }).click();
  await expect(focus.locator(".mini-task.is-done")).toHaveCount(1);
  await focus.getByRole("button", { name: "Salir del modo foco" }).click();
  await expect(focus).toBeHidden();
  await expect(card(page).locator(".phase-pill")).toHaveText("Foco"); // la sesión sigue
});
