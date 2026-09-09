/* KJAPP service worker — push notifications */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "KJAPP", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "KJAPP";
  const isTrip = data.tag === "kjapp-new-trip";
  const options = {
    body: data.body || "",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    data: { url: data.url || "/app" },
    vibrate: isTrip ? [300, 120, 300, 120, 300] : [80, 40, 80],
    tag: data.tag || "kjapp-notification",
    renotify: true,
    requireInteraction: !!data.requireInteraction,
    actions: isTrip ? [{ action: "open", title: "Se turen" }] : [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
