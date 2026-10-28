"use client";

import { useEffect, useState } from "react";
import { writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { daysBetween, longDate, today } from "@/lib/billing";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import type { Hunt } from "@/lib/hunting";
import {
  Prospect, ProspectEvent, Strategy, View, archivePatch, dropReady, followUpDue, fromHunts, inQueue, JOURNEY_STEPS, journeyStep, lastLine,
  restorePatch, silentDays, statusColor, statusLabel, view,
} from "@/lib/prospects";
import { clean, ctx, loadClosed, removeProspect, saveProspect } from "@/lib/prospectStore";
import { btnPrimary, card, chip, font, inputStyle, ink } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmSheet";
import { useOutcome } from "@/components/ProspectOutcome";
import Icon from "@/components/Icon";
import { profileUrl } from "@/lib/threads";

// Every person hunted, one journey each (docs/prd/PRD-009 §6): where they
// stand, what was said both ways, and the one-tap answer that moves them on.

// One list for everyone (owner, 23 Okt: Kirim, Journey and Percakapan were the
// same people three times): the filters of all three, in the order of a day.
export const FILTERS = ["Antrian", "Follow-up hari ini", "Baru", "Nunggu", "Terhubung", "Diem 7+", "Siap dibuang", "Parkir", "ETB", "DNC", "Arsip"] as const;
export type ProspectFilter = (typeof FILTERS)[number];
const PAGE = 30;

function when(at: number): string {
  const d = new Date(at);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd === today() ? "hari ini" : longDate(ymd)} ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

const STEPS = JOURNEY_STEPS;
function Steps({ p, v }: { p: Prospect; v: View }) {
  if (v.status === "dnc") return null;
  const at = journeyStep(p, v), c = statusColor(p, v);
  return (
    <ol className="sp-psteps" aria-label={`Tahap ${STEPS[at]}, ${at + 1} dari ${STEPS.length}`} style={{ "--k": c } as React.CSSProperties}>
      {STEPS.map((x, i) => <li key={x} className={i < at ? "done" : i === at ? "now" : undefined} aria-hidden="true"><span>{x}</span></li>)}
    </ol>
  );
}

// Last touch, chat-list style: a time today, "Kemarin", else the date.
const ago = (ms: number) => {
  const d = new Date(ms), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};
const profileOf = (p: Prospect) => p.url || (p.platform === "Threads" ? profileUrl(p.handle.replace(/^@/, "")) : p.platform === "IG" ? `https://www.instagram.com/${p.handle.replace(/^@/, "")}/` : "");

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
        {e.kind === "post" && e.url && <a href={e.url} target="_blank" rel="noreferrer" className="sp-tap" style={{ display: "inline-flex", alignItems: "center", padding: "4px 0", fontSize: 12, color: "var(--brand-text)" }}>Buka post ↗</a>}
      </div>
    </div>
  );
}

// The journey at a glance: ID, how long since the last touch, how many tries,
// how long they took to answer, and which campaigns already reached them.
function Summary({ p, on }: { p: Prospect; on: string }) {
  const h = p.history || [];
  const sent = h.filter(e => e.kind === "sent");
  const camps = Array.from(new Set(sent.map(e => e.campaign).filter(Boolean)));
  const since = p.lastSentAt ? daysBetween(p.lastSentAt, on) : null;
  const facts = [
    `ID ${p.id}`,
    sent.length ? `${sent.length} pesan` : "belum dikirimi",
    since !== null ? `kontak terakhir ${since === 0 ? "hari ini" : `${since} hari lalu`}` : "",
    p.firstReplyAt && p.firstSentAt ? `bales pertama ${daysBetween(p.firstSentAt, p.firstReplyAt)} hari setelah intro${p.attemptsToReply ? ` (kiriman ke-${p.attemptsToReply})` : ""}` : "",
    p.convertedAt ? `jadi ETB ${longDate(p.convertedAt)}` : "",
  ].filter(Boolean);
  return (
    <div style={{ fontSize: 12, color: "var(--app-sub)", padding: "8px 10px", borderRadius: 10, background: "var(--app-inner)", marginBottom: 8, lineHeight: 1.6 }}>
      {facts.join(" · ")}
      <div style={{ color: "var(--app-muted)" }}>Kampanye yang udah diterima: {camps.length ? camps.join(", ") : "belum ada"}</div>
    </div>
  );
}

