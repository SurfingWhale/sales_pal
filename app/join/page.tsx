"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { DEFAULT_TITLES, Invite, ROLE_HINT, isMemberOf, joinGuild, logActivity, readInvite } from "@/lib/guild";

// Opened from a guild invite link (/join?g=…&c=…): show which guild and which
// role, then join with one tap. Not signed in → sign in first, then back here.
export default function JoinPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [inv, setInv] = useState<Invite | null | undefined>(undefined);
  const [already, setAlready] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [g, setG] = useState("");
  const [c, setC] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setG(q.get("g") || ""); setC(q.get("c") || "");
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !g || !c) { if (user !== undefined && (!g || !c)) setInv(null); return; }
    (async () => {
      try {
        if (await isMemberOf(g, user.uid)) { setAlready(true); setInv(null); return; }
        setInv(await readInvite(g, c));
      } catch { setInv(null); }
    })();
  }, [user, g, c]);

  async function join() {
    if (!user || !inv) return;
    setBusy(true); setError("");
    try {
      const me = { uid: user.uid, name: user.displayName || (user.email || "").split("@")[0], email: user.email || "" };
      await joinGuild(me, g, inv);
      await logActivity(g, me, "joined", { detail: inv.roleTitle || DEFAULT_TITLES[inv.role] });
      try { localStorage.setItem("sp-guild", g); } catch { /* private mode */ }
      window.location.replace("/dashboard?guild");
    } catch {
      setError("Gagal gabung. Undangannya mungkin udah dicabut atau kedaluwarsa — minta link baru.");
      setBusy(false);
    }
  }

  const expired = inv && inv.expiresAt < Date.now();
  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/join";

  return (
    <div style={{ background: "var(--app-bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--app-text)" }}>
      <div style={{ maxWidth: 400, width: "100%", background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
        {user === undefined || (user && inv === undefined && !already) ? (
          <div role="status" style={{ fontSize: 14, color: "var(--app-muted)" }}>Membuka undangan…</div>
        ) : !user ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Kamu diundang ke guild SalesPal</div>
            <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 20 }}>Login dulu (Google atau email), nanti balik ke sini buat gabung.</div>
            <a href={`/login?next=${encodeURIComponent(here)}`} style={{ display: "inline-block", background: "#005eb0", color: "#fff", borderRadius: 10, padding: "12px 22px", fontWeight: 700, textDecoration: "none" }}>Login buat gabung</a>
          </>
        ) : already ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Kamu udah ada di guild ini</div>
            <a href="/dashboard?guild" onClick={() => { try { localStorage.setItem("sp-guild", g); } catch { /* */ } }} style={{ color: "#005eb0", fontWeight: 700 }}>Buka guild →</a>
          </>
        ) : !inv || expired ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Undangan ga berlaku</div>
            <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 16 }}>Link-nya salah, udah dicabut, atau lewat {expired ? "masa berlakunya" : "7 hari"}. Minta link baru ke Leader atau Officer guild-nya.</div>
            <a href="/dashboard" style={{ color: "#005eb0", fontWeight: 700 }}>Ke SalesPal →</a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--app-muted)" }}>Kamu diundang ke guild</div>
            <div style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 12px" }}>{inv.guildName}</div>
            <div style={{ display: "inline-block", background: "#005eb01a", color: "#005eb0", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>sebagai {inv.roleTitle || DEFAULT_TITLES[inv.role]}</div>
            <div style={{ fontSize: 12.5, color: "var(--app-muted)", marginBottom: 20 }}>{ROLE_HINT[inv.role]}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Login sebagai <b>{user.email}</b></div>
            <div role="alert" style={{ fontSize: 13, color: "#dc2626", marginBottom: error ? 12 : 0 }}>{error}</div>
            <button onClick={join} disabled={busy} style={{ background: "#005eb0", color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}>
              {busy ? "Bergabung…" : "Gabung guild"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
