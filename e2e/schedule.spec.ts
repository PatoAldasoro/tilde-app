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
  const subject = await db.from("subjects").insert({ name: "Física II", color_key: "mandarina" }).select("id").single();
  subjectId = subject.data!.id;
});
test.afterEach(async () => removeUser(user));

const column = (page: Page, label: RegExp) => page.locator(".sched-col").filter({ has: page.locator(`xpath=self::*[@aria-label]`) }).and(page.getByRole("group", { name: label }));
const blocksIn = (page: Page, label: RegExp) => column(page, label).locator(".sched-block");

test("grilla semanal: días visibles, hoy, hora actual y estado vacío", async ({ page }) => {
  await page.goto("/app/schedule");
  await expect(page.getByText("09/03 – 15/03 · 2026")).toBeVisible();
  await expect(page.locator(".sched-dayhead")).toHaveCount(5); // lunes a viernes por defecto
  await expect(page.locator(".sched-dayhead.is-today")).toContainText("10/03");
  await expect(page.locator(".now-label")).toHaveText("15:00");
  await expect(page.getByText("La semana está vacía")).toBeVisible();

  // Días visibles: se agrega el sábado y se guarda en el perfil.
  await page.getByRole("button", { name: /Días visibles/ }).click();
  await page.getByRole("button", { name: "sábado" }).click();
  await expect(page.locator(".sched-dayhead")).toHaveCount(6);
  await expect.poll(async () => (await db.from("profiles").select("visible_weekdays").single()).data?.visible_weekdays).toEqual([1, 2, 3, 4, 5, 6]);
  await page.keyboard.press("Escape");

  // Navegación por semanas.
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(page.getByText("16/03 – 22/03 · 2026")).toBeVisible();
  await expect(page.locator(".now-line")).toHaveCount(0);
  await page.getByRole("button", { name: "Esta semana" }).click();
  await expect(page.getByText("09/03 – 15/03 · 2026")).toBeVisible();
});

test("clases: varios bloques con aulas distintas, clic en un hueco y validación", async ({ page }) => {
  await page.goto("/app/schedule");
  await page.getByRole("button", { name: "Agregar clase" }).click();
  const dialog = page.getByRole("dialog", { name: "Agregar al horario" });

  // Primer bloque: lunes 08:00–10:00, aula 305. La hora de fin tiene que ser posterior.
  await dialog.getByLabel("Desde").selectOption("08:00");
  await dialog.getByLabel("Hasta").selectOption("07:30");
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(dialog.getByText("La hora de fin tiene que ser posterior a la de inicio.")).toBeVisible();
  await dialog.getByLabel("Hasta").selectOption("10:00");
  await dialog.getByLabel("Aula").fill("Aula 305");

  // Segundo bloque: miércoles, otra aula.
  await dialog.getByRole("button", { name: "Agregar otro horario" }).click();
  await dialog.getByLabel("Aula").nth(1).fill("Laboratorio 2");
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByText("2 horarios agregados a Física II")).toBeVisible();

  await expect(blocksIn(page, /^lunes 09\/03/)).toHaveCount(1);
  await expect(blocksIn(page, /^lunes 09\/03/)).toContainText("Aula 305");
  await expect(blocksIn(page, /^miércoles 11\/03/)).toContainText("Laboratorio 2");
  await expect(blocksIn(page, /^lunes 09\/03/)).toHaveClass(/subj-mandarina/);

  // Se repite todas las semanas.
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(blocksIn(page, /^lunes 16\/03/)).toHaveCount(1);
  await page.getByRole("button", { name: "Esta semana" }).click();

  // Clic en un hueco: precarga día y hora.
  await page.getByRole("button", { name: "Agregar el viernes a las 14:00" }).click({ force: true });
  await expect(dialog.getByLabel("Día")).toHaveValue("5");
  await expect(dialog.getByLabel("Desde")).toHaveValue("14:00");
  await expect(dialog.getByLabel("Hasta")).toHaveValue("16:00");
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(blocksIn(page, /^viernes 13\/03/)).toContainText("14:00–16:00");

  expect((await db.from("schedule_blocks").select("weekday, start_time, end_time, room").order("weekday")).data).toEqual([
    { weekday: 1, start_time: "08:00:00", end_time: "10:00:00", room: "Aula 305" },
    { weekday: 3, start_time: "08:00:00", end_time: "10:00:00", room: "Laboratorio 2" },
    { weekday: 5, start_time: "14:00:00", end_time: "16:00:00", room: null },
  ]);
});

