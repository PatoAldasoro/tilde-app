import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

/** Un teléfono: 390 × 844, táctil. La app está pensada primero para este tamaño. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

let user: TestUser;
let db: SupabaseClient<Database>;
let fisica: string;

test.beforeEach(async ({ context }) => {
  await freezeToday(context); // hoy = martes 10/03/2026, 15:00
  user = await signInFreshUser(context);
  db = await userClient(user);
  const subject = await db.from("subjects").insert({ name: "Física II", color_key: "mandarina", sort_order: 1, credits: 6, grade_course: 8, grade_final: null }).select("id").single();
  fisica = subject.data!.id;
});
test.afterEach(async () => removeUser(user));

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;
/** En un teléfono, algo que se pasa del borde no muestra una barra: agranda la página entera. El ancho tiene que ser el de la pantalla. */
const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth])).toEqual([390, 390]);
const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Secciones" });

test("barra de secciones: las cinco a un toque, con la actual marcada y sin tapar el contenido", async ({ page }) => {
  await page.goto("/app");
  const nav = bottomNav(page);
  await expect(nav.getByRole("link")).toHaveText(["Inicio", "Horario", "Tareas", "Calendario", "Sesiones"]);
  await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  // Pegada al pie, a todo el ancho, con blancos cómodos para el pulgar.
  const bar = await box(page, ".bottom-nav");
  expect(bar.x).toBe(0);
  expect(bar.width).toBe(390);
  expect(Math.round(bar.y + bar.height)).toBe(844);
  for (const item of await nav.getByRole("link").all()) {
    const size = (await item.boundingBox())!;
    expect(size.height).toBeGreaterThanOrEqual(48);
    expect(size.width).toBeGreaterThanOrEqual(64);
  }

  for (const [name, url, title] of [
    ["Horario", /\/app\/schedule$/, "Horario"],
    ["Tareas", /\/app\/todo$/, "Tareas"],
    ["Calendario", /\/app\/calendar$/, "Calendario"],
    ["Sesiones de estudio", /\/app\/study$/, "Sesiones de estudio"],
    ["Inicio", /\/app$/, "Inicio"],
  ] as const) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await noOverflow(page);
  }

  // El contenido termina arriba de la barra: lo último de la página no queda tapado.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = (await page.locator("main > :last-child, main [role='tabpanel'] > :last-child").last().boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(bar.y);

  // El menú lateral sigue estando, con el perfil, los ajustes y el tema.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.locator("#drawer").getByRole("button", { name: "Ajustes" })).toBeVisible();
  expect((await box(page, "#drawer")).width).toBeLessThan(390);
});

test("barra superior: las acciones son íconos con nombre, y los diálogos suben desde abajo a todo el ancho", async ({ page }) => {
  await page.goto("/app");
  // El texto no se ve, pero sigue siendo el nombre del botón.
  const add = page.locator(".topbar-actions").getByRole("button", { name: "Agregar materia" });
  await expect(add).toBeVisible();
  const size = (await add.boundingBox())!;
  expect(size.width).toBe(40);
  expect(size.height).toBe(40);
  // El título entra sin empujar nada afuera.
  const title = await box(page, ".topbar-title");
  expect(title.x + title.width).toBeLessThanOrEqual(size.x);

  await add.click();
  const dialog = page.getByRole("dialog", { name: "Nueva materia" });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => Math.round(((await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height))).toBe(844);
  const sheet = (await dialog.boundingBox())!;
  expect(sheet.x).toBe(0);
  expect(sheet.width).toBe(390);
  expect(sheet.y).toBeGreaterThanOrEqual(24);
  // Los campos van a 16 px (con menos, iOS hace zoom al tocarlos) y los botones del pie se reparten el ancho.
  expect(await dialog.getByLabel("Nombre").evaluate((input) => getComputedStyle(input).fontSize)).toBe("16px");
  const cancel = (await dialog.getByRole("button", { name: "Cancelar" }).boundingBox())!;
  const submit = (await dialog.getByRole("button", { name: "Agregar materia" }).boundingBox())!;
  expect(cancel.width + submit.width).toBeGreaterThan(300);
  await dialog.getByLabel("Nombre").fill("Álgebra");
  await dialog.getByRole("button", { name: "Agregar materia" }).click();
  await expect(page.locator(".subject-card")).toHaveCount(2);
  // Una columna de tarjetas, a todo el ancho.
  const cards = await page.locator(".subject-card").all();
  const [first, second] = [(await cards[0].boundingBox())!, (await cards[1].boundingBox())!];
  expect(first.x).toBe(second.x);
  expect(first.width).toBeGreaterThan(340);
  expect(second.y).toBeGreaterThan(first.y + first.height - 1);
  await noOverflow(page);
});

