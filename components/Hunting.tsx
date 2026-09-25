"use client";

import { useEffect, useRef, useState } from "react";
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addDays, daysBetween, longDate, today, useUserCollection } from "@/lib/billing";
import {
  HUNT_STATUS, Hunt, HuntStatus, MIN_SAMPLE, PLATFORMS, STALE_DAYS, PitchTemplate, Platform,
  fill, waLinkFor, huntColor, huntIcon, isStale, parseProfile, pct, platformSource, responded, scoreTemplates, verdict,
} from "@/lib/hunting";
import ThreadsRadar from "@/components/ThreadsRadar";
import { profileUrl } from "@/lib/threads";
import { badge, btnMuted, btnPrimary, btnWA, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

type Filter = "Semua" | "Follow-up" | "Tertarik";
const PAGE = 30;

export default function Hunting({ uid, hunts, goal }: { uid: string; hunts: Hunt[]; goal: number }) {
  const templates = useUserCollection<PitchTemplate>(uid, "pitchTemplates").slice().sort((a, b) => a.title.localeCompare(b.title));
  const [target, setTarget] = useState("");
  const [platform, setPlatform] = useState<Platform>("IG");
  const [pending, setPending] = useState<PitchTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PitchTemplate | null>(null);
  const [noting, setNoting] = useState<{ id: string; note: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("Semua");
  const [limit, setLimit] = useState(PAGE);
  const [url, setUrl] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");
  const targetRef = useRef<HTMLInputElement>(null);

  function apply(text: string) {
    const p = parseProfile(text);
    if (!p) return false;
    setTarget(p.target);
    if (p.platform) setPlatform(p.platform);
    setUrl(p.url || "");
    return true;
  }

  // Opened from a share or a bookmarklet: /dashboard?hunt&target=…&platform=…&url=…
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("hunt")) return;
    const from = q.get("url") || q.get("target") || "";
    if (from) apply(from);
    const pl = q.get("platform");
    if (pl && (PLATFORMS as readonly string[]).includes(pl)) setPlatform(pl as Platform);
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // From the Radar: this person, on Threads, ready for a message.
  function targetFromRadar(username: string) {
    setTarget(`@${username}`);
    setPlatform("Threads");
    setUrl(profileUrl(username));
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    targetRef.current?.focus({ preventScroll: true });
  }

  async function pasteLink() {
    setPasteMsg("");
    try {
      const text = await navigator.clipboard.readText();
      if (!apply(text)) setPasteMsg("Clipboard kosong. Copy link profil dulu di Threads/IG.");
    } catch {
      setPasteMsg("Browser nggak izinkan baca clipboard. Tahan kolom Target lalu Tempel.");
      targetRef.current?.focus();
    }
  }

  const now = today();
  const weekAgo = addDays(now, -6);
  const sorted = hunts.slice().sort((a, b) => b.createdAt - a.createdAt);
  const sentToday = hunts.filter(h => h.date === now).length;
  const week = hunts.filter(h => h.date >= weekAgo);
  const weekReplied = week.filter(responded).length;
  const weekInterested = week.filter(h => h.status === "Tertarik").length;
  const stale = sorted.filter(h => isStale(h, now));
  const interested = sorted.filter(h => h.status === "Tertarik");
  const shown = filter === "Follow-up" ? stale : filter === "Tertarik" ? interested : sorted;
  const scores = scoreTemplates(hunts, templates);
  const advice = verdict(scores);
  const reasons = sorted.filter(h => h.status === "Ditolak" && h.note.trim()).slice(0, 5);

  function pick(t: PitchTemplate, how: "copy" | "wa") {
    const text = fill(t.body, target);
    if (how === "copy") {
      navigator.clipboard?.writeText(text).catch(() => {});
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(c => (c === t.id ? null : c)), 1800);
    } else {
      window.open(waLinkFor(target, text), "_blank");
    }
    setPending(t);
  }

  async function logSent() {
    if (!pending) return;
    const id = `hunt_${Date.now()}`;
    const h: Omit<Hunt, "id"> = {
      target: target.trim(), platform, templateId: pending.id, templateTitle: pending.title,
      status: "Terkirim", note: "", date: now, createdAt: Date.now(), ...(url ? { url } : {}),
    };
    setPending(null);
    setTarget("");
    setUrl("");
    targetRef.current?.focus();
    await setDoc(doc(db, "users", uid, "hunts", id), h);
  }

  async function setStatus(h: Hunt, status: HuntStatus) {
    if (status === "Ditolak") setNoting({ id: h.id, note: h.note });
    await updateDoc(doc(db, "users", uid, "hunts", h.id), { status });
  }

  async function saveNote() {
    if (!noting) return;
    await updateDoc(doc(db, "users", uid, "hunts", noting.id), { note: noting.note.trim() });
    setNoting(null);
  }

  async function makeLead(h: Hunt) {
    const leadId = `lead_${Date.now()}`;
    const note = [`Dari Hunting (${h.platform}) · template "${h.templateTitle}"`, h.note].filter(Boolean).join(" — ");
    await setDoc(doc(db, "users", uid, "leads", leadId), {
      name: h.target || "Tanpa nama", contact: "", source: platformSource[h.platform], status: "Warm", score: 70,
      email: "", phone: "", category: "F&B", notes: note, lastContact: now, value: 0,
    });
    await updateDoc(doc(db, "users", uid, "hunts", h.id), { leadId });
  }

  async function remove(h: Hunt) {
    if (!confirm(`Hapus catatan DM ke ${h.target || "target ini"}?`)) return;
    await deleteDoc(doc(db, "users", uid, "hunts", h.id));
  }

  function followUp(h: Hunt) {
    setTarget(h.target);
    setPlatform(h.platform);
    window.scrollTo({ top: 0, behavior: "smooth" });
    targetRef.current?.focus();
  }

  async function changeGoal() {
    const v = prompt("Target DM per hari?", String(goal));
    const n = parseInt(v || "", 10);
    if (!n || n < 1) return;
    await setDoc(doc(db, "users", uid, "settings", "hunting"), { dailyGoal: n }, { merge: true });
  }

  async function saveTemplate() {
    if (!editing || !editing.title.trim() || !editing.body.trim()) return;
    const id = editing.id || `tpl_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "pitchTemplates", id), { title: editing.title.trim(), body: editing.body.trim() });
    setEditing(null);
  }

  const progress = Math.min(1, sentToday / goal);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={heading}>Hunting Mode</div>
        <div style={subheading}>Kirim DM, catat hasilnya sekali tap, dan lihat pesan mana yang beneran dibales.</div>
      </div>

      {/* Today at a glance */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 20 }}>
        <button onClick={changeGoal} aria-label={`Hari ini ${sentToday} dari ${goal} DM. Ubah target harian`} style={{ ...card, padding: 12, textAlign: "left", cursor: "pointer", color: "inherit", fontFamily: font }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: progress >= 1 ? "var(--ok)" : "#005eb0" }}>{sentToday}<span style={{ fontSize: 13, color: "var(--app-muted)", fontWeight: 600 }}> / {goal}</span></div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>DM hari ini</div>
          <div style={{ height: 4, background: "var(--app-inner)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", background: progress >= 1 ? "var(--ok)" : "#005eb0" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 6 }}>{progress >= 1 ? "Tercapai 🎯" : "Ubah target"}</div>
        </button>
        <div style={{ ...card, padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{week.length ? pct(weekReplied / week.length) : "—"}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>Dibales 7 hari</div>
          <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 4 }}>{weekReplied} dari {week.length} DM</div>
        </div>
        <div style={{ ...card, padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ok)" }}>{weekInterested}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>Tertarik 7 hari</div>
          <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 4 }}>{interested.filter(h => !h.leadId).length} belum jadi lead</div>
        </div>
      </div>

      <ThreadsRadar uid={uid} hunts={hunts} onTarget={targetFromRadar} />

      {/* The hunt itself: who, where, which message */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <label htmlFor="hunt-target" style={label}>Target</label>
        <div style={{ display: "flex", gap: 8, marginBottom: pasteMsg || url ? 6 : 12 }}>
          <input id="hunt-target" ref={targetRef} value={target}
            onChange={e => { const v = e.target.value; if (!(/https?:\/\//.test(v) && apply(v))) { setTarget(v); if (!v) setUrl(""); } }}
            placeholder="@akun, atau tempel link profil" autoComplete="off" style={{ ...inputStyle, fontSize: 16 }} />
          <button onClick={pasteLink} aria-label="Tempel link profil dari clipboard" style={{ ...chip, flexShrink: 0, minHeight: 44, padding: "0 12px", fontSize: 12, fontWeight: 700, color: "var(--app-text)" }}>📋 Tempel link</button>
        </div>
        {url && <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🔗 {url}</div>}
        {pasteMsg && <div role="status" style={{ fontSize: 11, color: "#ff9900", marginBottom: 12 }}>{pasteMsg}</div>}
        <div role="radiogroup" aria-label="Platform" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {PLATFORMS.map(p => (
            <button key={p} role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)}
              style={{ ...chip, minHeight: 36, padding: "8px 14px", fontSize: 12, fontWeight: 700, ...(platform === p ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
              {p}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Pilih pesan</div>
          <button onClick={() => setEditing({ id: "", title: "", body: "" })} style={chip}>+ Template</button>
        </div>
        {templates.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "8px 0" }}>Belum ada template. Tambah satu dulu, pakai <code>{"{nama}"}</code> untuk nama target.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {templates.map(t => {
            const s = scores.find(x => x.templateId === t.id);
            const active = pending?.id === t.id;
            return (
              <div key={t.id} style={{ background: "var(--app-inner)", border: `1px solid ${active ? "#005eb0" : "var(--app-border)"}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                  <button onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`} style={{ ...chip, padding: "2px 8px" }}>✎</button>
                </div>
                {s && <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 6 }}>{s.sent} terkirim · dibales {pct(s.responseRate)} · tertarik {pct(s.winRate)}</div>}
                <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12, flex: 1 }}>{fill(t.body, target)}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => pick(t, "copy")} style={{ ...chip, flex: 1, minHeight: 40, fontSize: 12, fontWeight: 700, color: copiedId === t.id ? "var(--ok)" : "var(--app-text)", border: `1px solid ${copiedId === t.id ? "var(--ok)" : "var(--app-border)"}` }}>
                    {copiedId === t.id ? "✓ Tersalin" : "Copy"}
                  </button>
                  <button onClick={() => pick(t, "wa")} style={{ ...btnWA, flex: 1, minHeight: 40, padding: "8px", fontSize: 12 }}>Kirim WA</button>
                </div>
              </div>
            );
          })}
        </div>

        {pending && (
          <div role="status" style={{ marginTop: 14, padding: 14, borderRadius: 12, background: "#005eb014", border: "1px solid #005eb050", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, flex: "1 1 200px" }}>
              Udah dikirim ke <b>{target.trim() || "target"}</b> via {platform}? Pesan: <b>{pending.title}</b>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={logSent} style={{ ...btnPrimary, minHeight: 44 }}>📤 Catat terkirim</button>
              <button onClick={() => setPending(null)} aria-label="Batal catat" style={{ ...btnMuted, minHeight: 44, padding: "11px 14px" }}>×</button>
            </div>
          </div>
        )}
      </div>

      {/* Log */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>Log DM</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([["Semua", sorted.length], ["Follow-up", stale.length], ["Tertarik", interested.length]] as [Filter, number][]).map(([f, n]) => (
              <button key={f} onClick={() => { setFilter(f); setLimit(PAGE); }} aria-pressed={filter === f}
                style={{ ...chip, fontWeight: 700, ...(filter === f ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
                {f} {n > 0 && <span style={{ opacity: 0.75 }}>{n}</span>}
              </button>
            ))}
          </div>
        </div>
        {filter === "Follow-up" && stale.length > 0 && <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 8 }}>Terkirim {STALE_DAYS}+ hari tanpa balasan. Follow-up sekali, kalau tetap diam tandai 👻.</div>}
        {shown.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "16px 0" }}>
            {filter === "Semua" ? "Belum ada DM. Isi target, pilih pesan, Copy, lalu Catat terkirim." : filter === "Follow-up" ? "Nggak ada yang nunggu follow-up." : "Belum ada yang tertarik. Terus kirim 💪"}
          </div>
        )}
        {shown.slice(0, limit).map(h => {
          const age = daysBetween(h.date, now);
          return (
            <div key={h.id} style={{ padding: "12px 0", borderTop: "1px solid var(--app-inner)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.target || "Tanpa nama"}</div>
                  <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>
                    {h.platform} · {h.templateTitle} · {age === 0 ? "hari ini" : age === 1 ? "kemarin" : longDate(h.date)}
                  </div>
                  {h.note && <div style={{ fontSize: 11, color: "var(--app-sub)", marginTop: 4 }}>“{h.note}”</div>}
                </div>
                <span style={badge(huntColor[h.status])}>{huntIcon[h.status]} {h.status}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                {HUNT_STATUS.filter(s => s !== h.status).map(s => (
                  <button key={s} onClick={() => setStatus(h, s)} aria-label={`Tandai ${s}`} title={s}
                    style={{ ...chip, minWidth: 40, minHeight: 36, fontSize: 14, padding: "4px 8px" }}>{huntIcon[s]}</button>
                ))}
                {isStale(h, now) && <button onClick={() => followUp(h)} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "#ff9900", border: "1px solid #ff990060" }}>↻ Follow-up</button>}
                {h.status === "Tertarik" && !h.leadId && <button onClick={() => makeLead(h)} style={{ ...chip, minHeight: 36, background: "#00a862", color: "#fff", border: "none", fontWeight: 700 }}>Jadiin Lead →</button>}
                {h.leadId && <span style={{ fontSize: 11, color: "var(--ok)", fontWeight: 700 }}>✓ Sudah jadi lead</span>}
                {h.url && <a href={h.url} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>Profil ↗</a>}
                {h.status === "Ditolak" && noting?.id !== h.id && <button onClick={() => setNoting({ id: h.id, note: h.note })} style={chip}>{h.note ? "Ubah alasan" : "+ Alasan"}</button>}
                <button onClick={() => remove(h)} aria-label={`Hapus DM ke ${h.target || "target"}`} style={{ ...chip, minHeight: 36, color: "#ff4444", border: "1px solid #ff444440" }}>🗑</button>
              </div>
              {noting?.id === h.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input autoFocus value={noting.note} onChange={e => setNoting({ ...noting, note: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") setNoting(null); }}
                    placeholder="Alasan nolak (opsional), mis. udah punya fotografer" aria-label="Alasan ditolak" style={{ ...inputStyle, fontSize: 16, padding: "8px 12px" }} />
                  <button onClick={saveNote} style={{ ...btnPrimary, padding: "8px 14px" }}>Simpan</button>
                  <button onClick={() => setNoting(null)} aria-label="Lewati" style={{ ...btnMuted, padding: "8px 12px" }}>×</button>
                </div>
              )}
            </div>
          );
        })}
        {shown.length > limit && <button onClick={() => setLimit(limit + PAGE)} style={{ ...chip, width: "100%", marginTop: 8, minHeight: 40 }}>Tampilkan {Math.min(PAGE, shown.length - limit)} lagi</button>}
      </div>

      {/* Which message works */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Pesan mana yang works?</div>
        <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 14 }}>Dibales = dijawab apa pun, termasuk ditolak. Tertarik = mau lanjut. Angka mulai bisa dipercaya setelah {MIN_SAMPLE} DM per template.</div>
        {advice && <div style={{ fontSize: 12, padding: 12, borderRadius: 10, background: "#f59e0b14", border: "1px solid #f59e0b50", marginBottom: 14 }}>💡 {advice}</div>}
        {scores.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Belum ada data. Catat beberapa DM dulu.</div>}
        {scores.map(s => (
          <div key={s.templateId} style={{ padding: "10px 0", borderTop: "1px solid var(--app-inner)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "var(--app-muted)", flexShrink: 0 }}>{s.sent} DM{s.sent < MIN_SAMPLE ? " · sampel kecil" : ""}</div>
            </div>
            {([["Dibales", s.responseRate, "#f59e0b"], ["Tertarik", s.winRate, "#00a862"]] as [string, number, string][]).map(([k, r, c]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: "var(--app-muted)", width: 56 }}>{k}</div>
                <div style={{ flex: 1, height: 6, background: "var(--app-inner)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r * 100}%`, height: "100%", background: c }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, width: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(r)}</div>
              </div>
            ))}
          </div>
        ))}
        {reasons.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Alasan ditolak terakhir</div>
            {reasons.map(h => <div key={h.id} style={{ fontSize: 12, color: "var(--app-sub)", padding: "3px 0" }}>“{h.note}” <span style={{ color: "var(--app-muted)" }}>· {h.templateTitle}</span></div>)}
          </div>
        )}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 460 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>{editing.id ? "Edit template" : "Template baru"}</div>
            <label htmlFor="tpl-title" style={label}>Judul</label>
            <input id="tpl-title" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="mis. Cold DM Cafe" style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
            <label htmlFor="tpl-body" style={label}>Isi pesan · <code>{"{nama}"}</code> diganti nama target</label>
            <textarea id="tpl-body" value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} placeholder="Halo {nama}! ..." style={{ ...inputStyle, fontSize: 16, height: 140, resize: "vertical", marginBottom: 16 }} />
            {editing.id && <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 12 }}>Kalau isinya berubah banyak, mending bikin template baru supaya angka evaluasinya nggak kecampur.</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveTemplate} disabled={!editing.title.trim() || !editing.body.trim()} style={{ ...btnPrimary, opacity: editing.title.trim() && editing.body.trim() ? 1 : 0.5 }}>SIMPAN</button>
              <button onClick={() => setEditing(null)} style={btnMuted}>BATAL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
