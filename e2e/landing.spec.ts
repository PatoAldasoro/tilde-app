import { expect, test } from "@playwright/test";

const FEATURES = ["Materias", "Horario", "Tareas", "Calendario", "Notas", "Sesiones de estudio"];

test("landing: barra fija, hero y un bloque por funcionalidad con captura real", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^Tilde — /);
  const top = page.locator(".landing-top");
  await expect(top.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Tilde" })).toBeVisible();

  const features = page.locator("section.feature");
  await expect(features).toHaveCount(FEATURES.length);
  for (const [index, name] of FEATURES.entries()) {
    await expect(features.nth(index).locator(".feature-kicker")).toContainText(name);
    await expect(features.nth(index).getByRole("heading", { level: 2 })).toBeVisible();
  }

  // La barra queda fija al desplazarse y las capturas cargan de verdad.
  for (let index = 0; index < FEATURES.length; index += 1) {
    const image = features.nth(index).locator("img.shot-light");
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute("alt", /Tilde/);
  }
  await expect(top).toBeInViewport();
  await expect(top).toHaveClass(/is-scrolled/);
});

test("la landing muestra la captura del tema activo", async ({ page }) => {
  await page.goto("/");
  const first = page.locator("section.feature").first();
  await first.scrollIntoViewIfNeeded();
  await expect(first.locator("img.shot-light")).toBeVisible();
  await expect(first.locator("img.shot-dark")).toBeHidden();

  await page.getByRole("button", { name: "Cambiar tema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(first.locator("img.shot-dark")).toBeVisible();
  await expect(first.locator("img.shot-light")).toBeHidden();
  await expect.poll(() => first.locator("img.shot-dark").evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBeGreaterThan(0);
});

test("la landing es indexable en ambos idiomas", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /localhost:\d+\/?$/);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);

  // Cambiar de idioma desde la barra lleva a /en con todo traducido.
  await page.getByLabel("Idioma").selectOption("en");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("section.feature").first().locator(".feature-kicker")).toContainText("Courses");
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(1);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app");
  expect(robots).toContain("Sitemap:");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/en</loc>");
});

test("el ping de keep-alive consulta la base y responde ok", async ({ request }) => {
  const response = await request.get("/api/keepalive");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(Number.isNaN(Date.parse(body.at))).toBe(false);
});
