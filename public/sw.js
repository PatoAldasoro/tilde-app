/*
 * Tilde — service worker.
 *
 * Qué hace: deja guardadas las pantallas de la app (/app y sus secciones) y los archivos que usan,
 * para que abran sin conexión. Qué no hace: no guarda ni responde datos (eso es de la app: su caché
 * y su cola de cambios), no toca /api ni /auth ni nada de otro origen, y con conexión siempre
 * manda la red: lo guardado solo se usa cuando la red no responde.
 */

const VERSION = "v1";
const PAGES = `tilde-pages-${VERSION}`;
const STATIC = `tilde-static-${VERSION}`;
const META = "/__tilde/meta";

const APP_PATH = /^\/(?:en\/)?app(?:\/|$)/;
const STATIC_PATH = /^\/_next\/static\//;
/** Cuánto se espera a la red antes de mostrar la pantalla guardada. */
const PAGE_TIMEOUT_MS = 4000;
/** Cada cuánto se vuelven a guardar todas las secciones aunque nada haya cambiado. */
const WARM_EVERY_MS = 6 * 60 * 60 * 1000;
const STATIC_LIMIT = 320;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("tilde-") && name !== PAGES && name !== STATIC).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (STATIC_PATH.test(url.pathname)) {
    event.respondWith(staticFile(request));
  } else if (request.mode === "navigate" && APP_PATH.test(url.pathname)) {
    event.respondWith(page(event, request, url));
  }
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message && message.type === "warm" && Array.isArray(message.paths)) {
    event.waitUntil(warm(message.paths.filter((path) => typeof path === "string" && APP_PATH.test(path)), false));
  }
});

// ---------- archivos del build (/_next/static): llevan un hash en el nombre, no cambian nunca ----------

async function staticFile(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request.url, response.clone()).catch(() => undefined);
  return response;
}

// ---------- pantallas: primero la red; lo guardado, solo si la red no responde ----------

const isHtml = (response) => (response.headers.get("content-type") || "").includes("text/html");
const pageKey = (url) => url.pathname + url.search;

async function savedPage(cache, url) {
  return (await cache.match(pageKey(url))) || (await cache.match(url.pathname));
}

async function page(event, request, url) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then((response) => {
    // Solo se guarda una pantalla de verdad: ni redirecciones (sesión vencida) ni errores.
    if (response.ok && response.type === "basic" && isHtml(response)) event.waitUntil(storePage(cache, url, response.clone()));
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), PAGE_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    // La red tarda: si la pantalla está guardada se muestra ya; si no, se sigue esperando.
    network.catch(() => undefined);
    return (await savedPage(cache, url)) || (await network);
  } catch {
    return (await savedPage(cache, url)) || offlinePage();
  }
}

async function storePage(cache, url, response) {
  const html = await response.text();
  await cache.put(pageKey(url), new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
  // La "firma" de una pantalla son los archivos que pide. Se compara cada pantalla consigo misma (cada una pide
  // archivos distintos): si la misma pantalla ahora pide otros, hubo un deploy y lo guardado de las demás quedó viejo.
  const signature = staticUrls(html).sort().join("|");
  const meta = await readMeta();
  const known = meta.signatures[url.pathname];
  if (known === signature) return;
  await writeMeta({ ...meta, signatures: { ...meta.signatures, [url.pathname]: signature } });
  if (known !== undefined && meta.paths.length > 0) await warm(meta.paths, true);
}

// ---------- dejar todo listo para usar sin conexión ----------

const staticUrls = (text) => [...new Set(text.match(/\/_next\/static\/[^"'\\)\s<>]+/g) || [])];

async function readMeta() {
  const cache = await caches.open(PAGES);
  const stored = await cache.match(META);
  const meta = stored ? await stored.json().catch(() => null) : null;
  return { signatures: {}, warmedAt: 0, paths: [], ...(meta || {}) };
}

async function writeMeta(meta) {
  const cache = await caches.open(PAGES);
  await cache.put(META, new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }));
}

let warming = null;

/** Guarda todas las secciones y los archivos que usan (también las fuentes que piden sus estilos). */
function warm(paths, force) {
  if (!warming) {
    warming = warmNow(paths, force)
      .catch(() => undefined)
      .then(() => {
        warming = null;
      });
  }
  return warming;
}

async function warmNow(paths, force) {
  if (paths.length === 0) return;
  const meta = await readMeta();
  const samePaths = paths.every((path) => meta.paths.includes(path));
  if (!force && samePaths && Date.now() - meta.warmedAt < WARM_EVERY_MS) return;

  const pages = await caches.open(PAGES);
  const files = new Set();
  for (const path of paths) {
    const response = await fetch(path, { credentials: "same-origin", headers: { accept: "text/html" } }).catch(() => null);
    // Una redirección quiere decir que no hay sesión: no se guarda nada.
    if (!response || !response.ok || response.redirected || !isHtml(response)) continue;
    const html = await response.text();
    await pages.put(path, new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
    staticUrls(html).forEach((url) => files.add(url));
  }

  const cache = await caches.open(STATIC);
  const fetchInto = async (url) => {
    const absolute = new URL(url, self.location.origin).href;
    let response = await cache.match(absolute);
    if (!response) {
      response = await fetch(absolute).catch(() => null);
      if (!response || !response.ok) return null;
      await cache.put(absolute, response.clone());
    }
    return response;
  };
  for (const url of files) {
    const response = await fetchInto(url);
    // Los estilos piden las fuentes con url(...): sin ellas la app abre con otra letra.
    if (response && url.split("?")[0].endsWith(".css")) {
      const css = await response.clone().text().catch(() => "");
      for (const font of staticUrls(css)) await fetchInto(font);
    }
  }

  // Los archivos de builds viejos se van: quedan los últimos que se guardaron.
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map((key) => cache.delete(key)));
  // Se relee: mientras tanto una navegación pudo haber anotado su firma.
  const latest = await readMeta();
  await writeMeta({ ...latest, warmedAt: Date.now(), paths: [...new Set([...latest.paths, ...paths])] });
}

// ---------- sin conexión y sin la pantalla guardada ----------

function offlinePage() {
  // El service worker no tiene los textos ni los estilos de la app: una página mínima, en los dos idiomas.
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tilde</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:16px/1.5 system-ui,sans-serif;background:#FAF9F7;color:#1E1C19;text-align:center}
main{max-width:420px}h1{font:400 32px/1.1 Georgia,serif;margin:0 0 12px}p{margin:0 0 8px;color:#5E5850}
button{margin-top:16px;height:44px;padding:0 20px;border:0;border-radius:6px;background:#1E1C19;color:#FAF9F7;font:500 15px system-ui,sans-serif;cursor:pointer}
@media (prefers-color-scheme:dark){body{background:#131211;color:#F2F0EC}p{color:#B5AFA6}button{background:#F2F0EC;color:#131211}}</style></head>
<body><main><h1>Sin conexión</h1><p>Esta pantalla todavía no estaba guardada en este dispositivo. Se abre sola cuando vuelva la conexión.</p>
<p lang="en">You are offline and this screen was not saved on this device yet. It will open on its own once you are back online.</p>
<button type="button" onclick="location.reload()">Reintentar · Retry</button></main>
<script>addEventListener("online",function(){location.reload()})</script></body></html>`;
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
