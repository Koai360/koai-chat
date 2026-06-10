/**
 * Noa SW v3 — service worker premium dark redesign.
 *
 * Strategy:
 * - Pre-cache shell (manifest + icons)
 * - Runtime cache: stale-while-revalidate para assets estáticos
 * - Network-only para /api/* (siempre fresh)
 * - SKIP_WAITING al recibir mensaje del cliente (update flow)
 * - Push notifications: solo si app no está visible
 */

// __SW_VERSION__ se estampa por build (vite.config.ts:stampServiceWorkerVersion).
// En dev (public/ servido directo) queda el placeholder — inofensivo.
// S158: antes era "noa-v3.0.0" fijo → el SW nunca se re-instalaba → index
// precacheado congelado → bundles viejos corriendo en iOS tras cada deploy.
const VERSION = "__SW_VERSION__";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/noa-192.png",
  "/icons/noa-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // cache: "reload" → bypass del HTTP cache del browser; el precache
      // siempre baja el index/manifest frescos del server, no una copia stale.
      .then((cache) =>
        cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: "reload" })))
      )
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpia caches viejos — SOLO los propios (prefijo noa-), no cualquier
      // cache del origin (review Codex S158).
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("noa-") && !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API requests siempre fresh
  if (url.pathname.startsWith("/api/")) return;

  // Solo cachemos same-origin GETs
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Stale-while-revalidate para assets
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(event.request);
        const networkPromise = fetch(event.request)
          .then((resp) => {
            if (resp.ok) cache.put(event.request, resp.clone()).catch(() => {});
            return resp;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })()
    );
    return;
  }

  // Navegaciones → network-first con fallback a index cached
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/").then((r) => r || Response.error()))
    );
  }
});

// --- Push notifications ---
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "Noa";
    const options = {
      body: data.body || "",
      icon: "/icons/noa-192.png",
      badge: "/icons/noa-192.png",
      data: { url: data.url || "/" },
      vibrate: [80, 40, 80],
    };
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true, visibilityState: "visible" })
        .then((visibleClients) => {
          if (visibleClients.length > 0) return;
          return self.registration.showNotification(title, options);
        })
    );
  } catch (err) {
    console.error("[SW] push parse error", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
