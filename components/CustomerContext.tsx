"use client";

import { useState } from "react";
import { longDate } from "@/lib/billing";
import { archetypes } from "@/lib/salespal-data";
import { guessArchetype } from "@/lib/profile";
import { KIND_HINT, KIND_LABEL, PostContext } from "@/lib/postContext";
import { Prospect, Strategy, View, statusColor, statusLabel } from "@/lib/prospects";
import { STAGES, Stage } from "@/lib/templates";
import { badge, btnMuted, btnPrimary, chip, inputStyle, label } from "@/components/ui";

// Who this is and what they need, before you pick a message (docs/prd/PRD-009
// §13): their post, what it says they need, when and where, whether price
// matters, what kind of post it is, and how they seem to like being talked to.

type Draft = { need: string; when: string; where: string; budget: string };

export default function CustomerContext({ p, v, strategy, stage, now, onSave }: {
  p: Prospect; v: View; strategy: Strategy; stage: Stage; now: string;
  onSave: (c: PostContext) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const post = [...(p.history || [])].reverse().find(e => e.kind === "post");
  const c = p.context || {};
  const type = post?.text ? archetypes.find(a => a.id === guessArchetype(post.text || "")) : undefined;
  const sent = (p.history || []).filter(e => e.kind === "sent").length;
  const st = STAGES.find(s => s.id === stage)!;
  const rows: [string, string | undefined][] = [
    ["Butuh", c.need], ["Kapan", c.when], ["Di mana", c.where], ["Budget", c.budget], ["Bisnis", c.business],
  ];

  async function save() {
    if (!draft) return;
    await onSave({ ...c, need: draft.need.trim(), when: draft.when.trim(), where: draft.where.trim(), budget: draft.budget.trim(), edited: true });
    setDraft(null);
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
        </div>
        <span style={badge(statusColor(p, v))}>{statusLabel(p, v)}</span>
      </div>

      {post?.text && <div style={{ fontSize: 12.5, color: "var(--app-sub)", lineHeight: 1.5, marginTop: 10, whiteSpace: "pre-wrap" }}>“{post.text}”</div>}
      {post?.url && <a href={post.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 12, color: "var(--brand-text)", marginTop: 6 }}>Buka post ↗</a>}

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
          {c.kind && <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 10 }}><b>{KIND_LABEL[c.kind]}.</b> {KIND_HINT[c.kind]}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Saran tahap: <b style={{ color: "var(--app-text)" }}>{st.label}</b> — {st.when.toLowerCase()}</span>
            <button onClick={() => setDraft({ need: c.need || "", when: c.when || "", where: c.where || "", budget: c.budget || "" })} style={{ ...chip, minHeight: 34 }}>✎ Ubah konteks</button>
          </div>
          {!c.need && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>Kebutuhannya belum kebaca. Isi biar <code>{"{kebutuhan}"}</code> di pesan kepakai.</div>}
          {v.status === "tidak" && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>Udah {strategy.maxAttempts}× tanpa jawaban, diparkir sampai {longDate(v.parkedUntil || now)}. Kirim lagi tetap bisa.</div>}
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          {([["need", "Butuh apa", "mis. foto katalog F&B"], ["when", "Kapan", "mis. besok jam 1-5 sore"], ["where", "Di mana", "mis. Sentul"], ["budget", "Budget / catatan harga", "mis. ramah UMKM"]] as [keyof Draft, string, string][]).map(([k, l, ph]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <label htmlFor={`ctx-${k}`} style={label}>{l}</label>
              <input id={`ctx-${k}`} value={draft[k]} placeholder={ph} onChange={e => setDraft({ ...draft, [k]: e.target.value })} style={{ ...inputStyle, fontSize: 16 }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={save} style={{ ...btnPrimary, padding: "8px 14px" }}>Simpan konteks</button>
            <button onClick={() => setDraft(null)} style={{ ...btnMuted, padding: "8px 14px" }}>Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}