test("Tareas en el teléfono: el título ocupa el ancho, los datos van debajo y todo se usa con el dedo", async ({ page }) => {
  await db.from("tasks").insert([
    { title: "Entregar el informe del laboratorio de óptica con las mediciones", subject_id: fisica, priority: "high", planned_date: null, due_date: "2026-03-12", lead_days: 5, sort_order: 1 },
    { title: "Leer el capítulo 4", subject_id: null, priority: "none", planned_date: "2026-03-10", due_date: null, lead_days: null, sort_order: 2 },
  ]);
  await page.goto("/app/todo");
  const delivery = page.locator(".task").filter({ hasText: "Entregar el informe" }).first();
  await expect(delivery).toBeVisible();
  // La prioridad y la entrega van en un segundo renglón, debajo del título.
  const title = (await delivery.locator(".task-title").boundingBox())!;
  const side = (await delivery.locator(".task-side").boundingBox())!;
  expect(side.y).toBeGreaterThanOrEqual(title.y + title.height - 4);
  expect(title.width).toBeGreaterThan(200);
  // Una tarea sin datos extra no deja un renglón vacío.
  await expect(page.locator(".task").filter({ hasText: "Leer el capítulo 4" }).first().locator(".task-side")).toBeHidden();

  // Agregar, tildar y abrir el detalle (a pantalla completa).
  const today = page.locator("section.day-group").filter({ has: page.getByRole("heading", { name: "Hoy" }) });
  await today.getByPlaceholder("Agregar tarea").fill("Desde el teléfono");
  await today.getByPlaceholder("Agregar tarea").press("Enter");
  await today.getByRole("checkbox", { name: "Marcar como completada: Leer el capítulo 4" }).tap();
  await expect(today.locator(".task.is-done .task-title")).toHaveText(["Leer el capítulo 4"]);
  await today.getByRole("button", { name: "Desde el teléfono", exact: true }).tap();
  const sheet = (await page.getByRole("dialog", { name: "Detalle de la tarea" }).boundingBox())!;
  expect(sheet.width).toBeCloseTo(390, 0);
  expect(sheet.height).toBeCloseTo(844, 0);
  await page.getByRole("dialog", { name: "Detalle de la tarea" }).getByRole("button", { name: "Cerrar" }).tap();

  // Las acciones de la barra y el menú de orden.
  await page.getByRole("button", { name: /^Ordenar/ }).tap();
  await page.getByRole("menuitemradio", { name: "Prioridad" }).tap();
  await expect.poll(() => today.locator(".task .task-title").allTextContents()).toEqual(["Entregar el informe del laboratorio de óptica con las mediciones", "Desde el teléfono", "Leer el capítulo 4"]);
  // Modo selección: la barra queda arriba de la de secciones, dentro de la pantalla.
  await page.getByRole("button", { name: "Seleccionar", exact: true }).tap();
  const bar = await box(page, ".select-bar");
  const nav = await box(page, ".bottom-nav");
  expect(bar.x).toBeGreaterThanOrEqual(0);
  expect(bar.x + bar.width).toBeLessThanOrEqual(390);
  expect(bar.y + bar.height).toBeLessThanOrEqual(nav.y);
  await noOverflow(page);
});

