"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteDoc, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authFetch } from "@/lib/authFetch";
import { useBusiness, useSpaceCollection } from "@/lib/billing";
import type { PitchTemplate } from "@/lib/hunting";
import { canEditCatalog, spaceCol, spaceDoc, stamp, useSpace } from "@/lib/space";
import { useConfirm } from "@/components/ConfirmSheet";
import { btnMuted, btnPrimary, chip, font, inputStyle, label } from "@/components/ui";

// Analisis Chat (PRD-023, Script Intelligence phase 1): paste a conversation,
// see where it stands and what the prospect said, which of your scripts fits
// and why, and a reply adjusted to it — rules only (rules-v1, api/_intel), no
// model, Rp 0. You approve and copy every message yourself.
// History: kept only when you leave "Simpan" on, private to you (even in a
// guild), deleted after 90 days or whenever you delete it.

type Finding = { text: string; quote: string; evidence: number[] };
type Theory = { framework: string; concept: string; supporting_evidence: string[]; application: string; limitations: string };
type Dim = { weight: number; score: number; points: number };
type Match = {
  script_id: string; script_name: string; stage: string; relevance_score: number;
  score_breakdown: Record<string, Dim>; matching_reasons: string[]; mismatches: string[]; critical: string[];
};
type Result = {
  detected_stage: { id: string; label: string; why: string };
  conversation_summary: { messages: number; prospect_messages: number; seller_unanswered: number; speakers: string[]; seller: string | null; ambiguous_speakers: boolean; tone: string; situation: string; main_concern: string };
  explicit_facts: Finding[]; inferred_context: { text: string; basis: string }[]; expressed_needs: Finding[];
  objections: { id: string; label: string; quote: string }[]; missing_information: { item: string; label: string; why: string; ask: string }[];
  buying_signals: Finding[]; open_questions: Finding[];
  theoretical_analysis: Theory[]; script_matches: Match[];
  recommended_adjustment: { text: string; why: string; changes: { kind: string; note: string }[]; required_edits: string[]; from_script: { script_id: string; script_name: string } | null };
  alternative_responses: { label: string; text: string }[];
  next_action: string; confidence: number; limitations: string[];
};
type Saved = { id: string; conversation: string; result: Result; createdAt: number; expiresAt: number; seller?: string };

const KEEP_DAYS = 90;
const DIM_LABEL: Record<string, string> = { context: "Konteks", stage: "Tahap", intent: "Maksud prospek", objective: "Tujuan pesan", tone_channel: "Nada & kanal" };
// Where a saved new script goes, by the detected moment.
const SCRIPT_STAGE: Record<string, string> = { intro: "intro", follow_up: "followup", discovery: "gali", proposal: "offering", objection_handling: "closing", negotiation: "closing", closing: "closing", nurturing: "etb" };

const box = { background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: 16 } as const;
const h3 = { margin: "0 0 8px", fontSize: 14, fontWeight: 700 } as const;
const muted = { fontSize: 12, color: "var(--app-muted)" } as const;

