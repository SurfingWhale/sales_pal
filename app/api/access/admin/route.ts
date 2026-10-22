import { NextResponse } from "next/server";
import { canStore, requireUser } from "@/lib/serverAuth";
import { decide, isAdmin, isOwner, listAdmins, listRequests, setAdmin } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Profil → Akses & admin (PRD-015 §2b): admins see and decide applications;
// only the owner names or removes admins.
const NO_STORE = { headers: { "Cache-Control": "no-store, max-age=0" } };

export async function GET(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!(await isAdmin(caller))) return NextResponse.json({ error: "Cuma admin." }, { status: 403 });
  if (!canStore()) return NextResponse.json({ error: "Butuh FIREBASE_SERVICE_ACCOUNT di server." }, { status: 503 });
  const owner = isOwner(caller);
  const [requests, admins] = await Promise.all([listRequests(), owner ? listAdmins() : Promise.resolve(null)]);
  return NextResponse.json({ requests, admins, owner, me: caller.uid }, NO_STORE);
}

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!(await isAdmin(caller))) return NextResponse.json({ error: "Cuma admin." }, { status: 403 });
  if (!canStore()) return NextResponse.json({ error: "Butuh FIREBASE_SERVICE_ACCOUNT di server." }, { status: 503 });
  let b: { op?: string; uid?: string; tools?: unknown; email?: string; on?: boolean } = {};
  try { b = await req.json(); } catch { /* handled below */ }
  try {
    if (b.op === "approve" || b.op === "refuse" || b.op === "revoke") {
      const uid = String(b.uid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
      if (!uid) return NextResponse.json({ error: "Siapa?" }, { status: 400 });
      const tools = Array.isArray(b.tools) ? b.tools.map(String) : [];
      await decide(caller, uid, b.op === "approve" ? "approved" : b.op === "refuse" ? "refused" : "revoked", tools);
      return NextResponse.json({ ok: true }, NO_STORE);
    }
    if (b.op === "admin") {
      if (!isOwner(caller)) return NextResponse.json({ error: "Cuma owner yang bisa ngangkat atau nyabut admin." }, { status: 403 });
      const email = String(b.email || "").trim().slice(0, 200);
      if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Tulis email yang bener." }, { status: 400 });
      await setAdmin(caller, email, b.on !== false);
      return NextResponse.json({ ok: true }, NO_STORE);
    }
    return NextResponse.json({ error: "Perintah ga dikenal." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Gagal." }, { status: 400 });
  }
}
