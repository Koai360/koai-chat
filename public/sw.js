const CACHE_NAME = "koai-chat-v17";
const PRECACHE = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- Push Notifications ---
self.addEventListener("push", (e) => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    const title = data.title || "Noa AI";
    const options = {
      body: data.body || "",
      icon: "/icons/noa-192.png",
      badge: "/icons/noa-192.png",
      data: { url: data.url || "/" },
      vibrate: [100, 50, 100],
    };
    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true, visibilityState: "visible" }).then((visibleClients) => {
        if (visibleClients.length > 0) {
          // App abierta y visible → NO mostrar notificación del sistema
          return;
        }
        // App en background o cerrada → mostrar notificación del sistema
        return self.registration.showNotification(title, options);
      })
    );
  } catch (err) {
    console.error("[SW] Push parse error:", err);
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache API calls
  if (url.pathname.startsWith("/api")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
