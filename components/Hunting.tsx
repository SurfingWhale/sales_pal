"use client";

import { type Dispatch, type SetStateAction, useEffect, useLayoutEffect, useRef, useState } from "react";
import { deleteDoc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { addDays, daysBetween, longDate, today, useSpaceCollection } from "@/lib/billing";
import { canEditCatalog, spaceDoc, stamp, useSpace } from "@/lib/space";
import {
  HUNT_STATUS, Hunt, HuntStatus, MIN_SAMPLE, PLATFORMS, STALE_DAYS, PitchTemplate, Platform,
  fill, waLinkFor, huntColor, huntIcon, isStale, parseProfile, pct, platformSource, responded, scoreTemplates, verdict,
} from "@/lib/hunting";
import ThreadsRadar from "@/components/ThreadsRadar";
import ProspectList, { ProspectFilter } from "@/components/ProspectList";
import Campaigns from "@/components/Campaigns";
import HunterStats from "@/components/HunterStats";
import { TOPICS, Tone, defaultTopic, fromLibrary, repliesFor } from "@/lib/replies";
import { profileUrl } from "@/lib/threads";
import {
  Channel, HuntSession, Prospect, Strategy, newProspect, patchFromHunt, postPatch, prospectId, sessionMinutes,
  statusColor, statusLabel, threadsPostLink, view,
} from "@/lib/prospects";
import { HuntInbox, bump, createProspect, ctx, recordSend, saveProspect, unfurl, useHuntInbox } from "@/lib/prospectStore";
import { badge, btnMuted, btnPrimary, btnWA, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

type Filter = "Semua" | "Follow-up" | "Tertarik";
const PAGE = 30;

export interface HuntingSession {
  prospects: Prospect[];
  ready: boolean;
  strategy: Strategy;
  live: HuntSession | null;
  sessions: HuntSession[];
  start: () => Promise<void>;
  end: () => Promise<void>;
}

export default function Hunting({ hunts, goal, onOpenScripts, journey }: { hunts: Hunt[]; goal: number; onOpenScripts?: () => void; journey: HuntingSession }) {
  const space = useSpace();
  const canEdit = canEditCatalog(space);
  const { prospects, strategy, live } = journey;
  const templates = useSpaceCollection<PitchTemplate>(space, "pitchTemplates").slice().sort((a, b) => a.title.localeCompare(b.title));
  const [target, setTarget] = useState("");
  const [platform, setPlatform] = useState<Platform>("IG");
  const [channel, setChannel] = useState<Channel>("dm");
  const [source, setSource] = useState<Prospect["source"]>({ kind: "manual" });
  const [blocked, setBlocked] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  const [prospectFilter, setProspectFilter] = useState<ProspectFilter>("Antrian");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PitchTemplate | null>(null);
  const [noting, setNoting] = useState<{ id: string; note: string } | null>(null);
  const [replyFor, setReplyFor] = useState<{ id: string; topic: string; tone: Tone } | null>(null);
  const [copiedReply, setCopiedReply] = useState<string | null>(null);
  const [copyFail, setCopyFail] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("Semua");
  const [limit, setLimit] = useState(PAGE);
  const [url, setUrl] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");
  const targetRef = useRef<HTMLInputElement>(null);
  const topicsRef = useRef<HTMLDivElement>(null);

  function apply(text: string) {
    const post = threadsPostLink(text);
    if (post) { openPost(post); return true; }
    const p = parseProfile(text);
    if (!p) return false;
    setTarget(p.target);
    if (p.platform) setPlatform(p.platform);
    setUrl(p.url || "");
    setSource({ kind: "manual" });
    setChannel("dm");
    return true;
  }

  // A Threads post shared or pasted: who wrote it and what, then their journey
  // (a new prospect, or the post added to the one they have).
  async function openPost(link: string) {
    const guess = link.match(/threads\.(?:com|net)\/(@[A-Za-z0-9._]+)\/post\//)?.[1];
    if (guess) { setTarget(guess); setPlatform("Threads"); setUrl(profileUrl(guess.slice(1))); }
    setPasteMsg("Membuka post…");
    const r = await unfurl(link);
    if ("error" in r) {
      // The words are lost, the person isn't: the post still counts as the source.
      if (guess) { setSource({ kind: "post", url: link.split("?")[0] }); setChannel("post"); }
      setPasteMsg(guess ? "" : r.error);
      if (!guess) targetRef.current?.focus();
      return;
    }
    const handle = r.handle;
    const profile = profileUrl(handle.slice(1));
    setTarget(handle); setPlatform("Threads"); setUrl(profile); setChannel("post");
    const src: Prospect["source"] = { kind: "post", url: r.postUrl || link, ...(r.postId ? { postId: r.postId } : {}), ...(r.text ? { text: r.text } : {}) };
    setSource(src);
    const id = prospectId("Threads", handle);
    const c = ctx(live?.id);
    try {
      const snap = await getDoc(spaceDoc(space, "prospects", id)).catch(() => null);
      const had = snap?.exists() ? ({ id, ...snap.data() } as Prospect) : undefined;
      if (had?.contact === "dnc") { setBlocked(id); setPasteMsg(""); return; }
      if (had) await saveProspect(space, had, postPatch(had, src, r.name, c));
      else {
        await createProspect(space, id, newProspect({ platform: "Threads", handle, name: r.name || undefined, url: profile, source: src }, c));
        bump(space, live?.id, "prospects");
      }
      setPasteMsg("");
    } catch {
      setPasteMsg("Post kebaca, tapi gagal disimpan. Cek koneksi.");
    }
  }

  // Someone who asked not to be contacted stays that way, whoever types their name.
  const curId = target.trim() ? prospectId(platform, target) : "";
  const cur = curId ? prospects.find(p => p.id === curId) : undefined;
  useEffect(() => {
    if (!curId || cur) { setBlocked(null); return; }
    const t = setTimeout(() => {
      getDoc(spaceDoc(space, "prospects", curId)).then(s => setBlocked(s.exists() && s.data()?.contact === "dnc" ? curId : null), () => setBlocked(null));
    }, 400);
    return () => clearTimeout(t);
  }, [curId, cur, space]);
  const isBlocked = blocked === curId && !!curId;
  const curPost = cur ? [...(cur.history || [])].reverse().find(e => e.kind === "post") : undefined;

  // The bar's paste button and its queue land here.
  useHuntInbox((m: HuntInbox) => {
    if (m.kind === "link") {
      if (!apply(m.text)) setPasteMsg("Clipboard nggak berisi link. Copy link post/profil dulu.");
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setProspectFilter("Antrian");
      setTimeout(() => document.getElementById("journey-prospek")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  });

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

  // Balas cepat: on a phone the guessed topic can sit past the edge of the chip row.
  useLayoutEffect(() => {
    const row = topicsRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip) return;
    const r = row.getBoundingClientRect(), c = chip.getBoundingClientRect();
    if (c.left < r.left || c.right > r.right) row.scrollLeft += c.left - r.left - (r.width - c.width) / 2;
  }, [replyFor?.id, replyFor?.topic]);

  // From the Radar: this person, on Threads, ready for a message.
  function targetFromRadar(username: string) {
    setTarget(`@${username}`);
    setPlatform("Threads");
    setUrl(profileUrl(username));
    setSource({ kind: "radar" });
    setChannel("dm");
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

  // "Tersalin" only once the clipboard has it; otherwise say how to copy by hand.
  function copy(text: string, key: string, setCopied: Dispatch<SetStateAction<string | null>>) {
    setCopyFail(null);
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      () => { setCopied(key); setTimeout(() => setCopied(c => (c === key ? null : c)), 1800); },
      () => setCopyFail(key),
    );
  }

  // Copy or Kirim WA is the send (PRD-008 D1): it goes in the log and the
  // person's journey at once, with five seconds to take it back.
  function pick(t: PitchTemplate, how: "copy" | "wa") {
    if (isBlocked) return;
    const text = fill(t.body, target);
    if (how === "copy") {
      copy(text, t.id, setCopiedId);
    } else {
      window.open(waLinkFor(target, text), "_blank");
    }
    if (!target.trim()) {
      setPasteMsg("Isi target dulu biar kecatat.");
      targetRef.current?.focus();
      return;
    }
    logSent(t, text, how);
  }

  async function logSent(t: PitchTemplate, text: string, how: "copy" | "wa") {
    const who = target.trim();
    const ch: Channel = curPost || source.kind === "post" ? channel : "dm";
    try {
      const back = await recordSend(space, {
        target: who, platform, url: url || undefined, templateId: t.id, templateTitle: t.title, text, channel: ch,
        source: cur ? undefined : source,
      }, cur, live?.id, strategy);
      setTarget("");
      setUrl("");
      setSource({ kind: "manual" });
      setChannel("dm");
      targetRef.current?.focus();
      const entry = { label: `Tercatat: ${how === "wa" ? "WA" : ch === "post" ? "balasan di post" : "DM"} ke ${who}`, run: back };
      setUndo(entry);
      setTimeout(() => setUndo(u => (u?.run === back ? null : u)), 5000);
    } catch {
      setPasteMsg("Pesan tersalin, tapi gagal dicatat. Cek koneksi lalu kirim ulang.");
    }
  }

  async function takeBack() {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    await u.run();
  }

  // The journey hears what the DM log was told.
  function syncProspect(h: Hunt, status: HuntStatus, note: string) {
    const p = h.prospectId ? prospects.find(x => x.id === h.prospectId) : undefined;
    if (!p) return;
    const patch = patchFromHunt(p, status, note, ctx(live?.id), strategy);
    if (patch) saveProspect(space, p, patch).then(() => { if (p.contact !== "terhubung") bump(space, live?.id, "replies"); }, () => undefined);
  }

  async function setStatus(h: Hunt, status: HuntStatus) {
    if (status === "Ditolak") setNoting({ id: h.id, note: h.note });
    // An open Balas cepat follows the new status; back at Terkirim there is nothing to answer.
    setReplyFor(r => (r?.id !== h.id ? r : status === "Terkirim" ? null : { ...r, topic: defaultTopic(status, h.note) }));
    await updateDoc(spaceDoc(space, "hunts", h.id), { status });
    syncProspect(h, status, h.note);
  }

  async function saveNote() {
    if (!noting) return;
    // A reason is only asked for on Ditolak; a new one can change the guessed objection.
    setReplyFor(r => (r?.id === noting.id ? { ...r, topic: defaultTopic("Ditolak", noting.note) } : r));
    await updateDoc(spaceDoc(space, "hunts", noting.id), { note: noting.note.trim() });
    const h = hunts.find(x => x.id === noting.id);
    if (h && noting.note.trim()) syncProspect(h, "Ditolak", noting.note.trim());
    setNoting(null);
  }

  async function makeLead(h: Hunt) {
    const leadId = `lead_${Date.now()}`;
    const note = [`Dari Hunting (${h.platform}) · template "${h.templateTitle}"`, h.note].filter(Boolean).join(" — ");
    await setDoc(spaceDoc(space, "leads", leadId), stamp(space, {
      name: h.target || "Tanpa nama", contact: "", source: platformSource[h.platform], status: "Warm", score: 70,
      email: "", phone: "", category: "F&B", notes: note, lastContact: now, value: 0,
    }, h as { ownerUid?: string; ownerName?: string }));
    await updateDoc(spaceDoc(space, "hunts", h.id), { leadId });
    const p = h.prospectId ? prospects.find(x => x.id === h.prospectId) : undefined;
    if (p && !p.leadId) saveProspect(space, p, { leadId, updatedAt: Date.now() }).catch(() => undefined);
  }

  // From a journey: this person, ready for the next message.
  function compose(p: Prospect) {
    setTarget(p.handle);
    setPlatform(p.platform);
    setUrl(p.url || "");
    setSource(p.source || { kind: "manual" });
    setChannel(view(p, now, strategy).status === "baru" && (p.history || []).some(e => e.kind === "post") ? "post" : "dm");
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    targetRef.current?.focus({ preventScroll: true });
  }

  async function remove(h: Hunt) {
    if (!confirm(`Hapus catatan DM ke ${h.target || "target ini"}?`)) return;
    await deleteDoc(spaceDoc(space, "hunts", h.id));
  }

  function followUp(h: Hunt) {
    setTarget(h.target);
    setPlatform(h.platform);
    window.scrollTo({ top: 0, behavior: "smooth" });
    targetRef.current?.focus();
  }

  async function changeGoal() {
    if (!canEdit) return;
    const v = prompt("Target DM per hari?", String(goal));
    const n = parseInt(v || "", 10);
    if (!n || n < 1) return;
    await setDoc(spaceDoc(space, "settings", "hunting"), { dailyGoal: n }, { merge: true });
  }

  async function saveTemplate() {
    if (!editing || !editing.title.trim() || !editing.body.trim() || !canEdit) return;
    const id = editing.id || `tpl_${Date.now()}`;
    await setDoc(spaceDoc(space, "pitchTemplates", id), { title: editing.title.trim(), body: editing.body.trim() });
    setEditing(null);
  }

  const progress = Math.min(1, sentToday / goal);
  const lastSession = journey.sessions.find(x => x.endedAt) || null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <div style={heading}>Hunting Mode</div>
          <div style={subheading}>Kirim DM, catat hasilnya sekali tap, dan lihat pesan mana yang beneran dibales.</div>
          {!live && lastSession && (
            <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 6 }}>
              Sesi terakhir: {Math.round(sessionMinutes(lastSession, Date.now()))} menit · {lastSession.counts?.intros || 0} intro · {lastSession.counts?.replies || 0} dibales · {lastSession.counts?.converted || 0} data
              {sessionMinutes(lastSession, Date.now()) >= 10 ? ` · ${((lastSession.counts?.intros || 0) / (sessionMinutes(lastSession, Date.now()) / 60)).toFixed(1)} intro/jam` : ""}
            </div>
          )}
        </div>
        {live
          ? <button onClick={journey.end} style={{ ...btnMuted, minHeight: 44 }}>■ Akhiri sesi</button>
          : <button onClick={journey.start} style={{ ...btnPrimary, minHeight: 44, background: "#b93a06" }}>▶ Mulai hunting</button>}
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
          <div style={{ fontSize: 22, fontWeight: 700, color: "color-mix(in srgb, #f59e0b 55%, var(--app-text))" }}>{week.length ? pct(weekReplied / week.length) : "—"}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>Dibales 7 hari</div>
          <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 4 }}>{weekReplied} dari {week.length} DM</div>
        </div>
        <div style={{ ...card, padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ok)" }}>{weekInterested}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>Tertarik 7 hari</div>
          <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 4 }}>{interested.filter(h => !h.leadId).length} belum jadi lead</div>
        </div>
      </div>

      <ThreadsRadar uid={space.me.uid} hunts={hunts} onTarget={targetFromRadar} />

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
        {pasteMsg && <div role="status" style={{ fontSize: 11, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginBottom: 12 }}>{pasteMsg}</div>}
        <div role="radiogroup" aria-label="Platform" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {PLATFORMS.map(p => (
            <button key={p} role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)}
              style={{ ...chip, minHeight: 36, padding: "8px 14px", fontSize: 12, fontWeight: 700, ...(platform === p ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
              {p}
            </button>
          ))}
        </div>

        {isBlocked && (
          <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#ff44441a", border: "1px solid #ff444460", fontSize: 12, marginBottom: 16 }}>
            <b>{target.trim()}</b> minta ga dihubungi. Pesan dimatiin buat orang ini.
          </div>
        )}
        {cur && (() => {
          const v = view(cur, now, strategy);
          return (
            <div aria-label={`Prospek ${cur.handle}`} style={{ padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{cur.name ? `${cur.name} (${cur.handle})` : cur.handle}</div>
                  <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>
                    {cur.segment} · {v.status === "intro" || v.status === "belum" ? `percobaan ${cur.attempts}/${strategy.maxAttempts}` : `masuk ${longDate(cur.firstSeenAt)}`}
                  </div>
                </div>
                <span style={badge(statusColor(cur, v))}>{statusLabel(cur, v)}</span>
              </div>
              {curPost?.text && <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.5, marginTop: 8, whiteSpace: "pre-wrap" }}>“{curPost.text}”</div>}
              {curPost?.url && <a href={curPost.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 11, color: "var(--brand-text)", marginTop: 6 }}>Buka post ↗</a>}
              {v.status === "tidak" && <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 6 }}>Udah {strategy.maxAttempts}× tanpa jawaban, diparkir sampai {longDate(v.parkedUntil || now)}. Kirim lagi tetap bisa.</div>}
            </div>
          );
        })()}
        {(curPost || source.kind === "post") && !isBlocked && (
          <div role="radiogroup" aria-label="Kirim lewat" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: "var(--app-muted)", marginRight: 2 }}>Kirim lewat</span>
            {([["post", "Balas di post"], ["dm", "DM"]] as [Channel, string][]).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={channel === k} onClick={() => setChannel(k)}
                style={{ ...chip, minHeight: 36, padding: "8px 14px", fontSize: 12, fontWeight: 700, ...(channel === k ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{l}</button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Pilih pesan</div>
          {canEdit && <button onClick={() => setEditing({ id: "", title: "", body: "" })} style={chip}>+ Template</button>}
        </div>
        {templates.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "8px 0" }}>Belum ada template. Tambah satu dulu, pakai <code>{"{nama}"}</code> untuk nama target.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {templates.map(t => {
            const s = scores.find(x => x.templateId === t.id);
            return (
              <div key={t.id} style={{ background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", opacity: isBlocked ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                  {canEdit && <button onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`} style={{ ...chip, padding: "2px 8px" }}>✎</button>}
                </div>
                {s && <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 6 }}>{s.sent} terkirim · dibales {pct(s.responseRate)} · tertarik {pct(s.winRate)}</div>}
                <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12, flex: 1 }}>{fill(t.body, target)}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => pick(t, "copy")} disabled={isBlocked} style={{ ...chip, flex: 1, minHeight: 40, fontSize: 12, fontWeight: 700, color: copiedId === t.id ? "var(--ok)" : "var(--app-text)", border: `1px solid ${copiedId === t.id ? "var(--ok)" : "var(--app-border)"}` }}>
                    {copiedId === t.id ? "✓ Tersalin" : "Copy"}
                  </button>
                  <button onClick={() => pick(t, "wa")} disabled={isBlocked} style={{ ...btnWA, flex: 1, minHeight: 40, padding: "8px", fontSize: 12 }}>Kirim WA</button>
                </div>
                {copyFail === t.id && <div role="status" style={{ fontSize: 11, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginTop: 8 }}>Gagal menyalin. Pilih teks di atas, lalu salin manual.</div>}
              </div>
            );
          })}
        </div>

        {undo && (
          <div role="status" style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "#005eb014", border: "1px solid #005eb050", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 12, minWidth: 0 }}>{undo.label}</div>
            <button onClick={takeBack} aria-label="Batal catat" style={{ ...btnMuted, minHeight: 40, padding: "8px 14px", flexShrink: 0 }}>Batal</button>
          </div>
        )}
      </div>

      <ProspectList prospects={prospects} ready={journey.ready} hunts={hunts} strategy={strategy} sessionId={live?.id}
        filter={prospectFilter} setFilter={setProspectFilter} onCompose={compose} />

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
            {filter === "Semua" ? "Belum ada DM. Isi target, pilih pesan, lalu Copy — langsung kecatat." : filter === "Follow-up" ? "Nggak ada yang nunggu follow-up." : "Belum ada yang tertarik. Terus kirim 💪"}
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
                {isStale(h, now) && <button onClick={() => followUp(h)} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", border: "1px solid #ff990060" }}>↻ Follow-up</button>}
                {h.status === "Tertarik" && !h.leadId && <button onClick={() => makeLead(h)} style={{ ...chip, minHeight: 36, background: "#00a862", color: "#1c2128", border: "none", fontWeight: 700 }}>Jadiin Lead →</button>}
                {h.leadId && <span style={{ fontSize: 11, color: "var(--ok)", fontWeight: 700 }}>✓ Sudah jadi lead</span>}
                {h.url && <a href={h.url} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>Profil ↗</a>}
                {h.status !== "Terkirim" && (
                  <button onClick={() => setReplyFor(replyFor?.id === h.id ? null : { id: h.id, topic: defaultTopic(h.status, h.note), tone: "santai" })}
                    aria-expanded={replyFor?.id === h.id}
                    style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)", border: "1px solid #005eb060" }}>💡 Balas</button>
                )}
                {h.status === "Ditolak" && noting?.id !== h.id && <button onClick={() => setNoting({ id: h.id, note: h.note })} style={chip}>{h.note ? "Ubah alasan" : "+ Alasan"}</button>}
                <button onClick={() => remove(h)} aria-label={`Hapus DM ke ${h.target || "target"}`} style={{ ...chip, minHeight: 36, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>🗑</button>
              </div>
              {replyFor?.id === h.id && h.status !== "Terkirim" && (
                <div role="region" aria-label={`Saran balasan untuk ${h.target || "target"}`} style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
                  <div ref={topicsRef} role="group" aria-label="Jenis balasan" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
                    {TOPICS.map(tp => (
                      <button key={tp.id} onClick={() => setReplyFor({ ...replyFor, topic: tp.id })} aria-pressed={replyFor.topic === tp.id}
                        style={{ ...chip, flexShrink: 0, minHeight: 34, fontWeight: 600, ...(replyFor.topic === tp.id ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{tp.label}</button>
                    ))}
                  </div>
                  <div role="group" aria-label="Gaya bahasa" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {(["santai", "formal"] as Tone[]).map(tn => (
                      <button key={tn} onClick={() => setReplyFor({ ...replyFor, tone: tn })} aria-pressed={replyFor.tone === tn}
                        style={{ ...chip, minHeight: 32, ...(replyFor.tone === tn ? { color: "var(--app-text)", border: "1px solid var(--app-text)" } : {}) }}>{tn === "santai" ? "Santai" : "Formal"}</button>
                    ))}
                  </div>
                  {repliesFor(replyFor.topic, replyFor.tone).map(r => {
                    const text = fill(r.text, h.target);
                    const key = `${h.id}_${r.key}`;
                    return (
                      <div key={r.key} style={{ padding: "10px 0", borderTop: "1px solid var(--app-border)" }}>
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--app-text)" }}>{text}</div>
                        <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 4 }}>{r.hint}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button onClick={() => copy(text, key, setCopiedReply)}
                            style={{ ...chip, minHeight: 36, minWidth: 80, fontWeight: 700, color: copiedReply === key ? "var(--ok)" : "var(--app-text)", border: `1px solid ${copiedReply === key ? "var(--ok)" : "var(--app-border)"}` }}>
                            {copiedReply === key ? "✓ Tersalin" : "Copy"}
                          </button>
                          {h.platform === "WA"
                            ? <a href={waLinkFor(h.target, text)} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700, background: btnWA.background, color: btnWA.color, border: "none" }}>Kirim WA</a>
                            : h.url && <a href={h.url} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>Buka profil ↗</a>}
                        </div>
                        {copyFail === key && <div role="status" style={{ fontSize: 11, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginTop: 6 }}>Gagal menyalin. Pilih teks di atas, lalu salin manual.</div>}
                      </div>
                    );
                  })}
                  {fromLibrary(replyFor.topic) && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: "var(--app-muted)" }}>Pilih yang paling mirip gaya orangnya.</div>
                      {onOpenScripts && <button onClick={onOpenScripts} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)" }}>Buka Script Library →</button>}
                    </div>
                  )}
                </div>
              )}
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
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
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

      <Campaigns prospects={prospects} templates={templates} strategy={strategy} sessionId={live?.id} />
      <HunterStats prospects={prospects} sessions={journey.sessions} />

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
              <button onClick={saveTemplate} disabled={!editing.title.trim() || !editing.body.trim()} style={{ ...btnPrimary, opacity: editing.title.trim() && editing.body.trim() ? 1 : 0.5 }}>Simpan</button>
              <button onClick={() => setEditing(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
