// Web Push on the server (PRD-007 §2.6). Subscriptions live in pushSubs/
// (server only — firestore.rules denies every browser), one doc per device.
//
// Env (Vercel → Settings → Environment Variables):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  VAPID public key (the browser subscribes with it)
//   VAPID_PRIVATE_KEY             VAPID private key
//   CRON_SECRET                   Vercel sends it to the cron route as a Bearer token
// Make a key pair with: npx web-push generate-vapid-keys

import { createHash } from "node:crypto";
import webpush, { PushSubscription } from "web-push";
import { adminDb } from "@/lib/serverAuth";

export function pushReady(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://salespal-alpha.vercel.app", pub, priv);
  return true;
}

export const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export function validSub(s: unknown): s is PushSubscription {
  const x = s as PushSubscription;
  return Boolean(x && typeof x.endpoint === "string" && /^https:\/\//.test(x.endpoint) && x.endpoint.length < 1000
    && x.keys && typeof x.keys.p256dh === "string" && typeof x.keys.auth === "string");
}

export async function saveSub(uid: string, sub: PushSubscription) {
  await adminDb().collection("pushSubs").doc(subId(sub.endpoint)).set({
    uid, endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, updatedAt: Date.now(),
  });
}

export async function dropSub(uid: string, endpoint: string) {
  const ref = adminDb().collection("pushSubs").doc(subId(endpoint));
  const snap = await ref.get();
  if (snap.exists && snap.data()?.uid === uid) await ref.delete();
}

export interface Note { title: string; body: string; url?: string; tag?: string }

// Send to one stored subscription; forget it when the push service says it's gone.
export async function sendTo(id: string, sub: PushSubscription, note: Note): Promise<boolean> {
  try {
    await webpush.sendNotification(sub, JSON.stringify(note), { TTL: 12 * 3600 });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await adminDb().collection("pushSubs").doc(id).delete();
    return false;
  }
}

export async function subsOf(uid: string) {
  const snap = await adminDb().collection("pushSubs").where("uid", "==", uid).get();
  return snap.docs.map(d => ({ id: d.id, sub: { endpoint: d.data().endpoint, keys: d.data().keys } as PushSubscription }));
}