export default function ProspectList({ prospects, ready, hunts, strategy, sessionId, filter, setFilter, onCompose, onOpen, query, embedded, focusId }: {
  prospects: Prospect[]; ready: boolean; hunts: Hunt[]; strategy: Strategy; sessionId?: string;
  filter: ProspectFilter; setFilter: (f: ProspectFilter) => void;
  onCompose: (p: Prospect, next: string[], from: ProspectFilter) => void;   // their page; next = who follows them in this list
  onOpen?: (p: Prospect) => void;   // the person's conversation
  query?: string;                   // a search box the page owns
  embedded?: boolean;               // inside Prospek: no box, title or search of its own
  focusId?: string | null;          // back from their page: their card open, in view, even if they left the filter
}) {
  const [ask, askSheet] = useConfirm();
  const space = useSpace();
  const [openId, setOpenId] = useState<string | null>(focusId ?? null);
  const [closed, setClosed] = useState<Prospect[] | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const on = today();
  const o = useOutcome({ strategy, sessionId, onMsg: setMsg, onLocked: () => { setClosed(null); setOpenId(null); } });

  useEffect(() => {
    if (focusId) document.getElementById(`pc-${focusId}`)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((filter === "DNC" || filter === "Arsip") && closed === null) loadClosed(space).then(setClosed).catch(() => setClosed([]));
  }, [filter, closed, space]);

  const rows = prospects.map(p => ({ p, v: view(p, on, strategy) }));
  const inFilter = (f: ProspectFilter) => rows.filter(({ p, v }) => {
    switch (f) {
      case "Antrian": return inQueue(p, on, strategy);
      case "Follow-up hari ini": return followUpDue(p, on, strategy);
      case "Diem 7+": { const q = silentDays(p, on); return q !== null && q >= 7 && !dropReady(p, on, strategy); }
      case "Baru": return v.status === "baru";
      case "Nunggu": return v.status === "intro" || v.status === "belum";
      case "Terhubung": return v.status === "terhubung" && p.result !== "data" && !v.parkedUntil;
      case "Siap dibuang": return dropReady(p, on, strategy);
      case "Parkir": return v.status === "tidak" || !!v.parkedUntil;
      case "ETB": return p.segment === "ETB";
      default: return false;
    }
  });
  // Search by ID, @username or name, across every journey, whatever the filter.
  const needle = (query ?? search).trim().toLowerCase().replace(/^@/, "");
  const hit = (p: Prospect) => [p.id, p.handle, p.name || ""].some(x => x.toLowerCase().replace(/^@/, "").includes(needle));
  const listed = needle
    ? [...rows, ...(closed || []).map(p => ({ p, v: view(p, on, strategy) }))].filter(({ p }) => hit(p))
    : filter === "DNC" || filter === "Arsip"
    ? (closed || []).filter(p => (filter === "Arsip") === !!p.archivedAt).map(p => ({ p, v: view(p, on, strategy) }))
    : inFilter(filter).sort((a, b) => filter === "Antrian" || filter === "Follow-up hari ini" ? (a.v.due || "").localeCompare(b.v.due || "") : (lastLine(b.p)?.at || b.p.updatedAt) - (lastLine(a.p)?.at || a.p.updatedAt));
  // Whoever was just handled stays on top of the list they came from, even
  // when the message moved them out of it (Diem 7+ after a follow-up).
  const pinned = !needle && focusId && !listed.some(r => r.p.id === focusId) ? rows.find(r => r.p.id === focusId) : undefined;
  const shown = pinned ? [pinned, ...listed] : listed;
  const unlinked = hunts.filter(h => !h.prospectId && h.target?.trim());

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

  const count = (f: ProspectFilter) => (f === "DNC" || f === "Arsip" ? (closed ? closed.filter(p => (f === "Arsip") === !!p.archivedAt).length : null) : inFilter(f).length);

  // Dropped after going quiet: archived, history kept, back with one tap.
  async function drop(ps: Prospect[]) {
    setBusy(true); setMsg("");
    try {
      const c = ctx();
      for (const p of ps) await saveProspect(space, p, archivePatch(p, `${silentDays(p, on) ?? strategy.dropDays} hari ga respon`, c));
      setClosed(null);
      setMsg(`${ps.length} prospek dibuang ke Arsip.`);
    } catch { setMsg("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    setBusy(false);
  }
  async function restore(p: Prospect) {
    setBusy(true);
    try { await saveProspect(space, p, restorePatch(p, ctx())); setClosed(null); setMsg(`${p.handle} dibalikin ke journey.`); }
    catch { setMsg("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    setBusy(false);
  }
  const dropping = filter === "Siap dibuang" ? inFilter("Siap dibuang").map(r => r.p) : [];

  return (
    <div id="journey-prospek" className={embedded ? "sp-plist" : undefined} style={embedded ? undefined : { ...card, padding: 20, marginBottom: 20 }}>
      {askSheet}
      {!embedded && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>Journey prospek</div>
        <div style={{ fontSize: 12, color: "var(--app-muted)" }}>{prospects.length} orang aktif</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>
        Satu orang satu journey. Belum dibales {strategy.gaps[0]} hari = Belum respon; {strategy.maxAttempts}× tanpa jawaban = Tidak terhubung, diparkir {strategy.parkDays} hari.
      </div>
      </>}

      {unlinked.length > 0 && (
        <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)", marginBottom: 12, fontSize: 12 }}>
          <span>{unlinked.length} DM lama belum punya journey.</span>
          <button onClick={backfill} disabled={busy} style={{ ...btnPrimary, padding: "8px 14px", fontSize: 12 }}>Gabungin jadi journey</button>
        </div>
      )}
      <div role="status" style={{ fontSize: 12, color: "var(--app-sub)", marginBottom: msg ? 10 : 0 }}>{msg}</div>

      {query === undefined && <input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE); }} aria-label="Cari prospek pakai ID atau @username"
        placeholder="Cari ID, @username, atau nama" style={{ ...inputStyle, fontSize: 16, marginBottom: 10 }} />}
      {needle && <div role="status" style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>{shown.length} ketemu buat “{(query ?? search).trim()}” di semua journey.</div>}

      {!needle && !embedded && <div role="group" aria-label="Saring prospek" className="sp-chiprow sp-pfilters" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 6 }}>
        {FILTERS.map(f => {
          const n = count(f);
          return (
            <button key={f} onClick={() => { setFilter(f); setLimit(PAGE); }} aria-pressed={filter === f}
              style={{ ...chip, flexShrink: 0, minHeight: 36, fontWeight: 700, ...(filter === f ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
              {f}{n ? <span> {n}</span> : null}
            </button>
          );
        })}
      </div>}

      {filter === "Siap dibuang" && dropping.length > 0 && !needle && (
        <div role="note" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)", margin: "4px 0 10px", fontSize: 13 }}>
          <span style={{ flex: "1 1 240px" }}>{dropping.length} orang diem {strategy.dropDays}+ hari sejak pesan terakhir. Dibuang = masuk Arsip, riwayat tetap ada, bisa dibalikin.</span>
          <button onClick={() => ask(`Buang ${dropping.length} prospek?`, "Mereka pindah ke Arsip dan ga muncul di antrian. Bisa dibalikin dari saringan Arsip.", () => drop(dropping), "Buang", "Membuang…")} disabled={busy}
            style={{ ...chip, minHeight: 40, fontWeight: 700, color: "color-mix(in srgb, #dc2626 55%, var(--app-text))", border: "1px solid #dc262640" }}>🗑 Buang semua ({dropping.length})</button>
        </div>
      )}
      {ready && shown.length === 0 && !needle && (
        <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "14px 0" }}>
          {filter === "Antrian" ? "Antrian kosong. Share post Threads ke SalesPal atau tempel link-nya buat nambah prospek."
            : filter === "DNC" ? (closed ? "Belum ada yang minta ga dihubungi." : "Memuat…")
            : filter === "Arsip" ? (closed ? "Arsip kosong." : "Memuat…")
            : filter === "Siap dibuang" ? `Ga ada yang diem ${strategy.dropDays}+ hari. Bagus.`
            : "Belum ada prospek di sini."}
        </div>
      )}

      {shown.slice(0, limit).map(({ p, v }) => {
        const open = openId === p.id;
        const who = p.name ? `${p.name} (${p.handle})` : p.handle;
        const post = [...(p.history || [])].reverse().find(e => e.kind === "post");
        const last = lastLine(p);
        const sub = [
          p.platform, p.segment,
          v.status === "intro" || v.status === "belum" ? `percobaan ${p.attempts}/${strategy.maxAttempts}` : "",
          (silentDays(p, on) ?? 0) >= 2 && !p.archivedAt ? `diem ${silentDays(p, on)} hari` : "",
          p.archivedAt ? `dibuang ${longDate(p.archivedAt)}` : "",
          v.due && v.status !== "dnc" ? (v.due <= on ? (v.due < on ? `telat sejak ${longDate(v.due)}` : "hari ini") : `${v.parkedUntil ? "parkir s.d." : "follow-up"} ${longDate(v.due)}`) : "",
        ].filter(Boolean).join(" · ");
        return (
          <div key={p.id} id={`pc-${p.id}`} className="sp-pcard">
            {/* One card per person: who and where, how far along, the last thing said. */}
            <div className="sp-pcard-top">
              <button className="sp-pcard-main" onClick={() => { setOpenId(open ? null : p.id); o.stop(); }} aria-expanded={open} aria-label={`Journey ${who}`}>
                <span className="sp-pini" aria-hidden="true" style={{ background: `color-mix(in srgb, ${statusColor(p, v)} 14%, var(--app-card))`, color: ink(statusColor(p, v)) }}>{(p.name || p.handle).replace(/^@/, "").slice(0, 2).toUpperCase()}</span>
                <span className="sp-pbody">
                  <span className="sp-phead"><span className="sp-pname">{p.name || p.handle}</span>{last && <span className="sp-ptime tabnum">{ago(last.at)}</span>}</span>
                  <span className="sp-psub"><span className="sp-pbadge" style={{ color: ink(statusColor(p, v)) }}>{statusLabel(p, v)}</span>{[p.name ? p.handle : "", sub].filter(Boolean).map(x => ` · ${x}`).join("")}</span>
                  {!open && <span className="sp-plast">{last ? `${last.who === "kamu" ? "Kamu: " : last.who === "dia" ? "Dia: " : ""}${last.text.replace(/\s+/g, " ")}` : "Belum ada pesan"}</span>}
                  <Steps p={p} v={v} />
                </span>
              </button>
              {profileOf(p) && <a className="sp-pprofile" href={profileOf(p)} target="_blank" rel="noreferrer" aria-label={`Buka profil ${who} di ${p.platform}`} title={`Buka profil di ${p.platform}`}><Icon name="arrowUpRight" size={18} /></a>}
            </div>

            {open && (
              <div role="region" aria-label={`Riwayat ${who}`} style={{ marginTop: 10 }}>
                <Summary p={p} on={on} />
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

                {p.archivedAt ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--app-sub)" }}>Dibuang {longDate(p.archivedAt)}{p.archiveReason ? ` · ${p.archiveReason}` : ""}.</span>
                    <button onClick={() => restore(p)} disabled={busy} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)" }}>↩ Balikin</button>
                    {onOpen && <button onClick={() => onOpen(p)} style={{ ...chip, minHeight: 36 }}>💬 Percakapan</button>}
                  </div>
                ) : v.status === "dnc" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--app-sub)" }}>Minta ga dihubungi sejak {p.dncAt ? longDate(p.dncAt) : "—"}{p.remark ? ` · ${p.remark}` : ""}.</span>
                    <button onClick={() => ask(`Hapus ${who} dari daftar Jangan dihubungi?`, "Kalau post-nya di-share lagi, dia masuk sebagai prospek baru.", async () => { await removeProspect(space, p); setClosed(null); })} style={{ ...chip, minHeight: 36 }}>Hapus dari daftar</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      {onOpen && <button onClick={() => onOpen(p)} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>💬 Percakapan</button>}
                      {dropReady(p, on, strategy) && <button onClick={() => ask(`Buang ${who}?`, "Pindah ke Arsip, riwayat tetap ada, bisa dibalikin.", () => drop([p]), "Buang", "Membuang…")} style={{ ...chip, minHeight: 36 }}>🗑 Buang</button>}
                      <button onClick={() => { const ids = shown.map(r => r.p.id); onCompose(p, ids.slice(ids.indexOf(p.id) + 1), filter); }} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)", border: "1px solid #005eb060" }}>{v.status === "baru" ? "✉ Kirim intro" : v.status === "belum" ? "↻ Follow-up" : "✉ Kirim pesan"}</button>
                      <button onClick={() => o.edit(p, "reply")} aria-pressed={o.editing?.id === p.id && o.editing.kind === "reply"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>💬 Dibales</button>
                      {(post?.url || p.url) && <a href={post?.url || p.url} target="_blank" rel="noreferrer" className="sp-tap" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>{post?.url ? "Buka post ↗" : "Buka profil ↗"}</a>}
                      <button onClick={() => o.edit(p, "note")} style={{ ...chip, minHeight: 36 }}>📝 Catatan</button>
                      <button onClick={() => ask(`Hapus journey ${who}?`, "Log DM-nya tetap ada.", () => removeProspect(space, p))} aria-label={`Hapus journey ${who}`} style={{ ...chip, minHeight: 36, marginLeft: "auto", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>🗑 Hapus</button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", margin: "10px 0 6px" }}>Hasil (otomatis dihitung dibales)</div>
                    {o.results(p, who)}
                  </>
                )}

                {o.editor(p)}
              </div>
            )}
          </div>
        );
      })}
      {shown.length > limit && <button onClick={() => setLimit(limit + PAGE)} style={{ ...chip, width: "100%", marginTop: 8, minHeight: 40 }}>Tampilkan {Math.min(PAGE, shown.length - limit)} lagi</button>}

      {o.sheet}
    </div>
  );
}
