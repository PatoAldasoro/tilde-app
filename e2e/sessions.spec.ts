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
  const subject = await db.from("subjects").insert({ name: "Física II", color_key: "mandarina", sort_order: 1 }).select("id").single();
  subjectId = subject.data!.id;
  // Cuenta los osciladores que se crean: cada sonido arma uno por nota.
  await context.addInitScript(() => {
    const state = window as unknown as { __notes: number };
    state.__notes = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function createOscillator(this: AudioContext) {
      state.__notes += 1;
      return original.call(this);
    };
  });
});
test.afterEach(async () => removeUser(user));

const time = (page: Page) => page.locator(".timer-card .timer-time");
const card = (page: Page) => page.locator(".timer-card");
const notes = (page: Page) => page.evaluate(() => (window as unknown as { __notes: number }).__notes);
const sessions = async () => (await db.from("study_sessions").select("*").order("started_at")).data ?? [];

test("reiniciar con tiempo de foco ofrece guardar la sesión incompleta", async ({ page }) => {
  await page.goto("/app/study");
  // Con segundos de foco no hay nada que guardar: vuelve al inicio sin preguntar.
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("00:20");
  await card(page).getByRole("button", { name: "Reiniciar" }).click();
  await expect(card(page).locator(".phase-pill")).toHaveText("Lista para empezar");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Con diez minutos de foco, reiniciar pregunta qué hacer con lo estudiado.
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("10:00");
  await card(page).getByRole("button", { name: "Reiniciar" }).click();
  const summary = page.getByRole("dialog", { name: "Resumen de la sesión" });
  await expect(summary).toContainText("Quedó incompleta: 0 de 4 ciclos");
  await expect(summary.locator(".summary-stat").first()).toContainText("10 min");
  await summary.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".toast")).toContainText("Sesión guardada en el historial");
  await expect.poll(async () => (await sessions()).map((row) => [row.preset, row.focus_seconds, row.cycles_completed])).toEqual([["25-5", 600, 0]]);

  // Descartar no guarda nada.
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("03:00");
  await card(page).getByRole("button", { name: "Reiniciar" }).click();
  await summary.getByRole("button", { name: "Descartar" }).click();
  await expect(card(page).locator(".phase-pill")).toHaveText("Lista para empezar");
  expect(await sessions()).toHaveLength(1);
});

test("ajustar el tiempo: atrasar, adelantar, cortar el foco y volver a empezar la fase", async ({ page }) => {
  await page.goto("/app/study");
  const adjust = card(page).getByRole("button", { name: /^Ajustar el tiempo/ });
  // Sin sesión en curso no hay nada que ajustar.
  await expect(adjust).toHaveAttribute("aria-disabled", "true");

  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("10:00");
  await expect(time(page)).toHaveText(/^1[45]:\d\d$/);
  await adjust.click();
  const popover = page.locator(".adjust-pop");

  // El timer corrió 5 minutos de más: se atrasa y ese tiempo deja de contar como foco.
  await popover.getByRole("group", { name: "Atrasar" }).getByRole("button", { name: "5 min" }).click();
  await expect(time(page)).toHaveText(/^(20:00|19:5\d)$/);
  // Atrasar no pasa del principio de la fase.
  await popover.getByRole("group", { name: "Atrasar" }).getByRole("button", { name: "5 min" }).click();
  await popover.getByRole("group", { name: "Atrasar" }).getByRole("button", { name: "5 min" }).click();
  await expect(time(page)).toHaveText(/^(25:00|24:5\d)$/);
  // Se siguió estudiando con el timer frenado: se adelanta y ese tiempo cuenta.
  await popover.getByRole("group", { name: "Adelantar" }).getByRole("button", { name: "5 min" }).click();
  await popover.getByRole("group", { name: "Adelantar" }).getByRole("button", { name: "1 min" }).click();
  await expect(time(page)).toHaveText(/^(19:00|18:5\d)$/);

  // Volver a empezar la fase: el reloj vuelve a 25:00 y lo ya contado se conserva.
  await popover.getByRole("button", { name: "Volver a empezar esta fase" }).click();
  await expect(time(page)).toHaveText(/^(25:00|24:5\d)$/);

  // Cortar el foco: pasa al descanso y el ciclo no figura como completado.
  await adjust.click();
  await popover.getByRole("button", { name: "Cortar el foco y pasar al descanso" }).click();
  await expect(card(page).locator(".phase-pill")).toHaveText("Descanso");
  await adjust.click();
  await expect(popover.getByRole("button", { name: "Saltar descanso" })).toBeVisible();
  await page.keyboard.press("Escape");

  await card(page).getByRole("button", { name: "Terminar sesión" }).click();
  const summary = page.getByRole("dialog", { name: "Resumen de la sesión" });
  // 6 minutos adelantados: lo demás se descontó al atrasar.
  await expect(summary.locator(".summary-stat").first()).toContainText("6 min");
  await summary.getByRole("button", { name: "Guardar" }).click();
  await expect.poll(async () => (await sessions()).map((row) => [Math.round(row.focus_seconds / 60), row.cycles_completed])).toEqual([[6, 0]]);
});

