import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient, type TestUser } from "../scripts/lib/test-session";
import type { Database } from "../src/lib/supabase/database.types";
import { freezeToday, removeUser, signInFreshUser } from "./session";

let user: TestUser;
let db: SupabaseClient<Database>;
let subjectId: string;

test.beforeEach(async ({ context }) => {
  await freezeToday(context); // hoy = martes 10/03/2026
  user = await signInFreshUser(context);
  db = await userClient(user);
  const subject = await db.from("subjects").insert({ name: "Física II", color_key: "mandarina" }).select("id").single();
  subjectId = subject.data!.id;
});
test.afterEach(async () => removeUser(user));

const cell = (page: Page, label: RegExp) => page.getByRole("gridcell", { name: label });

async function openForm(page: Page, dayLabel: string) {
  await page.getByRole("button", { name: `Agregar fecha el ${dayLabel}` }).click();
  return page.getByRole("dialog", { name: "Agregar fecha" });
}

test("vista mensual: lunes primero, hoy destacado y feriados nacionales sin puentes", async ({ page }) => {
  await page.goto("/app/calendar");
  await expect(page.getByRole("heading", { name: "marzo 2026" })).toBeVisible();
  await expect(page.getByRole("columnheader").first()).toHaveText("lun");
  await expect(page.getByRole("columnheader").last()).toHaveText("dom");
  await expect(cell(page, /^martes 10\/03/)).toHaveClass(/is-today/);

  // 24/03 es feriado; el 23/03 es puente (día no laborable) y no se muestra.
  await expect(cell(page, /^martes 24\/03/).locator(".ev.cat-feriado")).toHaveText("Día de la Memoria por la Verdad y la Justicia");
  await expect(cell(page, /^lunes 23\/03/).locator(".ev")).toHaveCount(0);

  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.getByRole("heading", { name: "abril 2026" })).toBeVisible();
  await expect(cell(page, /^jueves 02\/04/).locator(".ev.cat-feriado")).toBeVisible();
  await expect(cell(page, /^viernes 03\/04/).locator(".ev.cat-feriado")).toHaveText("Viernes Santo");
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "marzo 2026" })).toBeVisible();

  // Noviembre de 2026: el 09/11 (visita del papa) es feriado nacional.
  for (let i = 0; i < 8; i += 1) await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.getByRole("heading", { name: "noviembre 2026" })).toBeVisible();
  await expect(cell(page, /^lunes 09\/11/).locator(".ev.cat-feriado")).toHaveText("Visita del papa León XIV");
  await expect(cell(page, /^martes 10\/11/).locator(".ev")).toHaveCount(0);
});