test("actividades: en una fecha, todos los días y días específicos con fecha de fin", async ({ page }) => {
  await db.from("schedule_events").insert([
    { title: "Turno médico", color_key: "cielo", start_time: "11:00", end_time: "12:00", recurrence: "none", weekdays: [], date: "2026-03-12", start_date: null, until_date: null },
    { title: "Gimnasio", color_key: "lima", start_time: "07:00", end_time: "08:00", recurrence: "daily", weekdays: [], date: null, start_date: null, until_date: "2026-03-11" },
  ]);
  await page.goto("/app/schedule");
  await expect(blocksIn(page, /^jueves 12\/03/)).toContainText("Turno médico");
  // "Todos los días" hasta el 11/03: lunes, martes y miércoles.
  for (const day of [/^lunes 09\/03/, /^martes 10\/03/, /^miércoles 11\/03/]) await expect(blocksIn(page, day)).toContainText("Gimnasio");
  await expect(blocksIn(page, /^jueves 12\/03/)).not.toContainText("Gimnasio");

  // Nueva actividad con días específicos.
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Agregar al horario" });
  await dialog.getByRole("radio", { name: "Actividad" }).click();
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(dialog.getByText("Falta el título.")).toBeVisible();
  await dialog.getByLabel("Título").fill("Vóley");
  await dialog.getByRole("radio", { name: "Días específicos" }).click();
  await dialog.getByRole("button", { name: "viernes" }).click(); // lunes ya viene marcado
  await dialog.getByLabel("Desde").selectOption("21:00");
  await dialog.getByLabel("Hasta").selectOption("23:00");
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByText("Vóley agregada al horario")).toBeVisible();

  const voley = (label: RegExp) => blocksIn(page, label).filter({ hasText: "Vóley" });
  await expect(voley(/^lunes 09\/03/)).toHaveClass(/is-event/);
  await expect(voley(/^viernes 13\/03/)).toHaveCount(1);
  await expect(voley(/^martes 10\/03/)).toHaveCount(0);
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(voley(/^lunes 16\/03/)).toHaveCount(1);
  await expect(blocksIn(page, /^lunes 16\/03/)).not.toContainText("Gimnasio"); // terminó el 11/03
});

test("excepciones: omitir y restaurar; los feriados dejan las clases sin clase", async ({ page }) => {
  await db.from("schedule_blocks").insert([
    { subject_id: subjectId, weekday: 2, start_time: "18:00", end_time: "20:00", room: null },
  ]);
  await db.from("schedule_events").insert([
    { title: "Vóley", color_key: "lima", start_time: "21:00", end_time: "22:00", recurrence: "weekdays", weekdays: [2], date: null, start_date: null, until_date: null },
  ]);
  await page.goto("/app/schedule");
  const classBlock = (label: RegExp) => blocksIn(page, label).filter({ hasText: "Física II" });
  const tuesday = /^martes 10\/03/;

  // Omitir esta vez → rayada, con "Omitida"; la semana siguiente no cambia.
  await classBlock(tuesday).click();
  await page.getByRole("button", { name: "Omitir esta vez" }).click();
  await expect(classBlock(tuesday)).toHaveClass(/is-skipped/);
  await expect(classBlock(tuesday)).toContainText("Omitida");
  await expect.poll(async () => (await db.from("schedule_exceptions").select("date, kind, target_type")).data).toEqual([
    { date: "2026-03-10", kind: "skip", target_type: "block" },
  ]);
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(classBlock(/^martes 17\/03/)).not.toHaveClass(/is-skipped/);
  await page.getByRole("button", { name: "Esta semana" }).click();

  // Restaurar.
  await classBlock(tuesday).click();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(classBlock(tuesday)).not.toHaveClass(/is-skipped/);
  await expect.poll(async () => (await db.from("schedule_exceptions").select("id")).data).toEqual([]);

  // Martes 24/03 es feriado nacional: la clase queda "Sin clase"; la actividad no se ve afectada.
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  const holidayTuesday = /^martes 24\/03 · Día de la Memoria/;
  await expect(page.locator(".holiday-tag")).toContainText("Día de la Memoria por la Verdad y la Justicia");
  await expect(classBlock(holidayTuesday)).toHaveClass(/is-skipped/);
  await expect(classBlock(holidayTuesday)).toContainText("Sin clase");
  await expect(blocksIn(page, holidayTuesday).filter({ hasText: "Vóley" })).not.toHaveClass(/is-skipped/);
  // El lunes 23/03 es puente, no feriado: no se marca.
  await expect(page.getByRole("group", { name: /^lunes 23\/03$/ })).toBeVisible();

  // "Hubo clase igual" → excepción keep.
  await classBlock(holidayTuesday).click();
  await page.getByRole("button", { name: "Hubo clase igual: restaurar" }).click();
  await expect(classBlock(holidayTuesday)).not.toHaveClass(/is-skipped/);
  await expect.poll(async () => (await db.from("schedule_exceptions").select("date, kind")).data).toEqual([{ date: "2026-03-24", kind: "keep" }]);
});

test("archivar la materia saca sus clases del Horario; editar y eliminar un bloque", async ({ page }) => {
  await db.from("schedule_blocks").insert([{ subject_id: subjectId, weekday: 4, start_time: "09:00", end_time: "11:00", room: "Aula 1" }]);
  await page.goto("/app/schedule");
  const thursday = /^jueves 12\/03/;
  await expect(blocksIn(page, thursday)).toHaveCount(1);

  // Editar.
  await blocksIn(page, thursday).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Editar horario de clase" });
  await dialog.getByLabel("Hasta").selectOption("12:30");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(blocksIn(page, thursday)).toContainText("09:00–12:30");

  // Archivar la materia: sus clases dejan de dictarse.
  await db.from("subjects").update({ archived_at: new Date().toISOString() }).eq("id", subjectId);
  await page.reload();
  await expect(page.locator(".sched-col").first()).toBeVisible();
  await expect(page.locator(".sched-block")).toHaveCount(0);
  await db.from("subjects").update({ archived_at: null }).eq("id", subjectId);
  await page.reload();

  // Eliminar el horario (con confirmación).
  await blocksIn(page, thursday).click();
  await page.getByRole("button", { name: "Eliminar este horario" }).click();
  await page.getByRole("alertdialog", { name: "¿Eliminar este horario?" }).getByRole("button", { name: "Eliminar" }).click();
  await expect(page.locator(".sched-block")).toHaveCount(0);
  await expect.poll(async () => (await db.from("schedule_blocks").select("id")).data).toEqual([]);
});