export default function ChatAnalysis() {
  const space = useSpace();
  const business = useBusiness(space);
  const scripts = useSpaceCollection<PitchTemplate>(space, "pitchTemplates");
  const [ask, askSheet] = useConfirm();
  const [text, setText] = useState("");
  const [seller, setSeller] = useState("");
  const [tone, setTone] = useState<"santai" | "formal">("santai");
  const [channel, setChannel] = useState<"wa" | "dm">("wa");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const [saving, setSaving] = useState<{ title: string } | null>(null);
  const [savedNote, setSavedNote] = useState("");
  const [history, setHistory] = useState<Saved[]>([]);

  // Your history only: in a guild the rules let no one else read it, and the
  // query has to say so.
  useEffect(() => {
    const col = spaceCol(space, "analyses");
    const q = space.kind === "guild" ? query(col, where("ownerUid", "==", space.me.uid)) : col;
    return onSnapshot(q, snap => {
      const now = Date.now();
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Saved));
      // Past its 90 days: gone, the next time you look.
      rows.filter(r => r.expiresAt < now).forEach(r => { deleteDoc(spaceDoc(space, "analyses", r.id)).catch(() => undefined); });
      setHistory(rows.filter(r => r.expiresAt >= now).sort((a, b) => b.createdAt - a.createdAt));
    }, () => setHistory([]));
  }, [space]);

  const liveScripts = useMemo(() => scripts.filter(s => !s.archived), [scripts]);

  async function analyze(sellerName = seller) {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(""); setSavedNote("");
    try {
      const res = await authFetch("/api/script-intelligence/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_text: text.slice(0, 20000), seller_role: sellerName || undefined, tone_preference: tone, channel,
          business_context: business.tagline || business.name || undefined,
          scripts: liveScripts.slice(0, 200).map(s => ({ id: s.id, title: s.title, body: s.body, stage: s.stage, categories: s.categories, workflow: s.workflow })),
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) throw new Error(j?.detail || "Analisis gagal. Coba lagi.");
      setResult(j); setDraft(j.recommended_adjustment.text);
      // Not while it still has to ask who you are: that reading isn't the one you'll use.
      const unsure = j.conversation_summary?.ambiguous_speakers && (j.conversation_summary?.speakers?.length || 0) >= 2;
      if (keep && !unsure) {
        const now = Date.now();
        await setDoc(spaceDoc(space, "analyses", `an_${now}`), stamp(space, {
          conversation: text.slice(0, 20000), result: JSON.parse(JSON.stringify(j)), seller: sellerName || "",
          createdAt: now, expiresAt: now + KEEP_DAYS * 86400000,
        })).catch(() => setErr("Analisis jadi, tapi gagal disimpan ke riwayat."));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analisis gagal. Coba lagi.");
    }
    setBusy(false);
  }

  async function copy() {
    let ok = true;
    try { await navigator.clipboard.writeText(draft); } catch { ok = false; }
    setCopied(ok ? "ok" : "fail"); setTimeout(() => setCopied(""), 2000);
  }

  async function saveScript() {
    if (!saving?.title.trim() || !draft.trim() || !result) return;
    const id = `tpl_${Date.now()}`;
    try {
      // Always a new script: an existing one is never overwritten from here.
      await setDoc(spaceDoc(space, "pitchTemplates", id), { title: saving.title.trim(), body: draft.trim(), stage: SCRIPT_STAGE[result.detected_stage.id] || "intro" });
      setSaving(null); setSavedNote(`Tersimpan jadi script “${saving.title.trim()}”.`);
    } catch { setSavedNote("Script gagal disimpan. Cek koneksi lalu coba lagi."); }
  }

  const r = result;
  const rec = r?.recommended_adjustment;
  const best = r && rec?.from_script ? r.script_matches.find(m => m.script_id === rec.from_script!.script_id) : null;
  const needsSeller = r?.conversation_summary.ambiguous_speakers && (r.conversation_summary.speakers.length >= 2);

  return (
    <div className="sp-learn">
      {askSheet}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: font }}>Analisis Chat</div>
        <div style={{ ...muted, fontSize: 13, marginTop: 4 }}>Tempel percakapan WhatsApp atau DM: lihat posisinya, apa yang mereka butuhin, script mana yang cocok dan kenapa, plus balasan yang disesuaiin. Kamu yang mutusin dan ngirim.</div>
      </div>

      <section aria-label="Percakapan" style={box}>
        <label htmlFor="ca-text" style={label}>Percakapan</label>
        <textarea id="ca-text" value={text} onChange={e => setText(e.target.value)} rows={8}
          placeholder={"Tempel chat-nya, mis.\nDita: Halo kak, buat foto menu 20 item berapa ya?\nAku: Halo kak Dita!"}
          style={{ ...inputStyle, fontSize: 16, width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12, marginTop: 12 }}>
          <div>
            <label htmlFor="ca-seller" style={label}>Nama kamu di chat <span style={{ fontWeight: 400, color: "var(--app-muted)" }}>(opsional)</span></label>
            <input id="ca-seller" value={seller} onChange={e => setSeller(e.target.value)} placeholder="mis. Raka" style={{ ...inputStyle, fontSize: 16 }} />
          </div>
          <div>
            <label htmlFor="ca-tone" style={label}>Nada</label>
            <select id="ca-tone" value={tone} onChange={e => setTone(e.target.value as "santai" | "formal")} style={{ ...inputStyle, fontSize: 16 }}>
              <option value="santai">Santai</option><option value="formal">Formal</option>
            </select>
          </div>
          <div>
            <label htmlFor="ca-channel" style={label}>Kanal</label>
            <select id="ca-channel" value={channel} onChange={e => setChannel(e.target.value as "wa" | "dm")} style={{ ...inputStyle, fontSize: 16 }}>
              <option value="wa">WhatsApp</option><option value="dm">DM (IG/Threads)</option>
            </select>
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14, marginTop: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
          Simpan ke riwayat ({KEEP_DAYS} hari, cuma kamu yang bisa lihat)
        </label>
        {err && <p role="alert" style={{ margin: "6px 0 0", fontSize: 13, color: "var(--hot)" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={() => { setText(""); setResult(null); setDraft(""); setErr(""); }} disabled={busy || (!text && !result)} style={{ ...btnMuted, minHeight: 48 }}>Kosongin</button>
          <button onClick={() => analyze()} disabled={busy || !text.trim()} style={{ ...btnPrimary, flex: 1, minHeight: 48, opacity: busy || !text.trim() ? 0.6 : 1 }}>{busy ? "Menganalisis…" : "Analisis"}</button>
        </div>
      </section>

      {r && rec && (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {needsSeller && (
            <section aria-label="Siapa kamu" style={{ ...box, borderColor: "#005eb0" }}>
              <p style={{ margin: "0 0 8px", fontSize: 14 }}>Siapa kamu di chat ini? Biar yang dibaca omongan prospeknya, bukan omongan kamu.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {r.conversation_summary.speakers.map(n => (
                  <button key={n} onClick={() => { setSeller(n); analyze(n); }} style={{ ...chip, minHeight: 44, fontWeight: 700 }}>{n}</button>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Ringkasan" style={box}>
            <h3 style={h3}>Posisinya: {r.detected_stage.label}</h3>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--app-sub)" }}>{r.detected_stage.why}</p>
            <dl style={{ margin: 0, display: "grid", gap: 6, fontSize: 13 }}>
              {r.conversation_summary.situation && <div><dt style={muted}>Situasi mereka</dt><dd style={{ margin: 0 }}>“{r.conversation_summary.situation}”</dd></div>}
              {r.conversation_summary.main_concern && <div><dt style={muted}>Yang paling jadi perhatian</dt><dd style={{ margin: 0 }}>{r.conversation_summary.main_concern}</dd></div>}
              {r.missing_information.length > 0 && (
                <div><dt style={muted}>Yang belum kamu tahu</dt>
                  <dd style={{ margin: 0 }}><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{r.missing_information.map(m => <li key={m.item}>{m.label}: {m.why}</li>)}</ul></dd>
                </div>
              )}
            </dl>
          </section>

          <section aria-label="Script yang cocok" style={box}>
            <h3 style={h3}>{rec.from_script ? `Script: ${rec.from_script.script_name}${best ? ` · ${best.relevance_score}%` : ""}` : "Respons baru"}</h3>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--app-sub)" }}>{rec.why}</p>
            {best && (
              <ul aria-label="Rincian skor" style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "grid", gap: 4 }}>
                {Object.entries(best.score_breakdown).map(([k, d]) => (
                  <li key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr 56px", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span>{DIM_LABEL[k] || k}</span>
                    <span aria-hidden="true" style={{ height: 6, borderRadius: 3, background: "var(--app-inner)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${d.score * 100}%`, background: "#005eb0" }} /></span>
                    <span className="tabnum" style={{ textAlign: "right" }}>{d.points}/{d.weight}</span>
                  </li>
                ))}
              </ul>
            )}
            {best && best.mismatches.length > 0 && <p style={{ ...muted, margin: "0 0 8px" }}>Kurang cocok: {best.mismatches.join(" · ")}</p>}
            {r.theoretical_analysis.length > 0 && (
              <ul aria-label="Dasar teori" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {r.theoretical_analysis.map(t => <li key={t.framework + t.concept} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "var(--app-inner)" }}><b>{t.framework}</b> · {t.concept}</li>)}
              </ul>
            )}
          </section>

          <section aria-label="Balasan yang disaranin" style={{ ...box, borderColor: "#005eb0" }}>
            <h3 style={h3}>Balasan yang disaranin</h3>
            {rec.required_edits.length > 0 && (
              <div role="alert">
                <ul aria-label="Wajib kamu isi" style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 13, color: "var(--hot)" }}>
                  {rec.required_edits.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
            <label htmlFor="ca-reply" className="vh">Balasan</label>
            <textarea id="ca-reply" value={draft} onChange={e => setDraft(e.target.value)} rows={5}
              style={{ ...inputStyle, fontSize: 16, width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />
            {rec.changes.length > 0 && (
              <ul aria-label="Yang disesuaiin" style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6 }}>
                {rec.changes.map((c, i) => <li key={i}>{c.kind === "add" ? "Ditambah: " : c.kind === "edit" ? "Dirapihin: " : "Dibuang: "}{c.note}</li>)}
              </ul>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={copy} disabled={!draft.trim()} style={{ ...btnPrimary, flex: "1 1 140px", minHeight: 48 }}>{copied === "ok" ? "✓ Tersalin" : copied === "fail" ? "Gagal copy" : "Copy"}</button>
              {draft !== rec.text && <button onClick={() => setDraft(rec.text)} style={{ ...btnMuted, minHeight: 48 }}>Balikin saran</button>}
              <button onClick={() => analyze()} disabled={busy} style={{ ...btnMuted, minHeight: 48 }}>Analisis ulang</button>
            </div>
            {r.alternative_responses.length > 0 && (
              <div role="group" aria-label="Alternatif" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {r.alternative_responses.map(a => <button key={a.label} onClick={() => setDraft(a.text)} style={{ ...chip, minHeight: 44 }}>{a.label}</button>)}
              </div>
            )}
            <p style={{ ...muted, margin: "10px 0 0" }}><b>Langkah berikutnya:</b> {r.next_action}</p>
            {canEditCatalog(space) && (saving ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <label htmlFor="ca-script-title" className="vh">Nama script</label>
                <input id="ca-script-title" value={saving.title} onChange={e => setSaving({ title: e.target.value })} placeholder="mis. Udah punya fotografer" autoFocus
                  style={{ ...inputStyle, fontSize: 16, flex: "1 1 200px", width: "auto" }} />
                <button onClick={saveScript} disabled={!saving.title.trim()} style={{ ...btnPrimary, minHeight: 44, opacity: saving.title.trim() ? 1 : 0.5 }}>Simpan script</button>
                <button onClick={() => setSaving(null)} style={{ ...btnMuted, minHeight: 44 }}>Batal</button>
              </div>
            ) : (
              <button onClick={() => setSaving({ title: "" })} style={{ ...chip, minHeight: 44, marginTop: 10, color: "var(--brand-text)", fontWeight: 700 }}>Simpan sebagai script baru</button>
            ))}
            {savedNote && <p role="status" style={{ ...muted, margin: "8px 0 0" }}>{savedNote}</p>}
          </section>

          <details style={box}>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontWeight: 700, fontSize: 14 }}>Analisis lengkap · yakin {Math.round(r.confidence * 100)}%</summary>
            <div style={{ display: "grid", gap: 14, fontSize: 13, marginTop: 8 }}>
              {([["Yang mereka bilang", r.explicit_facts], ["Kebutuhan", r.expressed_needs], ["Tanda mau beli", r.buying_signals], ["Pertanyaan yang belum dijawab", r.open_questions]] as [string, Finding[]][]).filter(([, xs]) => xs.length).map(([t, xs]) => (
                <div key={t}><h4 style={{ margin: "0 0 4px", fontSize: 13 }}>{t}</h4>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{xs.map((f, i) => <li key={i}>“{f.quote}”{f.text !== f.quote ? ` (${f.text})` : ""}</li>)}</ul></div>
              ))}
              {r.objections.length > 0 && <div><h4 style={{ margin: "0 0 4px", fontSize: 13 }}>Keberatan</h4><ul style={{ margin: 0, paddingLeft: 18 }}>{r.objections.map(o => <li key={o.id}>{o.label}: “{o.quote}”</li>)}</ul></div>}
              {r.inferred_context.length > 0 && <div><h4 style={{ margin: "0 0 4px", fontSize: 13 }}>Tafsiran (bukan kata mereka)</h4><ul style={{ margin: 0, paddingLeft: 18 }}>{r.inferred_context.map((x, i) => <li key={i}>{x.text} · dasarnya {x.basis}</li>)}</ul></div>}
              {r.theoretical_analysis.map(t => (
                <div key={t.framework + t.concept}><h4 style={{ margin: "0 0 4px", fontSize: 13 }}>{t.framework} · {t.concept}</h4>
                  <p style={{ margin: "0 0 2px" }}>{t.application}</p>
                  {t.supporting_evidence.length > 0 && <p style={{ ...muted, margin: "0 0 2px" }}>Dasarnya: {t.supporting_evidence.map(e => `“${e}”`).join(" · ")}</p>}
                  <p style={{ ...muted, margin: 0 }}>Batasnya: {t.limitations}</p>
                </div>
              ))}
              {r.script_matches.length > 0 && (
                <div><h4 style={{ margin: "0 0 4px", fontSize: 13 }}>Semua script</h4>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{r.script_matches.map(m => (
                    <li key={m.script_id}>{m.script_name}: {m.relevance_score}%{m.critical.length ? ` · gugur: ${m.critical.join("; ")}` : ""}{m.matching_reasons.length ? ` · ${m.matching_reasons.join(", ")}` : ""}</li>
                  ))}</ul></div>
              )}
              <div><h4 style={{ margin: "0 0 4px", fontSize: 13 }}>Batasan analisis ini</h4><ul style={{ margin: 0, paddingLeft: 18 }}>{r.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            </div>
          </details>
        </div>
      )}

      <section aria-label="Riwayat analisis" style={{ ...box, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3 style={{ ...h3, margin: 0 }}>Riwayat ({history.length})</h3>
          {history.length > 0 && (
            <button onClick={() => ask("Hapus semua riwayat analisis?", "Percakapan dan hasilnya hilang. Script yang udah kamu simpan tetap ada.", async () => {
              const b = writeBatch(db);
              history.forEach(h => b.delete(spaceDoc(space, "analyses", h.id)));
              await b.commit();
            })} style={{ ...chip, minHeight: 44, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>Hapus semua</button>
          )}
        </div>
        <p style={{ ...muted, margin: "4px 0 8px" }}>Cuma kamu yang bisa lihat. Kehapus sendiri setelah {KEEP_DAYS} hari.</p>
        {history.length === 0 ? <p style={{ ...muted, margin: 0 }}>Belum ada.</p> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {history.slice(0, 30).map(h => (
              <li key={h.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => { setText(h.conversation); setSeller(h.seller || ""); setResult(h.result); setDraft(h.result.recommended_adjustment.text); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{ flex: 1, minWidth: 0, minHeight: 48, padding: "6px 10px", borderRadius: 10, border: "1px solid var(--app-border)", background: "var(--app-bg)", color: "var(--app-text)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{h.result.detected_stage.label} · {new Date(h.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.conversation.split("\n")[0]}</span>
                </button>
                <button onClick={() => deleteDoc(spaceDoc(space, "analyses", h.id))} aria-label={`Hapus analisis ${new Date(h.createdAt).toLocaleDateString("id-ID")}`}
                  style={{ ...chip, minWidth: 44, minHeight: 44, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>Hapus</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
