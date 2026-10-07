import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

let user: TestUser;
let db: SupabaseClient<Database>;
let subjectId: string;

test.beforeEach(async ({ context }) => {
  await freezeToday(context); // hoy = martes 10/03/2026, 15:00
  user = await signInFreshUser(context);
  db = await userClient(user);
  const subject = await db.from("subjects").insert({ name: "Física II", color_key: "mandarina", icon: "atom" }).select("id").single();
  subjectId = subject.data!.id;
});
test.afterEach(async () => removeUser(user));

const drawer = (page: Page) => page.locator("#drawer");
const day = (page: Page, title: string | RegExp) => page.locator("section.day-group").filter({ has: page.getByRole("heading", { name: title }) });

// ---------- 1. subtareas en "Tareas de hoy" ----------

test("sesiones: las subtareas se despliegan en Tareas de hoy y destraban la tarea", async ({ page }) => {
  const task = await db.from("tasks").insert({ title: "Resolver la guía 4", subject_id: subjectId, planned_date: "2026-03-10", sort_order: 1 }).select("id").single();
  await db.from("subtasks").insert([
    { task_id: task.data!.id, title: "Ejercicios 1 a 4", sort_order: 1 },
    { task_id: task.data!.id, title: "Ejercicios 5 a 8", sort_order: 2 },
  ]);
  await page.goto("/app/study");
  const panel = page.getByRole("complementary", { name: "Tareas de hoy" });
  const row = panel.locator(".mini-task-group");
  await expect(row.locator(".subcount")).toHaveText("0/2");
  await expect(row.getByRole("checkbox", { name: "Ejercicios 1 a 4" })).toHaveCount(0);

  // Tocar la tarea bloqueada despliega sus subtareas (antes no había forma de llegar a ellas).
  await row.getByRole("checkbox", { name: /Resolver la guía 4/ }).click({ force: true });
  await expect(row.getByRole("button", { name: /Ocultar subtareas/ })).toHaveAttribute("aria-expanded", "true");
  await row.getByRole("checkbox", { name: "Ejercicios 1 a 4" }).click();
  await expect(row.locator(".subcount")).toHaveText("1/2");
  // Al completar la última, la tarea se completa sola.
  await row.getByRole("checkbox", { name: "Ejercicios 5 a 8" }).click();
  await expect(row.getByRole("checkbox", { name: /Resolver la guía 4/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await db.from("tasks").select("completed_at").single()).data?.completed_at).not.toBeNull();

  // El botón pliega y despliega, también en el modo foco.
  await row.getByRole("button", { name: /Ocultar subtareas/ }).click();
  await expect(row.getByRole("checkbox", { name: "Ejercicios 1 a 4" })).toHaveCount(0);
  await page.getByRole("button", { name: "Modo foco" }).click();
  const focus = page.getByRole("dialog", { name: "Modo foco" });
  await focus.getByRole("button", { name: /Ver subtareas/ }).click();
  await expect(focus.getByRole("checkbox", { name: "Ejercicios 5 a 8" })).toHaveAttribute("aria-checked", "true");
});

// ---------- 2. importar tareas ----------

test("tareas: importar un plan en JSON, con vista previa, avisos y deshacer", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/app/todo");
  await page.getByRole("button", { name: "Importar" }).click();
  const dialog = page.getByRole("dialog", { name: "Importar tareas" });
  const submit = dialog.getByRole("button", { name: /^Importar/ }).last();
  await expect(submit).toBeDisabled();

  // El pedido para la IA incluye el formato, las materias propias y la fecha de hoy.
  await dialog.getByRole("button", { name: "Copiar pedido" }).click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain('"tasks"');
  expect(prompt).toContain("«Física II»");
  expect(prompt).toContain("2026-03-10");

  const plan = dialog.getByLabel("Plan en JSON");
  await plan.fill("esto no es un plan");
  await expect(dialog.getByRole("alert")).toContainText("No se encontró un JSON válido");
  await expect(submit).toBeDisabled();

  // Respuesta de una IA pegada tal cual: texto, bloque de código y un elemento que no sirve.
  await plan.fill(
    [
      "¡Claro! Acá va el plan:",
      "```json",
      JSON.stringify({
        tasks: [
          { title: "Leer el capítulo 4", date: "2026-03-10", subject: "física ii", priority: "high" },
          { title: "Resolver la guía 5", date: "2026-03-11", subject: "Física II", subtasks: ["Ejercicios 1 a 5", "Ejercicios 6 a 10"] },
          { title: "Entregar el informe", due: "2026-03-16", lead_days: 4, subject: "Historia" },
          { date: "2026-03-12" },
        ],
      }),
      "```",
    ].join("\n"),
  );
  await expect(dialog.getByText("3 tareas en 3 días")).toBeVisible();
  await expect(dialog.getByText(/no existen en Tilde.*Historia/)).toBeVisible();
  await expect(dialog.getByText("1 elemento no se pudo importar")).toBeVisible();
  await expect(dialog.getByText(/N\.º 4: le falta el título/)).toBeVisible();
  await dialog.getByRole("button", { name: "Importar 3 tareas" }).click();

  await expect(page.locator(".toast")).toContainText("3 tareas importadas");
  const today = day(page, "Hoy");
  await expect(today.locator(".task").filter({ hasText: "Leer el capítulo 4" }).locator(".chip")).toHaveText("Física II");
  const tomorrow = day(page, "Mañana");
  await expect(tomorrow.locator(".task").filter({ hasText: "Resolver la guía 5" }).locator(".subcount")).toHaveText("0/2");
  // La entrega del 16/03 aparece 4 días antes: desde el jueves 12.
  await expect(day(page, "Jueves").locator(".task").filter({ hasText: "Entregar el informe" })).toBeVisible();
  await expect(tomorrow.locator(".task").filter({ hasText: "Entregar el informe" })).toHaveCount(0);

  await expect.poll(async () => (await db.from("tasks").select("id")).data?.length).toBe(3);
  const saved = (await db.from("tasks").select("title, planned_date, due_date, lead_days, priority, subject_id").order("sort_order")).data!;
  expect(saved).toEqual([
    { title: "Leer el capítulo 4", planned_date: "2026-03-10", due_date: null, lead_days: null, priority: "high", subject_id: subjectId },
    { title: "Resolver la guía 5", planned_date: "2026-03-11", due_date: null, lead_days: null, priority: "none", subject_id: subjectId },
    { title: "Entregar el informe", planned_date: null, due_date: "2026-03-16", lead_days: 4, priority: "none", subject_id: null },
  ]);
  expect((await db.from("subtasks").select("title").order("sort_order")).data).toEqual([{ title: "Ejercicios 1 a 5" }, { title: "Ejercicios 6 a 10" }]);

  // Deshacer se lleva todo lo importado.
  await page.locator(".toast").getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".task")).toHaveCount(0);
  await expect.poll(async () => (await db.from("tasks").select("id")).data?.length).toBe(0);
});

