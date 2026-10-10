"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";

// Where Android's share sheet lands (manifest.json share_target, PRD-008 §4.4):
// Threads → Share → SalesPal. The link rides on to Hunting, which opens it.
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
