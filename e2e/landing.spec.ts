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
  expect(sitemap).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(sitemap).toContain("/en/privacy</loc>");
});

test("el ping de keep-alive consulta la base y responde ok", async ({ request }) => {
  const response = await request.get("/api/keepalive");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(Number.isNaN(Date.parse(body.at))).toBe(false);
});

test("al compartir el link sale la imagen de la landing, en cada idioma", async ({ page, request }) => {
  for (const [path, locale] of [["/", "es"], ["/en", "en"]] as const) {
    await page.goto(path);
    const image = page.locator('meta[property="og:image"]');
    await expect(image).toHaveAttribute("content", new RegExp(`/og/${locale}\\.png$`));
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", new RegExp(`/og/${locale}\\.png$`));
    const file = await request.get(`/og/${locale}.png`);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe("image/png");
  }
});

test("en el teléfono la landing muestra capturas del teléfono y nada se pasa del ancho", async ({ browser }) => {
  for (const width of [320, 390, 600, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, locale: "es-AR" });
    const page = await context.newPage();
    for (const path of ["/", "/en", "/privacy", "/en/terms"]) {
      await page.goto(path);
      const [inner, scroll] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
      expect(inner, `${path} a ${width}`).toBe(width);
      expect(scroll, `scroll horizontal en ${path} a ${width}`).toBeLessThanOrEqual(width);
    }
    await page.goto("/");
    const shot = page.locator("section.feature").first().locator("img.shot-light");
    await shot.scrollIntoViewIfNeeded();
    await expect.poll(() => shot.evaluate((node: HTMLImageElement) => node.currentSrc)).toContain(width < 768 ? "-mobile.png" : "subjects-light.png");
    await context.close();
  }
});

test("privacidad y términos: públicos, en los dos idiomas y enlazados desde el pie", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await footer.getByRole("link", { name: "Privacidad" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacidad" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Cómo borrar los datos" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/privacy$/);

  await page.locator("footer").getByRole("link", { name: "Términos" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Términos de uso" })).toBeVisible();
  await page.getByRole("link", { name: "política de privacidad" }).click();
  await expect(page).toHaveURL(/\/privacy$/);

  await page.goto("/en/terms");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/en/privacy");
});
