/*
 * Lifestyle Tracker service worker: offline *reads*, nothing more.
 *
 * - Framework assets (/_next/static) are immutable, so cache-first.
 * - Page navigations and Supabase REST reads are network-first, falling back
 *   to the last good copy, so Today and the Fridge still open with the data
 *   they last showed when the kitchen has no signal.
 * - Writes are never cached or replayed. Neither are /api (AI calls), auth
 *   routes, or Supabase auth. A write offline fails visibly, as it would
 *   without a service worker.
 * - Signing out empties the page and data caches. This is health data on a
 *   phone that might be shared.
 *
 * Bump VERSION when this strategy changes; activate deletes older caches.
 */

const VERSION = "v1";
const STATIC = `lt-static-${VERSION}`;
const PAGES = `lt-pages-${VERSION}`;
const DATA = `lt-data-${VERSION}`;
const KEEP = new Set([STATIC, PAGES, DATA]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("lt-") && !KEEP.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-user-data") {
    event.waitUntil(clearUserData());
  }
});

async function clearUserData() {
  await Promise.all([caches.delete(PAGES), caches.delete(DATA)]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Sign-out is a POST navigation; let it through, and forget everything.
  if (url.origin === self.location.origin && url.pathname === "/auth/signout") {
    event.waitUntil(clearUserData());
    return;
  }

  if (request.method !== "GET") return;

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname === "/login") return;

    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(request, STATIC));
      return;
    }

    // Full page loads and the RSC payloads behind client-side tab switches.
    if (request.mode === "navigate" || url.searchParams.has("_rsc")) {
      event.respondWith(networkFirst(request, PAGES));
      return;
    }
    return;
  }

  // Supabase table reads (PostgREST). Never auth, storage or realtime.
  if (url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/v1/")) {
    event.respondWith(networkFirst(request, DATA));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // Only keep real successes — never a login redirect or an error page.
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch (offline) {
    const hit = (await cache.match(request)) || (await cache.match(request, { ignoreVary: true }));
    if (hit) return hit;
    throw offline;
  }
}