test("sonido: se elige entre varios, se prueba y se ajusta el volumen", async ({ page }) => {
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Elegir el sonido" }).click();
  const popover = page.locator(".sound-pop");
  const options = popover.getByRole("radiogroup").getByRole("radio");
  await expect(options).toHaveText(["Dos tonos", "Campana", "Tres notas", "Digital", "Madera"]);
  await expect(options.first()).toHaveAttribute("aria-checked", "true");

  // Elegir uno lo hace sonar (la campana son tres notas).
  await options.nth(1).click();
  await expect(options.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => notes(page)).toBe(3);
  await popover.getByRole("button", { name: "Probar" }).click();
  await expect.poll(() => notes(page)).toBe(6);

  // En silencio no suena nada.
  await popover.getByRole("slider").fill("0");
  await popover.getByRole("button", { name: "Probar" }).click();
  await page.waitForTimeout(200);
  expect(await notes(page)).toBe(6);
  await popover.getByRole("slider").fill("80");
  await page.keyboard.press("Escape");

  // Lo elegido se recuerda y es lo que suena al terminar una fase.
  await page.reload();
  const before = await notes(page);
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("25:00");
  await expect(card(page).locator(".phase-pill")).toHaveText("Descanso");
  await expect.poll(() => notes(page)).toBe(before + 3);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tilde-study") ?? "{}").setup);
  expect(stored).toMatchObject({ soundKind: "bell", volume: 0.8 });
});