test("Horario en el teléfono: un día por vez, elegido en la tira de días", async ({ page }) => {
  await db.from("schedule_blocks").insert([
    { subject_id: fisica, weekday: 2, start_time: "14:00", end_time: "16:00", room: "Aula 5" },
    { subject_id: fisica, weekday: 4, start_time: "09:00", end_time: "11:00", room: "Laboratorio" },
  ]);
  await page.goto("/app/schedule");
  const strip = page.getByRole("group", { name: "Día que se muestra" });
  await expect(strip.getByRole("button")).toHaveCount(5);
  // Arranca en hoy (martes 10/03) y muestra solo esa columna, a todo el ancho.
  await expect(strip.getByRole("button", { name: "martes 10/03" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".sched-col:visible")).toHaveCount(1);
  const column = await box(page, ".sched-col:visible");
  expect(column.width).toBeGreaterThan(300);
  await expect(page.locator(".sched-block:visible")).toHaveCount(1);
  await expect(page.locator(".sched-block:visible")).toContainText("Física II");
  await expect(page.locator(".sched-block:visible")).toContainText("Aula 5");

  // Otro día: cambia la columna y sus clases.
  await strip.getByRole("button", { name: "jueves 12/03" }).tap();
  await expect(strip.getByRole("button", { name: "jueves 12/03" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".sched-block:visible")).toContainText("Laboratorio");
  await expect(page.locator(".sched-col:visible")).toHaveCount(1);
  // Un bloque se toca y muestra sus acciones.
  await page.locator(".sched-block:visible").tap();
  await expect(page.getByRole("button", { name: "Omitir esta vez" })).toBeVisible();
  await page.keyboard.press("Escape");

  // La semana siguiente conserva el día elegido; la página (no la grilla) es la que se desplaza.
  await page.getByRole("button", { name: "Semana siguiente" }).tap();
  await expect(strip.getByRole("button", { name: "jueves 19/03" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator(".sched-scroll").evaluate((element) => getComputedStyle(element).overflowY)).toBe("visible");
  await noOverflow(page);
});

test("Calendario en el teléfono: puntos en la grilla, el día se abre al tocarlo y la lista del mes debajo", async ({ page }) => {
  const inserted = await db.from("calendar_events").insert([
    { subject_id: fisica, category: "parcial", title: "", date: "2026-03-12", confirmed: true, lead_days: null },
    { subject_id: null, category: "evento", title: "Charla de becas", date: "2026-03-12", confirmed: true, lead_days: null },
    { subject_id: fisica, category: "final", title: "", date: "2026-03-27", confirmed: true, lead_days: null },
  ]);
  expect(inserted.error).toBeNull();
  await page.goto("/app/calendar");
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  // La grilla entra en la pantalla: siete columnas parejas.
  const cells = await grid.getByRole("gridcell").all();
  const widths = await Promise.all(cells.slice(0, 7).map(async (cell) => (await cell.boundingBox())!.width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  expect(widths.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(390);
  // En las celdas no hay nombres (no entran): un punto por fecha.
  const day12 = grid.getByRole("gridcell", { name: /jueves 12\/03/ });
  await expect(day12.locator(".cal-dot")).toHaveCount(2);
  await expect(day12.locator(".ev:visible")).toHaveCount(0);

  // Tocar el día (en cualquier parte de la celda) abre su lista.
  const cell = (await day12.boundingBox())!;
  await page.touchscreen.tap(cell.x + cell.width / 2, cell.y + cell.height - 8);
  const dayList = page.locator(".day-list");
  await expect(dayList).toContainText("jueves 12/03");
  await expect(dayList).toContainText("Parcial · Física II");
  await expect(dayList).toContainText("Charla de becas");
  await page.keyboard.press("Escape");

  // La lista del mes: cada fecha con su nombre, en orden; tocarla abre sus acciones.
  const agenda = page.getByRole("region", { name: "Fechas de marzo 2026" });
  // Tres días con algo: el 12, el feriado del 24 y el 27.
  await expect(agenda.locator(".cal-agenda-day strong")).toHaveText(["12", "24", "27"]);
  await expect(agenda.locator(".cal-agenda-day").first()).toContainText("Parcial · Física II");
  await expect(agenda.locator(".cal-agenda-day").first()).toContainText("Charla de becas");
  await expect(agenda.locator(".cal-agenda-day").nth(1)).toContainText("Memoria");
  await expect(agenda.locator(".cal-agenda-day").last()).toContainText("Final · Física II");
  await agenda.getByRole("button", { name: /Charla de becas/ }).tap();
  await page.getByRole("button", { name: "Editar" }).tap();
  await expect(page.getByRole("dialog", { name: "Editar fecha" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Un mes sin nada lo dice (septiembre no tiene feriados nacionales).
  for (let month = 0; month < 6; month += 1) await page.getByRole("button", { name: "Mes siguiente" }).tap();
  await expect(page.getByRole("region", { name: "Fechas de septiembre 2026" })).toContainText("Este mes no tiene fechas cargadas.");
  await noOverflow(page);
});

test("Sesiones en el teléfono: el timer entra en la pantalla, las tareas van debajo y el modo foco se desplaza", async ({ page }) => {
  await db.from("tasks").insert([{ title: "Repasar la unidad 3", planned_date: "2026-03-10", sort_order: 1 }]);
  await db.from("study_sessions").insert([
    { subject_id: fisica, preset: "25-5", started_at: "2026-03-09T18:00:00Z", ended_at: "2026-03-09T19:00:00Z", focus_seconds: 3000, break_seconds: 600, cycles_completed: 2 },
  ]);
  await page.goto("/app/study");
  const ring = await box(page, ".timer-card .timer-ring");
  expect(ring.width).toBeLessThanOrEqual(390 - 32);
  expect(Math.abs(ring.width - ring.height)).toBeLessThan(1);
  // El reloj entra dentro del anillo y los cinco controles en un renglón.
  const time = await box(page, ".timer-card .timer-time");
  expect(time.width).toBeLessThan(ring.width - 40);
  const controls = await page.locator(".timer-card .timer-controls > *").all();
  const tops = await Promise.all(controls.map(async (control) => Math.round((await control.boundingBox())!.y + (await control.boundingBox())!.height / 2)));
  expect(new Set(tops).size).toBe(1);
  // Las tareas de hoy van debajo del timer, no al costado.
  const card = await box(page, ".timer-card");
  const panel = await box(page, ".side-panel");
  expect(panel.y).toBeGreaterThan(card.y + card.height);
  expect(panel.width).toBeGreaterThan(340);

  await page.locator(".timer-card").getByRole("button", { name: "Iniciar", exact: true }).tap();
  await expect(page.locator(".timer-card .phase-pill")).toHaveText("Foco");
  // Modo foco: el timer arriba y las tareas debajo, en una sola columna que se desplaza.
  await page.getByRole("button", { name: "Modo foco" }).tap();
  const focus = page.getByRole("dialog", { name: "Modo foco" });
  await expect(focus).toBeVisible();
  const focusRing = (await focus.locator(".timer-ring").boundingBox())!;
  expect(focusRing.width).toBeLessThanOrEqual(390 - 32);
  const side = (await focus.locator(".focus-side").boundingBox())!;
  expect(side.y).toBeGreaterThan(focusRing.y + focusRing.height);
  await expect(focus.getByText("Repasar la unidad 3")).toBeAttached();
  await focus.getByRole("button", { name: "Salir del modo foco" }).tap();
  await page.locator(".timer-card").getByRole("button", { name: "Terminar sesión" }).tap();
  await page.getByRole("dialog", { name: "Resumen de la sesión" }).getByRole("button", { name: "Descartar" }).tap();

  // Historial: cada sesión es una tarjeta con sus números rotulados, no una tabla que se sale.
  await page.getByRole("tab", { name: "Historial" }).tap();
  const row = page.locator(".session-table tbody tr").first();
  await expect(row).toContainText("Física II");
  expect(await row.evaluate((element) => getComputedStyle(element).display)).toBe("grid");
  expect(await row.locator("td.num").first().evaluate((cell) => getComputedStyle(cell, "::before").content)).toBe('"Foco"');
  expect((await row.boundingBox())!.width).toBeLessThanOrEqual(390 - 32);
  await noOverflow(page);
});

test("Notas en el teléfono: una tarjeta por materia, con cada nota rotulada y editable", async ({ page }) => {
  await page.goto("/app?tab=grades");
  const row = page.locator(".grades tbody tr").first();
  await expect(row).toContainText("Física II");
  expect(await row.evaluate((element) => getComputedStyle(element).display)).toBe("grid");
  const labels = await row.locator("td").evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell, "::before").content.replaceAll('"', "")));
  expect(labels).toEqual(["Cuatrimestre", "Créditos", "Cursada", "Final", "Promedio"]);
  // Sigue siendo una tabla para quien la recorre con lector de pantalla.
  await expect(page.getByRole("table", { name: "Notas por materia" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /Física II/ })).toBeVisible();
  // Y se edita igual.
  const final = page.getByRole("textbox", { name: "Final · Física II" });
  await final.fill("9");
  await final.press("Enter");
  await expect.poll(async () => (await db.from("subjects").select("grade_final").eq("id", fisica).single()).data?.grade_final).toBe(9);
  await expect(row.locator(".avg")).toHaveText("8,50");
  await noOverflow(page);
});

test("en escritorio no hay barra de secciones ni tira de días: queda el diseño de siempre", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });
  await freezeToday(context);
  const { sessionCookies } = await import("../scripts/lib/test-session");
  const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  await context.addCookies((await sessionCookies(user)).map((cookie) => ({ ...cookie, url: baseURL })));
  const page = await context.newPage();
  await page.goto(`${baseURL}/app/schedule`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Horario");
  await expect(page.locator(".bottom-nav")).toBeHidden();
  await expect(page.locator(".sched-daystrip")).toBeHidden();
  await expect(page.locator(".sched-col:visible")).toHaveCount(5);
  // Las acciones muestran su texto.
  await expect(page.locator(".topbar-actions").getByRole("button", { name: "Exportar" })).toContainText("Exportar");
  expect((await page.locator(".topbar-actions").getByRole("button", { name: "Exportar" }).boundingBox())!.width).toBeGreaterThan(80);
  await context.close();
});
