import { expect, test } from "@playwright/test";
import type { TestUser } from "../scripts/lib/test-session";
import { removeUser, signInFreshUser } from "./session";

let user: TestUser;
test.beforeEach(async ({ context }) => {
  user = await signInFreshUser(context);
});
test.afterEach(async () => removeUser(user));

async function addSubject(page: import("@playwright/test").Page, name: string, extra?: { credits?: string }) {
  await page.getByRole("button", { name: "Agregar materia" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nueva materia" });
  await dialog.getByLabel("Nombre").fill(name);
  if (extra?.credits) await dialog.getByLabel("Créditos").fill(extra.credits);
  await dialog.getByRole("button", { name: "Agregar materia" }).click();
  await expect(dialog).toBeHidden();
}

test("materias: primer uso, alta con validación, edición, archivar y eliminar", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Empecemos por tus materias" })).toBeVisible();

  // Alta con el nombre vacío: muestra el error y no cierra.
  await page.getByRole("button", { name: "Agregar materia" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva materia" });
  await dialog.getByRole("button", { name: "Agregar materia" }).click();
  await expect(dialog.getByText("Falta el nombre de la materia.")).toBeVisible();
  await dialog.getByLabel("Nombre").fill("Física II");
  await dialog.getByLabel("Comisión").fill("Com. 3");
  await dialog.getByLabel("Docente").fill("Laura Benítez");
  await dialog.getByLabel("Créditos").fill("8");
  await dialog.getByRole("radio", { name: "Mandarina" }).click();
  await dialog.getByRole("button", { name: "Agregar materia" }).click();

  const card = page.getByRole("article", { name: "Física II" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Laura Benítez");
  await expect(card).toContainText("Com. 3");
  await expect(card).toContainText("100 %");
  await expect(card).toContainText("Sin tareas todavía");
  await expect(card).toContainText("8 créditos");
  await expect(card).toHaveClass(/subj-mandarina/);

  // Se guardó de verdad: sigue después de recargar.
  await page.reload();
  await expect(card).toBeVisible();

  // Editar desde el menú de la tarjeta (con teclado).
  await card.getByRole("button", { name: "Opciones de Física II" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const edit = page.getByRole("dialog", { name: "Editar materia" });
  await edit.getByLabel("Nombre").fill("Física 2");
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("article", { name: "Física 2" })).toBeVisible();

  // Archivar la saca de Inicio y la deja en Archivadas; desarchivar la devuelve.
  await page.getByRole("button", { name: "Opciones de Física 2" }).click();
  await page.getByRole("menuitem", { name: "Archivar" }).click();
  await expect(page.getByRole("article", { name: "Física 2" })).toBeHidden();
  await page.getByRole("button", { name: /Archivadas/ }).click();
  const archivedCard = page.getByRole("article", { name: "Física 2" });
  await expect(archivedCard).toBeVisible();
  await archivedCard.getByRole("button", { name: "Desarchivar" }).click();
  await page.getByRole("button", { name: "Volver a materias" }).click();
  await expect(page.getByRole("article", { name: "Física 2" })).toBeVisible();

  // Eliminar pide confirmación.
  await page.getByRole("button", { name: "Opciones de Física 2" }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  const confirmDialog = page.getByRole("alertdialog", { name: "¿Eliminar Física 2?" });
  await confirmDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("article", { name: "Física 2" })).toBeVisible();
  await page.getByRole("button", { name: "Opciones de Física 2" }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar materia" }).click();
  await expect(page.getByRole("heading", { name: "Empecemos por tus materias" })).toBeVisible();
});

test("documentos: pegar link valida que sea de Drive o Docs", async ({ page }) => {
  await page.goto("/app");
  await addSubject(page, "Química");
  await page.getByRole("button", { name: "Abrir Química" }).click();
  const sheet = page.getByRole("dialog", { name: "Química" });
  await sheet.getByRole("button", { name: "Pegar link" }).click();

  await sheet.getByLabel("Link de Google Drive o Docs").fill("https://example.com/apunte");
  await sheet.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(sheet.getByText("Tiene que ser un link de Google Drive o de Google Docs.")).toBeVisible();

  await sheet.getByLabel("Link de Google Drive o Docs").fill("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit");
  await sheet.getByRole("button", { name: "Agregar", exact: true }).click();
  const name = sheet.getByLabel("Nombre del documento");
  await expect(name).toHaveValue("Documento nuevo");
  await name.fill("Tabla de constantes");
  await name.press("Enter");

  const link = sheet.getByRole("link", { name: "Abrir Tabla de constantes en una pestaña nueva" });
  await expect(link).toHaveAttribute("href", "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit");
  await expect(link).toHaveAttribute("target", "_blank");
  await sheet.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByRole("article", { name: "Química" })).toContainText("1 documento");
});

test("notas: validación 0–10, promedios simple y ponderado, actual y general", async ({ page }) => {
  await page.goto("/app");
  await addSubject(page, "Álgebra", { credits: "8" });
  await addSubject(page, "Inglés técnico", { credits: "2" });
  await page.getByRole("tab", { name: "Notas" }).click();

  const grade = (label: string) => page.getByRole("textbox", { name: label });
  await grade("Cursada · Álgebra").fill("11");
  await grade("Cursada · Álgebra").press("Enter");
  await expect(page.getByText("Entre 0 y 10")).toBeVisible();

  await grade("Cursada · Álgebra").fill("8");
  await grade("Cursada · Álgebra").press("Enter");
  await expect(page.getByText("Entre 0 y 10")).toBeHidden();
  // Con una sola nota la materia no tiene promedio.
  await expect(page.getByRole("row", { name: /Álgebra/ }).locator(".avg")).toHaveText("—");

  await grade("Final · Álgebra").fill("9");
  await grade("Final · Álgebra").press("Enter");
  await grade("Cursada · Inglés técnico").fill("7,5");
  await grade("Cursada · Inglés técnico").press("Enter");
  await grade("Final · Inglés técnico").fill("6.5");
  await grade("Final · Inglés técnico").press("Tab");

  await expect(page.getByRole("row", { name: /Álgebra/ }).locator(".avg")).toHaveText("8,50");
  await expect(page.getByRole("row", { name: /Inglés técnico/ }).locator(".avg")).toHaveText("7,00");
  const current = page.locator(".stat-group").nth(0);
  // Simple: (8,5 + 7) / 2 = 7,75 · Ponderado: (8,5×8 + 7×2) / 10 = 8,20
  await expect(current.locator(".stat-value").nth(0)).toHaveText("7,75");
  await expect(current.locator(".stat-value").nth(1)).toHaveText("8,20");

  // Archivar Álgebra: sale del cuatrimestre actual pero sigue contando en el general.
  await page.getByRole("tab", { name: "Materias" }).click();
  await page.getByRole("button", { name: "Opciones de Álgebra" }).click();
  await page.getByRole("menuitem", { name: "Archivar" }).click();
  await page.getByRole("tab", { name: "Notas" }).click();
  await expect(current.locator(".stat-value").nth(0)).toHaveText("7,00");
  const overall = page.locator(".stat-group").nth(1);
  await expect(overall.locator(".stat-value").nth(0)).toHaveText("7,75");
  await expect(overall.locator(".stat-value").nth(1)).toHaveText("8,20");
  await expect(page.getByRole("row", { name: /Álgebra/ })).toContainText("Archivada");
});
