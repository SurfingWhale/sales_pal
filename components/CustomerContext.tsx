"use client";

import { useState } from "react";
import { longDate } from "@/lib/billing";
import { archetypes } from "@/lib/salespal-data";
import { guessArchetype } from "@/lib/profile";
import { KIND_HINT, KIND_LABEL, PostContext } from "@/lib/postContext";
import { Prospect, Strategy, View, statusColor, statusLabel } from "@/lib/prospects";
import { STAGES, Stage } from "@/lib/templates";
import { resolveWhen } from "@/lib/when";
import JobCalendar, { Job } from "@/components/JobCalendar";
import { badge, btnMuted, btnPrimary, chip, inputStyle, label } from "@/components/ui";

// Who this is and what they need, before you pick a message (docs/prd/PRD-009
// §13): their post, what it says they need, when and where, whether price
// matters, what kind of post it is, and how they seem to like being talked to.

type Draft = { need: string; when: string; date: string; where: string; budget: string };

export default function CustomerContext({ p, v, strategy, stage, now, jobs, onSave }: {
  p: Prospect; v: View; strategy: Strategy; stage: Stage; now: string; jobs: Job[];
  onSave: (c: PostContext) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copied, setCopied] = useState(false);
  const post = [...(p.history || [])].reverse().find(e => e.kind === "post");
  const c = p.context || {};
  const type = post?.text ? archetypes.find(a => a.id === guessArchetype(post.text || "")) : undefined;
  const sent = (p.history || []).filter(e => e.kind === "sent").length;
  const st = STAGES.find(s => s.id === stage)!;
  const date = c.date || resolveWhen(c.when, now) || resolveWhen(post?.text, now);
  const copyId = () => navigator.clipboard?.writeText(p.id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => undefined);
  const rows: [string, string | undefined][] = [
    ["Butuh", c.need], ["Kapan", c.when], ["Di mana", c.where], ["Budget", c.budget], ["Bisnis", c.business],
  ];

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!draft) return;
    setSaving(true); setError("");
    try {
      await onSave({ ...c, need: draft.need.trim(), when: draft.when.trim(), date: draft.date, where: draft.where.trim(), budget: draft.budget.trim(), edited: true });
      setDraft(null);
    } catch {
      setError("Gagal nyimpen konteks. Cek koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-label={`Prospek ${p.handle}`} style={{ padding: 14, borderRadius: 12, background: "var(--app-inner)", border: "1px solid var(--app-border)", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name ? `${p.name} (${p.handle})` : p.handle}</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>
            {p.segment} · {v.status === "intro" || v.status === "belum" ? `percobaan ${p.attempts}/${strategy.maxAttempts}` : `masuk ${longDate(p.firstSeenAt)}`}
            {sent ? ` · ${sent} pesan terkirim` : ""}
          </div>
          <button onClick={copyId} aria-label={`Salin ID prospek ${p.id}`} title="ID prospek: cari pakai ini di Journey prospek"
            style={{ ...chip, minHeight: 32, maxWidth: "100%", padding: "4px 10px", marginTop: 6, fontSize: 12, textAlign: "left", overflowWrap: "anywhere", color: copied ? "var(--ok)" : "var(--app-sub)" }}>
            {copied ? "✓ ID tersalin" : <>✓ Tersimpan · ID <span style={{ fontFamily: "ui-monospace, monospace" }}>{p.id}</span></>}
          </button>
        </div>
        <span style={badge(statusColor(p, v))}>{statusLabel(p, v)}</span>
      </div>

      {post?.text && <div style={{ fontSize: 12.5, color: "var(--app-sub)", lineHeight: 1.5, marginTop: 10, whiteSpace: "pre-wrap" }}>“{post.text}”</div>}
      {post?.url && <a href={post.url} target="_blank" rel="noreferrer" className="sp-tap" style={{ display: "inline-flex", alignItems: "center", padding: "6px 0", fontSize: 12, color: "var(--brand-text)", marginTop: 2 }}>Buka post ↗</a>}

      {!draft ? (
        <>
          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", margin: "12px 0 0", fontSize: 12 }}>
            {rows.map(([k, val]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt style={{ color: "var(--app-muted)" }}>{k}</dt>
                <dd style={{ margin: 0, color: val ? "var(--app-text)" : "var(--app-muted)", fontWeight: val ? 600 : 400 }}>{val || "—"}</dd>
              </div>
            ))}
            {type && (
              <div style={{ display: "contents" }}>
                <dt style={{ color: "var(--app-muted)" }}>Gaya</dt>
                <dd style={{ margin: 0 }}>{type.animal} {type.name} (tebakan) · {type.comStyle}</dd>
              </div>
            )}
          </dl>
          {date && <JobCalendar date={date} jobs={jobs} today={now} />}
          {c.kind && <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 10 }}><b>{KIND_LABEL[c.kind]}.</b> {KIND_HINT[c.kind]}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Saran tahap: <b style={{ color: "var(--app-text)" }}>{st.label}</b> — {st.when.toLowerCase()}</span>
            <button onClick={() => setDraft({ need: c.need || "", when: c.when || "", date: date || "", where: c.where || "", budget: c.budget || "" })} style={{ ...chip, minHeight: 34 }}>✎ Ubah konteks</button>
          </div>
          {!c.need && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>Kebutuhannya belum kebaca. Isi biar <code>{"{kebutuhan}"}</code> di pesan kepakai.</div>}
          {v.status === "tidak" && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>Udah {strategy.maxAttempts}× tanpa jawaban, diparkir sampai {longDate(v.parkedUntil || now)}. Kirim lagi tetap bisa.</div>}
        </>
      ) : (
        <div style={{ marginTop: 12 }} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setDraft(null); } }}>
          {([["need", "Butuh apa", "mis. foto katalog F&B"], ["when", "Kapan", "mis. besok jam 1-5 sore"], ["where", "Di mana", "mis. Sentul"], ["budget", "Budget / catatan harga", "mis. ramah UMKM"]] as [keyof Draft, string, string][]).map(([k, l, ph]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <label htmlFor={`ctx-${k}`} style={label}>{l}</label>
              <input id={`ctx-${k}`} value={draft[k]} placeholder={ph} onChange={e => setDraft({ ...draft, [k]: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
            </div>
          ))}
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="ctx-date" style={label}>Tanggal acara (buat cek jadwal)</label>
            <input id="ctx-date" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44, maxWidth: 240 }} />
          </div>
          {error && <div role="alert" style={{ fontSize: 12, color: "var(--hot)", marginTop: 4 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={() => setDraft(null)} style={{ ...btnMuted, minHeight: 44, padding: "8px 16px" }}>Batal</button>
            <button onClick={save} disabled={saving} style={{ ...btnPrimary, minHeight: 44, padding: "8px 16px", opacity: saving ? 0.7 : 1 }}>{saving ? "Menyimpan…" : "Simpan konteks"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
