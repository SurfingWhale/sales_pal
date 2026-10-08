// Server-side identity (docs/prd/PRD-006, P0). Every API route asks who is
// calling before it spends a paid key or touches a stored token.
//
// Env (Vercel → Settings → Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  the service-account JSON (raw or base64). Needed
//                             for anything the server stores: the token vault
//                             and usage quotas. Verifying a sign-in does not
//                             need it — only the project id.
//   SCAN_DAILY_LIMIT          scans per user per day (default 40)

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-salespal";

// Flow tests run the app against the emulators; point the Admin SDK there too.
// Only when the build was made for the emulators, so production never can.
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8089";
}

function serviceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON (raw or base64).");
    return null;
  }
}

function admin(): App {
  const existing = getApps().find(a => a.name === "salespal-admin");
  if (existing) return existing;
  const sa = serviceAccount();
  return initializeApp(sa ? { credential: cert(sa), projectId } : { projectId }, "salespal-admin");
}

// The server may keep data of its own only with real credentials, or against the emulator.
export function canStore(): boolean {
  return Boolean(serviceAccount() || process.env.FIRESTORE_EMULATOR_HOST);
}

export function adminDb() {
  return getFirestore(admin());
}

export interface Caller { uid: string; email?: string }

export function deny(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

// The signed-in SalesPal user behind a request, from its
// "Authorization: Bearer <Firebase ID token>" header — or a 401 to return.
export async function requireUser(req: Request): Promise<Caller | NextResponse> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return deny("Login dulu.", 401);
  try {
    const d = await getAuth(admin()).verifyIdToken(token);
    return { uid: d.uid, email: d.email };
  } catch {
    return deny("Sesi login tidak valid. Coba muat ulang app.", 401);
  }
}

// ---- daily quota per user ----------------------------------------------
// Stored in usage/{uid}_{key}_{YYYY-MM-DD} (server only). Without stored
// credentials it falls back to this instance's memory — weaker, but a cap.
const memory = new Map<string, number>();

export async function takeQuota(uid: string, key: string, limit: number): Promise<{ ok: boolean; used: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const id = `${uid}_${key}_${day}`;
  if (!canStore()) {
    const used = (memory.get(id) || 0) + 1;
    if (used > limit) return { ok: false, used: used - 1 };
    memory.set(id, used);
    return { ok: true, used };
  }
  const ref = adminDb().collection("usage").doc(id);
  return adminDb().runTransaction(async tx => {
    const used = ((await tx.get(ref)).data()?.count as number | undefined) || 0;
    if (used >= limit) return { ok: false, used };
    tx.set(ref, { uid, key, day, count: FieldValue.increment(1), at: Date.now() }, { merge: true });
    return { ok: true, used: used + 1 };
  });
}

// ---- token vault ---------------------------------------------------------
// connections/{uid}_{platform}: platform tokens the browser must never read.
// firestore.rules denies every client access; only this module touches it.
export interface StoredConnection { token: string; userId: string; username?: string; expiresAt: number; refreshedAt: number }

export async function saveConnection(uid: string, platform: string, c: StoredConnection) {
  await adminDb().collection("connections").doc(`${uid}_${platform}`).set({ ...c, uid, platform, updatedAt: Date.now() });
}

export async function readConnection(uid: string, platform: string): Promise<StoredConnection | null> {
  const snap = await adminDb().collection("connections").doc(`${uid}_${platform}`).get();
  return snap.exists ? (snap.data() as StoredConnection) : null;
}

export async function dropConnection(uid: string, platform: string) {
  await adminDb().collection("connections").doc(`${uid}_${platform}`).delete();
}
