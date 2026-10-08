"use client";

import { useState } from "react";
import { archetypes, objections } from "@/lib/salespal-data";
import { LeadProfile, guessArchetype, hasProfile, objectionTypeOf, scriptsFor } from "@/lib/profile";
import { waLink } from "@/lib/billing";

// The lead's profile in its detail (PRD-008 §3): need, pain point, objection
// and customer type, filled by hand for now (WhatsApp import comes in 8.4).
// With a type and an objection it offers the matching script, ready to send.
export default function LeadProfileCard({ profile, name, phone, onSave }: {
  profile?: LeadProfile | null; name: string; phone?: string; onSave: (p: LeadProfile) => Promise<void> | void;
}) {
  const p = profile || {};
  const [edit, setEdit] = useState<LeadProfile | null>(null);
  const [tone, setTone] = useState<"santai" | "formal">("santai");
  const [copied, setCopied] = useState(false);
  const { archetype, objection, scripts } = scriptsFor(p);
  const script = scripts.find(s => s.tone === tone) || scripts[0];
  const text = script ? script.script.replace(/\{nama\}/gi, name) : "";

  const field: React.CSSProperties = { width: "100%", background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 8, color: "var(--app-text)", padding: "9px 10px", fontSize: 16, fontFamily: "inherit", resize: "vertical" };
  const chip = (on: boolean): React.CSSProperties => ({ minHeight: 36, padding: "0 10px", borderRadius: 18, border: `1px solid ${on ? "#005eb0" : "var(--app-border)"}`, background: on ? "#005eb0" : "var(--app-card)", color: on ? "#fff" : "var(--app-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
  const small: React.CSSProperties = { minHeight: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--app-border)", background: "transparent", color: "var(--app-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center" };

  if (edit) {
    const guess = !edit.archetype ? guessArchetype([edit.need, edit.pain, edit.objection].join(" ")) : null;
    const detected = edit.objection && !edit.objectionType ? objectionTypeOf(edit) : null;
    return (
      <section aria-label="Ubah profil" style={{ marginTop: 16, background: "var(--app-inner)", borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
        <div style={{ fontSize: 10, color: "var(--app-muted)", letterSpacing: "1px", fontWeight: 600 }}>PROFIL</div>
        {([["pf-need", "need", "Kebutuhan", "mis. foto menu baru buat 3 cabang sebelum Desember"], ["pf-pain", "pain", "Pain point", "mis. foto antar cabang beda-beda gaya"], ["pf-obj", "objection", "Keberatan", "mis. budget dibagi sama renovasi"]] as const).map(([id, k, l, ph]) => (
          <div key={id}>
            <label htmlFor={id} style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{l}</label>
            <textarea id={id} rows={2} value={edit[k] || ""} placeholder={ph} onChange={e => setEdit({ ...edit, [k]: e.target.value })} style={field} />
          </div>
        ))}
        <div role="group" aria-label="Jenis keberatan">
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Jenis keberatan {detected && <span style={{ fontWeight: 500, color: "var(--app-muted)" }}>· ketebak: {objections.find(o => o.id === detected)?.label}</span>}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {objections.filter(o => o.id !== "ghosting").map(o => {
              const on = (edit.objectionType || detected) === o.id;
              return <button key={o.id} aria-pressed={on} onClick={() => setEdit({ ...edit, objectionType: on && edit.objectionType ? undefined : o.id })} style={chip(on)}>{o.icon} {o.label}</button>;
            })}
          </div>
        </div>
        <div role="group" aria-label="Tipe customer">
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Tipe customer {guess && <span style={{ fontWeight: 500, color: "var(--app-muted)" }}>· kayaknya {archetypes.find(a => a.id === guess)?.name}</span>}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {archetypes.map(a => {
              const on = (edit.archetype || guess) === a.id;
              return <button key={a.id} aria-pressed={on} onClick={() => setEdit({ ...edit, archetype: edit.archetype === a.id ? undefined : a.id })} style={chip(on)}>{a.animal} {a.name}</button>;
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={async () => {
            const next: LeadProfile = {
              ...p, ...edit,
              need: (edit.need || "").trim(), pain: (edit.pain || "").trim(), objection: (edit.objection || "").trim(),
              archetype: edit.archetype || guess || undefined, objectionType: edit.objectionType || detected || undefined,
              source: p.source || "manual", at: new Date().toISOString().slice(0, 10),
            };
            await onSave(JSON.parse(JSON.stringify(next)));
            setEdit(null);
          }} style={{ ...small, background: "#005eb0", color: "#fff", border: "none" }}>Simpan profil</button>
          <button onClick={() => setEdit(null)} style={small}>Batal</button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Profil" style={{ marginTop: 16, background: "var(--app-inner)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 10, color: "var(--app-muted)", letterSpacing: "1px", fontWeight: 600 }}>PROFIL</div>
        {hasProfile(p) && <button onClick={() => setEdit({ ...p })} style={{ background: "none", border: "none", color: "var(--brand-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Ubah</button>}
      </div>
      {!hasProfile(p) ? (
        <>
          <p style={{ margin: "6px 0 10px", fontSize: 12.5, color: "var(--app-muted)", lineHeight: 1.5 }}>Belum diisi. Catat kebutuhan, pain point, dan keberatannya setelah chat pertama — nanti SalesPal nyaranin script yang pas.</p>
          <button onClick={() => setEdit({})} style={small}>Isi profil</button>
        </>
      ) : (
        <>
          <dl style={{ margin: "8px 0 0", display: "grid", gap: 8 }}>
            {([["Kebutuhan", p.need], ["Pain point", p.pain], ["Keberatan", p.objection]] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt style={{ fontSize: 11.5, fontWeight: 700, color: "var(--app-muted)" }}>{k}</dt><dd style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.5 }}>{v}</dd></div>
            ))}
          </dl>
          {archetype && (
            <div style={{ marginTop: 10, fontSize: 12.5 }}>
              <b>{archetype.animal} {archetype.name}</b> <span style={{ color: "var(--app-muted)" }}>· {archetype.strategy}</span>
            </div>
          )}
          {script && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--app-border)", paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Script: {objection?.icon} {objection?.label}</div>
                <div role="group" aria-label="Gaya bahasa" style={{ display: "flex", gap: 4 }}>
                  {(["santai", "formal"] as const).map(t => <button key={t} aria-pressed={tone === t} onClick={() => setTone(t)} style={{ ...chip(tone === t), minHeight: 30 }}>{t === "santai" ? "Santai" : "Formal"}</button>)}
                </div>
              </div>
              <p style={{ margin: "8px 0 4px", fontSize: 13, lineHeight: 1.55 }}>{text}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--app-muted)" }}>{script.tips}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600); }} style={small}>{copied ? "✓ Tersalin" : "Copy"}</button>
                {phone && <a href={waLink(phone, text)} target="_blank" rel="noreferrer" style={{ ...small, background: "#25D366", color: "#fff", border: "none" }}>Kirim WA</a>}
              </div>
            </div>
          )}
          {archetype && !script && <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--app-muted)" }}>Pilih jenis keberatannya buat dapet script yang pas.</p>}
        </>
      )}
    </section>
  );
}
