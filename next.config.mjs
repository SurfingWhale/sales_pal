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
};

export default nextConfig;
