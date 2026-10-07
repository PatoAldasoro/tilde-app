import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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

test("modo examen: de corrido, en rojo, a pantalla completa, sin tareas, con la pausa en un submenú y las salidas anotadas", async ({ page }) => {
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
  // No hay descansos ni se ajusta el tiempo, y el botón principal entrega: a la vista no hay cómo pausar.
  await expect(focus.getByRole("button", { name: "Pausar", exact: true })).toHaveCount(0);
  await expect(focus.getByRole("button", { name: /^Ajustar el tiempo/ })).toHaveCount(0);
  await expect(focus.getByRole("button", { name: /^Saltar descanso/ })).toHaveAttribute("aria-disabled", "true");
  await expect(focus.getByRole("button", { name: "Entregar el examen" })).toBeVisible();

  // Pausar se puede, pero un paso más lejos: en el menú del reloj.
  await focus.getByRole("button", { name: "Opciones del examen" }).click();
  const options = page.locator(".adjust-pop");
  await expect(options).toContainText("Un examen de verdad no se pausa");
  await expect(options.getByRole("group")).toHaveCount(0); // sin adelantar ni atrasar
  await options.getByRole("button", { name: "Pausar el examen" }).click();
  await expect(options).toBeHidden();
  await expect(focus.locator(".timer-sub")).toContainText("En pausa");
  await expect(page).toHaveTitle(/^1:(29|30):\d\d · En pausa · Tilde$/);
  // En pausa el reloj no corre, el rojo y la pantalla completa siguen, y salir de la página no se anota.
  const frozen = await focus.locator(".timer-time").textContent();
  await page.clock.fastForward("05:00");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(focus.locator(".timer-time")).toHaveText(frozen!);
  await expect(focus.locator(".timer-sub")).not.toContainText("salida");
  await expect(page.locator("html")).toHaveAttribute("data-exam", "");
  expect(await fullscreen()).toBe(true);
  await expect(taskLists).toHaveCount(0);
  // El menú ahora ofrece reanudar; el botón principal también (volver es fácil, pausar no).
  await focus.getByRole("button", { name: "Opciones del examen" }).click();
  await expect(options.getByRole("button", { name: "Pausar el examen" })).toHaveCount(0);
  await expect(options.getByRole("button", { name: "Reanudar el examen" })).toBeVisible();
  await page.keyboard.press("Escape");
  await focus.getByRole("button", { name: "Reanudar", exact: true }).click();
  await expect(focus.getByRole("button", { name: "Entregar el examen" })).toBeVisible();
  await expect(focus.locator(".timer-sub")).toContainText("Termina a las");

  // Salir de la página (otra ventana) suena y queda anotado; al volver avisa cuántas van.
  await page.clock.fastForward("10:00");
  const before = await notes(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(() => notes(page)).toBe(before + 6);
  await page.clock.fastForward("00:30");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".toast")).toContainText("Saliste de la página. Va 1 salida en este examen.");
  // El aviso se ve por encima del modo foco (no queda tapado).
  const onTop = await page.locator(".toast").first().evaluate((toast) => {
    const box = toast.getBoundingClientRect();
    return toast.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  });
  expect(onTop).toBe(true);
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

/** Colores de los tokens tal como llegan al video (el códec los mueve apenas). */
const near = (pixel: number[], hex: string, tolerance = 14) => {
  const expected = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return pixel.every((value, index) => Math.abs(value - expected[index]) <= tolerance);
};

/**
 * La ventana de imagen en imagen es del navegador, no una página: se la mira por el video que la
 * alimenta. Estos ayudantes leen sus píxeles, los textos que se le dibujaron y disparan sus botones.
 */
async function watchPip(context: BrowserContext) {
  await context.addInitScript(() => {
    const state = window as unknown as { __texts: string[]; __media: Record<string, (() => void) | null> };
    state.__texts = [];
    state.__media = {};
    // Cada cuadro empieza pintando el fondo entero; después van la fase, el detalle y el reloj, dígito por dígito.
    let drawing: string[] = [];
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function patched(this: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
      if (width === this.canvas.width && height === this.canvas.height) drawing = [];
      return fillRect.call(this, x, y, width, height);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function patched(this: CanvasRenderingContext2D, text: string, x: number, y: number) {
      drawing.push(text);
      state.__texts = [drawing[0], drawing[1] ?? "", drawing.slice(2).join("")];
      return fillText.call(this, text, x, y);
    };
    // Los botones de la ventana llegan como acciones de Media Session.
    const setActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (action, handler) => {
      state.__media[action] = handler as (() => void) | null;
      setActionHandler(action, handler);
    };
  });
}
const pipVideo = (page: Page) =>
  page.evaluate(() => {
    const video = document.pictureInPictureElement as HTMLVideoElement | null;
    return video ? { tag: video.tagName, width: video.videoWidth, height: video.videoHeight, paused: video.paused, source: video.className } : null;
  });
/** Los tres textos del último cuadro: fase, detalle y reloj. */
const pipTexts = (page: Page) => page.evaluate(() => (window as unknown as { __texts: string[] }).__texts);
const pipPixel = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([px, py]) => {
      const video = document.pictureInPictureElement as HTMLVideoElement;
      const probe = document.createElement("canvas");
      probe.width = video.videoWidth;
      probe.height = video.videoHeight;
      const ctx = probe.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      return Array.from(ctx.getImageData(px, py, 1, 1).data.slice(0, 3));
    },
    [x, y],
  );
const pressPip = (page: Page, action: "play" | "pause") =>
  page.evaluate((name) => (window as unknown as { __media: Record<string, (() => void) | null> }).__media[name]?.(), action);
const pipButtons = (page: Page) =>
  page.evaluate(() => {
    const media = (window as unknown as { __media: Record<string, (() => void) | null> }).__media;
    return ["play", "pause"].filter((action) => typeof media[action] === "function");
  });

test("timer flotante: la ventana de imagen en imagen del navegador, sin marco, que también maneja el timer", async ({ page, context }) => {
  await watchPip(context);
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.fastForward("05:00");
  const toggle = card(page).getByRole("button", { name: "Timer flotante" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // Es un video en imagen en imagen (16:9), no una ventana nueva del navegador con su marco.
  await expect.poll(() => pipVideo(page)).toEqual({ tag: "VIDEO", width: 960, height: 540, paused: false, source: "pip-source" });
  expect(context.pages()).toHaveLength(1);
  // El video que la alimenta no se ve en la página.
  const hidden = await page.locator("video.pip-source").evaluate((video) => ({ ...video.getBoundingClientRect().toJSON(), opacity: getComputedStyle(video).opacity }));
  expect(hidden).toMatchObject({ width: 1, height: 1, opacity: "0" });

  // Lo que muestra: fase, ciclo y reloj, dentro de un rectángulo redondeado cuyo borde es el progreso.
  await expect.poll(() => pipTexts(page)).toEqual(["Foco", "Ciclo 1 de 4", expect.stringMatching(/^(20:00|19:5\d)$/)]);
  // 5 de 25 minutos: el borde lleva un 20 %, que sale del borde de arriba hacia la derecha.
  await expect.poll(async () => near(await pipPixel(page, 300, 24), "#E44919")).toBe(true); // acento: ya recorrido
  expect(near(await pipPixel(page, 820, 24), "#E44919")).toBe(false); // todavía no
  expect(near(await pipPixel(page, 480, 516), "#E44919")).toBe(false);
  const background = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim());
  const light = await background();
  expect(near(await pipPixel(page, 2, 2), light, 8)).toBe(true);
  expect(near(await pipPixel(page, 30, 30), light, 8)).toBe(true); // dentro del radio de la esquina: es fondo, no tarjeta

  // El botón de pausa de la ventana maneja el timer de la app, y el video queda detenido igual que él.
  expect(await pipButtons(page)).toEqual(["play", "pause"]);
  await pressPip(page, "pause");
  await expect(card(page).getByRole("button", { name: "Reanudar" })).toBeVisible();
  await expect.poll(() => pipTexts(page)).toEqual(["Foco", "En pausa", expect.stringMatching(/^(20:00|19:5\d)$/)]);
  await expect.poll(async () => (await pipVideo(page))?.paused).toBe(true);
  await pressPip(page, "play");
  await expect(card(page).getByRole("button", { name: "Pausar" })).toBeVisible();
  await expect.poll(async () => (await pipVideo(page))?.paused).toBe(false);

  // Hay navegadores donde ese botón detiene el video en vez de avisar: también pausa y reanuda el timer.
  await page.evaluate(() => (document.pictureInPictureElement as HTMLVideoElement).pause());
  await expect(card(page).getByRole("button", { name: "Reanudar" })).toBeVisible();
  await expect.poll(() => pipTexts(page)).toEqual(["Foco", "En pausa", expect.stringMatching(/^(20:00|19:5\d)$/)]);
  await expect.poll(async () => (await pipVideo(page))?.paused).toBe(true);
  await page.evaluate(() => (document.pictureInPictureElement as HTMLVideoElement).play());
  await expect(card(page).getByRole("button", { name: "Pausar" })).toBeVisible();
  await expect.poll(async () => (await pipVideo(page))?.paused).toBe(false);

  // Sigue al cambiar de sección, sin recuadro dentro de la app, y el reloj avanza.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Tareas", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/todo$/);
  await page.clock.fastForward("01:00");
  await expect.poll(() => pipTexts(page)).toEqual(["Foco", "Ciclo 1 de 4", expect.stringMatching(/^1[89]:\d\d$/)]);
  await expect(page.locator(".floating-timer")).toHaveCount(0);

  // El cambio de tema llega a la ventana.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("radio", { name: "Oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const dark = await background();
  expect(dark).not.toBe(light);
  await expect.poll(async () => near(await pipPixel(page, 2, 2), dark, 8)).toBe(true);

  // Cerrar la ventana (su botón de cerrar) la da de baja. El navegador detiene el video al cerrarla:
  // eso no pausa la sesión.
  await page.locator("#drawer").getByRole("link", { name: "Sesiones de estudio", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    (document.pictureInPictureElement as HTMLVideoElement).pause();
    return document.exitPictureInPicture();
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("video.pip-source")).toHaveCount(0);
  await page.waitForTimeout(700);
  await expect(card(page).getByRole("button", { name: "Pausar" })).toBeVisible();

  // Y se abre y se cierra de nuevo desde el botón de la app.
  await toggle.click();
  await expect.poll(async () => (await pipVideo(page))?.tag).toBe("VIDEO");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => pipVideo(page)).toBeNull();
});

test("timer flotante en un examen: muestra el examen en rojo y no tiene botón de pausa", async ({ page, context }) => {
  await watchPip(context);
  await page.goto("/app/study");
  await card(page).getByRole("radio", { name: "Examen" }).click();
  await card(page).getByRole("radio", { name: "1 h 30 min" }).click();
  await card(page).getByRole("button", { name: "Timer flotante" }).click();
  await expect.poll(async () => (await pipVideo(page))?.tag).toBe("VIDEO");
  // Un examen se empieza desde la app (pasa a pantalla completa), no desde la ventana.
  await expect.poll(() => pipTexts(page)).toEqual(["Examen listo", "De corrido, sin descansos", "1:30:00"]);
  expect(await pipButtons(page)).toEqual([]);

  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  const focus = page.getByRole("dialog", { name: "Modo foco" });
  await page.clock.fastForward("45:00");
  await expect.poll(() => pipTexts(page)).toEqual(["Examen", expect.stringMatching(/^Termina a las 16:30$/), expect.stringMatching(/^0:4[45]:\d\d$/)]);
  // Mitad del examen: el borde va por la mitad, en el rojo de examen.
  await expect.poll(async () => near(await pipPixel(page, 700, 24), "#E11D48")).toBe(true);
  expect(await pipButtons(page)).toEqual([]);

  // Pausado desde el menú del reloj, la ventana lo dice; sigue sin botones.
  await focus.getByRole("button", { name: "Opciones del examen" }).click();
  await page.locator(".adjust-pop").getByRole("button", { name: "Pausar el examen" }).click();
  await expect.poll(() => pipTexts(page)).toEqual(["Examen", "En pausa", expect.stringMatching(/^0:4[45]:\d\d$/)]);
  expect(await pipButtons(page)).toEqual([]);
  expect((await pipVideo(page))?.paused).toBe(false);

  // Con el examen corriendo, detener el video desde la ventana no lo pausa: el video se reanuda solo.
  await focus.getByRole("button", { name: "Reanudar", exact: true }).click();
  await page.evaluate(() => (document.pictureInPictureElement as HTMLVideoElement).pause());
  await page.waitForTimeout(900);
  await expect(focus.getByRole("button", { name: "Entregar el examen" })).toBeVisible();
  await expect(focus.locator(".timer-sub")).toContainText("Termina a las");
  await expect.poll(async () => (await pipVideo(page))?.paused).toBe(false);
});

test("timer flotante sin imagen en imagen: un recuadro dentro de la app", async ({ page, context }) => {
  // Navegador sin la API de imagen en imagen para videos.
  await context.addInitScript(() => {
    delete (HTMLVideoElement.prototype as { requestPictureInPicture?: unknown }).requestPictureInPicture;
  });
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await card(page).getByRole("button", { name: "Timer flotante" }).click();
  await expect(card(page).getByRole("button", { name: "Timer flotante" })).toHaveAttribute("aria-pressed", "true");
  // En Sesiones ya está el timer grande: el recuadro aparece al ir a otra sección.
  await expect(page.locator(".floating-timer")).toHaveCount(0);
  await expect(page.locator("video.pip-source")).toHaveCount(0);
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

test("timer flotante: si el navegador rechaza la imagen en imagen, queda el recuadro dentro de la app", async ({ page, context }) => {
  await context.addInitScript(() => {
    HTMLVideoElement.prototype.requestPictureInPicture = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
  });
  await page.goto("/app/study");
  await card(page).getByRole("button", { name: "Iniciar", exact: true }).click();
  await card(page).getByRole("button", { name: "Timer flotante" }).click();
  await expect(card(page).getByRole("button", { name: "Timer flotante" })).toHaveAttribute("aria-pressed", "true");
  // No queda un video suelto en la página.
  await expect(page.locator("video.pip-source")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("#drawer").getByRole("link", { name: "Calendario", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Timer flotante" }).locator(".mini-timer-time")).toHaveText(/^2[45]:\d\d$/);
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
