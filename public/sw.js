// SalesPal service worker: notifications (PRD-007 §2.6) and Android's share
// sheet (PRD-008 §5). It caches no app files, so every update loads fresh.

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

// Android's share sheet lands here as a POST. A WhatsApp chat export: park
// the file for the app (Cache Storage, one slot) and open the dashboard to
// pick the lead it belongs to. A link (a Threads post, PRD-009 §4.4): open
// Hunting with it. Every other request goes to the network untouched.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "POST" || url.pathname !== "/share-target") return;
  e.respondWith((async () => {
    try {
      const form = await e.request.formData();
      const file = form.get("file");
      const cache = await caches.open("sp-share");
      if (file && typeof file !== "string") {
        await cache.put("/shared-file", new Response(file, { headers: { "content-type": file.type || "text/plain", "x-name": encodeURIComponent(file.name || "chat.txt") } }));
        return Response.redirect("/dashboard?share", 303);
      }
      const words = ["url", "text", "title"].map(k => form.get(k)).filter(v => typeof v === "string").join(" ");
      const link = (words.match(/https?:\/\/[^\s]+/) || [])[0];
      if (link) return Response.redirect(`/dashboard?hunt&url=${encodeURIComponent(link)}`, 303);
    } catch (err) { /* fall through */ }
    return Response.redirect("/dashboard?share=kosong", 303);
  })());
});
