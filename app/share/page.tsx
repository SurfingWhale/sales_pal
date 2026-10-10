"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";

// A plain GET door to Hunting for a shared link (bookmarklets, the flow tests,
// PRD-009 §4.4). Android's share sheet posts to /share-target instead, where
// the service worker sends a link to the same place.
export default function SharePage() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const all = [q.get("url"), q.get("text"), q.get("title")].filter(Boolean).join(" ");
    const link = all.match(/https?:\/\/[^\s]+/)?.[0] || all.trim();
    window.location.replace(link ? `/dashboard?hunt&url=${encodeURIComponent(link)}` : "/dashboard?hunt");
  }, []);
  return (
    <div role="status" style={{ background: "var(--app-bg, #f0f2f5)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--app-muted, #57606a)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Membuka Hunting…
    </div>
  );
}
