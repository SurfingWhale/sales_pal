/** @type {import('next').NextConfig} */
// Version stamp baked into the client at build time. On Vercel this is the git
// commit SHA (unique per deploy); locally it falls back to "dev". The /api/version
// route reads the same source at runtime so the client can detect a newer deploy.
const APP_VERSION =
  (process.env.VERCEL_GIT_COMMIT_SHA && process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)) ||
  process.env.APP_VERSION ||
  "dev";

const nextConfig = {
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  // Firebase's sign-in handler, served from this origin. An installed iPhone
  // app keeps its storage apart from firebaseapp.com, so a Google redirect that
  // finishes there never reaches the app. With the handler on our own host the
  // result lands where the app can read it. Takes effect once
  // NEXT_PUBLIC_AUTH_HOST names this host (see lib/firebase.ts).
  async rewrites() {
    return [
      { source: "/__/auth/:path*", destination: "https://sales-pal.firebaseapp.com/__/auth/:path*" },
      { source: "/__/firebase/:path*", destination: "https://sales-pal.firebaseapp.com/__/firebase/:path*" },
    ];
  },
};

export default nextConfig;