// ---------- 3. importar al calendario ----------

const ics = (...events: string[][]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-CALNAME:Facultad", ...events.flatMap((lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");

const PARCIAL = ["UID:parcial@cal", "SUMMARY:Parcial de Física II", "DTSTART:20260317T210000Z"];
const ENTREGA = ["UID:tp@cal", "SUMMARY:Entrega TP 2", "DTSTART;VALUE=DATE:20260320"];
const DENTISTA = ["UID:dentista@cal", "SUMMARY:Dentista", "DTSTART;TZID=America/Argentina/Buenos_Aires:20260318T103000"];
const CONSULTA = ["UID:consulta@cal", "SUMMARY:Consulta semanal", "DTSTART;VALUE=DATE:20260312", "RRULE:FREQ=WEEKLY;COUNT=4"];
const VIEJO = ["UID:viejo@cal", "SUMMARY:Inscripción", "DTSTART;VALUE=DATE:20260220"];

const cell = (page: Page, label: RegExp) => page.getByRole("gridcell", { name: label });

async function chooseIcs(page: Page, content: string, name = "facultad.ics") {
  await page.getByRole("dialog", { name: "Importar fechas" }).locator('input[type="file"]').setInputFiles({ name, mimeType: "text/calendar", buffer: Buffer.from(content) });
}

