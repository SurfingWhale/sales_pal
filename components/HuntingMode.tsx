"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Template { id: string; title: string; body: string; }
type HuntStatus = "sent" | "replied" | "interested" | "rejected" | "ghosted";
interface Hunt {
  id: string;
  target: string;
  platform: string;
  templateId: string;
  templateTitle: string;
  status: HuntStatus;
  note?: string;
  converted?: boolean;
  createdAt: number;
}

const PLATFORMS = ["Threads", "Instagram", "WhatsApp", "Lainnya"];

const STATUS_META: Record<HuntStatus, { label: string; color: string; responded: boolean; won: boolean }> = {
  sent:       { label: "📤 Terkirim", color: "#64748b", responded: false, won: false },
  replied:    { label: "💬 Dibales",  color: "#f59e0b", responded: true,  won: false },
  interested: { label: "✅ Tertarik", color: "#00a862", responded: true,  won: true  },
  rejected:   { label: "❌ Ditolak",  color: "#ff4444", responded: true,  won: false },
  ghosted:    { label: "👻 Ghosting", color: "#8b949e", responded: false, won: false },
};
const OUTCOMES: HuntStatus[] = ["replied", "interested", "rejected", "ghosted"];

export default function HuntingMode({ uid }: { uid: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [target, setTarget] = useState("");
  const [platform, setPlatform] = useState("Threads");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "users", uid, "pitchTemplates"), (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
    });
    const u2 = onSnapshot(collection(db, "users", uid, "hunts"), (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Hunt));
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setHunts(rows);
    });
    return () => { u1(); u2(); };
  }, [uid]);

  function render(body: string) {
    return body.replace(/\{nama\}/gi, target.trim() || "kak");
  }

  async function logHunt(t: Template) {
    const id = `hunt_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "hunts", id), {
      target: target.trim() || "(tanpa nama)",
      platform,
      templateId: t.id,
      templateTitle: t.title,
      status: "sent" as HuntStatus,
      createdAt: Date.now(),
    });
  }

  async function sendWA(t: Template) {
    window.open("https://wa.me/?text=" + encodeURIComponent(render(t.body)), "_blank");
    await logHunt(t);
  }
  async function copyAndLog(t: Template) {
    navigator.clipboard.writeText(render(t.body));
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
    await logHunt(t);
  }
  async function setStatus(h: Hunt, status: HuntStatus) {
    await updateDoc(doc(db, "users", uid, "hunts", h.id), { status });
  }
  async function removeHunt(id: string) {
    await deleteDoc(doc(db, "users", uid, "hunts", id));
  }
  async function makeLead(h: Hunt) {
    await setDoc(doc(db, "users", uid, "leads", `hunt_${h.id}`), {
      name: h.target,
      contact: h.target,
      source: `Hunting · ${h.platform}`,
      status: "Warm",
      score: 70,
      email: "",
      phone: "",
      category: "Other",
      notes: `Dari hunting (${h.templateTitle})${h.note ? ` · ${h.note}` : ""}`,
      lastContact: new Date().toISOString().split("T")[0],
      value: 0,
    });
    await updateDoc(doc(db, "users", uid, "hunts", h.id), { converted: true });
  }

  // Per-template evaluation
  const evals = useMemo(() => {
    const byTpl: Record<string, { title: string; total: number; responded: number; won: number }> = {};
    for (const h of hunts) {
      const e = byTpl[h.templateId] || { title: h.templateTitle, total: 0, responded: 0, won: 0 };
      e.total += 1;
      if (STATUS_META[h.status]?.responded) e.responded += 1;
      if (STATUS_META[h.status]?.won) e.won += 1;
      byTpl[h.templateId] = e;
    }
    return Object.values(byTpl).sort((a, b) => b.total - a.total);
  }, [hunts]);

  const today = new Date().toISOString().split("T")[0];
  const sentToday = hunts.filter(h => new Date(h.createdAt).toISOString().split("T")[0] === today).length;

  const chip: React.CSSProperties = { border: "1px solid var(--app-border)", background: "transparent", color: "var(--app-muted)", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Hunting Mode</div>
        <div style={{ color: "var(--app-muted)", fontSize: 12, marginTop: 4 }}>Berburu klien lewat Threads/IG/WA — kirim, catat 1-tap, evaluasi pesan mana yang works. {sentToday} kiriman hari ini.</div>
      </div>

      {/* Target + platform */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="🎯 Nama target (buat {nama})"
          style={{ flex: 1, minWidth: 180, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 8, color: "var(--app-text)", padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
        <div style={{ display: "flex", gap: 4, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 8, overflow: "hidden" }}>
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              style={{ background: platform === p ? "var(--app-inner)" : "transparent", border: "none", color: platform === p ? "#005eb0" : "var(--app-muted)", padding: "8px 12px", fontSize: 12, fontWeight: platform === p ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Template deck */}
      {templates.length === 0 ? (
        <div style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: "32px 20px", textAlign: "center", marginBottom: 28, fontSize: 12, color: "var(--app-muted)" }}>
          Belum ada template. Buka tombol 💬 (Quick Pitch) buat bikin template dulu.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 28 }}>
          {templates.map(t => (
            <div key={t.id} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t.title}</div>
              <div style={{ fontSize: 11, color: "var(--app-sub)", lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{render(t.body)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => copyAndLog(t)} style={{ ...chip, flex: 1, color: copiedId === t.id ? "var(--ok)" : "var(--app-text)", borderColor: copiedId === t.id ? "var(--ok)" : "var(--app-border)", padding: "8px" }}>{copiedId === t.id ? "✓ Tersalin" : "Copy"}</button>
                <button onClick={() => sendWA(t)} style={{ flex: 1, background: "#25D366", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Kirim WA</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evaluation */}
      {evals.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12 }}>📊 Evaluasi Pesan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {evals.map((e, i) => {
              const resp = e.total ? Math.round((e.responded / e.total) * 100) : 0;
              const win = e.total ? Math.round((e.won / e.total) * 100) : 0;
              return (
                <div key={i} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: resp >= 25 ? "#00a862" : resp >= 10 ? "#f59e0b" : "#ff4444" }}>{resp}%</div><div style={{ fontSize: 10, color: "var(--app-muted)" }}>Response</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: "#005eb0" }}>{win}%</div><div style={{ fontSize: 10, color: "var(--app-muted)" }}>Tertarik</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700 }}>{e.total}</div><div style={{ fontSize: 10, color: "var(--app-muted)" }}>Kirim</div></div>
                  </div>
                  {resp < 10 && e.total >= 5 && <div style={{ fontSize: 11, color: "#ff8888", marginTop: 8 }}>⚠️ Response rendah — pertimbangin revisi pesan ini.</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hunt log */}
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12 }}>Riwayat Berburu</div>
      {hunts.length === 0 ? (
        <div style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: "40px 20px", textAlign: "center", fontSize: 12, color: "var(--app-muted)" }}>
          Belum ada. Pilih target + template di atas, tap <b>Kirim WA</b> — otomatis kecatat di sini.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hunts.slice(0, 40).map(h => {
            const m = STATUS_META[h.status];
            return (
              <div key={h.id} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.target}</div>
                    <div style={{ fontSize: 11, color: "var(--app-muted)" }}>{h.platform} · {h.templateTitle}</div>
                  </div>
                  <span className="badge" style={{ background: `${m.color}1a`, color: m.color, border: `1px solid ${m.color}40`, flexShrink: 0 }}>{m.label}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {OUTCOMES.map(s => (
                    <button key={s} onClick={() => setStatus(h, s)} style={{ ...chip, borderColor: h.status === s ? STATUS_META[s].color : "var(--app-border)", color: h.status === s ? STATUS_META[s].color : "var(--app-muted)" }}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                  {h.status === "interested" && !h.converted && (
                    <button onClick={() => makeLead(h)} style={{ background: "#005eb0", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Jadiin Lead</button>
                  )}
                  {h.converted && <span style={{ fontSize: 11, color: "var(--ok)" }}>✓ Jadi lead</span>}
                  <button onClick={() => removeHunt(h.id)} aria-label="Hapus" style={{ ...chip, marginLeft: "auto", borderColor: "#ff444440", color: "#ff4444" }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