test("modo examen: de corrido, en rojo, a pantalla completa, sin pausas ni tareas, y con las salidas anotadas", async ({ page }) => {
  await db.from("tasks").insert({ title: "Repasar la unidad 3", planned_date: "2026-03-10", sort_order: 1 });
  await page.goto("/app/study");
  const accent = (selector: string) => page.locator(selector).evaluate((element) => getComputedStyle(element).getPropertyValue("--color-accent").trim().toUpperCase());
  const fullscreen = () => page.evaluate(() => document.fullscreenElement !== null);
  const taskLists = page.locator(".side-panel, .focus-side");
  expect(await accent(".timer-card")).toBe("#E44919");

  await card(page).getByRole("radio", { name: "Examen" }).click();
  // Elegido el modo, la tarjeta ya se ve en el rojo de examen; el resto de la app todavía no.
  expect(await accent(".timer-card")).toBe("#E11D48");
  expect(await accent("html")).toBe("#E44919");
  await expect(time(page)).toHaveText("2:00:00");
  await expect(card(page).getByRole("radiogroup", { name: "Duración del examen" }).getByRole("radio")).toHaveText(["1 h 30 min", "2 h", "2 h 30 min", "3 h"]);
  await card(page).getByRole("radio", { name: "1 h 30 min" }).click();
  await expect(time(page)).toHaveText("1:30:00");
  await card(page).locator("select").selectOption({ label: "Física II" });
  // Antes de empezar, la lista de tareas sigue a la vista.
  await expect(page.getByRole("complementary", { name: "Tareas de hoy" })).toContainText("Repasar la unidad 3");
  expect(await fullscreen()).toBe(false);

  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  // Al empezar pasa solo a pantalla completa, con el timer y nada más: la lista de tareas se oculta.
  const focus = page.getByRole("dialog", { name: "Modo foco" });
  await expect(focus).toBeVisible();
  await expect.poll(fullscreen).toBe(true);
  await expect(focus.locator(".phase-pill")).toHaveText("Examen");
  await expect(taskLists).toHaveCount(0);
  await expect(page.getByText("Repasar la unidad 3")).toHaveCount(0);
  // Con el examen en curso, toda la app pasa al rojo.
  await expect(page.locator("html")).toHaveAttribute("data-exam", "");
  expect(await accent("html")).toBe("#E11D48");
  await expect(page).toHaveTitle(/^1:(29|30):\d\d · Examen · Tilde$/);
  // No se pausa, no se ajusta y no hay descansos: solo se entrega.
  await expect(focus.getByRole("button", { name: "Pausar" })).toHaveCount(0);
  await expect(focus.getByRole("button", { name: /^Ajustar el tiempo/ })).toHaveAttribute("aria-disabled", "true");
  await expect(focus.getByRole("button", { name: /^Saltar descanso/ })).toHaveAttribute("aria-disabled", "true");

  // Salir de la página (otra ventana) suena y queda anotado; al volver avisa cuántas van.
  await page.clock.fastForward("10:00");
  const before = await notes(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(() => notes(page)).toBe(before + 6);
  await page.clock.fastForward("00:30");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".toast")).toContainText("Saliste de la página. Va 1 salida en este examen.");
  await expect(focus.locator(".timer-sub")).toContainText("1 salida");

  // Salir de la pantalla completa no corta el examen: sigue en la vista normal, todavía sin la lista de tareas.
  await focus.getByRole("button", { name: "Salir del modo foco" }).click();
  await expect(focus).toBeHidden();
  await expect.poll(fullscreen).toBe(false);
  await expect(card(page).locator(".phase-pill")).toHaveText("Examen");
  await expect(card(page).getByRole("radio", { name: "Estudio" })).toBeDisabled();
  await expect(taskLists).toHaveCount(0);

  // Otra salida, esta vez con la alarma apagada: se anota igual.
  await card(page).getByRole("button", { name: "Elegir el sonido" }).click();
  await page.getByRole("switch", { name: /Alarma al salir/ }).click();
  await page.keyboard.press("Escape");
  const quiet = await notes(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.fastForward("00:10");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(card(page).locator(".timer-sub")).toContainText("2 salidas");
  expect(await notes(page)).toBe(quiet);

  await card(page).getByRole("button", { name: "Entregar el examen" }).click();
  const summary = page.getByRole("dialog", { name: "Resumen del examen" });
  await expect(summary.locator(".summary-stat").filter({ hasText: "Salidas de la página" })).toContainText("2");
  await expect(summary.locator(".summary-stat").filter({ hasText: "Tiempo afuera" })).toContainText("1 min");
  await summary.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-exam");
  // Entregado el examen, la lista de tareas vuelve.
  await expect(page.getByRole("complementary", { name: "Tareas de hoy" })).toContainText("Repasar la unidad 3");
  await expect
    .poll(async () => (await sessions()).map((row) => [row.preset, row.subject_id, row.away_count, row.away_seconds, row.break_seconds]))
    .toEqual([["exam", subjectId, 2, 40, 0]]);

  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(page.locator(".session-table tbody tr").first()).toContainText("Examen · 2 salidas");
});

test("una sesión de estudio común no pasa sola a pantalla completa ni oculta las tareas", async ({ page }) => {
  await db.from("tasks").insert({ title: "Repasar la unidad 3", planned_date: "2026-03-10", sort_order: 1 });
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(card(page).locator(".phase-pill")).toHaveText("Foco");
  await expect(page.getByRole("dialog", { name: "Modo foco" })).toHaveCount(0);
  expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(false);
  await expect(page.getByRole("complementary", { name: "Tareas de hoy" })).toContainText("Repasar la unidad 3");
});

