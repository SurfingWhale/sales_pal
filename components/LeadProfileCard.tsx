"use client";

import { useState } from "react";
import { archetypes, objections } from "@/lib/salespal-data";
import { LeadProfile, guessArchetype, hasProfile, objectionTypeOf, scriptsFor } from "@/lib/profile";
import { waLink } from "@/lib/billing";
import WaImport, { WaPatch } from "@/components/WaImport";

// The lead's profile in its detail (PRD-008 §3): need, pain point, objection
// and customer type, filled by hand for now (WhatsApp import comes in 8.4).
// With a type and an objection it offers the matching script, ready to send.
export default function LeadProfileCard({ profile, name, phone, onSave, onImport, shareFile }: {
  profile?: LeadProfile | null; name: string; phone?: string; onSave: (p: LeadProfile) => Promise<void> | void;
  onImport: (patch: WaPatch) => Promise<void> | void; shareFile?: File | null;
}) {
  const p = profile || {};
  const [edit, setEdit] = useState<LeadProfile | null>(null);
  const [importing, setImporting] = useState(Boolean(shareFile));
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
        {hasProfile(p) && (
          <div style={{ display: "flex", gap: 14 }}>
            <button onClick={() => setImporting(true)} style={{ background: "none", border: "none", color: "var(--brand-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{p.source === "wa-export" ? "Tarik ulang" : "Tarik dari WA"}</button>
            <button onClick={() => setEdit({ ...p })} style={{ background: "none", border: "none", color: "var(--brand-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Ubah</button>
          </div>
        )}
      </div>
      {!hasProfile(p) ? (
        <>
          <p style={{ margin: "6px 0 10px", fontSize: 12.5, color: "var(--app-muted)", lineHeight: 1.5 }}>Belum diisi. Catat kebutuhan, pain point, dan keberatannya setelah chat pertama — nanti SalesPal nyaranin script yang pas.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setImporting(true)} style={{ ...small, background: "#005eb0", color: "#fff", border: "none" }}>Tarik dari WhatsApp</button>
            <button onClick={() => setEdit({})} style={small}>Isi profil</button>
          </div>
        </>
      ) : (
        <>
          {p.brief && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--app-muted)" }}>Brief{p.chat ? ` · dari ${p.chat.messages} pesan WA` : ""}</div>
              <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.55 }}>{p.brief}</p>
            </div>
          )}
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
          {p.cues && p.cues.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }} aria-label="Kata yang muncul di chat">
              {p.cues.map(c => <span key={c.word} style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 999, background: "var(--app-card)", border: "1px solid var(--app-border)" }}>“{c.word}” {c.n}×</span>)}
            </div>
          )}
          {p.chat && <ChatPattern chat={p.chat} />}
          {p.questions && p.questions.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--app-border)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Yang mereka tanya</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {p.questions.slice().reverse().map((q, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0", borderTop: i ? "1px solid var(--app-border)" : "none" }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13 }}>“{q.text}”</span>
                      <span style={{ display: "block", fontSize: 11.5, color: q.answered ? "var(--app-muted)" : "color-mix(in srgb, #b45309 80%, var(--app-text))" }}>{q.at} · {q.answered ? "dijawab" : "belum dijawab"}</span>
                    </span>
                    {!q.answered && phone && <a href={waLink(phone, "")} target="_blank" rel="noreferrer" style={{ ...small, flexShrink: 0 }}>Balas</a>}
                  </li>
                ))}
              </ul>
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
      {importing && <WaImport leadName={name} profile={p} initialFile={shareFile} onSave={onImport} onClose={() => setImporting(false)} />}
    </section>
  );
}

// Pola chat (PRD-008 §4): how much, how fast they answer, when, who talks more.
function ChatPattern({ chat }: { chat: NonNullable<LeadProfile["chat"]> }) {
  const max = Math.max(1, ...chat.perWeek.map(w => w.n));
  const total = chat.mine + chat.theirs || 1;
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--app-border)", paddingTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Pola chat</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[[String(chat.messages), `pesan sejak ${chat.since}`], [chat.avgReplyMin === null ? "—" : chat.avgReplyMin < 60 ? `${chat.avgReplyMin} mnt` : `${Math.round(chat.avgReplyMin / 60)} jam`, "rata-rata mereka bales"], [chat.activeHours || "—", "jam paling aktif"]].map(([v, l]) => (
          <div key={l}><div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</div><div style={{ fontSize: 11, color: "var(--app-muted)" }}>{l}</div></div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--app-muted)", margin: "10px 0 4px" }}>Pesan dari mereka per minggu</div>
      <div role="img" aria-label={chat.perWeek.map(w => `${w.week}: ${w.n}`).join(", ")} style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
        {chat.perWeek.map((w, i) => (
          <div key={w.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", height: Math.max(3, (w.n / max) * 40), borderRadius: 4, background: i === chat.perWeek.length - 1 ? "#005eb0" : "color-mix(in srgb, #005eb0 40%, var(--app-card))" }} />
            <span style={{ fontSize: 10, color: "var(--app-muted)" }}>{w.week}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--app-muted)", margin: "10px 0 4px" }}>Siapa yang lebih banyak ngechat</div>
      <div aria-hidden="true" style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--app-border)" }}>
        <div style={{ width: `${(chat.mine / total) * 100}%`, background: "#005eb0" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginTop: 3 }}><span>Kamu {chat.mine}</span><span>Mereka {chat.theirs}</span></div>
    </div>
  );
}
