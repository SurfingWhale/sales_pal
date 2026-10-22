"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import SalesTracker from "@/components/SalesTracker";
import { authFetch } from "@/lib/authFetch";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.replace("/login");
    });
    return unsub;
  }, [router]);

  // Invite-only for now (PRD-015): the server says whether this account may
  // come in. If it can't be asked, let them in: every paid route checks again.
  const [entry, setEntry] = useState<"checking" | "in" | "closed">("checking");
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!user) return;
    let live = true;
    setEntry("checking");
    authFetch("/api/access").then(r => (r.ok ? r.json() : null)).then(j => { if (live) setEntry(j && j.app === false ? "closed" : "in"); }, () => { if (live) setEntry("in"); });
    return () => { live = false; };
  }, [user, tries]);

  if (user && entry === "closed") {
    return (
      <main style={{ background: "var(--app-bg, #f0f2f5)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--app-text)" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 24 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>SalesPal masih tertutup</h1>
          <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55, color: "var(--app-muted)" }}>
            Lagi uji coba terbatas, cuma buat tim yang diundang. Akun <b style={{ color: "var(--app-text)" }}>{user.email || "ini"}</b> belum ada di tim mana pun.
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.55, color: "var(--app-muted)" }}>
            Punya link undangan? Buka lagi link-nya, lalu tap <b style={{ color: "var(--app-text)" }}>Gabung guild</b>.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setTries(tries + 1)} style={{ minHeight: 44, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--app-border)", background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Cek lagi</button>
            <button onClick={() => signOut(auth)} style={{ minHeight: 44, padding: "10px 16px", borderRadius: 10, border: 0, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Keluar</button>
          </div>
        </div>
      </main>
    );
  }

  if (user === undefined || (user && entry === "checking")) {
    return (
      <div style={{ background: "var(--app-bg, #f0f2f5)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: "3px solid var(--app-border, #d0d7de)", borderTopColor: "#005eb0", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 12, color: "var(--app-muted, #57606a)", }}>Memuat…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return <SalesTracker user={user} />;
}