test("modo examen: al cumplirse el tiempo termina solo", async ({ page }) => {
  await page.goto("/app/study");
  await card(page).getByRole("radio", { name: "Examen" }).click();
  await card(page).getByRole("radio", { name: "1 h 30 min" }).click();
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("01:30:00");
  const summary = page.getByRole("dialog", { name: "Resumen del examen" });
  await expect(summary.locator(".summary-stat").first()).toContainText("1 h 30 min");
  await expect(summary).not.toContainText("Quedó incompleta");
});

test("timer flotante: una ventana aparte con el timer en un rectángulo redondeado, que también lo maneja", async ({ page, context }) => {
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("05:00");
  const toggle = card(page).getByRole("button", { name: "Timer flotante" });
  const [floating] = await Promise.all([context.waitForEvent("page"), toggle.click()]);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // La ventana trae los estilos y el tema de la app, y solo el timer.
  await expect(floating.locator("body")).toHaveClass("pip-body");
  await expect(floating.locator("html")).toHaveAttribute("data-theme", /light|dark/);
  const mini = floating.locator(".mini-timer");
  await expect(mini.getByRole("timer")).toHaveCount(0); // el propio recuadro es el timer
  await expect(mini).toHaveAttribute("role", "timer");
  await expect(mini.locator(".mini-timer-time")).toHaveText(/^(20:00|19:5\d)$/);
  await expect(mini).toContainText("Foco");
  await expect(mini).toContainText("Ciclo 1 de 4");
  // El borde de progreso es un rectángulo redondeado que ocupa el marco.
  const border = await mini.locator(".mini-timer-border .bar").evaluate((rect) => ({
    radius: getComputedStyle(rect).getPropertyValue("rx"),
    dash: getComputedStyle(rect).strokeDashoffset,
    tag: rect.tagName,
  }));
  expect(border.tag).toBe("rect");
  expect(border.radius).toBe("22px");
  expect(parseFloat(border.dash)).toBeGreaterThan(0.7); // 5 de 25 minutos: lleva un 20 %
  expect(parseFloat(border.dash)).toBeLessThan(0.85);

  // Pausar y reanudar desde la ventana flotante maneja el timer de la app.
  await mini.getByRole("button", { name: "Pausar" }).click();
  await expect(card(page).getByRole("button", { name: "Reanudar" })).toBeVisible();
  await mini.getByRole("button", { name: "Reanudar" }).click();
  await expect(card(page).getByRole("button", { name: "Pausar" })).toBeVisible();

  // Sigue al cambiar de sección dentro de la app.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Tareas", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/todo$/);
  await page.clock.fastForward("01:00");
  await expect(mini.locator(".mini-timer-time")).toHaveText(/^1[89]:\d\d$/);

  // El cambio de tema llega a la ventana.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("radio", { name: "Oscuro" }).click();
  await expect(floating.locator("html")).toHaveAttribute("data-theme", "dark");

  // Cerrar la ventana la da de baja.
  await floating.close();
  await page.keyboard.press("Escape");
  await page.goto("/app/study");
  await expect(card(page).getByRole("button", { name: "Timer flotante" })).toHaveAttribute("aria-pressed", "false");
});

test("timer flotante sin ventanas flotantes: un recuadro dentro de la app", async ({ page, context }) => {
  // Navegador sin Document Picture-in-Picture (Firefox, Safari).
  await context.addInitScript(() => {
    delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture;
  });
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await card(page).getByRole("button", { name: "Timer flotante" }).click();
  // En Sesiones ya está el timer grande: el recuadro aparece al ir a otra sección.
  await expect(page.locator(".floating-timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Calendario", exact: true }).click();
  const floating = page.getByRole("complementary", { name: "Timer flotante" });
  await expect(floating.locator(".mini-timer-time")).toHaveText(/^2[45]:\d\d$/);
  await floating.getByRole("button", { name: "Pausar" }).click();
  await expect(floating.getByRole("button", { name: "Reanudar" })).toBeVisible();
  await floating.getByRole("link", { name: "Volver a Sesiones de estudio" }).click();
  await expect(page).toHaveURL(/\/app\/study$/);
  await expect(card(page).getByRole("button", { name: "Reanudar" })).toBeVisible();
});

