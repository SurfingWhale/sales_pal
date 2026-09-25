"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Back from Threads with a code: trade it for a token (server side, where the
// app secret is), keep the token with the owner's settings, then go to Hunting.
export default function ThreadsCallback() {
  const [msg, setMsg] = useState("Menghubungkan Threads…");
  const [bad, setBad] = useState(false);
  // A Threads code works once; never trade it twice (React runs effects twice in dev).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state");
    let expected: string | null = null;
    try { expected = sessionStorage.getItem("threads.state"); } catch { /* private mode */ }
    const fail = (m: string) => { setMsg(m); setBad(true); };

    if (q.get("error")) return fail(`Threads membatalkan: ${q.get("error_description") || q.get("error")}`);
    if (!code) return fail("Tidak ada kode dari Threads. Coba hubungkan lagi dari tab Hunting.");
    if (!state || state !== expected) return fail("Sesi penghubungan tidak cocok. Hubungkan lagi dari tab Hunting di browser ini.");

    const stop = onAuthStateChanged(auth, async (user) => {
      stop();
      if (!user) return fail("Login SalesPal dulu di browser ini, lalu hubungkan Threads lagi dari tab Hunting.");
      try {
        const res = await fetch("/api/threads/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri: `${window.location.origin}/threads/callback` }),
        });
        const body = await res.json();
        if (!res.ok) return fail(body.error || "Gagal menukar kode.");
        await setDoc(doc(db, "users", user.uid, "settings", "threads"), body);
        try { sessionStorage.removeItem("threads.state"); } catch { /* private mode */ }
        setMsg(`Tersambung sebagai @${body.username || "threads"}. Membuka Hunting…`);
        window.location.replace("/dashboard?hunt");
      } catch {
        fail("Koneksi putus. Coba lagi.");
      }
    });
  }, []);

  return (
    <div style={{ background: "var(--app-bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--app-text)" }}>
      <div role="status" style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{bad ? "⚠️" : "📡"}</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{msg}</div>
        {bad && <a href="/dashboard?hunt" style={{ color: "#005eb0", fontWeight: 700, fontSize: 14 }}>← Kembali ke Hunting</a>}
      </div>
    </div>
  );
}
