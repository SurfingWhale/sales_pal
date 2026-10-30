import { NextResponse } from "next/server";
import { deny, requireUser, takeQuota } from "@/lib/serverAuth";
import { publicSite, readSite } from "@/lib/siteRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// A website or Instagram link pasted into Tambah lead (PRD-018 §2): its name,
// description, public email and phone, read from the page itself like a link
// preview. Free (no Google); a daily cap per user keeps it from being a proxy.

const DAILY = 60;

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  let url = "";
  try { url = String((await req.json())?.url || "").trim().slice(0, 500); } catch { /* handled below */ }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!publicSite(url)) return deny("Bukan alamat website.", 400);

  const quota = await takeQuota(caller.uid, "site", DAILY);
  if (!quota.ok) return deny(`Batas baca website hari ini (${DAILY}) udah habis. Isi manual dulu.`, 429);

  const site = await readSite(url);
  if (!site) return deny("Website-nya ga kebuka. Isi manual aja.", 422);
  return NextResponse.json(site, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