test("calendario: importar un .ics propone categoría y materia, crea la tarea del TP y no duplica", async ({ page }) => {
  await page.goto("/app/calendar");
  await page.getByRole("button", { name: "Importar" }).click();
  const dialog = page.getByRole("dialog", { name: "Importar fechas" });

  await chooseIcs(page, "esto no es un calendario", "notas.txt");
  await expect(dialog.getByRole("alert")).toHaveText("No es un archivo de calendario (.ics).");

  await chooseIcs(page, ics(PARCIAL, ENTREGA, DENTISTA, CONSULTA, VIEJO));
  const rows = dialog.locator(".import-item");
  // Las fechas pasadas quedan afuera salvo que se pidan.
  await expect(rows).toHaveCount(4);
  await expect(dialog.getByText("7 fechas para revisar")).toBeVisible();

  const parcial = rows.filter({ hasText: "Parcial de Física II" });
  await expect(parcial.locator(".import-when")).toHaveText(/mar 17\/03\s*18:00/);
  await expect(parcial.getByRole("combobox", { name: /^Categoría/ })).toHaveValue("parcial");
  await expect(parcial.getByRole("combobox", { name: /^Materia/ })).toHaveValue(subjectId);
  await expect(rows.filter({ hasText: "Entrega TP 2" }).getByRole("combobox", { name: /^Categoría/ })).toHaveValue("tp");
  await expect(rows.filter({ hasText: "Dentista" }).getByRole("combobox", { name: /^Categoría/ })).toHaveValue("evento");

  // La serie semanal va en una sola fila y sin marcar.
  const series = rows.filter({ hasText: "Consulta semanal" });
  await expect(series).toContainText("Se repite · 4 fechas");
  await expect(series.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");

  await dialog.getByRole("switch", { name: "Incluir fechas pasadas" }).click();
  await expect(rows).toHaveCount(5);
  await dialog.getByRole("switch", { name: "Incluir fechas pasadas" }).click();

  await rows.filter({ hasText: "Entrega TP 2" }).getByRole("combobox", { name: /^Materia/ }).selectOption(subjectId);
  await dialog.getByRole("button", { name: "Importar 3 fechas" }).click();
  await expect(page.locator(".toast")).toContainText("3 fechas importadas");

  const exam = cell(page, /^martes 17\/03/).locator(".ev");
  await expect(exam).toHaveText("Parcial de Física II");
  await expect(exam).toHaveClass(/cat-parcial/);
  await expect(exam).toHaveClass(/subj-mandarina/);
  await expect(cell(page, /^miércoles 18\/03/).locator(".ev.cat-evento")).toHaveText("Dentista");
  await expect(cell(page, /^viernes 20\/03/).locator(".ev.cat-tp")).toHaveText("Entrega TP 2");

  // La hora queda guardada y se ve al abrir la fecha.
  await exam.click();
  await expect(page.locator(".popover")).toContainText("Parcial · martes 17/03 · 18:00");
  await page.keyboard.press("Escape");

  // El TP importado genera su tarea, como cualquier TP.
  await expect
    .poll(async () => (await db.from("tasks").select("title, due_date, lead_days, subject_id")).data)
    .toEqual([{ title: "TP · Entrega TP 2", due_date: "2026-03-20", lead_days: 3, subject_id: subjectId }]);
  const events = (await db.from("calendar_events").select("title, date, start_time, category, external_id").order("date")).data!;
  expect(events).toEqual([
    { title: "Parcial de Física II", date: "2026-03-17", start_time: "18:00:00", category: "parcial", external_id: "ics:parcial@cal" },
    { title: "Dentista", date: "2026-03-18", start_time: "10:30:00", category: "evento", external_id: "ics:dentista@cal" },
    { title: "Entrega TP 2", date: "2026-03-20", start_time: null, category: "tp", external_id: "ics:tp@cal" },
  ]);

  // Volver a importar el mismo archivo: lo que ya está no se duplica; un cambio de fecha se ofrece como tal.
  await page.getByRole("button", { name: "Importar" }).click();
  const moved = ["UID:tp@cal", "SUMMARY:Entrega TP 2", "DTSTART;VALUE=DATE:20260323"];
  await chooseIcs(page, ics(PARCIAL, moved, DENTISTA));
  await expect(dialog.getByText("1 fecha para revisar · 2 ya importadas")).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Cambió de fecha");
  await dialog.getByRole("button", { name: "Importar 1 fecha" }).click();
  await expect(cell(page, /^lunes 23\/03/).locator(".ev.cat-tp")).toHaveText("Entrega TP 2");
  await expect(cell(page, /^viernes 20\/03/).locator(".ev")).toHaveCount(0);
  // La tarea del TP sigue a su fecha.
  await expect.poll(async () => (await db.from("tasks").select("due_date").single()).data?.due_date).toBe("2026-03-23");
  expect((await db.from("calendar_events").select("id")).data).toHaveLength(3);
});

test("calendario vinculado: se lee por el servidor, avisa las novedades y recuerda lo descartado", async ({ page }) => {
  const url = "https://calendar.google.com/calendar/ical/yo%40gmail.com/private-abc123/basic.ics";
  let feedContent = ics(PARCIAL, DENTISTA);
  let requested: unknown = null;
  // La descarga real la hace /api/ical contra Google: acá se reemplaza por un calendario de prueba.
  await page.route("**/api/ical", async (route) => {
    requested = route.request().postDataJSON();
    await route.fulfill({ json: { ics: feedContent } });
  });

  await page.goto("/app/calendar");
  await page.getByRole("button", { name: "Importar" }).click();
  const dialog = page.getByRole("dialog", { name: "Importar fechas" });
  const link = dialog.getByRole("button", { name: "Vincular" });
  await expect(link).toBeDisabled();

  // Solo se aceptan direcciones de servicios de calendario conocidos.
  await dialog.getByLabel("Dirección secreta en formato iCal").fill("https://example.com/agenda.ics");
  await link.click();
  await expect(dialog.getByRole("alert")).toContainText("Google Calendar, Outlook o iCloud");
  expect(requested).toBeNull();

  await dialog.getByLabel("Dirección secreta en formato iCal").fill(url);
  await link.click();
  expect(requested).toEqual({ url });
  // Toma el nombre del propio calendario y pasa directo a la revisión.
  await expect(page.locator(".toast")).toContainText("Facultad vinculado");
  const rows = dialog.locator(".import-item");
  await expect(rows).toHaveCount(2);
  await rows.filter({ hasText: "Dentista" }).getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Importar 1 fecha" }).click();
  await expect(cell(page, /^martes 17\/03/).locator(".ev")).toHaveText("Parcial de Física II");

  // Lo que no se eligió queda anotado: no se vuelve a proponer.
  await expect
    .poll(async () => (await db.from("calendar_feeds").select("name, url, skipped").single()).data)
    .toEqual({ name: "Facultad", url, skipped: ["ics:dentista@cal"] });
  const feedId = (await db.from("calendar_feeds").select("id").single()).data!.id;
  expect((await db.from("calendar_events").select("feed_id, external_id").single()).data).toEqual({ feed_id: feedId, external_id: "ics:parcial@cal" });

  // Sin novedades no hay aviso.
  await page.reload();
  await expect(cell(page, /^martes 17\/03/).locator(".ev")).toBeVisible();
  await expect(page.getByText(/fechas? nuevas? o con cambios/)).toHaveCount(0);

  // Aparece una fecha nueva en el calendario de origen y el parcial se mueve un día.
  feedContent = ics(["UID:parcial@cal", "SUMMARY:Parcial de Física II", "DTSTART:20260318T210000Z"], DENTISTA, ENTREGA);
  await page.reload();
  const banner = page.locator(".archived-banner").filter({ hasText: "Facultad" });
  await expect(banner).toContainText("Facultad: 2 fechas nuevas o con cambios");
  // Nada se importó solo.
  expect((await db.from("calendar_events").select("id")).data).toHaveLength(1);

  await banner.getByRole("button", { name: "Revisar" }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "Parcial de Física II" })).toContainText("Cambió de fecha");
  await expect(rows.filter({ hasText: "Dentista" })).toContainText("Omitida antes");
  await expect(rows.filter({ hasText: "Dentista" }).getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  await dialog.getByRole("button", { name: "Importar 2 fechas" }).click();
  await expect(cell(page, /^miércoles 18\/03/).locator(".ev.cat-parcial")).toHaveText("Parcial de Física II");
  await expect(cell(page, /^viernes 20\/03/).locator(".ev.cat-tp")).toHaveText("Entrega TP 2");
  await expect(banner).toHaveCount(0);

  // Borrar una fecha importada la deja como omitida (la próxima revisión no la propone).
  await cell(page, /^viernes 20\/03/).locator(".ev").click();
  await page.locator(".popover").getByRole("button", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect
    .poll(async () => (await db.from("calendar_feeds").select("skipped").single()).data?.skipped)
    .toEqual(["ics:dentista@cal", "ics:tp@cal"]);

  // Desvincular quitando sus fechas.
  await page.getByRole("button", { name: "Importar" }).click();
  await dialog.getByRole("button", { name: "Opciones de Facultad" }).click();
  await page.getByRole("menuitem", { name: "Desvincular y quitar sus fechas" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("También se quita 1 fecha importada");
  await page.getByRole("alertdialog").getByRole("button", { name: "Desvincular y quitar sus fechas" }).click();
  await expect.poll(async () => (await db.from("calendar_feeds").select("id")).data?.length).toBe(0);
  await expect.poll(async () => (await db.from("calendar_events").select("id")).data?.length).toBe(0);
});

test("/api/ical exige sesión y solo descarga de servicios de calendario", async ({ page, playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const denied = await anonymous.post("/api/ical", { data: { url: "https://calendar.google.com/calendar/ical/a/private-b/basic.ics" } });
  expect(denied.status()).toBe(401);
  await anonymous.dispose();

  // Con sesión: lo que no es un servicio de calendario se rechaza sin salir a buscarlo.
  for (const url of ["https://example.com/a.ics", "http://calendar.google.com/a.ics", "https://127.0.0.1/a.ics", "https://calendar.google.com.evil.test/a.ics"]) {
    const response = await page.request.post("/api/ical", { data: { url } });
    expect(response.status(), url).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_url" });
  }
  expect((await page.request.post("/api/ical", { data: {} })).status()).toBe(400);
});

// ---------- 4 y 5. horario: encabezado y exportar como fondo de pantalla ----------

async function pngSize(path: string): Promise<[number, number]> {
  const file = await readFile(path);
  expect(file.subarray(1, 4).toString()).toBe("PNG");
  return [file.readUInt32BE(16), file.readUInt32BE(20)];
}

test("horario: el día manda en el encabezado y se exporta como fondo de pantalla", async ({ page }) => {
  await db.from("schedule_blocks").insert([
    { subject_id: subjectId, weekday: 1, start_time: "08:00", end_time: "10:00", room: "Aula 110" },
    { subject_id: subjectId, weekday: 4, start_time: "18:00", end_time: "20:00" },
  ]);
  await db.from("schedule_events").insert([
    { title: "Vóley", color_key: "lima", icon: "volleyball", start_time: "21:00", end_time: "22:30", recurrence: "weekdays", weekdays: [3] },
    { title: "Consulta", color_key: "cielo", start_time: "11:00", end_time: "12:00", recurrence: "none", date: "2026-03-11" },
  ]);
  await page.goto("/app/schedule");

  // Encabezado: el día grande y en negrita; la fecha, chica. Hoy se resalta sobre el día.
  const head = page.locator(".sched-dayhead").first();
  await expect(head.locator(".wd")).toHaveText("lun");
  await expect(head.locator(".dn")).toHaveText("09/03");
  const style = (selector: string) => head.locator(selector).evaluate((element) => ({ size: parseFloat(getComputedStyle(element).fontSize), weight: Number(getComputedStyle(element).fontWeight) }));
  const [weekday, date] = [await style(".wd"), await style(".dn")];
  expect(weekday.size).toBeGreaterThan(date.size);
  expect(weekday.weight).toBeGreaterThanOrEqual(600);
  expect(date.weight).toBeLessThan(600);
  const today = page.locator(".sched-dayhead.is-today");
  const background = (selector: string) => today.locator(selector).evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(await background(".wd")).not.toBe("rgba(0, 0, 0, 0)");
  expect(await background(".dn")).toBe("rgba(0, 0, 0, 0)");

  // Exportar: por defecto horizontal 16:9 (3840 × 2160), fondo liso y bloques plenos.
  await page.getByRole("button", { name: "Exportar" }).click();
  const dialog = page.getByRole("dialog", { name: "Exportar el horario" });
  const canvas = dialog.getByTestId("wallpaper-canvas");
  await expect(dialog.getByRole("radio", { name: "Horizontal 16:9" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("radio", { name: "Liso" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByText("3840 × 2160 px · PNG")).toBeVisible();
  const size = () => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height]);
  await expect.poll(size).toEqual([3840, 2160]);

  /** Color de un punto de la imagen, en fracciones del ancho y del alto. */
  const pixel = (fx: number, fy: number) =>
    canvas.evaluate(
      (element: HTMLCanvasElement, [x, y]) => [...element.getContext("2d")!.getImageData(Math.round(element.width * x), Math.round(element.height * y), 1, 1).data.slice(0, 3)],
      [fx, fy],
    );
  const colors = () =>
    canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("2d")!;
      const seen = new Set<string>();
      for (let x = 40; x < element.width; x += 97) {
        for (let y = 40; y < element.height; y += 89) seen.add(context.getImageData(x, y, 1, 1).data.slice(0, 3).join(","));
      }
      return seen.size;
    });

  // Fondo "Con color": manchas con los colores de las materias (muchos más tonos que el liso).
  const plain = await colors();
  expect(plain).toBeGreaterThan(5);
  await dialog.getByRole("radio", { name: "Con color" }).click();
  await expect.poll(colors).toBeGreaterThan(plain + 40);

  // Fondo a elección: cualquier color, escribiendo su código o con el selector.
  await dialog.getByRole("radio", { name: "A elección" }).click();
  const hex = dialog.getByLabel("Color del fondo", { exact: true });
  await hex.fill("0055aa");
  await hex.press("Enter");
  await expect(hex).toHaveValue("#0055AA");
  await expect.poll(() => pixel(0.005, 0.01)).toEqual([0, 85, 170]);
  await dialog.getByLabel("Elegir el color del fondo").fill("#ff8800");
  await expect(hex).toHaveValue("#FF8800");
  await expect.poll(() => pixel(0.005, 0.01)).toEqual([255, 136, 0]);
  // Lo que no es un color no se acepta.
  await hex.fill("naranja");
  await hex.press("Enter");
  await expect(hex).toHaveValue("#FF8800");

  // La tabla ocupa casi toda la imagen: a un 4 % del borde lateral ya no es fondo.
  expect(await pixel(0.04, 0.5)).not.toEqual([255, 136, 0]);
  expect(await pixel(0.96, 0.5)).not.toEqual([255, 136, 0]);

  // Bloques plenos (el color de la materia de fondo) o suaves, como en la app.
  const blockColor = () => pixel(0.25, 0.2); // lunes de 08:00 a 10:00: Física II
  const solid = await blockColor();
  await dialog.getByRole("radio", { name: "Suaves" }).click();
  await expect.poll(blockColor).not.toEqual(solid);
  await dialog.getByRole("radio", { name: "Plenos" }).click();
  await expect.poll(blockColor).toEqual(solid);

  const [landscape] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Descargar imagen" }).click()]);
  expect(landscape.suggestedFilename()).toBe("tilde-horario-16x9.png");
  expect(await pngSize(await landscape.path())).toEqual([3840, 2160]);
  await expect(page.locator(".toast")).toContainText("Imagen descargada");

  // Las opciones se recuerdan. Vertical para el teléfono: cubre casi todo el alto de la pantalla.
  await page.getByRole("button", { name: "Exportar" }).click();
  await expect(dialog.getByRole("radio", { name: "A elección" })).toHaveAttribute("aria-checked", "true");
  await expect(hex).toHaveValue("#FF8800");
  await dialog.getByRole("radio", { name: "Vertical 9:19,5" }).click();
  await dialog.getByRole("radio", { name: "Oscuro" }).click();
  await expect(dialog.getByText("2160 × 4680 px · PNG")).toBeVisible();
  await expect.poll(size).toEqual([2160, 4680]);
  await expect.poll(() => pixel(0.5, 0.02)).toEqual([255, 136, 0]);
  expect(await pixel(0.9, 0.06)).not.toEqual([255, 136, 0]);
  expect(await pixel(0.9, 0.94)).not.toEqual([255, 136, 0]);
  // En oscuro la tabla es oscura aunque la app esté en claro (última fila, siempre vacía).
  await expect.poll(async () => Math.max(...(await pixel(0.88, 0.935)))).toBeLessThan(60);
  const [phone] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Descargar imagen" }).click()]);
  expect(phone.suggestedFilename()).toBe("tilde-horario-9x19.5.png");
  expect(await pngSize(await phone.path())).toEqual([2160, 4680]);

  // Los otros dos formatos.
  await page.getByRole("button", { name: "Exportar" }).click();
  await dialog.getByRole("radio", { name: "Vertical 9:16" }).click();
  await expect.poll(size).toEqual([2160, 3840]);
  await dialog.getByRole("radio", { name: "Horizontal 16:10" }).click();
  await expect(dialog.getByText("3840 × 2400 px · PNG")).toBeVisible();
  await expect.poll(size).toEqual([3840, 2400]);
});

test("horario: sin nada que se repita no hay qué exportar", async ({ page }) => {
  await db.from("schedule_events").insert({ title: "Consulta", color_key: "cielo", start_time: "11:00", end_time: "12:00", recurrence: "none", date: "2026-03-11" });
  await page.goto("/app/schedule");
  await page.getByRole("button", { name: "Exportar" }).click();
  const dialog = page.getByRole("dialog", { name: "Exportar el horario" });
  await expect(dialog.getByText("Todavía no hay clases ni actividades que se repitan")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Descargar imagen" })).toBeDisabled();
});

// ---------- 6. íconos ----------

test("íconos: se eligen en la materia y en la actividad, y aparecen donde se muestran", async ({ page }) => {
  await db.from("schedule_blocks").insert({ subject_id: subjectId, weekday: 2, start_time: "16:00", end_time: "18:00" });
  await db.from("tasks").insert({ title: "Leer el capítulo 4", subject_id: subjectId, planned_date: "2026-03-10", sort_order: 1 });
  await db.from("calendar_events").insert({ subject_id: subjectId, category: "parcial", date: "2026-03-17" });

  // La materia ya tiene el átomo: tarjeta, panel y selector.
  await page.goto("/app");
  const card = page.locator(".subject-card").filter({ hasText: "Física II" });
  await expect(card.locator('.subject-tile svg[data-icon="atom"]')).toBeVisible();

  // Alta de una materia eligiendo ícono con el teclado.
  await page.getByRole("button", { name: "Agregar materia" }).first().click();
  const form = page.getByRole("dialog", { name: "Nueva materia" });
  await form.getByLabel("Nombre").fill("Química");
  const trigger = form.getByRole("button", { name: /Ícono/ });
  await expect(trigger).toContainText("Sin ícono");
  await trigger.click();
  const grid = page.getByRole("radiogroup", { name: "Ícono" });
  await expect(grid.getByRole("radio")).toHaveCount(65);
  await expect(grid.getByRole("radio", { name: "Sin ícono" })).toBeFocused();
  // Flechas: "Sin ícono" ocupa la primera fila; después, ocho por fila.
  await page.keyboard.press("ArrowDown");
  await expect(grid.getByRole("radio", { name: "Libro abierto" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(grid.getByRole("radio", { name: "Calculadora" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(grid.getByRole("radio", { name: "Sigma" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(grid.getByRole("radio", { name: "Sin ícono" })).toBeFocused();
  await grid.getByRole("radio", { name: "Matraz" }).click();
  await expect(trigger).toContainText("Matraz");
  await form.getByRole("button", { name: "Agregar materia" }).click();
  await expect(page.locator(".subject-card").filter({ hasText: "Química" }).locator('svg[data-icon="flask-conical"]')).toBeVisible();
  await expect.poll(async () => (await db.from("subjects").select("icon").eq("name", "Química").single()).data?.icon).toBe("flask-conical");

  // Desde el panel de la materia se cambia o se quita.
  await card.getByRole("button", { name: "Abrir Física II" }).click();
  const sheet = page.getByRole("dialog", { name: "Física II" });
  await sheet.getByRole("button", { name: /Ícono/ }).click();
  await page.getByRole("radio", { name: "Imán" }).click();
  await expect(card.locator('svg[data-icon="magnet"]')).toBeVisible();
  await expect.poll(async () => (await db.from("subjects").select("icon").eq("id", subjectId).single()).data?.icon).toBe("magnet");
  await sheet.getByRole("button", { name: "Listo" }).click();

  // Tareas: chip de la tarea y filtro por materia.
  await page.goto("/app/todo");
  await expect(page.locator(".task .chip").filter({ hasText: "Física II" }).locator('svg[data-icon="magnet"]')).toBeVisible();
  await page.getByRole("radio", { name: "Por materia" }).click();
  await expect(page.getByRole("radio", { name: "Física II" }).locator('svg[data-icon="magnet"]')).toBeVisible();

  // Calendario: el chip de la fecha.
  await page.goto("/app/calendar");
  await expect(page.locator(".ev.cat-parcial").locator('svg[data-icon="magnet"]')).toBeVisible();

  // Horario: el bloque de la clase y una actividad sin materia con su propio ícono.
  await page.goto("/app/schedule");
  await expect(page.locator(".sched-block").filter({ hasText: "Física II" }).locator('svg[data-icon="magnet"]')).toBeVisible();
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Agregar al horario" });
  await dialog.getByRole("radio", { name: "Actividad" }).click();
  await dialog.getByLabel("Título").fill("Gimnasio");
  await dialog.getByRole("button", { name: /Ícono/ }).click();
  await page.getByRole("radio", { name: "Gimnasio" }).click();
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".sched-block.is-event").filter({ hasText: "Gimnasio" }).locator('svg[data-icon="dumbbell"]')).toBeVisible();
  await expect.poll(async () => (await db.from("schedule_events").select("icon").single()).data?.icon).toBe("dumbbell");
});

// ---------- 7. menú por el borde izquierdo ----------

test("menú: se abre con un gesto decidido hacia el borde izquierdo y no con cualquier roce", async ({ page }) => {
  await page.goto("/app");
  await expect(page.locator(".subject-card").first()).toBeVisible();

  // Llegar en diagonal (camino a otra cosa) no lo abre.
  await page.mouse.move(320, 120);
  await page.mouse.move(0, 760, { steps: 10 });
  await page.waitForTimeout(700);
  await expect(drawer(page)).toHaveCount(0);

  // Tocar el borde y volver enseguida, tampoco.
  await page.mouse.move(700, 400);
  await page.mouse.move(0, 400, { steps: 8 });
  await page.mouse.move(240, 400, { steps: 3 });
  await page.waitForTimeout(400);
  await expect(drawer(page)).toHaveCount(0);

  // Arrastrando (botón apretado), tampoco.
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await page.mouse.move(0, 400, { steps: 8 });
  await page.waitForTimeout(400);
  await page.mouse.up();
  await expect(drawer(page)).toHaveCount(0);

  // Un movimiento largo y horizontal que se queda en el borde: se abre.
  await page.mouse.move(700, 400);
  await page.mouse.move(0, 404, { steps: 8 });
  await expect(drawer(page)).toBeVisible();
  // Se cierra solo al alejar el mouse…
  await page.mouse.move(800, 400, { steps: 6 });
  await expect(drawer(page)).toHaveCount(0);

  // …salvo que se lo haya usado: ahí queda abierto hasta cerrarlo.
  await page.mouse.move(0, 400, { steps: 8 });
  await expect(drawer(page)).toBeVisible();
  await drawer(page).getByRole("radio", { name: "Oscuro" }).click();
  await page.mouse.move(900, 400, { steps: 6 });
  await page.waitForTimeout(600);
  await expect(drawer(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toHaveCount(0);

  // Con un diálogo abierto el borde no hace nada.
  await page.getByRole("button", { name: "Agregar materia" }).first().click();
  await expect(page.getByRole("dialog", { name: "Nueva materia" })).toBeVisible();
  await page.mouse.move(700, 400);
  await page.mouse.move(0, 400, { steps: 8 });
  await page.waitForTimeout(400);
  await expect(drawer(page)).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Se puede apagar desde Ajustes, y queda guardado en el perfil.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await drawer(page).getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("dialog", { name: "Ajustes" }).getByRole("switch", { name: /borde izquierdo/ }).click();
  await expect.poll(async () => (await db.from("profiles").select("edge_menu").single()).data?.edge_menu).toBe(false);
  await page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Listo" }).click();
  await page.mouse.move(700, 400);
  await page.mouse.move(0, 400, { steps: 8 });
  await page.waitForTimeout(500);
  await expect(drawer(page)).toHaveCount(0);
});

// ---------- color de acento ----------

test("ajustes: el color de acento se elige de la paleta, se aplica en toda la app y se recuerda", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/schedule");
  const html = page.locator("html");
  const token = (name: string) => page.evaluate((property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim().toUpperCase(), name);
  const todayPill = () => page.locator(".sched-dayhead.is-today .wd").evaluate((element) => getComputedStyle(element).backgroundColor);
  const openSettings = async () => {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await drawer(page).getByRole("button", { name: "Ajustes" }).click();
    return page.getByRole("dialog", { name: "Ajustes" });
  };

  // Por defecto, el naranja original.
  await expect(html).not.toHaveAttribute("data-accent");
  expect(await token("--color-accent")).toBe("#E44919");
  await expect.poll(todayPill).toBe("rgb(189, 52, 3)");

  let settings = await openSettings();
  const group = settings.getByRole("radiogroup", { name: "Color de acento" });
  await expect(group.getByRole("radio")).toHaveCount(13);
  await expect(group.getByRole("radio", { name: "Naranja Tilde" })).toHaveAttribute("aria-checked", "true");

  // Se aplica al instante, sin recargar, y queda en el perfil.
  await group.getByRole("radio", { name: "Turquesa" }).click();
  await expect(html).toHaveAttribute("data-accent", "turquesa");
  expect(await token("--color-accent")).toBe("#0EA09D");
  expect(await token("--color-accent-soft")).toBe("#D6F8F6");
  expect(await token("--color-focus-ring")).toBe("#0EA09D");
  await expect.poll(async () => (await db.from("profiles").select("accent_color").single()).data?.accent_color).toBe("turquesa");

  // Con el teclado: las flechas recorren la paleta.
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Cielo" })).toHaveAttribute("aria-checked", "true");
  await expect(html).toHaveAttribute("data-accent", "cielo");
  await page.keyboard.press("ArrowLeft");
  await expect(html).toHaveAttribute("data-accent", "turquesa");
  await settings.getByRole("button", { name: "Listo" }).click();
  await expect.poll(todayPill).toBe("rgb(2, 131, 128)");

  // En oscuro usa los tonos de ese tema.
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await drawer(page).getByRole("radio", { name: "Oscuro" }).click();
  await page.keyboard.press("Escape");
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await token("--color-accent")).toBe("#0AC3BF");
  await expect.poll(todayPill).toBe("rgb(10, 195, 191)");

  // Se recuerda al recargar (lo aplica el script de <head>, antes del primer pintado)…
  await page.reload();
  await expect(html).toHaveAttribute("data-accent", "turquesa");
  // Sin esperar a React: en una página a la que no le llega el JavaScript de la app, el acento ya está puesto.
  const bare = await context.newPage();
  await bare.route("**/_next/static/**/*.js", (route) => route.abort());
  await bare.goto("/app/schedule");
  await expect(bare.locator("html")).toHaveAttribute("data-accent", "turquesa");
  await expect(bare.locator("html")).toHaveAttribute("data-theme", "dark");
  await bare.close();
  // …y en otro dispositivo lo trae el perfil.
  await page.evaluate(() => localStorage.removeItem("tilde-accent"));
  await page.reload();
  await expect(html).toHaveAttribute("data-accent", "turquesa");
  expect(await page.evaluate(() => localStorage.getItem("tilde-accent"))).toBe("turquesa");

  // Volver al naranja original.
  settings = await openSettings();
  await settings.getByRole("radio", { name: "Naranja Tilde" }).click();
  await expect(html).not.toHaveAttribute("data-accent");
  expect(await token("--color-accent")).toBe("#FF754A");
  await expect.poll(async () => (await db.from("profiles").select("accent_color").single()).data?.accent_color).toBeNull();
  expect(errors).toEqual([]);
});

// ---------- materias: orden a mano ----------

test("inicio: las materias se reordenan arrastrando, con el mouse y con el teclado", async ({ page }) => {
  await db.from("subjects").update({ sort_order: 1 }).eq("id", subjectId);
  await db.from("subjects").insert([
    { name: "Álgebra", color_key: "frambuesa", sort_order: 2 },
    { name: "Química", color_key: "turquesa", sort_order: 3 },
  ]);
  await page.goto("/app");
  const names = () => page.locator(".subject-card .card-title").allTextContents();
  const order = async () => (await db.from("subjects").select("name").order("sort_order")).data!.map((row) => row.name);
  await expect.poll(names).toEqual(["Física II", "Álgebra", "Química"]);

  // Con el teclado, desde el asa: Espacio levanta, la flecha mueve, Espacio suelta.
  // (con una pausa entre teclas, como una persona: el arrastre con teclado mide y anuncia cada paso)
  await page.getByRole("button", { name: "Mover Química" }).focus();
  for (const key of ["Space", "ArrowLeft", "ArrowLeft", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(200);
  }
  await expect.poll(names).toEqual(["Química", "Física II", "Álgebra"]);
  await expect.poll(order).toEqual(["Química", "Física II", "Álgebra"]);

  // Con el mouse, desde cualquier parte de la tarjeta.
  const from = (await page.locator(".subject-card").filter({ hasText: "Álgebra" }).boundingBox())!;
  const to = (await page.locator(".subject-card").filter({ hasText: "Química" }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 20, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(names).toEqual(["Álgebra", "Química", "Física II"]);
  await expect.poll(order).toEqual(["Álgebra", "Química", "Física II"]);
  // Arrastrar no abre la materia; un clic sin mover, sí.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".subject-card").filter({ hasText: "Química" }).getByRole("button", { name: "Abrir Química" }).click();
  await expect(page.getByRole("dialog", { name: "Química" })).toBeVisible();
  await page.keyboard.press("Escape");

  // El orden queda guardado y vale en el resto de la app.
  await page.reload();
  await expect.poll(names).toEqual(["Álgebra", "Química", "Física II"]);
  await page.goto("/app/todo");
  await page.getByRole("radio", { name: "Por materia" }).click();
  await expect(page.getByRole("radiogroup", { name: "Materia" }).getByRole("radio")).toHaveText(["Álgebra", "Química", "Física II"]);

  // Una materia nueva va al final.
  await page.goto("/app");
  await page.getByRole("button", { name: "Agregar materia" }).first().click();
  await page.getByRole("dialog", { name: "Nueva materia" }).getByLabel("Nombre").fill("Historia");
  await page.getByRole("dialog", { name: "Nueva materia" }).getByRole("button", { name: "Agregar materia" }).click();
  await expect.poll(names).toEqual(["Álgebra", "Química", "Física II", "Historia"]);
  await expect.poll(order).toEqual(["Álgebra", "Química", "Física II", "Historia"]);
});

test("el logo conserva su color aunque cambie el acento", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const logo = drawer(page).locator(".logo svg rect").first();
  const fill = () => logo.evaluate((element) => getComputedStyle(element).fill);
  const original = await fill();
  expect(original).toBe("rgb(228, 73, 25)");

  await drawer(page).getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("dialog", { name: "Ajustes" }).getByRole("radio", { name: "Cobalto" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "cobalto");
  await page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Listo" }).click();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  // El acento cambió (la sección activa del menú usa el nuevo), el logo no.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim().toUpperCase())).toBe("#5E8AFE");
  expect(await fill()).toBe(original);
});
