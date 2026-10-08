import { NextResponse } from "next/server";

// Android's share sheet posts here (manifest share_target). The service worker
// normally answers first and keeps the file; this only runs when it isn't
// installed yet, so say so instead of failing.
export function POST(req: Request) {
  return NextResponse.redirect(new URL("/dashboard?share=gagal", req.url), 303);
}
