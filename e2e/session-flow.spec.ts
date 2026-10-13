import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

let user: TestUser;
let db: SupabaseClient<Database>;

test.beforeEach(async ({ context }) => {
  await freezeToday(context); // hoy = martes 10/03/2026, 15:00 (el reloj corre desde ahí)
  user = await signInFreshUser(context);
  db = await userClient(user);
});
test.afterEach(async () => removeUser(user));

const card = (page: Page) => page.locator(".timer-card");
const time = (page: Page) => page.locator(".timer-card .timer-time");
const pill = (page: Page) => page.locator(".timer-card .phase-pill");
const summary = (page: Page) => page.getByRole("dialog", { name: "Resumen de la sesión" });
const sessions = async () => (await db.from("study_sessions").select("*").order("started_at")).data ?? [];
const start = (page: Page) => card(page).getByRole("button", { name: "Iniciar", exact: true }).click();

/** Un preset corto: un solo ciclo de 5 minutos, con 1 de descanso. */
async function shortPreset(page: Page) {
  await card(page).getByRole("radio", { name: "Personalizado" }).click();
  for (const [id, value] of [["custom-focusMinutes", "5"], ["custom-breakMinutes", "1"], ["custom-cycles", "1"]] as const) {
    await page.locator(`#${id}`).fill(value);
    await page.locator(`#${id}`).press("Enter");
  }
  await expect(time(page)).toHaveText("05:00");
}

