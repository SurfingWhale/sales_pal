import { NextResponse } from "next/server";
import { canStore, deny, requireUser } from "@/lib/serverAuth";
import { dropSub, pushReady, saveSub, sendTo, subsOf, validSub } from "@/lib/pushServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });

// Turn on the morning reminder for this device, or send a test to every device
// of the caller ({ test: true }).
export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!pushReady()) return deny("Notifikasi belum disetel di server (VAPID key).", 503);
  if (!canStore()) return deny("Server belum bisa menyimpan (FIREBASE_SERVICE_ACCOUNT belum diisi).", 503);
  const body = await req.json().catch(() => ({}));
  if (body.test) {
    const subs = await subsOf(caller.uid);
    const sent = (await Promise.all(subs.map(s => sendTo(s.id, s.sub, {
      title: "SalesPal", body: "Notifikasi nyala. Tiap pagi kamu dapet ringkasan yang perlu ditindak.", url: "/dashboard", tag: "test",
    })))).filter(Boolean).length;
    return ok({ sent });
  }
  if (!validSub(body.subscription)) return deny("Langganan notifikasi tidak valid.", 400);
  await saveSub(caller.uid, body.subscription);
  return ok({ ok: true });
}

// Turn it off for this device.
export async function DELETE(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  const { endpoint } = await req.json().catch(() => ({}));
  if (canStore() && typeof endpoint === "string") await dropSub(caller.uid, endpoint);
  return ok({ ok: true });
}
