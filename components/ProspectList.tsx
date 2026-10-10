"use client";

import { useEffect, useState } from "react";
import { setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addDays, longDate, today } from "@/lib/billing";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import { Hunt, platformSource } from "@/lib/hunting";
import { objections } from "@/lib/salespal-data";
import {
  Prospect, ProspectEvent, Result, Strategy, convertPatch, dncPatch, fromHunts, isDue, notePatch, replyPatch,
  resultPatch, statusColor, statusLabel, view,
} from "@/lib/prospects";
import { Counter, bump, clean, ctx, loadClosed, removeProspect, saveProspect, syncHunt } from "@/lib/prospectStore";
import { badge, btnPrimary, btnMuted, card, chip, font, inputStyle, label, modalBox } from "@/components/ui";

// Every person hunted, one journey each (docs/prd/PRD-009 §6): where they
// stand, what was said both ways, and the one-tap answer that moves them on.

export const FILTERS = ["Antrian", "Baru", "Nunggu", "Terhubung", "Parkir", "ETB", "DNC"] as const;
export type ProspectFilter = (typeof FILTERS)[number];
const PAGE = 30;

type Editing = { id: string; kind: "reply" | "nanti" | "tolak" | "dnc" | "note"; text: string; date: string };

function when(at: number): string {
  const d = new Date(at);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd === today() ? "hari ini" : longDate(ymd)} ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

function Bubble({ e }: { e: ProspectEvent }) {
  const theirs = e.kind === "post" || e.kind === "reply";
  const mine = e.kind === "sent";
  if (!theirs && !mine) {
    return <div style={{ textAlign: "center", fontSize: 12, color: "var(--app-muted)", margin: "6px 0" }}>{e.text} · {when(e.at)}</div>;
  }
  const head = e.kind === "post" ? "Post" : e.kind === "reply" ? "Balasan" : `${e.channel === "post" ? "Balas di post" : "DM"}${e.campaign ? ` · kampanye ${e.campaign}` : e.template ? ` · ${e.template}` : ""}`;
  return (
    <div style={{ display: "flex", justifyContent: theirs ? "flex-start" : "flex-end", margin: "6px 0" }}>
      <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 12, background: mine ? "#005eb014" : "var(--app-inner)", border: `1px solid ${mine ? "#005eb040" : "var(--app-border)"}` }}>
        <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 3 }}>{head} · {when(e.at)}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.text || (e.kind === "reply" ? "(dibales)" : "(isi pesan ga tercatat)")}</div>
        {e.kind === "post" && e.url && <a href={e.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand-text)" }}>Buka post ↗</a>}
      </div>
    </div>
  );
}

