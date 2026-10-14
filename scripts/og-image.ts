/**
 * npm run og-image
 *
 * Arma la imagen que acompaña al link cuando se comparte (LinkedIn, X, WhatsApp…): 1200 × 630, una por
 * idioma, en public/og/. Lleva el logo, el nombre, la primera frase de la portada y la captura de Materias
 * (public/landing/subjects-light.png: correr antes `npm run screenshots` si cambió la app).
 * No necesita la app ni Supabase: arma la página con los tokens y las fuentes del repo y la captura.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "og");
const SIZE = { width: 1200, height: 630 };
const LOCALES = ["es", "en"] as const;

const dataUrl = async (file: string, type: string) =>
  `data:${type};base64,${(await readFile(path.join(ROOT, file))).toString("base64")}`;

async function html(locale: (typeof LOCALES)[number]) {
  const messages = JSON.parse(await readFile(path.join(ROOT, "messages", `${locale}.json`), "utf8"));
  const line = String(messages.hero_line).split(".")[0];
  const tokens = await readFile(path.join(ROOT, "src", "styles", "tokens.css"), "utf8");
  const serif = await dataUrl("node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2", "font/woff2");
  const sans = await dataUrl("node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", "font/woff2");
  const shot = await dataUrl("public/landing/subjects-light.png", "image/png");

  return `<!doctype html>
<html lang="${locale}" data-theme="light">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: "Instrument Serif"; src: url(${serif}) format("woff2"); font-weight: 400; }
@font-face { font-family: "Geist Variable"; src: url(${sans}) format("woff2"); font-weight: 100 900; }
${tokens}
* { box-sizing: border-box; margin: 0; }
body { width: ${SIZE.width}px; height: ${SIZE.height}px; overflow: hidden; position: relative; background: var(--color-surface-sunken); font-family: var(--font-sans); color: var(--color-text); }
.copy { position: absolute; left: 80px; top: 0; bottom: 0; width: 420px; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
h1 { font-family: var(--font-display); font-weight: 400; font-size: 132px; line-height: 0.9; letter-spacing: var(--tracking-tight); }
p { font-size: 30px; line-height: 1.3; color: var(--color-text-muted); text-wrap: balance; }
.frame { position: absolute; left: 560px; top: 88px; width: 760px; height: 640px; overflow: hidden; background: var(--color-bg); border: 1px solid var(--color-border-strong); border-radius: var(--radius-xl) 0 0 0; box-shadow: 0 24px 64px -24px rgb(30 28 25 / 0.28); }
.frame img { position: absolute; left: -8px; top: -6px; width: 1008px; height: auto; }
</style>
</head>
<body>
<div class="copy">
  <svg width="84" height="84" viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="6.5" fill="var(--accent-default-vivid)" />
    <path d="M5 13.2C6.3 10.6 8.3 10.4 9.9 12.6L11.6 15C12.1 15.7 12.9 15.7 13.4 15L18.9 7.4" fill="none" stroke="var(--accent-default-on-solid)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <h1>Tilde</h1>
  <p>${line}.</p>
</div>
<div class="frame"><img src="${shot}" alt=""></div>
</body>
</html>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: SIZE });
    for (const locale of LOCALES) {
      await page.setContent(await html(locale), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(OUT_DIR, `${locale}.png`);
      await page.screenshot({ path: file });
      console.log(`✓ ${path.relative(ROOT, file)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