test("terminar sin querer: se vuelve con el botón, con Esc o tocando afuera, y la sesión sigue donde estaba", async ({ page }) => {
  await page.goto("/app/study");
  await start(page);
  await page.clock.fastForward("10:00");
  await expect(time(page)).toHaveText(/^1[45]:\d\d$/);

  // Con el botón. El rato que el resumen está en pantalla no corre el reloj.
  await card(page).getByRole("button", { name: "Terminar sesión" }).click();
  await expect(summary(page)).toContainText("Quedó incompleta: 0 de 4 ciclos");
  await expect(summary(page).getByRole("button", { name: "Agregar un ciclo" })).toHaveCount(0);
  await page.clock.fastForward("02:00");
  await summary(page).getByRole("button", { name: "Volver a la sesión" }).click();
  await expect(summary(page)).toBeHidden();
  await expect(page.locator(".toast")).toContainText("La sesión sigue donde estaba.");
  await expect(pill(page)).toHaveText("Foco");
  await expect(time(page)).toHaveText(/^1[45]:\d\d$/);
  await expect(card(page).getByRole("button", { name: "Pausar" })).toBeVisible();

  // Con Esc.
  await card(page).getByRole("button", { name: "Terminar sesión" }).click();
  await expect(summary(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(summary(page)).toBeHidden();
  await expect(time(page)).toHaveText(/^1[45]:\d\d$/);

  // Tocando afuera del resumen.
  await card(page).getByRole("button", { name: "Terminar sesión" }).click();
  await expect(summary(page)).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(summary(page)).toBeHidden();
  await expect(time(page)).toHaveText(/^1[45]:\d\d$/);

  // Si estaba en pausa, vuelve en pausa; "Reiniciar" tiene la misma salida.
  await card(page).getByRole("button", { name: "Pausar" }).click();
  await card(page).getByRole("button", { name: "Reiniciar" }).click();
  await summary(page).getByRole("button", { name: "Volver a la sesión" }).click();
  await expect(card(page).getByRole("button", { name: "Reanudar" })).toBeVisible();
  await expect(card(page).locator(".timer-sub")).toHaveText("En pausa");

  // Volver no guarda ni descarta nada; guardar sigue funcionando, con el foco real.
  expect(await sessions()).toHaveLength(0);
  await card(page).getByRole("button", { name: "Terminar sesión" }).click();
  await summary(page).getByRole("button", { name: "Guardar" }).click();
  await expect.poll(async () => (await sessions()).map((row) => [Math.round(row.focus_seconds / 60), row.cycles_completed])).toEqual([[10, 0]]);
});

test("al completar todos los ciclos hay que decidir, y se puede agregar un ciclo más", async ({ page }) => {
  await page.goto("/app/study");
  await shortPreset(page);
  await start(page);
  await page.clock.fastForward("05:00");

  // Terminó sola: guardar, descartar o seguir. No hay "volver" y no se cierra por error.
  await expect(summary(page)).toBeVisible();
  await expect(summary(page)).not.toContainText("Quedó incompleta");
  await expect(summary(page)).toContainText("Un ciclo más suma un descanso y otro foco.");
  await expect(summary(page).getByRole("button", { name: "Volver a la sesión" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.click(8, 8);
  await expect(summary(page)).toBeVisible();

  // Un ciclo más: arranca el descanso y después viene otro foco.
  await summary(page).getByRole("button", { name: "Agregar un ciclo" }).click();
  await expect(summary(page)).toBeHidden();
  await expect(pill(page)).toHaveText("Descanso");
  await expect(card(page).locator(".cycle-label")).toContainText("Ciclo 1 de 2");
  await expect(time(page)).toHaveText(/^(01:00|00:5\d)$/);
  await page.clock.fastForward("01:00");
  await expect(pill(page)).toHaveText("Foco");
  await expect(card(page).locator(".cycle-label")).toContainText("Ciclo 2 de 2");
  await page.clock.fastForward("05:00");

  // Termina de nuevo, con todo sumado, y se guarda como una sola sesión.
  await expect(summary(page).locator(".summary-stat").first()).toContainText("10 min");
  await expect(summary(page).locator(".summary-stat").nth(2)).toHaveText("2Ciclos");
  await summary(page).getByRole("button", { name: "Guardar" }).click();
  await expect
    .poll(async () => (await sessions()).map((row) => [row.focus_seconds, row.break_seconds, row.cycles_completed]))
    .toEqual([[600, 60, 2]]);
});

test("pasar de fase a mano: el timer avisa, espera contando el tiempo extra y sigue al tocar", async ({ page }) => {
  await page.goto("/app/study");
  const options = card(page).getByRole("button", { name: "Opciones del timer" });
  const menu = page.locator(".adjust-pop");

  // Se elige antes de empezar (o con la sesión en curso): esperar al terminar el foco.
  await options.click();
  await expect(menu).toContainText("Pasar de fase a mano");
  await expect(menu).toContainText("sirve para terminar un ejercicio antes de cortar");
  const holdFocus = menu.getByRole("switch", { name: "Esperar al terminar el foco" });
  const holdBreak = menu.getByRole("switch", { name: "Esperar al terminar el descanso" });
  await expect(holdFocus).toHaveAttribute("aria-checked", "false");
  await holdFocus.click();
  await expect(holdFocus).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await start(page);
  await page.clock.fastForward("25:00");
  // El foco cumplió su tiempo: no pasa solo al descanso. Avisa, y el reloj cuenta para arriba.
  await expect(page.locator(".toast")).toContainText("Terminó el foco. El descanso empieza cuando lo toques.");
  await expect(pill(page)).toHaveText("Foco");
  await expect(time(page)).toHaveText(/^\+00:0\d$/);
  await expect(card(page).locator(".timer-sub")).toHaveText("Tiempo extra");
  await expect(page).toHaveTitle(/^\+00:\d\d · Foco · Tilde$/);
  const toBreak = card(page).getByRole("button", { name: "Empezar el descanso" });
  await expect(toBreak).toBeVisible();
  // Tres minutos terminando el ejercicio: siguen contando.
  await page.clock.fastForward("03:00");
  await expect(time(page)).toHaveText(/^\+03:0\d$/);

  // Al tocarlo, el descanso empieza entero. Ese no espera: pasa solo al foco siguiente.
  await toBreak.click();
  await expect(pill(page)).toHaveText("Descanso");
  await expect(time(page)).toHaveText(/^(05:00|04:5\d)$/);
  await expect(toBreak).toHaveCount(0);
  await page.clock.fastForward("05:00");
  await expect(pill(page)).toHaveText("Foco");
  await expect(card(page).locator(".cycle-label")).toContainText("Ciclo 2 de 4");

  // Con la sesión en curso se suma la espera del descanso.
  await options.click();
  await holdBreak.click();
  await expect(holdBreak).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await page.clock.fastForward("25:00");
  await card(page).getByRole("button", { name: "Empezar el descanso" }).click();
  await page.clock.fastForward("05:00");
  await expect(page.locator(".toast")).toContainText("Terminó el descanso. El foco empieza cuando lo toques.");
  await expect(pill(page)).toHaveText("Descanso");
  await expect(time(page)).toHaveText(/^\+00:0\d$/);
  await card(page).getByRole("button", { name: "Empezar el foco" }).click();
  await expect(pill(page)).toHaveText("Foco");
  await expect(card(page).locator(".cycle-label")).toContainText("Ciclo 3 de 4");

  // El tiempo extra contó como foco: 25 + 3 del primero y 25 del segundo.
  await card(page).getByRole("button", { name: "Terminar sesión" }).click();
  await expect(summary(page).locator(".summary-stat").first()).toContainText("53 min");
  await summary(page).getByRole("button", { name: "Descartar" }).click();

  // La elección se recuerda en el dispositivo.
  await page.reload();
  await card(page).getByRole("button", { name: "Opciones del timer" }).click();
  await expect(page.locator(".adjust-pop").getByRole("switch", { name: "Esperar al terminar el foco" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".adjust-pop").getByRole("switch", { name: "Esperar al terminar el descanso" })).toHaveAttribute("aria-checked", "true");
});

test("pasar de fase a mano en el último foco: la sesión termina al tocar, completa", async ({ page }) => {
  await page.goto("/app/study");
  await shortPreset(page);
  await card(page).getByRole("button", { name: "Opciones del timer" }).click();
  await page.locator(".adjust-pop").getByRole("switch", { name: "Esperar al terminar el foco" }).click();
  await page.keyboard.press("Escape");
  await start(page);
  await page.clock.fastForward("05:00");
  await expect(page.locator(".toast")).toContainText("Terminó el último foco. La sesión termina cuando lo toques.");
  // No se cierra sola: espera, con el tiempo extra corriendo.
  await expect(summary(page)).toHaveCount(0);
  await page.clock.fastForward("02:00");
  await expect(time(page)).toHaveText(/^\+02:0\d$/);
  await card(page).getByRole("button", { name: "Terminar la sesión" }).click();
  // Llegó al final: está completa (7 minutos de foco) y se le puede agregar un ciclo.
  await expect(summary(page)).not.toContainText("Quedó incompleta");
  await expect(summary(page).locator(".summary-stat").first()).toContainText("7 min");
  await expect(summary(page).getByRole("button", { name: "Agregar un ciclo" })).toBeVisible();
  await expect(summary(page).getByRole("button", { name: "Volver a la sesión" })).toHaveCount(0);
});

test("entregar un examen sin querer: se vuelve y el examen sigue, en rojo y a pantalla completa", async ({ page }) => {
  await page.goto("/app/study");
  await card(page).getByRole("radio", { name: "Examen" }).click();
  await card(page).getByRole("radio", { name: "1 h 30 min" }).click();
  await start(page);
  const focus = page.getByRole("dialog", { name: "Modo foco" });
  await page.clock.fastForward("20:00");
  await focus.getByRole("button", { name: "Entregar el examen" }).click();
  const examSummary = page.getByRole("dialog", { name: "Resumen del examen" });
  await expect(examSummary.locator(".summary-stat").first()).toContainText("20 min");
  // Un examen que no llegó al final no ofrece agregar un ciclo; sí volver.
  await expect(examSummary.getByRole("button", { name: "Agregar un ciclo" })).toHaveCount(0);
  await examSummary.getByRole("button", { name: "Volver al examen" }).click();
  await expect(examSummary).toBeHidden();
  await expect(focus.locator(".phase-pill")).toHaveText("Examen");
  await expect(focus.locator(".timer-time")).toHaveText(/^1:(10:00|09:5\d)$/);
  await expect(page.locator("html")).toHaveAttribute("data-exam", "");
  await expect(focus.getByRole("button", { name: "Entregar el examen" })).toBeVisible();

  // Cuando el tiempo se cumple termina solo: ahí no hay vuelta atrás ni ciclo que agregar.
  await page.clock.fastForward("01:10:00");
  await expect(examSummary.locator(".summary-stat").first()).toContainText("1 h 30 min");
  await expect(examSummary.getByRole("button", { name: "Volver al examen" })).toHaveCount(0);
  await expect(examSummary.getByRole("button", { name: "Agregar un ciclo" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(examSummary).toBeVisible();
});
