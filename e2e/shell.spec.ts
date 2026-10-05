import { expect, test } from "@playwright/test";
import type { TestUser } from "../scripts/lib/test-session";
import { removeUser, signInFreshUser } from "./session";

test.describe("landing", () => {
  test("es pública, en español por defecto y en inglés bajo /en", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1, name: "Tilde" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar con Google" }).first()).toBeVisible();

    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Continue with Google" }).first()).toBeVisible();
  });

  test("sin sesión, /app vuelve a la landing", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Continuar con Google" }).first()).toBeVisible();
  });
});

test.describe("shell con sesión", () => {
  let user: TestUser;
  test.beforeEach(async ({ context }) => {
    user = await signInFreshUser(context);
  });
  test.afterEach(async () => removeUser(user));

  test("la landing redirige a la app y el drawer navega entre secciones", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inicio");

    await page.getByRole("button", { name: "Abrir menú" }).click();
    const drawer = page.locator("#drawer");
    await expect(drawer).toBeVisible();
    for (const label of ["Inicio", "Horario", "Tareas", "Calendario", "Sesiones de estudio"]) {
      await expect(drawer.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await drawer.getByRole("link", { name: "Tareas", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/todo$/);
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tareas");
  });

  test("el drawer se abre y se cierra con el teclado y devuelve el foco", async ({ page }) => {
    await page.goto("/app");
    const menu = page.getByRole("button", { name: "Abrir menú" });
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#drawer")).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test("el tema se cambia y se recuerda", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("radio", { name: "Oscuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("radio", { name: "Claro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("el idioma se cambia desde Ajustes y se guarda en el perfil", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    // En el menú queda el tema; el idioma está solo en Ajustes.
    const drawer = page.locator("#drawer");
    await expect(drawer.getByRole("radiogroup", { name: "Tema" })).toBeVisible();
    await expect(drawer.getByRole("radiogroup", { name: "Idioma" })).toHaveCount(0);
    await expect(drawer.getByRole("radio", { name: "English" })).toHaveCount(0);
    await page.getByRole("button", { name: "Ajustes" }).click();
    await page.getByRole("dialog", { name: "Ajustes" }).getByRole("radio", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/app$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
    // La cookie hace que las URL sin prefijo respeten el idioma elegido.
    await page.goto("/app/calendar");
    await expect(page).toHaveURL(/\/en\/app\/calendar$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Calendar");
  });

  test("cerrar sesión vuelve a la landing y /app deja de ser accesible", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("button", { name: "Ajustes" }).click();
    await page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(page.getByRole("button", { name: "Continuar con Google" }).first()).toBeVisible();
    await page.goto("/app/todo");
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });
});