test("subtareas en el registro: se cuentan las tildadas durante la sesión", async ({ page }) => {
  const task = await db.from("tasks").insert({ title: "Resolver la guía 4", subject_id: subjectId, planned_date: "2026-03-10", sort_order: 1 }).select("id").single();
  await db.from("subtasks").insert([
    { task_id: task.data!.id, title: "Ejercicios 1 a 4", sort_order: 1 },
    { task_id: task.data!.id, title: "Ejercicios 5 a 8", sort_order: 2 },
    { task_id: task.data!.id, title: "Ejercicios 9 a 12", sort_order: 3, completed_at: "2026-03-09T15:00:00Z" },
  ]);
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("05:00");
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  await panel.getByRole("button", { name: /Ver subtareas/ }).click();
  await panel.getByRole("checkbox", { name: "Ejercicios 1 a 4" }).click();
  await panel.getByRole("checkbox", { name: "Ejercicios 5 a 8" }).click();
  await page.clock.fastForward("05:00");
  await card(page).getByRole("button", { name: "Terminar sesión" }).click();

  const summary = page.getByRole("dialog", { name: "Resumen de la sesión" });
  // Dos subtareas tildadas en la sesión (la de ayer no cuenta) y, con ellas, la tarea.
  await expect(summary.locator(".summary-stat").filter({ hasText: "Subtareas completadas" })).toContainText("2");
  await expect(summary.locator(".summary-stat").filter({ has: page.getByText("Tareas completadas", { exact: true }) })).toContainText("1");
  await summary.getByRole("button", { name: "Guardar" }).click();
  await expect.poll(async () => (await sessions()).map((row) => row.subtasks_completed)).toEqual([2]);

  await page.getByRole("tab", { name: "Historial" }).click();
  const table = page.locator(".session-table");
  await expect(table.getByRole("columnheader", { name: "Subtareas" })).toBeVisible();
  const cells = table.locator("tbody tr").first().locator("td");
  await expect(cells.nth(6)).toHaveText("1"); // tareas
  await expect(cells.nth(7)).toHaveText("2"); // subtareas
});

