import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the version of the currently deployed build. Because this runs on the
// server (always the latest deploy) while the client has its version baked in at
// build time, a mismatch means the user is running an older cached build.
export function GET() {
  const version =
    (process.env.VERCEL_GIT_COMMIT_SHA && process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)) ||
    process.env.APP_VERSION ||
    "dev";
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
