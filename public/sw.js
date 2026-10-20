const SW_VERSION = "sales-5";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "US (global)",
    body: "New donation",
    url: "/admin/sales",
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      if (event.data) data.body = event.data.text();
    } catch {
      /* keep defaults */
    }
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "US (global)", {
        body: data.body || "New donation",
        icon: "/admin-icon-192.png",
        badge: "/admin-icon-192.png",
        silent: false,
        vibrate: [80, 40, 120, 40, 200],
        tag: "sale-alert",
        renotify: true,
        data: { url: data.url || "/admin/sales" },
      });
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        client.postMessage({ type: "sale-chime" });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/admin/sales";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (client.url.includes("/admin")) {
          client.postMessage({ type: "open-sales", url: path });
          if ("focus" in client) return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