test("historial: corregir una sesión, borrarla con deshacer y anotar una a mano", async ({ page }) => {
  const task = await db.from("tasks").insert({ title: "Leer el capítulo 4", subject_id: subjectId, planned_date: "2026-03-09", sort_order: 1 }).select("id").single();
  const saved = await db
    .from("study_sessions")
    .insert({ preset: "25-5", started_at: "2026-03-09T21:00:00Z", ended_at: "2026-03-09T21:55:00Z", focus_seconds: 3000, break_seconds: 300, cycles_completed: 2 })
    .select("id")
    .single();
  await db.from("study_session_tasks").insert({ session_id: saved.data!.id, task_id: task.data!.id, title: "Leer el capítulo 4" });

  await page.goto("/app/study?tab=history");
  const row = page.locator(".session-table tbody tr").first();
  await expect(row).toContainText("lun 09/03");
  // Las acciones están en un menú por fila: la tabla no suma botones a la vista.
  await expect(row.getByRole("button")).toHaveCount(1);
  await row.getByRole("button", { name: "Opciones de la sesión del lun 09/03" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();

  const dialog = page.getByRole("dialog", { name: "Editar sesión" });
  await expect(dialog.getByLabel("Hora de inicio")).toHaveValue("18:00");
  await expect(dialog.getByLabel("Horas")).toHaveValue("0");
  await expect(dialog.getByLabel("Minutos")).toHaveValue("50");
  await expect(dialog.locator(".session-tasks li")).toHaveText(["Leer el capítulo 4"]);

  // Sin foco no es una sesión.
  await dialog.getByLabel("Minutos").fill("0");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog.getByRole("alert")).toContainText("al menos un minuto");

  // Se agregan horas, se cambia la materia y se corrige qué se hizo.
  await dialog.getByLabel("Horas").fill("2");
  await dialog.getByLabel("Minutos").fill("15");
  await dialog.getByLabel("Materia").selectOption({ label: "Física II" });
  await dialog.getByLabel("Subtareas completadas").fill("4");
  await dialog.getByRole("button", { name: "Quitar: Leer el capítulo 4" }).click();
  await dialog.getByLabel("Tareas completadas", { exact: true }).fill("Ejercicio 7 de la guía");
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await dialog.getByLabel("Tareas completadas", { exact: true }).fill("Leer el capítulo 4");
  await dialog.getByLabel("Tareas completadas", { exact: true }).press("Enter");
  await expect(dialog.locator(".session-tasks li")).toHaveText(["Ejercicio 7 de la guía", "Leer el capítulo 4"]);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".toast")).toContainText("Sesión actualizada");

  await expect(row).toContainText("2 h 15 min");
  await expect(row.locator(".chip")).toHaveText("Física II");
  await expect
    .poll(async () => (await sessions()).map((item) => [item.focus_seconds, item.subject_id, item.subtasks_completed, item.ended_at]))
    .toEqual([[8100, subjectId, 4, "2026-03-09T23:20:00+00:00"]]);
  // Lo que coincide con una tarea queda enlazado; lo demás, solo el texto.
  await expect
    .poll(async () => (await db.from("study_session_tasks").select("title, task_id").order("title")).data)
    .toEqual([
      { title: "Ejercicio 7 de la guía", task_id: null },
      { title: "Leer el capítulo 4", task_id: task.data!.id },
    ]);

  // Borrar, con deshacer.
  await row.getByRole("button", { name: /Opciones de la sesión/ }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Sin sesiones guardadas")).toBeVisible();
  await page.locator(".toast").getByRole("button", { name: "Deshacer" }).click();
  await expect(row).toContainText("2 h 15 min");
  await expect.poll(async () => (await db.from("study_session_tasks").select("id")).data?.length).toBe(2);

  // Anotar una sesión que se hizo sin el timer.
  await page.getByRole("button", { name: "Agregar sesión" }).click();
  const added = page.getByRole("dialog", { name: "Agregar sesión" });
  await added.getByLabel("Hora de inicio").fill("9:30");
  await added.getByLabel("Horas").fill("1");
  await added.getByLabel("Minutos").fill("30");
  await added.getByLabel("Tipo").selectOption({ label: "Examen" });
  await added.getByLabel("Salidas de la página").fill("3");
  await added.getByRole("button", { name: "Guardar" }).click();
  // La más nueva queda primera.
  await expect(page.locator(".session-table tbody tr")).toHaveCount(2);
  await expect(row).toContainText("mar 10/03");
  await expect(row).toContainText("Examen · 3 salidas");
  await expect
    .poll(async () => (await sessions()).map((item) => [item.preset, item.started_at, item.focus_seconds, item.away_count]).at(-1))
    .toEqual(["exam", "2026-03-10T12:30:00+00:00", 5400, 3]);
});

