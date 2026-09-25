// Drops everything the browser may be holding from an older deploy — service
// workers, Cache Storage, and the session-scoped state an interrupted Google
// redirect leaves behind — then reloads with a cache-busting query.
//
// The session itself lives in IndexedDB and is left alone, so a signed-in user
// stays signed in. Used from the dashboard's profile panel and from the login
// page, where a stale build or a half-finished redirect is what usually keeps
// someone from getting in.
export async function clearCacheAndReload(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    sessionStorage.clear();
  } catch {
    /* ignore — reload anyway */
  }
  const u = new URL(window.location.href);
  u.searchParams.set("_v", Date.now().toString());
  window.location.replace(u.toString());
}
