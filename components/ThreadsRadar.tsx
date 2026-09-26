"use client";

import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { today, useUserCollection } from "@/lib/billing";
import type { Hunt } from "@/lib/hunting";
import { RadarItem, RadarPerson, THREADS_SCOPES, ThreadsConnection, groupRadar, needsRefresh, profileUrl } from "@/lib/threads";
import { card, chip, font } from "@/components/ui";

const APP_ID = process.env.NEXT_PUBLIC_THREADS_APP_ID || "";

interface Seen { id: string; at: string } // username → newest timestamp already handled

function ago(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "hari ini" : d === 1 ? "kemarin" : `${d} hari lalu`;
}

export default function ThreadsRadar({ uid, hunts, onTarget }: { uid: string; hunts: Hunt[]; onTarget: (username: string) => void }) {
  const [conn, setConn] = useState<ThreadsConnection | null | undefined>(undefined);
  const [people, setPeople] = useState<RadarPerson[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showDone, setShowDone] = useState(false);
  const seen = useUserCollection<Seen>(uid, "radarSeen");
  const ref = doc(db, "users", uid, "settings", "threads");

  useEffect(() => onSnapshot(doc(db, "users", uid, "settings", "threads"), snap => {
    setConn(snap.exists() ? (snap.data() as ThreadsConnection) : null);
  }), [uid]);

  // Keep the token alive: another 60 days whenever it is under 30 days from running out.
  useEffect(() => {
    if (!conn || !needsRefresh(conn)) return;
    fetch("/api/threads/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: conn.token }) })
      .then(r => r.ok ? r.json() : null)
      .then(r => r && setDoc(ref, r, { merge: true }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.token]);

  function connect() {
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem("threads.state", state); } catch { /* private mode */ }
    const q = new URLSearchParams({
      client_id: APP_ID, redirect_uri: `${window.location.origin}/threads/callback`,
      scope: THREADS_SCOPES.join(","), response_type: "code", state,
    });
    window.location.href = `https://threads.com/oauth/authorize?${q}`;
  }

  async function scan() {
    if (!conn) return;
    setLoading(true); setError(""); setWarnings([]);
    try {
      const res = await fetch("/api/threads/radar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: conn.token }) });
      const body = await res.json();
      if (!res.ok) {
        setError(body.expired ? "Sambungan Threads kedaluwarsa. Hubungkan lagi." : body.error || "Radar gagal.");
        return;
      }
      setPeople(groupRadar(body.items as RadarItem[], conn.username));
      setWarnings(body.warnings || []);
    } catch {
      setError("Koneksi putus. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function markDone(p: RadarPerson) {
    await setDoc(doc(db, "users", uid, "radarSeen", p.username.toLowerCase()), { at: p.latest.timestamp });
  }

  async function makeLead(p: RadarPerson) {
    const id = `thr_${p.username.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
    const where = p.latest.kind === "mention" ? "Mention" : `Balas di post "${p.latest.postText.slice(0, 60)}"`;
    await setDoc(doc(db, "users", uid, "leads", id), {
      name: `@${p.username}`, contact: "", source: "Threads", status: "Warm", score: 65,
      email: "", phone: "", category: "F&B", notes: `${where}: "${p.latest.text.slice(0, 200)}" · ${profileUrl(p.username)}`,
      lastContact: today(), value: 0,
    }, { merge: true });
    await markDone(p);
  }

  async function disconnect() {
    if (!confirm("Putuskan Threads dari SalesPal?")) return;
    await deleteDoc(ref);
    setPeople(null);
  }

  // Not set up yet (docs/prd/PRD-003-threads-radar.md): say what is coming,
  // and what to do meanwhile.
  if (!APP_ID) {
    return (
      <div style={{ ...card, padding: 16, marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>📡</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>Radar Threads</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#005eb014", color: "#005eb0", border: "1px solid #005eb040" }}>Segera hadir</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4, lineHeight: 1.5 }}>
            Daftar orang yang balas atau mention post Threads lo, sekali tap jadi target DM. Sementara: buka Aktivitas di Threads, Copy link profilnya, lalu 📋 Tempel link di bawah.
          </div>
        </div>
      </div>
    );
  }
  if (conn === undefined) return null;

  const dmd = new Set(hunts.map(h => h.target.replace(/^@/, "").toLowerCase()));
  const seenAt = new Map(seen.map(s => [s.id, s.at]));
  const fresh = (people || []).filter(p => !((seenAt.get(p.username.toLowerCase()) || "") >= p.latest.timestamp));
  const shown = showDone ? people || [] : fresh;

  return (
    <div style={{ ...card, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>📡 Radar Threads</div>
        {conn && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={scan} disabled={loading} style={{ ...chip, minHeight: 36, fontWeight: 700, background: "#005eb0", color: "#fff", border: "1px solid #005eb0", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Memindai…" : people ? "↻ Pindai lagi" : "Pindai"}
            </button>
            <button onClick={disconnect} aria-label="Putuskan Threads" style={{ ...chip, minHeight: 36 }}>⋯</button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 12 }}>
        Orang yang balas atau mention post Threads lo. Mereka udah lihat karya lo: DM paling hangat.
      </div>

      {!conn && (
        <button onClick={connect} style={{ ...chip, width: "100%", minHeight: 44, fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>
          Hubungkan akun Threads
        </button>
      )}
      {conn && !people && !loading && !error && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Tersambung sebagai @{conn.username}. Tap Pindai untuk lihat siapa yang nimbrung.</div>}
      {error && <div role="status" style={{ fontSize: 12, color: "#ff4444", marginBottom: 8 }}>{error} {/kedaluwarsa/.test(error) && <button onClick={connect} style={{ ...chip, marginLeft: 6 }}>Hubungkan</button>}</div>}
      {warnings.length > 0 && <div style={{ fontSize: 11, color: "#ff9900", marginBottom: 8 }}>{warnings[0]}{warnings.length > 1 ? ` (+${warnings.length - 1})` : ""}</div>}

      {people && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--app-muted)", marginBottom: 6 }}>
            <span>{fresh.length} baru · {people.length} orang dari 15 post terakhir</span>
            {people.length > fresh.length && <button onClick={() => setShowDone(!showDone)} style={chip}>{showDone ? "Sembunyikan yang beres" : "Tampilkan semua"}</button>}
          </div>
          {shown.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "8px 0" }}>Semua udah ditangani. Posting lagi, lalu pindai 👀</div>}
          {shown.map(p => (
            <div key={p.username} style={{ padding: "12px 0", borderTop: "1px solid var(--app-inner)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  @{p.username}
                  {dmd.has(p.username.toLowerCase()) && <span style={{ fontSize: 10, color: "var(--ok)", marginLeft: 6 }}>✓ udah di-DM</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--app-muted)", flexShrink: 0 }}>{p.latest.kind === "mention" ? "mention" : "balas"} · {ago(p.latest.timestamp)}{p.count > 1 ? ` · ${p.count}×` : ""}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 4, lineHeight: 1.5 }}>“{p.latest.text || "(tanpa teks)"}”</div>
              {p.latest.postText && <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>di post: {p.latest.postText}</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <button onClick={() => onTarget(p.username)} style={{ ...chip, minHeight: 36, fontWeight: 700, background: "#005eb0", color: "#fff", border: "1px solid #005eb0" }}>DM dia →</button>
                <a href={p.latest.permalink || profileUrl(p.username)} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>Lihat ↗</a>
                <button onClick={() => makeLead(p)} style={{ ...chip, minHeight: 36 }}>Jadiin Lead</button>
                <button onClick={() => markDone(p)} style={{ ...chip, minHeight: 36 }}>✓ Beres</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