export default function ProspectList({ prospects, ready, hunts, strategy, sessionId, filter, setFilter, onCompose }: {
  prospects: Prospect[]; ready: boolean; hunts: Hunt[]; strategy: Strategy; sessionId?: string;
  filter: ProspectFilter; setFilter: (f: ProspectFilter) => void; onCompose: (p: Prospect) => void;
}) {
  const space = useSpace();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [converting, setConverting] = useState<{ p: Prospect; business: string; phone: string; email: string; note: string } | null>(null);
  const [closed, setClosed] = useState<Prospect[] | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const on = today();

  useEffect(() => {
    if (filter === "DNC" && closed === null) loadClosed(space).then(setClosed).catch(() => setClosed([]));
  }, [filter, closed, space]);

  const rows = prospects.map(p => ({ p, v: view(p, on, strategy) }));
  const inFilter = (f: ProspectFilter) => rows.filter(({ p, v }) => {
    switch (f) {
      case "Antrian": return isDue(p, on, strategy);
      case "Baru": return v.status === "baru";
      case "Nunggu": return v.status === "intro" || v.status === "belum";
      case "Terhubung": return v.status === "terhubung" && p.result !== "data" && !v.parkedUntil;
      case "Parkir": return v.status === "tidak" || !!v.parkedUntil;
      case "ETB": return p.segment === "ETB";
      default: return false;
    }
  });
  const shown = filter === "DNC"
    ? (closed || []).map(p => ({ p, v: view(p, on, strategy) }))
    : inFilter(filter).sort((a, b) => filter === "Antrian" ? (a.v.due || "").localeCompare(b.v.due || "") : b.p.updatedAt - a.p.updatedAt);
  const unlinked = hunts.filter(h => !h.prospectId && h.target?.trim());

  async function act(p: Prospect, patch: Partial<Prospect>, counters: Counter[] = []) {
    setBusy(true);
    try {
      await saveProspect(space, p, patch);
      syncHunt(space, { ...p, ...patch } as Prospect);
      counters.forEach(c => bump(space, sessionId, c));
      setEditing(null);
    } catch {
      setMsg("Gagal nyimpen. Cek koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  const firstAnswer = (p: Prospect): Counter[] => (p.contact === "terhubung" ? [] : ["replies"]);

  function mark(p: Prospect, r: Exclude<Result, "data">, extra: { remark?: string; nextAt?: string } = {}) {
    return act(p, resultPatch(p, r, extra, ctx(sessionId), strategy), firstAnswer(p));
  }

  async function lockDnc(p: Prospect, reason: string) {
    await act(p, dncPatch(p, reason, ctx(sessionId)), firstAnswer(p));
    setClosed(null);
    setOpenId(null);
  }

  async function convert() {
    if (!converting) return;
    const { p, business, phone, email, note } = converting;
    setBusy(true);
    try {
      const leadId = `lead_${Date.now()}`;
      const post = (p.history || []).find(e => e.kind === "post")?.text;
      const notes = [`Dari Hunting (${p.platform}) · ${p.handle}`, post ? `Post: "${post.slice(0, 160)}"` : "", note.trim()].filter(Boolean).join(" — ");
      await setDoc(spaceDoc(space, "leads", leadId), clean(stamp(space, {
        name: business.trim() || p.name || p.handle, contact: p.name || p.handle, source: platformSource[p.platform], status: "Hot", score: 85,
        email: email.trim(), phone: phone.trim(), category: "F&B", notes, lastContact: on, value: 0,
      }, p)));
      const summary = ["Kasih data", business.trim(), phone.trim(), email.trim()].filter(Boolean).join(" · ");
      await saveProspect(space, p, convertPatch(p, leadId, summary, ctx(sessionId)));
      syncHunt(space, { ...p, result: "data", contact: "terhubung" } as Prospect);
      [...firstAnswer(p), "converted" as Counter].forEach(c => bump(space, sessionId, c));
      setConverting(null);
      setMsg(`${p.name || p.handle} masuk Leads sebagai Hot, sekarang ETB.`);
    } catch {
      setMsg("Gagal nyimpen lead. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function backfill() {
    setBusy(true);
    try {
      const c = ctx();
      const known = new Map(prospects.map(p => [p.id, p]));
      const groups = fromHunts(unlinked, c);
      let ops = 0;
      let b = writeBatch(db);
      const flush = async () => { if (ops) { await b.commit(); b = writeBatch(db); ops = 0; } };
      for (const g of groups) {
        const had = known.get(g.id);
        if (had) {
          const merged = [...(had.history || []), ...g.data.history].sort((x, y) => x.at - y.at).slice(-200);
          b.update(spaceDoc(space, "prospects", g.id), clean({ history: merged, updatedAt: c.at }));
        } else {
          const owner = hunts.find(h => g.huntIds.includes(h.id)) as { ownerUid?: string; ownerName?: string } | undefined;
          b.set(spaceDoc(space, "prospects", g.id), clean(stamp(space, g.data, owner)));
        }
        ops++;
        for (const id of g.huntIds) { b.update(spaceDoc(space, "hunts", id), { prospectId: g.id }); ops++; if (ops >= 400) await flush(); }
        if (ops >= 400) await flush();
      }
      await flush();
      setMsg(`${groups.length} journey dibuat dari ${unlinked.length} DM lama.`);
    } catch {
      setMsg("Gagal menggabungkan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const count = (f: ProspectFilter) => (f === "DNC" ? (closed ? closed.length : null) : inFilter(f).length);

  return (
    <div id="journey-prospek" style={{ ...card, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>Journey prospek</div>
        <div style={{ fontSize: 12, color: "var(--app-muted)" }}>{prospects.length} orang aktif</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>
        Satu orang satu journey. Belum dibales {strategy.gaps[0]} hari = Belum respon; {strategy.maxAttempts}× tanpa jawaban = Tidak terhubung, diparkir {strategy.parkDays} hari.
      </div>

      {unlinked.length > 0 && (
        <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)", marginBottom: 12, fontSize: 12 }}>
          <span>{unlinked.length} DM lama belum punya journey.</span>
          <button onClick={backfill} disabled={busy} style={{ ...btnPrimary, padding: "8px 14px", fontSize: 12 }}>Gabungin jadi journey</button>
        </div>
      )}
      <div role="status" style={{ fontSize: 12, color: "var(--app-sub)", marginBottom: msg ? 10 : 0 }}>{msg}</div>

      <div role="group" aria-label="Saring prospek" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 6 }}>
        {FILTERS.map(f => {
          const n = count(f);
          return (
            <button key={f} onClick={() => { setFilter(f); setLimit(PAGE); }} aria-pressed={filter === f}
              style={{ ...chip, flexShrink: 0, minHeight: 36, fontWeight: 700, ...(filter === f ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
              {f}{n ? <span style={{ opacity: 0.75 }}> {n}</span> : null}
            </button>
          );
        })}
      </div>

      {ready && shown.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "14px 0" }}>
          {filter === "Antrian" ? "Antrian kosong. Share post Threads ke SalesPal atau tempel link-nya buat nambah prospek."
            : filter === "DNC" ? (closed ? "Belum ada yang minta ga dihubungi." : "Memuat…")
            : "Belum ada prospek di sini."}
        </div>
      )}

      {shown.slice(0, limit).map(({ p, v }) => {
        const open = openId === p.id;
        const who = p.name ? `${p.name} (${p.handle})` : p.handle;
        const post = [...(p.history || [])].reverse().find(e => e.kind === "post");
        const ed = editing?.id === p.id ? editing : null;
        const sub = [
          p.platform, p.segment,
          v.status === "intro" || v.status === "belum" ? `percobaan ${p.attempts}/${strategy.maxAttempts}` : "",
          v.due && v.status !== "dnc" ? (v.due <= on ? (v.due < on ? `telat sejak ${longDate(v.due)}` : "hari ini") : `${v.parkedUntil ? "parkir s.d." : "follow-up"} ${longDate(v.due)}`) : "",
        ].filter(Boolean).join(" · ");
        return (
          <div key={p.id} style={{ borderTop: "1px solid var(--app-inner)", padding: "10px 0" }}>
            <button onClick={() => { setOpenId(open ? null : p.id); setEditing(null); }} aria-expanded={open} aria-label={`Journey ${who}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</div>
                <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{sub}</div>
                {!open && post?.text && <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>“{post.text}”</div>}
              </div>
              <span style={badge(statusColor(p, v))}>{statusLabel(p, v)}</span>
            </button>

            {open && (
              <div role="region" aria-label={`Riwayat ${who}`} style={{ marginTop: 10 }}>
                {p.context && (p.context.need || p.context.when || p.context.where) && (
                  <div style={{ fontSize: 12, color: "var(--app-sub)", marginBottom: 6 }}>
                    {[p.context.need && `Butuh ${p.context.need}`, p.context.when, p.context.where, p.context.budget].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div style={{ maxHeight: 360, overflowY: "auto", padding: "4px 2px" }}>
                  {(p.history || []).length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Belum ada riwayat.</div>}
                  {(p.history || []).map((e, i) => <Bubble key={`${e.at}_${i}`} e={e} />)}
                </div>
                {p.result && v.status === "intro" && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>Hasil terakhir: {statusLabel({ ...p, contact: "terhubung" }, { ...v, status: "terhubung" })}{p.remark ? ` — ${p.remark}` : ""}</div>}

                {v.status === "dnc" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--app-sub)" }}>Minta ga dihubungi sejak {p.dncAt ? longDate(p.dncAt) : "—"}{p.remark ? ` · ${p.remark}` : ""}.</span>
                    <button onClick={async () => { if (confirm(`Hapus ${who} dari daftar Jangan dihubungi? Kalau post-nya di-share lagi, dia masuk sebagai prospek baru.`)) { await removeProspect(space, p); setClosed(null); } }} style={chip}>Hapus dari daftar</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      <button onClick={() => onCompose(p)} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)", border: "1px solid #005eb060" }}>{v.status === "baru" ? "✉ Kirim intro" : v.status === "belum" ? "↻ Follow-up" : "✉ Kirim pesan"}</button>
                      <button onClick={() => setEditing({ id: p.id, kind: "reply", text: "", date: "" })} aria-pressed={ed?.kind === "reply"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>💬 Dibales</button>
                      {(post?.url || p.url) && <a href={post?.url || p.url} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>{post?.url ? "Buka post ↗" : "Buka profil ↗"}</a>}
                      <button onClick={() => setEditing({ id: p.id, kind: "note", text: "", date: "" })} style={{ ...chip, minHeight: 36 }}>📝 Catatan</button>
                      <button onClick={async () => { if (confirm(`Hapus journey ${who}? Log DM-nya tetap ada.`)) await removeProspect(space, p); }} aria-label={`Hapus journey ${who}`} style={{ ...chip, minHeight: 36, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>🗑</button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", margin: "10px 0 6px" }}>Hasil (otomatis dihitung dibales)</div>
                    <div role="group" aria-label={`Hasil untuk ${who}`} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button disabled={busy} onClick={() => mark(p, "tertarik")} aria-pressed={p.result === "tertarik"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>✅ Tertarik</button>
                      <button disabled={busy} onClick={() => mark(p, "pikir")} aria-pressed={p.result === "pikir"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>🤔 Pikir-pikir</button>
                      <button disabled={busy} onClick={() => setEditing({ id: p.id, kind: "nanti", text: "", date: addDays(on, 7) })} aria-pressed={p.result === "nanti"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>⏳ Hubungi nanti</button>
                      <button disabled={busy} onClick={() => setEditing({ id: p.id, kind: "tolak", text: p.result === "tolak" ? p.remark || "" : "", date: "" })} aria-pressed={p.result === "tolak"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>❌ Tidak tertarik</button>
                      <button disabled={busy} onClick={() => setConverting({ p, business: p.name || "", phone: p.platform === "WA" ? p.handle : "", email: "", note: "" })} style={{ ...chip, minHeight: 36, fontWeight: 700, background: "#00a862", color: "#1c2128", border: "none" }}>Kasih data →</button>
                      <button disabled={busy} onClick={() => setEditing({ id: p.id, kind: "dnc", text: "", date: "" })} style={{ ...chip, minHeight: 36, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>🚫 Menolak dihubungi</button>
                    </div>
                  </>
                )}

                {ed && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
                    {ed.kind === "reply" && <>
                      <label htmlFor={`reply-${p.id}`} style={label}>Tempel balasannya (opsional)</label>
                      <textarea id={`reply-${p.id}`} autoFocus value={ed.text} onChange={e => setEditing({ ...ed, text: e.target.value })} placeholder="mis. Boleh kak, pricelist-nya berapa?" style={{ ...inputStyle, fontSize: 16, height: 72, resize: "vertical" }} />
                    </>}
                    {ed.kind === "note" && <>
                      <label htmlFor={`note-${p.id}`} style={label}>Catatan</label>
                      <input id={`note-${p.id}`} autoFocus value={ed.text} onChange={e => setEditing({ ...ed, text: e.target.value })} style={{ ...inputStyle, fontSize: 16 }} />
                    </>}
                    {ed.kind === "nanti" && <>
                      <label htmlFor={`nanti-${p.id}`} style={label}>Hubungi lagi tanggal</label>
                      <input id={`nanti-${p.id}`} type="date" value={ed.date} min={on} onChange={e => setEditing({ ...ed, date: e.target.value })} style={{ ...inputStyle, fontSize: 16, maxWidth: 220 }} />
                    </>}
                    {(ed.kind === "tolak" || ed.kind === "dnc") && <>
                      {ed.kind === "tolak" && (
                        <div role="group" aria-label="Alasan" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          {objections.filter(o => o.id !== "ghosting").map(o => (
                            <button key={o.id} onClick={() => setEditing({ ...ed, text: o.label })} aria-pressed={ed.text === o.label} style={{ ...chip, minHeight: 32, ...(ed.text === o.label ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{o.icon} {o.label}</button>
                          ))}
                        </div>
                      )}
                      {ed.kind === "dnc" && <div style={{ fontSize: 12, color: "var(--app-sub)", marginBottom: 8 }}>Dikunci selamanya: ga muncul di antrian & kampanye. Riwayat percakapannya dihapus, yang disimpan cuma username + tanggal.</div>}
                      <label htmlFor={`why-${p.id}`} style={label}>{ed.kind === "tolak" ? "Alasan (bebas)" : "Alasan (opsional)"}</label>
                      <input id={`why-${p.id}`} autoFocus value={ed.text} onChange={e => setEditing({ ...ed, text: e.target.value })} style={{ ...inputStyle, fontSize: 16 }} />
                    </>}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button disabled={busy} onClick={() => {
                        const c = ctx(sessionId);
                        if (ed.kind === "reply") return act(p, replyPatch(p, ed.text, c), firstAnswer(p));
                        if (ed.kind === "note") return ed.text.trim() ? act(p, notePatch(p, ed.text, c)) : setEditing(null);
                        if (ed.kind === "nanti") return mark(p, "nanti", { nextAt: ed.date || addDays(on, 7) });
                        if (ed.kind === "tolak") return mark(p, "tolak", { remark: ed.text });
                        return lockDnc(p, ed.text);
                      }} style={{ ...btnPrimary, padding: "8px 14px", ...(ed.kind === "dnc" ? { background: "#c62828" } : {}) }}>{ed.kind === "dnc" ? "Kunci" : "Simpan"}</button>
                      <button onClick={() => setEditing(null)} style={{ ...btnMuted, padding: "8px 14px" }}>Batal</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {shown.length > limit && <button onClick={() => setLimit(limit + PAGE)} style={{ ...chip, width: "100%", marginTop: 8, minHeight: 40 }}>Tampilkan {Math.min(PAGE, shown.length - limit)} lagi</button>}

      {converting && (
        <div className="modal-overlay" onClick={() => setConverting(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="convert-title" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 440 }}>
            <div id="convert-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Kasih data: {converting.p.name || converting.p.handle}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Jadi Lead Hot di Leads, prospek pindah ke ETB.</div>
            <label htmlFor="cv-business" style={label}>Nama bisnis</label>
            <input id="cv-business" value={converting.business} onChange={e => setConverting({ ...converting, business: e.target.value })} style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
            <label htmlFor="cv-phone" style={label}>WhatsApp</label>
            <input id="cv-phone" inputMode="tel" value={converting.phone} onChange={e => setConverting({ ...converting, phone: e.target.value })} placeholder="08…" style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
            <label htmlFor="cv-email" style={label}>Email</label>
            <input id="cv-email" type="email" value={converting.email} onChange={e => setConverting({ ...converting, email: e.target.value })} style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
            <label htmlFor="cv-note" style={label}>Catatan</label>
            <input id="cv-note" value={converting.note} onChange={e => setConverting({ ...converting, note: e.target.value })} placeholder="mis. butuh foto 20 menu, minggu depan" style={{ ...inputStyle, fontSize: 16, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={convert} disabled={busy || !(converting.phone.trim() || converting.email.trim())} style={{ ...btnPrimary, opacity: converting.phone.trim() || converting.email.trim() ? 1 : 0.5 }}>Simpan jadi Lead</button>
              <button onClick={() => setConverting(null)} style={btnMuted}>Batal</button>
            </div>
            {!(converting.phone.trim() || converting.email.trim()) && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 8 }}>Isi WhatsApp atau email — itu yang bikin dia dihitung konversi.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
