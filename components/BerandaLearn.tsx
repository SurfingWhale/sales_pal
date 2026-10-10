"use client";

import { useState } from "react";
import { useSpaceCollection } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import { Hunt, MIN_SAMPLE, PitchTemplate, pct, scoreTemplates, verdict } from "@/lib/hunting";
import { objections } from "@/lib/salespal-data";
import { detectObjection, repliesFor } from "@/lib/replies";
import type { Prospect } from "@/lib/prospects";
import { STAGES } from "@/lib/templates";

// Beranda, Belajar (docs/prd/PRD-008 §6): what your own numbers teach — the
// message that gets answered, the no you hear most and how to answer it next
// time — and where to practise.

const card: React.CSSProperties = { background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 20 };

// A "no" written down anywhere — a declined journey, a DM marked Ditolak, the
// Rejection Log — counted by the objection it sounds like.
function objectionsFrom(prospects: Prospect[], hunts: Hunt[], rejections: { reason?: string }[]) {
  const label = new Map(objections.map(o => [o.label.toLowerCase(), o.id]));
  const said = [
    ...prospects.filter(p => p.result === "tolak").map(p => p.remark || ""),
    ...hunts.filter(h => h.status === "Ditolak" && !h.prospectId).map(h => h.note || ""),
    ...rejections.map(r => r.reason || ""),
  ].filter(s => s.trim());
  const counts = new Map<string, number>();
  for (const s of said) {
    const id = label.get(s.trim().toLowerCase()) || detectObjection(s);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return { total: said.length, top: Array.from(counts, ([id, n]) => ({ o: objections.find(x => x.id === id)!, n })).filter(x => x.o).sort((a, b) => b.n - a.n) };
}

export default function BerandaLearn({ prospects, hunts, rejections, onGo }: {
  prospects: Prospect[]; hunts: Hunt[]; rejections: { reason?: string }[]; onGo: (tab: string) => void;
}) {
  const space = useSpace();
  const templates = useSpaceCollection<PitchTemplate>(space, "pitchTemplates");
  const [copied, setCopied] = useState<string | null>(null);
  const scores = scoreTemplates(hunts, templates).filter(s => s.templateId !== "_none");
  const ready = scores.filter(s => s.sent >= MIN_SAMPLE).sort((a, b) => b.responseRate - a.responseRate);
  const best = ready[0] || scores.slice().sort((a, b) => b.sent - a.sent)[0];
  const advice = verdict(scores);
  const no = objectionsFrom(prospects, hunts, rejections);
  const first = no.top[0];
  const scripts = first ? repliesFor(first.o.id, "santai").slice(0, 2) : [];

  function copy(key: string, text: string) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => {
      setCopied(key); setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
    }, () => setCopied(null));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1 className="sp-b-h1">
        {hunts.length || no.total
          ? `Belajar dari ${hunts.length} DM dan ${no.total} penolakan.`
          : "Kirim beberapa DM dulu, nanti di sini keliatan apa yang works."}
      </h1>

      <div style={{ marginTop: "clamp(20px, 4vw, 40px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <section aria-labelledby="learn-best-h" style={card}>
          <h2 id="learn-best-h" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Pesan yang paling dibales</h2>
          {best ? (
            <>
              <p style={{ margin: "12px 0 0", fontSize: 20, fontWeight: 600 }}>{best.title}</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--app-muted)" }}>
                {best.sent} terkirim · dibales {pct(best.responseRate)} · tertarik {pct(best.winRate)}
                {best.sent < MIN_SAMPLE ? ` · sampel kecil, butuh ${MIN_SAMPLE} DM biar bisa dipercaya` : ""}
              </p>
              {advice && <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5 }}>{advice}</p>}
            </>
          ) : <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Belum ada DM yang kecatat.</p>}
          <button onClick={() => onGo("Hunting")} style={{ marginTop: 14, padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Lihat semua template →</button>
        </section>

        <section aria-labelledby="learn-no-h" style={card}>
          <h2 id="learn-no-h" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Keberatan paling sering</h2>
          {no.top.length === 0 ? (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Belum ada alasan nolak yang kecatat. Isi alasannya tiap ada yang nolak, nanti polanya keliatan di sini.</p>
          ) : (
            <>
              {no.top.slice(0, 3).map(x => (
                <div key={x.o.id} style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{x.o.icon} {x.o.label}</span><span className="tabnum" style={{ fontWeight: 600 }}>{x.n}</span>
                  </div>
                  <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: "var(--app-inner)", overflow: "hidden" }}>
                    <div style={{ width: `${(x.n / first.n) * 100}%`, height: "100%", background: "#a78bfa" }} />
                  </div>
                </div>
              ))}
              <p style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 600 }}>Cara jawab &quot;{first.o.label}&quot;:</p>
              {scripts.map(r => (
                <div key={r.key} style={{ padding: "10px 0", borderTop: "1px solid var(--app-border)" }}>
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>{r.text.replace(/\{nama\}/gi, "kak")}</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>{r.hint}</div>
                  <button onClick={() => copy(r.key, r.text.replace(/\{nama\}/gi, "kak"))} style={{ marginTop: 6, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--app-border)", background: "transparent", color: copied === r.key ? "var(--ok)" : "var(--app-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{copied === r.key ? "✓ Tersalin" : "Copy"}</button>
                </div>
              ))}
              <button onClick={() => onGo("Script Library")} style={{ marginTop: 8, padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Buka Script Library →</button>
            </>
          )}
        </section>

        <section aria-labelledby="learn-practice-h" style={card}>
          <h2 id="learn-practice-h" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Latihan</h2>
          <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.55 }}>
            {first ? <>Latih jawab <b>{first.o.label}</b> sebelum ketemu lagi: pilih tipe customer, coba balas, lihat skornya.</> : "Coba jawab keberatan umum di Simulator sebelum ketemu customer beneran."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button onClick={() => onGo("Simulator")} className="sp-pill" style={{ border: 0, background: "#005eb0", color: "#fff" }}>Buka Simulator</button>
            <button onClick={() => onGo("AI Playbook")} className="sp-pill" style={{ border: "1px solid var(--app-line-strong)", background: "transparent", color: "var(--app-text)" }}>AI Playbook</button>
          </div>
        </section>
      </div>

      <section aria-labelledby="learn-stages-h" style={{ marginTop: "clamp(24px, 4vw, 40px)" }}>
        <h2 id="learn-stages-h" style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600 }}>Pesan yang pas per tahap</h2>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {STAGES.map((s, i) => (
            <li key={s.id} style={{ ...card, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}><span style={{ color: "var(--app-muted)" }}>{i + 1} ·</span> {s.label}</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{s.when}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>{s.tip}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
