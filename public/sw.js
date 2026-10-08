// SalesPal service worker: notifications only (PRD-007 §2.6). It caches
// nothing, so every app update still loads fresh.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let note = { title: "SalesPal", body: "" };
  try { note = { ...note, ...e.data.json() }; } catch { if (e.data) note.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(note.title, {
    body: note.body,
    icon: "/logo-mark.png",
    badge: "/logo-mark.png",
    tag: note.tag || "salespal",
    data: { url: note.url || "/dashboard" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/dashboard";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
