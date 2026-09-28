"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Lead { id: string; source?: string; status?: string; value?: number; }
interface Hunt { id: string; templateTitle?: string; status?: string; }

const FUNNEL = ["Cold", "Warm", "Hot", "Closed"] as const;
const STATUS_COLOR: Record<string, string> = { Cold: "#64748b", Warm: "#ff9900", Hot: "#ff4444", Closed: "#00a862" };
// A hunt counts as "responded" if the DM got any answer (even a no).
const RESPONDED = new Set(["Dibales", "Tertarik", "Ditolak"]);
const rp = (v: number) => `Rp ${(v / 1000000).toFixed(1)}Jt`;
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export default function Insights({ uid }: { uid: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "users", uid, "leads"), (s) => {
      setLeads(s.docs.map(d => ({ id: d.id, ...d.data() } as Lead))); setReady(true);
    });
    const u2 = onSnapshot(collection(db, "users", uid, "hunts"), (s) => {
      setHunts(s.docs.map(d => ({ id: d.id, ...d.data() } as Hunt)));
    });
    return () => { u1(); u2(); };
  }, [uid]);

  const m = useMemo(() => {
    const val = (l: Lead) => Number(l.value) || 0;
    const total = leads.length;
    const pipeline = leads.reduce((a, l) => a + val(l), 0);
    const closed = leads.filter(l => l.status === "Closed");
    const closedValue = closed.reduce((a, l) => a + val(l), 0);

    const funnel = FUNNEL.map(st => {
      const rows = leads.filter(l => l.status === st);
      return { status: st, count: rows.length, value: rows.reduce((a, l) => a + val(l), 0) };
    });

    // Source ROI — where leads (and money) come from.
    const bySource: Record<string, { count: number; closed: number; value: number; closedValue: number }> = {};
    for (const l of leads) {
      const key = (l.source || "Lainnya").split(" · ").slice(0, 2).join(" · ");
      const e = bySource[key] || { count: 0, closed: 0, value: 0, closedValue: 0 };
      e.count += 1; e.value += val(l);
      if (l.status === "Closed") { e.closed += 1; e.closedValue += val(l); }
      bySource[key] = e;
    }
    const sources = Object.entries(bySource)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.closedValue - a.closedValue || b.count - a.count)
      .slice(0, 8);

    // Pitch performance from Hunting.
    const byPitch: Record<string, { sent: number; responded: number; interested: number }> = {};
    for (const h of hunts) {
      const key = h.templateTitle || "(tanpa template)";
      const e = byPitch[key] || { sent: 0, responded: 0, interested: 0 };
      e.sent += 1;
      if (h.status && RESPONDED.has(h.status)) e.responded += 1;
      if (h.status === "Tertarik") e.interested += 1;
      byPitch[key] = e;
    }
    const pitches = Object.entries(byPitch)
      .map(([key, v]) => ({ key, ...v, resp: pct(v.responded, v.sent), win: pct(v.interested, v.sent) }))
      .sort((a, b) => b.win - a.win || b.sent - a.sent);

    return {
      total, pipeline, closedValue, closedCount: closed.length,
      conv: pct(closed.length, total),
      funnel, sources, pitches,
      huntsSent: hunts.length,
    };
  }, [leads, hunts]);

  const card: React.CSSProperties = { background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: 20 };
  const maxFunnel = Math.max(1, ...m.funnel.map(f => f.count));

  return (
    <div style={{ background: "var(--app-bg)", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--app-text)" }}>
      <div style={{ borderBottom: "1px solid var(--app-border)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--app-nav)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <div style={{ fontSize: 20, fontWeight: 400, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "2px" }}>SALES<span style={{ color: "#005eb0" }}>PAL</span> · INSIGHTS</div>
        <Link href="/dashboard" style={{ fontSize: 12, color: "#005eb0", textDecoration: "none", fontWeight: 700 }}>← Dashboard</Link>
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Insights</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>Evaluasi menyeluruh — funnel, sumber lead, dan performa pitch. Bukan cuma nyatet, tapi ngeliat apa yang works.</div>
        </div>

        {!ready ? (
          <div style={{ ...card, textAlign: "center", color: "var(--app-muted)", fontSize: 13 }}>Memuat data...</div>
        ) : m.total === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada data buat dianalisa</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Mulai berburu atau import lead dulu, nanti angkanya muncul di sini.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Lead", value: String(m.total), sub: `${m.closedCount} closed` },
                { label: "Pipeline", value: rp(m.pipeline), sub: "estimasi total", color: "var(--ok)" },
                { label: "Closed Value", value: rp(m.closedValue), sub: "udah menang", color: "var(--ok)" },
                { label: "Conversion", value: `${m.conv}%`, sub: "lead → closed" },
                { label: "DM Terkirim", value: String(m.huntsSent), sub: "dari Hunting" },
              ].map(s => (
                <div key={s.label} style={card}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color || "var(--app-text)" }}>{s.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "var(--app-muted)", marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Funnel */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Sales Funnel</div>
              {m.funnel.map(f => (
                <div key={f.status} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: STATUS_COLOR[f.status], fontWeight: 700 }}>{f.status}</span>
                    <span style={{ color: "var(--app-muted)" }}>{f.count} lead · {rp(f.value)}</span>
                  </div>
                  <div style={{ background: "var(--app-inner)", borderRadius: 4, height: 8 }}>
                    <div style={{ width: `${pct(f.count, maxFunnel)}%`, height: "100%", background: STATUS_COLOR[f.status], borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Source ROI */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Sumber Lead & Uang</div>
              <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 16 }}>Dari mana lead datang, dan mana yang benar-benar closing.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {m.sources.map(s => (
                  <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingBottom: 10, borderBottom: "1px solid var(--app-inner)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.key}</div>
                      <div style={{ fontSize: 11, color: "var(--app-muted)" }}>{s.count} lead · {s.closed} closed ({pct(s.closed, s.count)}%)</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ok)" }}>{rp(s.closedValue)}</div>
                      <div style={{ fontSize: 10, color: "var(--app-muted)" }}>dari {rp(s.value)} pipeline</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pitch performance */}
            {m.pitches.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Performa Pitch (Hunting)</div>
                <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 16 }}>Pesan mana yang paling sering dibales & bikin tertarik.</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {m.pitches.map(p => (
                    <div key={p.key} style={{ background: "var(--app-inner)", borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.key}</div>
                      <div style={{ display: "flex", gap: 14 }}>
                        <div><div style={{ fontSize: 18, fontWeight: 700, color: p.resp >= 25 ? "#00a862" : p.resp >= 10 ? "#f59e0b" : "#ff4444" }}>{p.resp}%</div><div style={{ fontSize: 10, color: "var(--app-muted)" }}>Response</div></div>
                        <div><div style={{ fontSize: 18, fontWeight: 700, color: "#005eb0" }}>{p.win}%</div><div style={{ fontSize: 10, color: "var(--app-muted)" }}>Tertarik</div></div>
                        <div><div style={{ fontSize: 18, fontWeight: 700 }}>{p.sent}</div><div style={{ fontSize: 10, color: "var(--app-muted)" }}>Kirim</div></div>
                      </div>
                      {p.sent >= 5 && p.resp < 10 && <div style={{ fontSize: 10, color: "#ff8888", marginTop: 8 }}>⚠️ Response rendah — revisi pesan ini.</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