test("parcial, final y feriado manual: no generan tarea", async ({ page }) => {
  await page.goto("/app/calendar");
  let dialog = await openForm(page, "17/03");
  await expect(dialog.getByRole("radio", { name: "Parcial" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Agregar fecha" }).click();
  const parcial = cell(page, /^martes 17\/03/).locator(".ev");
  await expect(parcial).toHaveText("Parcial · Física II");
  await expect(parcial).toHaveClass(/cat-parcial/);
  await expect(parcial).toHaveClass(/subj-mandarina/);

  dialog = await openForm(page, "18/03");
  await dialog.getByRole("radio", { name: "Final" }).click();
  await dialog.getByLabel("Título").fill("Final de Física");
  await dialog.getByRole("button", { name: "Agregar fecha" }).click();
  await expect(cell(page, /^miércoles 18\/03/).locator(".ev.cat-final")).toHaveText("Final de Física");

  dialog = await openForm(page, "19/03");
  await dialog.getByRole("radio", { name: "Feriado" }).click();
  await expect(dialog.getByLabel("Materia")).toHaveCount(0); // los feriados no tienen materia
  await dialog.getByLabel("Título").fill("Día del Estudiante");
  await dialog.getByRole("button", { name: "Agregar fecha" }).click();
  const holiday = cell(page, /^jueves 19\/03/).locator(".ev.cat-feriado");
  await expect(holiday).toHaveText("Día del Estudiante");
  await expect(holiday).not.toHaveClass(/subj-/);

  await expect.poll(async () => (await db.from("calendar_events").select("id")).data?.length).toBe(3);
  expect((await db.from("tasks").select("id")).data).toEqual([]);
});

test("recuperatorio: un clic lo confirma y le da color pleno; el lápiz edita", async ({ page }) => {
  await page.goto("/app/calendar");
  const dialog = await openForm(page, "20/03");
  await dialog.getByRole("radio", { name: "Recuperatorio" }).click();
  await dialog.getByRole("button", { name: "Agregar fecha" }).click();

  const chip = cell(page, /^viernes 20\/03/).getByRole("button", { name: /Recuperatorio · Física II — Recuperatorio/ });
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(chip).not.toHaveClass(/is-confirmed/);

  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(chip).toHaveClass(/is-confirmed/);
  await expect.poll(async () => (await db.from("calendar_events").select("confirmed").single()).data?.confirmed).toBe(true);
  expect((await db.from("tasks").select("id")).data).toEqual([]); // confirmar no crea tarea

  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");

  // El lápiz está siempre visible (no depende del hover) y abre la edición.
  const pencil = cell(page, /^viernes 20\/03/).getByRole("button", { name: "Editar: Recuperatorio · Física II" });
  await expect(pencil).toBeVisible();
  await pencil.click();
  const edit = page.getByRole("dialog", { name: "Editar fecha" });
  await edit.getByLabel("Título").fill("Recu de Física");
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(cell(page, /^viernes 20\/03/).locator(".ev")).toHaveText("Recu de Física");
});

test("TP: genera su tarea, la edición la actualiza y el borrado se la lleva", async ({ page }) => {
  await page.goto("/app/calendar");
  const dialog = await openForm(page, "20/03");
  await dialog.getByRole("radio", { name: "TP" }).click();
  await dialog.getByLabel("Título").fill("Circuitos RC");
  await expect(dialog.getByLabel("En Tareas")).toHaveValue("3"); // valor por defecto de Ajustes
  await dialog.getByLabel("En Tareas").fill("5");
  await dialog.getByRole("button", { name: "Agregar fecha" }).click();
  await expect(page.getByText("Fecha agregada · se creó la tarea en Tareas")).toBeVisible();

  const chip = cell(page, /^viernes 20\/03/).locator(".ev.cat-tp");
  await expect(chip).toHaveText("Circuitos RC");

  const linked = async () => (await db.from("tasks").select("title, subject_id, due_date, lead_days, source_calendar_event_id, completed_at")).data;
  await expect.poll(async () => (await linked())?.length).toBe(1);
  const eventId = (await db.from("calendar_events").select("id").single()).data!.id;
  expect(await linked()).toEqual([
    { title: "TP · Circuitos RC", subject_id: subjectId, due_date: "2026-03-20", lead_days: 5, source_calendar_event_id: eventId, completed_at: null },
  ]);

  // La tarea aparece en Tareas desde 5 días antes (15/03): hoy (10/03) todavía no,
  // y en la vista de 7 días (10 al 16) se ve el domingo 15 y el lunes 16.
  await page.goto("/app/todo");
  await expect(page.locator("section.day-group").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "TP · Circuitos RC", exact: true })).toHaveCount(2);
  await expect(page.locator("section.day-group").first().locator(".task")).toHaveCount(0);
  await page.goto("/app/calendar");

  // Editar el evento (fecha, título y anticipación) actualiza la tarea vinculada.
  await chip.click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Editar fecha" });
  await edit.getByLabel("Título").fill("Circuitos RLC");
  await edit.getByLabel("En Tareas").fill("12");
  await edit.getByLabel("Fecha", { exact: true }).click();
  await page.getByRole("button", { name: "viernes, 13 de marzo de 2026" }).click();
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(cell(page, /^viernes 13\/03/).locator(".ev.cat-tp")).toHaveText("Circuitos RLC");
  await expect.poll(async () => (await linked())?.[0]).toMatchObject({ title: "TP · Circuitos RLC", due_date: "2026-03-13", lead_days: 12 });

  // Completar la tarea no toca el evento.
  await page.goto("/app/todo");
  await page.getByRole("checkbox", { name: "Marcar como completada: TP · Circuitos RLC" }).first().click();
  await expect.poll(async () => (await linked())?.[0].completed_at).not.toBeNull();
  const event = await db.from("calendar_events").select("title, date, category").single();
  expect(event.data).toEqual({ title: "Circuitos RLC", date: "2026-03-13", category: "tp" });

  // Borrar el evento borra su tarea.
  await page.goto("/app/calendar");
  await cell(page, /^viernes 13\/03/).locator(".ev.cat-tp").click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(cell(page, /^viernes 13\/03/).locator(".ev")).toHaveCount(0);
  await expect.poll(async () => (await linked())?.length).toBe(0);
  expect((await db.from("calendar_events").select("id")).data).toEqual([]);
});

test("más de tres fechas en un día: '+N más' abre la lista", async ({ page }) => {
  const base = { subject_id: subjectId, date: "2026-03-12" };
  await db.from("calendar_events").insert([
    { ...base, category: "parcial", title: "Parcial 1", confirmed: true, lead_days: null },
    { ...base, category: "final", title: "Final", confirmed: true, lead_days: null },
    { ...base, category: "recuperatorio", title: "Recu", confirmed: false, lead_days: null },
    { ...base, category: "tp", title: "TP 3", confirmed: true, lead_days: 3 },
    { ...base, category: "parcial", title: "Parcial 2", confirmed: true, lead_days: null },
  ]);
  await page.goto("/app/calendar");
  const day = cell(page, /^jueves 12\/03, 5 fechas/);
  await expect(day.locator(".ev")).toHaveCount(3);
  await expect(day.locator(".ev").first()).toHaveText("Final"); // orden: final, parcial, recuperatorio, TP
  await day.getByRole("button", { name: "+2 más" }).click();
  const list = page.locator(".day-list");
  await expect(list.locator(".ev")).toHaveCount(5);
  await expect(list).toContainText("5 fechas");
  await list.getByRole("button", { name: "Editar: TP 3" }).click();
  await expect(page.getByRole("dialog", { name: "Editar fecha" })).toBeVisible();
});