test("Wrapped: la semana, el mes y el cuatrimestre contados en tarjetas", async ({ page }) => {
  const second = await db.from("subjects").insert({ name: "Química", color_key: "turquesa", sort_order: 2 }).select("id").single();
  const session = (day: string, hour: string, minutes: number, subject: string | null, extra: object = {}) => ({
    preset: "50-10",
    subject_id: subject,
    started_at: `${day}T${hour}:00-03:00`,
    ended_at: `${day}T23:59:00-03:00`,
    focus_seconds: minutes * 60,
    break_seconds: 0,
    cycles_completed: 1,
    away_count: 0,
    ...extra,
  });
  const inserted = await db.from("study_sessions").insert([
    session("2026-03-09", "19:00", 120, subjectId),
    session("2026-03-10", "20:00", 60, subjectId, { preset: "exam" }),
    // Semana anterior (lunes): 60 minutos.
    session("2026-03-02", "10:00", 60, null),
    // Febrero.
    session("2026-02-10", "10:00", 300, null),
  ]);
  await db.from("tasks").insert([
    { title: "TP 1", due_date: "2026-03-10", lead_days: 3, completed_at: "2026-03-09T20:00:00Z", sort_order: 1 },
    { title: "Guía 2", planned_date: "2026-03-06", completed_at: "2026-03-10T15:00:00Z", sort_order: 2 },
  ]);
  expect([second.error, inserted.error]).toEqual([null, null]);

  await page.goto("/app/study");
  await page.getByRole("button", { name: "Wrapped" }).click();
  const dialog = page.getByRole("dialog", { name: "Tu Wrapped" });
  const slide = dialog.locator(".wrapped-card");
  const next = dialog.getByRole("button", { name: "Siguiente", exact: true });

  // Portada de la semana.
  await expect(dialog.locator(".wrapped-range")).toHaveText("09/03 al 15/03");
  await expect(slide).toContainText("Tu semana en Tilde");
  await expect(slide).toContainText("2 sesiones en 2 días");
  await next.click();
  // Foco: 3 h contra 1 h a esta altura de la semana pasada (+200 %), y la comparación de escala.
  await expect(slide).toContainText("3 h");
  await expect(slide).toContainText("Un 200 % más que a esta altura de la semana pasada");
  await expect(slide).toContainText("2 partidos de fútbol");
  await next.click();
  // Materia estrella y la que quedó sin estudiar.
  await expect(slide).toContainText("Física II");
  await expect(slide).toContainText("Se llevó el 100 % del foco");
  await expect(slide).toContainText("Química");
  await expect(slide).toHaveClass(/subj-mandarina/);
  // Con el teclado también se pasa de tarjeta.
  await slide.press("ArrowRight");
  await expect(slide).toContainText("Lunes");
  await expect(slide).toContainText("2 días seguidos con sesión");
  await expect(slide).toContainText("después de las seis");
  await slide.press("ArrowRight");
  await expect(slide).toContainText("tareas completadas");
  await expect(slide).toContainText("La entrega salió a tiempo");
  await expect(slide).toContainText("«Guía 2», 4 días de espera");
  await next.click();
  await expect(slide).toContainText("2 h");
  await expect(slide).toContainText("1 simulacro de examen, sin salir de la página ni una vez");
  await next.click();
  // Cierre, con el botón para seguir estudiando.
  await expect(slide).toContainText("En racha");
  await expect(dialog.getByRole("tab")).toHaveCount(7);
  await expect(dialog.getByRole("button", { name: "Empezar una sesión" })).toBeVisible();

  // Mes y cuatrimestre: vuelven a la portada con su propio rango.
  await dialog.getByRole("radio", { name: "Mes", exact: true }).click();
  await expect(dialog.locator(".wrapped-range")).toHaveText("01/03 al 31/03");
  await expect(slide).toContainText("Tu mes en Tilde");
  await expect(slide).toContainText("3 sesiones en 3 días");
  await dialog.getByRole("radio", { name: "Cuatrimestre" }).click();
  await expect(dialog.locator(".wrapped-range")).toHaveText("1.er cuatrimestre de 2026");
  // El período anterior (el verano) tiene lo de febrero; no se puede ir más allá de hoy.
  await expect(dialog.getByRole("button", { name: "Período siguiente" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Período anterior" }).click();
  await expect(dialog.locator(".wrapped-range")).toHaveText("Verano de 2026");
  await expect(slide).toContainText("1 sesión en 1 día");

  // Un período sin nada no inventa números.
  await dialog.getByRole("button", { name: "Período anterior" }).click();
  await expect(slide).toContainText("todavía está en blanco");
  await expect(dialog.getByRole("tab")).toHaveCount(2);
});

test("el tooltip de una tarea bloqueada no se recorta en Tareas de hoy", async ({ page }) => {
  const task = await db.from("tasks").insert({ title: "Resolver la guía 4", planned_date: "2026-03-10", sort_order: 1 }).select("id").single();
  await db.from("subtasks").insert({ task_id: task.data!.id, title: "Ejercicio 1", sort_order: 1 });
  await page.goto("/app/study");
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  await panel.getByRole("checkbox", { name: /Resolver la guía 4/ }).hover();
  const tooltip = page.locator(".tooltip");
  await expect(tooltip).toContainText("Falta 1 subtarea para poder completarla");
  // Se dibuja fuera del panel (que tiene scroll) y entra entero en la pantalla.
  expect(await tooltip.evaluate((element) => element.closest(".side-panel") === null)).toBe(true);
  const box = (await tooltip.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  // Todo el texto a la vista: nada lo tapa en su centro.
  const onTop = await tooltip.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top !== null && element.contains(top);
  });
  expect(onTop).toBe(true);
});
