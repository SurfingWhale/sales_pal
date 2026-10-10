// The file Android shared into SalesPal (public/sw.js parks it in Cache Storage).

export async function takeSharedFile(): Promise<File | null> {
  try {
    if (!("caches" in window)) return null;
    const cache = await caches.open("sp-share");
    const res = await cache.match("/shared-file");
    if (!res) return null;
    await cache.delete("/shared-file");
    const name = decodeURIComponent(res.headers.get("x-name") || "chat.txt");
    return new File([await res.blob()], name, { type: res.headers.get("content-type") || "text/plain" });
  } catch {
    return null;
  }
}

// Installed for the share sheet; it caches no app files, so updates stay fresh.
export function registerWorker() {
  try { navigator.serviceWorker?.register("/sw.js", { scope: "/" }).catch(() => {}); } catch { /* old browser */ }
}
