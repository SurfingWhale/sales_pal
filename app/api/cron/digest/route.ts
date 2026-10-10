import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { adminDb, canStore } from "@/lib/serverAuth";
import { pushReady, sendTo } from "@/lib/pushServer";
import { digest, digestText, wibToday } from "@/lib/digest";
import { Prospect, queue, strategyFrom } from "@/lib/prospects";
import type { Deal } from "@/lib/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

function fromCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

const rows = async (path: string) => (await adminDb().collection(path).get()).docs.map(d => ({ id: d.id, ...d.data() }));

// Everything that needs a move today for one user, counted like the dashboard.
async function countFor(uid: string, on: string) {
  const u = `users/${uid}`;
  const [leads, quotes, invoices, rejections, clients, guilds] = await Promise.all(
    ["leads", "quotes", "invoices", "rejections", "clients", "guilds"].map(c => rows(`${u}/${c}`)));
  const deals: Deal[] = [];
  for (const c of clients) deals.push(...((await rows(`${u}/clients/${c.id}/deals`)) as unknown as Deal[]));
  for (const g of guilds) {
    const snap = await adminDb().collection(`guilds/${g.id}/deals`).where("ownerUid", "==", uid).get();
    deals.push(...snap.docs.map(d => ({ id: d.id, ...d.data() }) as Deal));
  }
  const counts = digest(on, { leads, quotes, invoices, rejections, deals } as unknown as Parameters<typeof digest>[1]);
  const open = (await adminDb().collection(`${u}/prospects`).where("closed", "==", false).get()).docs.map(d => ({ id: d.id, ...d.data() }) as Prospect);
  const hunting = (await adminDb().doc(`${u}/settings/hunting`).get()).data() as { strategy?: Parameters<typeof strategyFrom>[0] } | undefined;
  return { ...counts, prospects: queue(open, on, strategyFrom(hunting?.strategy)).length };
}

// Vercel cron (vercel.json), every morning: one push per device of each user
// who has something due. Nothing due, no push.
export async function GET(req: Request) {
  if (!fromCron(req)) return reply({ error: "forbidden" }, 401);
  if (!pushReady() || !canStore()) return reply({ error: "push not configured" }, 503);

  const on = wibToday();
  const subs = (await adminDb().collection("pushSubs").get()).docs.map(d => ({
    id: d.id, uid: String(d.data().uid), sub: { endpoint: d.data().endpoint, keys: d.data().keys } as PushSubscription,
  }));
  const users = Array.from(new Set(subs.map(s => s.uid)));
  let sent = 0;
  for (const uid of users) {
    try {
      const text = digestText(await countFor(uid, on));
      if (!text) continue;
      for (const s of subs.filter(x => x.uid === uid)) {
        if (await sendTo(s.id, s.sub, { title: "Perlu ditindak hari ini", body: text, url: "/dashboard", tag: `digest-${on}` })) sent++;
      }
    } catch (e) {
      console.error("digest failed for a user", (e as Error).message);
    }
  }
  return reply({ users: users.length, sent });
}
