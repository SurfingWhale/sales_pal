// Morning reminder on this device (PRD-007 §2.6): the browser side of Web Push.
// iPhone/iPad: only from the app added to the home screen, iOS 16.4 or newer.

import { authFetch } from "@/lib/authFetch";

const FLAG = "sp-push";
const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export type PushState = "unsupported" | "needs-install" | "off" | "on" | "blocked" | "not-configured";

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const standalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

const flag = (on: boolean) => { try { on ? localStorage.setItem(FLAG, "1") : localStorage.removeItem(FLAG); } catch { /* private mode */ } };
const flagged = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } };

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !standalone() ? "needs-install" : "unsupported";
  if (!KEY) return "not-configured";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

async function subscribe(): Promise<void> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) as BufferSource }));
  const res = await authFetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Server nolak langganan notifikasi.");
}

// Asks for permission (must run from a tap), subscribes, and tells the server.
export async function enablePush(): Promise<void> {
  if (!supported()) throw new Error(isIos() ? "Tambahin SalesPal ke Home Screen dulu (Share → Add to Home Screen), terus buka dari situ." : "Browser ini belum dukung notifikasi.");
  if (!KEY) throw new Error("Notifikasi belum disetel di server.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Izin notifikasi ditolak. Nyalain dari pengaturan browser/HP.");
  await subscribe();
  flag(true);
}

export async function disablePush(): Promise<void> {
  flag(false);
  const reg = await navigator.serviceWorker?.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await authFetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe();
}

export async function testPush(): Promise<number> {
  const res = await authFetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Tes ga kekirim. Matikan lalu nyalain lagi notifikasinya, terus coba lagi.");
  return body.sent || 0;
}

// After "reset cache" unregisters the service worker, or a new deploy, put the
// subscription back quietly — permission was already given, so no prompt.
export async function restorePush(): Promise<void> {
  if (!supported() || !KEY || !flagged() || Notification.permission !== "granted") return;
  try { await subscribe(); } catch { /* try again next open */ }
}
