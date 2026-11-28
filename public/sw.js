/*
 * Milliy Mock service worker — makes the app installable and lets already-visited pages
 * (and saved flashcard decks) open without internet.
 *
 * Safety rules:
 *  - API calls (/api/*), the admin panel and exam pages are NEVER cached: answers, timers and
 *    results must always come from the server.
 *  - Only same-origin GET requests are handled. Pages are client-rendered shells; personal data
 *    is fetched from the API with the user's token and is not stored here.
 */
const VERSION = "mm-v3";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/kartalar/oflayn", "/pwa-icon/192", "/pwa-icon/512"];
const NEVER = [/^\/api\//, /^\/admin(\/|$)/, /^\/urinish(\/|$)/, /^\/imtihon\/[^/]+\/boshlash/, /^\/challenge\/[^/]+$/, /^\/battle\/[^/]+$/];
const MAX_PAGES = 60;

/** Caches a page AND the hashed scripts/styles it references — without them an offline page renders blank. */
async function precachePage(url) {
  const res = await fetch(new Request(url, { cache: "reload" }));
  if (!res.ok) return;
  const html = await res.clone().text();
  await (await caches.open(PAGES)).put(url, res);
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
  const statics = await caches.open(STATIC);
  await Promise.all(assets.map((a) => statics.add(a).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all(PRECACHE.map((u) => (u.startsWith("/pwa-icon/") ? caches.open(STATIC).then((c) => c.add(u)) : precachePage(u)).catch(() => undefined))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((r) => r.test(url.pathname))) return;

  // Build assets are content-hashed → cache first, forever.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations: network first; offline → the cached copy, else the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy).then(() => trim(PAGES, MAX_PAGES)));
          }
          return res;
        })
        // Unknown page offline → redirect (not the HTML under another URL: the client router would
        // then try to load the original route and fail).
        .catch(async () => (await caches.match(url.pathname)) || ((await caches.match("/offline")) ? Response.redirect("/offline", 302) : Response.error())),
    );
  }
});

// The page can ask to pre-cache a list of URLs (used by "save deck for offline").
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "precache" && Array.isArray(data.urls)) {
    const urls = data.urls.filter((u) => typeof u === "string" && u.startsWith("/") && !NEVER.some((r) => r.test(u))).slice(0, 80);
    event.waitUntil(
      Promise.all(
        urls.map((u) =>
          fetch(u)
            .then((res) => {
              if (!res.ok) return;
              return caches.open(u.startsWith("/_next/static/") ? STATIC : PAGES).then((c) => c.put(u, res));
            })
            .catch(() => undefined),
        ),
      ),
    );
  }
});
