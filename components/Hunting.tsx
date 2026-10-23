"use client";

import Icon from "@/components/Icon";
import { type CSSProperties, type Dispatch, type SetStateAction, useEffect, useLayoutEffect, useRef, useState } from "react";
import { deleteDoc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Invoice, Quote, addDays, daysBetween, longDate, today, useBusiness, useSpaceCollection } from "@/lib/billing";
import { jobsFrom } from "@/components/JobCalendar";
import OccupancyCalendar from "@/components/OccupancyCalendar";
import { canEditCatalog, spaceDoc, stamp, useSpace } from "@/lib/space";
import {
  HUNT_STATUS, Hunt, HuntStatus, MIN_SAMPLE, PLATFORMS, STALE_DAYS, PitchTemplate, Platform,
  fill, waLinkFor, huntAction, huntColor, huntIcon, isStale, parseProfile, pct, platformSource, responded, scoreTemplates, verdict,
} from "@/lib/hunting";
import ThreadsRadar from "@/components/ThreadsRadar";
import ProspectList, { FILTERS as PROSPECT_FILTERS, ProspectFilter } from "@/components/ProspectList";
import ProspectThread, { type SendHow, type SendOut } from "@/components/ProspectThread";
import Campaigns from "@/components/Campaigns";
import HunterStats from "@/components/HunterStats";
import CustomerContext from "@/components/CustomerContext";
import TemplateBoard from "@/components/TemplateBoard";
import { dataFor, defaultsWith, fillTemplate, stageFor } from "@/lib/templates";
import DefaultsSheet from "@/components/DefaultsSheet";
import { TOPICS, Tone, defaultTopic, fromLibrary, repliesFor } from "@/lib/replies";
import { profileUrl } from "@/lib/threads";
import {
  Channel, HuntSession, Prospect, Strategy, newProspect, patchFromHunt, postPatch, prospectId, queueGroup, sessionMinutes,
  threadsPostLink, view,
} from "@/lib/prospects";
import { HuntInbox, bump, createProspect, ctx, recordSend, saveProspect, unfurl, useFillDefaults, useHuntInbox } from "@/lib/prospectStore";
import { badge, btnMuted, btnPrimary, btnWA, card, chip, font, heading, inputStyle, label, modalBox, subheading, ink } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmSheet";

type Filter = "Semua" | "Follow-up" | "Tertarik";
// One part of Hunting at a time (QA 15 Okt: "tiap component mesti scroll panjang"):
// writing the message, the people, the log, and the numbers.
// Two parts (owner, 23 Okt): everyone you hunt in one list of cards, and how it's going.
type Pane = "kirim" | "performa";
const PANES: [Pane, string][] = [["kirim", "Prospek"], ["performa", "Performa"]];
// An inline editor under a log row: the field on its own line, Batal beside the action.
const inlineEditor: CSSProperties = { marginTop: 10, padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" };
const editorButtons: CSSProperties = { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 10 };
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
  const [ask, askSheet] = useConfirm();
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
  const [noting, setNoting] = useState<{ id: string; note: string } | null>(null);
  const [replyFor, setReplyFor] = useState<{ id: string; topic: string; tone: Tone } | null>(null);
  const [copiedReply, setCopiedReply] = useState<string | null>(null);
  const [copyFail, setCopyFail] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("Semua");
  const [limit, setLimit] = useState(PAGE);
  const [url, setUrl] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");
  const [referring, setReferring] = useState<{ id: string; who: string } | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);
  // "Ubah target": a small sheet with Batal/Simpan instead of the browser's prompt().
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [goalError, setGoalError] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [pane, setPane] = useState<Pane>("kirim");
  // The cycle (owner, 23 Okt): one person's conversation, and who's next from a queue.
  const [threadId, setThreadId] = useState<string | null>(null);
  // Kirim is a table of who's next (like a Notion database) and, once someone
  // is picked, their page: the message for them (owner, 23 Okt).
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [addMenu, setAddMenu] = useState(false);
  // Messages and scripts live behind the + menu too (owner, 23 Okt).
  const [tplNew, setTplNew] = useState(0);
  const [tplManage, setTplManage] = useState<false | "list" | "new">(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [queued, setQueued] = useState<{ label: string; ids: string[] } | null>(null);
  const [editDefaults, setEditDefaults] = useState(false);
  const allQuotes = useSpaceCollection<Quote>(space, "quotes");
  const allInvoices = useSpaceCollection<Invoice>(space, "invoices");
  const jobs = jobsFrom(allQuotes, allInvoices);
  const targetRef = useRef<HTMLInputElement>(null);
  const topicsRef = useRef<HTMLDivElement>(null);

  function apply(text: string) {
    const post = threadsPostLink(text);
    if (post) { openPost(post); return true; }
    const p = parseProfile(text);
    if (!p) return false;
    setOpen(true);
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
    setOpen(true);
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
  const business = useBusiness(space);
  // A post that didn't say what, when or where: the message uses the
  // workspace's defaults (QA 15 Okt), and "Jasa apa" from the letterhead.
  const savedDefaults = useFillDefaults(space);
  const defaults = defaultsWith(savedDefaults, business.tagline);
  const fillData = dataFor(target, cur, business.name, defaults);
  const curPost = cur ? [...(cur.history || [])].reverse().find(e => e.kind === "post") : undefined;

  // To the message, from wherever the person was picked; the pane shows first.
  function toTarget(focus = true) {
    setPane("kirim");
    setOpen(true);
    requestAnimationFrame(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (focus) targetRef.current?.focus({ preventScroll: true });
    });
  }

  // The bar's paste button and its queue land here.
  useHuntInbox((m: HuntInbox) => {
    if (m.kind === "link") {
      if (!apply(m.text)) setPasteMsg("Clipboard ga berisi link. Copy link post/profil dulu.");
      toTarget(false);
    } else {
      setProspectFilter("Antrian");
      setPane("kirim"); setOpen(false);
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
    toTarget();
  }

  async function pasteLink() {
    setPasteMsg("");
    try {
      const text = await navigator.clipboard.readText();
      if (!apply(text)) setPasteMsg("Clipboard kosong. Copy link profil dulu di Threads/IG.");
    } catch {
      setPasteMsg("Browser ga izinkan baca clipboard. Tahan kolom Target lalu Tempel.");
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

  // Copy or Kirim WA is the send (PRD-009 D1): it goes in the log and the
  // person's journey at once, with five seconds to take it back.
  // Where the second button goes (QA 15 Okt: "link Threads langsung ke DM"):
  // a reply goes to the post; a DM to Instagram's own DM link (ig.me/m/…).
  // Threads has no public DM link, and its accounts are Instagram usernames.
  const handle = target.trim().replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  const postUrl = (curPost?.url || (source.kind === "post" ? source.url : "")) || "";
  const sendOut: { how: "wa" | "open"; label: string; url?: string } =
    platform === "WA" ? { how: "wa", label: "Kirim WA" }
    : channel === "post" && postUrl ? { how: "open", label: "Copy & buka post", url: postUrl }
    : (platform === "Threads" || platform === "IG") && handle ? { how: "open", label: platform === "IG" ? "Copy & DM" : "Copy & DM (via IG)", url: `https://ig.me/m/${handle}` }
    : url ? { how: "open", label: "Copy & buka profil", url }
    : { how: "wa", label: "Kirim WA" };

  function pick(t: PitchTemplate, how: "copy" | "wa" | "open") {
    if (isBlocked) return;
    const text = fillTemplate(t.body, fillData);
    if (how === "copy") {
      copy(text, t.id, setCopiedId);
    } else if (how === "open" && sendOut.url) {
      // Copy first, then open in the same tap (a popup opened later is blocked).
      copy(text, t.id, setCopiedId);
      window.open(sendOut.url, "_blank", "noopener");
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

  async function logSent(t: PitchTemplate, text: string, how: "copy" | "wa" | "open") {
    const who = target.trim();
    const ch: Channel = curPost || source.kind === "post" ? channel : "dm";
    try {
      const back = await recordSend(space, {
        target: who, platform, url: url || undefined, templateId: t.id, templateTitle: t.title, text, channel: ch,
        source: cur ? undefined : source,
      }, cur, live?.id, strategy);
      // The person stays on screen: their post and context are still the guide
      // for the next message (QA 11 Okt). "Target lain" clears it.
      const entry = { label: `Tercatat: ${how === "wa" ? "WA" : ch === "post" ? "balasan di post" : "DM"} ke ${who}`, run: back };
      setUndo(entry);
      setTimeout(() => setUndo(u => (u?.run === back ? null : u)), 10000);
    } catch {
      setPasteMsg("Pesan tersalin, tapi gagal dicatat. Cek koneksi lalu kirim ulang.");
    }
  }

  // Sending to someone from their conversation, the same way Kirim does.
  function sendFor(p: Prospect): SendOut {
    const h = p.handle.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
    const post = [...(p.history || [])].reverse().find(e => e.kind === "post");
    if (p.platform === "WA") return { how: "wa", label: "Buka WA" };
    if (p.contact === "baru" && post?.url) return { how: "open", label: "Copy & buka post", url: post.url };
    if ((p.platform === "Threads" || p.platform === "IG") && h) return { how: "open", label: p.platform === "IG" ? "Copy & DM" : "Copy & DM (via IG)", url: `https://ig.me/m/${h}` };
    if (p.url) return { how: "open", label: "Copy & buka profil", url: p.url };
    return { how: "wa", label: "Buka WA" };
  }

  async function sendTo(p: Prospect, t: PitchTemplate | null, text: string, how: SendHow): Promise<(() => Promise<void>) | null> {
    const out = sendFor(p);
    if (how === "copy") copy(text, `th_${p.id}`, setCopiedId);
    else if (how === "open" && out.url) { copy(text, `th_${p.id}`, setCopiedId); window.open(out.url, "_blank", "noopener"); }
    else window.open(waLinkFor(p.handle, text), "_blank");
    try {
      return await recordSend(space, {
        target: p.handle, platform: p.platform, url: p.url || undefined, templateId: t?.id || "manual", templateTitle: t?.title || "Pesan sendiri",
        text, channel: out.label === "Copy & buka post" ? "post" : "dm",
      }, p, live?.id, strategy);
    } catch { return null; }
  }

  // "Berikutnya" walks the rest of the list the person was picked from.
  function takeNext() {
    if (!queued) return;
    const rest = queued.ids.map(id => prospects.find(x => x.id === id)).filter((x): x is Prospect => !!x);
    const next = rest[0];
    if (!next) { setQueued(null); return; }
    setQueued({ label: queued.label, ids: queued.ids.slice(queued.ids.indexOf(next.id) + 1) });
    setUndo(null);
    compose(next);
  }

  // Back from a person's page to the list; their page stays one tap away.
  function backToList() {
    setOpen(false); setUndo(null);
  }

  // The search box is the way in: a match opens its page, anything else
  // (a link, an @name) becomes a new target.
  function commitSearch(text = q) {
    const v = text.trim();
    if (!v) return;
    setQ(""); setQueued(null);
    if (/https?:\/\//.test(v) && apply(v)) return;
    const key = v.replace(/^@/, "").toLowerCase();
    const hit = prospects.find(p => p.handle.replace(/^@/, "").toLowerCase() === key);
    if (hit) { compose(hit); return; }
    setTarget(v); setUrl(""); setSource({ kind: "manual" }); setChannel("dm"); setPasteMsg("");
    setOpen(true);
  }

  function clearTarget() {
    setTarget(""); setUrl(""); setSource({ kind: "manual" }); setChannel("dm"); setPasteMsg("");
    targetRef.current?.focus();
  }

  // A typed @name or profile link becomes a journey without sending anything yet.
  async function saveTarget() {
    const who = target.trim();
    if (!who || cur || isBlocked) return;
    setSavingTarget(true);
    try {
      await createProspect(space, curId, newProspect({ platform, handle: who, url: url || undefined, source }, ctx(live?.id)));
      bump(space, live?.id, "prospects");
    } catch {
      setPasteMsg("Gagal nyimpen prospek. Cek koneksi.");
    } finally {
      setSavingTarget(false);
    }
  }

  // "Dia rekomendasiin orang lain": the answer counts as a reply, and the new
  // person is ready as the next target.
  async function saveReferral() {
    if (!referring) return;
    const h = hunts.find(x => x.id === referring.id);
    const who = referring.who.trim();
    setReferring(null);
    if (!h || !who) return;
    const note = `Rekomendasiin ${who}`;
    await updateDoc(spaceDoc(space, "hunts", h.id), { status: h.status === "Terkirim" || h.status === "Ghosting" ? "Dibales" : h.status, note, statusAt: Date.now() });
    if (h.status === "Terkirim" || h.status === "Ghosting") syncProspect(h, "Dibales", note);
    if (!apply(who)) { setTarget(who); setPlatform(h.platform); }
    setPasteMsg(`${who} siap jadi target (rekomendasi dari ${h.target}).`);
    toTarget(false);
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
    await updateDoc(spaceDoc(space, "hunts", h.id), { status, statusAt: Date.now() });
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

  // The lead a DM row already has, its own or its person's (Kasih data).
  const leadOf = (h: Hunt) => h.leadId || (h.prospectId ? prospects.find(x => x.id === h.prospectId)?.leadId : undefined);

  async function makeLead(h: Hunt) {
    // One person, one lead (flow audit, 23 Okt): link the one Kasih data made.
    const existing = leadOf(h);
    if (existing) { await updateDoc(spaceDoc(space, "hunts", h.id), { leadId: existing }); return; }
    const leadId = `lead_${Date.now()}`;
    const note = [`Dari Hunting (${h.platform}) · template "${h.templateTitle}"`, h.note].filter(Boolean).join(" — ");
    await setDoc(spaceDoc(space, "leads", leadId), stamp(space, {
      name: h.target || "Tanpa nama", contact: "", source: platformSource[h.platform], status: "Warm", score: 70,
      email: "", phone: "", category: "F&B", notes: note, lastContact: now, value: 0,
      ...(responded(h) ? { lastReplyAt: now } : {}),
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
    toTarget();
  }

  function remove(h: Hunt) {
    ask("Hapus catatan DM?", `Catatan DM ke ${h.target || "target ini"} dihapus dari log.`, () => deleteDoc(spaceDoc(space, "hunts", h.id)));
  }

  function followUp(h: Hunt) {
    setTarget(h.target);
    setPlatform(h.platform);
    toTarget();
  }

  function changeGoal() {
    if (!canEdit) return;
    setGoalError("");
    setGoalDraft(String(goal));
  }
  async function saveGoal() {
    const n = parseInt(goalDraft || "", 10);
    if (!(n > 0)) { setGoalError("Isi jumlah DM, minimal 1."); return; }
    setSavingGoal(true);
    try {
      await setDoc(spaceDoc(space, "settings", "hunting"), { dailyGoal: n }, { merge: true });
      setGoalDraft(null);
    } catch {
      setGoalError("Gagal nyimpen. Di guild, target diatur Leader atau Officer.");
    } finally {
      setSavingGoal(false);
    }
  }

  const progress = Math.min(1, sentToday / goal);
  const lastSession = journey.sessions.find(x => x.endedAt) || null;

  return (
    <div className="sp-hunt">
      {askSheet}
      <div className="sp-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <div style={heading}>Hunting Mode</div>
          <div style={subheading}>Kirim DM, catat hasilnya sekali tap, dan lihat pesan mana yang beneran dibales.</div>
          {!live && lastSession && (
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>
              Sesi terakhir: {Math.round(sessionMinutes(lastSession, Date.now()))} menit · {lastSession.counts?.intros || 0} intro · {lastSession.counts?.replies || 0} dibales · {lastSession.counts?.converted || 0} data
              {sessionMinutes(lastSession, Date.now()) >= 10 ? ` · ${((lastSession.counts?.intros || 0) / (sessionMinutes(lastSession, Date.now()) / 60)).toFixed(1)} intro/jam` : ""}
            </div>
          )}
        </div>
        {live
          ? <button onClick={journey.end} style={{ ...btnMuted, minHeight: 44 }}>■ Akhiri sesi</button>
          : <button onClick={journey.start} style={{ ...btnPrimary, minHeight: 44, background: "#b93a06", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="play" size={16} />Mulai hunting</button>}
      </div>

      {/* Today in one line; the full numbers are under Performa. */}
      {/* Two numbers split by a hairline (docs/standards/design.md §2), not two boxes. */}
      <div className="sp-strip two" style={{ marginBottom: "var(--sp-4)" }}>
        <button onClick={changeGoal} disabled={!canEdit} aria-label={`Hari ini ${sentToday} dari ${goal} DM. ${canEdit ? "Ubah target harian" : "Target harian diatur Leader atau Officer"}`}
          style={{ minWidth: 0, minHeight: 44, paddingBlock: "var(--sp-2)", border: 0, borderRadius: 0, textAlign: "left", cursor: canEdit ? "pointer" : "default", color: "inherit", fontFamily: font }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="tabnum" style={{ fontSize: "var(--fs-section)", fontWeight: 700, color: progress >= 1 ? "var(--ok)" : "var(--brand-text)" }}>{sentToday}<span style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)", fontWeight: 600 }}>/{goal}</span></span>
            <span style={{ fontSize: "var(--fs-meta)", fontWeight: 600 }}>DM hari ini</span>
            <span aria-hidden="true" style={{ marginLeft: "auto", display: "inline-flex", color: progress >= 1 ? "var(--ok)" : "var(--app-muted)" }}>{progress >= 1 ? <Icon name="target" size={16} /> : canEdit ? <Icon name="pencil" size={16} /> : null}</span>
          </span>
          <span aria-hidden="true" style={{ display: "block", height: 4, background: "var(--app-inner)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
            <span style={{ display: "block", width: `${progress * 100}%`, height: "100%", background: progress >= 1 ? "var(--ok)" : "var(--heat-3)" }} />
          </span>
        </button>
        <div className="tabnum" style={{ minWidth: 0, paddingBlock: "var(--sp-2)", fontSize: "var(--fs-meta)", color: "var(--app-sub)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
          <span>Dibales 7 hr <b style={{ color: "var(--app-text)" }}>{week.length ? pct(weekReplied / week.length) : "—"}</b></span>
          <span>Tertarik 7 hr <b style={{ color: "var(--app-text)" }}>{weekInterested}</b></span>
        </div>
      </div>

      <div role="tablist" aria-label="Bagian Hunting" className="sp-hunt-panes"
        style={{ display: "grid", gridTemplateColumns: `repeat(${PANES.length}, minmax(0, 1fr))`, gap: 4, padding: 4, marginBottom: 16, borderRadius: 12, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
        {PANES.map(([k, l]) => {
          const n = k === "kirim" ? queueGroup(prospects, "due", now, strategy).length : 0;
          return (
            <button key={k} role="tab" id={`hp-${k}`} aria-selected={pane === k} aria-controls={`hpane-${k}`} onClick={() => { setPane(k); }}
              aria-label={n ? `${l}, ${n} perlu follow-up` : l}
              style={{ minHeight: 40, minWidth: 0, padding: "0 4px", borderRadius: 9, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                background: pane === k ? "var(--app-card)" : "transparent", color: pane === k ? "var(--app-text)" : "var(--app-sub)", boxShadow: pane === k ? "0 1px 3px rgba(0,0,0,.12)" : "none" }}>
              {l}{n ? <span aria-hidden="true" style={{ marginLeft: 4, padding: "0 6px", borderRadius: 999, background: "#ff990033", color: "var(--warn-text)", fontSize: 11 }}>{n}</span> : null}
            </button>
          );
        })}
      </div>

      {threadId && (() => {
        const p = prospects.find(x => x.id === threadId);
        if (!p) return null;
        return <ProspectThread key={p.id} p={p} strategy={strategy} templates={templates} fill={dataFor(p.handle, p, business.name, defaults)}
          sendOut={sendFor(p)} sessionId={live?.id} onSend={sendTo} onClose={() => setThreadId(null)} />;
      })()}
      <div id="hpane-kirim" role="tabpanel" aria-labelledby="hp-kirim" hidden={pane !== "kirim"}>
      {addMenu && (
        // The + menu, like Notion's: who to add, and the messages and scripts to send them.
        <div className="modal-overlay sp-sheet-overlay" onClick={() => setAddMenu(false)} style={{ alignItems: "flex-end", background: "var(--scrim)" }}>
          <section role="dialog" aria-modal="true" aria-label="Tambah" className="sp-sheet sp-kadd" onClick={e => e.stopPropagation()}>
            <div className="sp-kadd-head"><h2>Tambah</h2><button className="sp-x" onClick={() => setAddMenu(false)} aria-label="Tutup"><span><Icon name="close" size={13} stroke={2.4} /></span></button></div>
            <h3 className="sp-kadd-sec">Target</h3>
            <ul>
              <li><button onClick={() => { setAddMenu(false); setOpen(false); requestAnimationFrame(() => searchRef.current?.focus()); }}><Icon name="search" size={20} />Ketik @akun atau tempel link</button></li>
              <li><button onClick={() => { setAddMenu(false); pasteLink(); }}><Icon name="clipboard" size={20} />Tempel link dari clipboard</button></li>
              <li><button onClick={() => { setAddMenu(false); setOpen(false); setTimeout(() => document.getElementById("radar-threads")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}><Icon name="target" size={20} />Dari Radar Threads</button></li>
            </ul>
            <h3 className="sp-kadd-sec">Pesan & script</h3>
            <ul>
              {canEdit && <li><button onClick={() => { setAddMenu(false); if (open) setTplNew(n => n + 1); else setTplManage("new"); }}><Icon name="plus" size={20} />Template pesan baru</button></li>}
              <li><button onClick={() => { setAddMenu(false); setTplManage("list"); }}><Icon name="doc" size={20} />Kelola template pesan</button></li>
              <li><button onClick={() => { setAddMenu(false); setEditDefaults(true); }}><Icon name="sliders" size={20} />Default kalau kosong</button></li>
              {onOpenScripts && <li><button onClick={() => { setAddMenu(false); onOpenScripts(); }}><Icon name="book" size={20} />Script Library</button></li>}
            </ul>
          </section>
        </div>
      )}
      {tplManage === "new" && (
        // Just the editor: the deck behind it closes with it.
        <TemplateBoard templates={templates} scores={scores} data={fillData} stage={stageFor(undefined, undefined)} editorOnly startNew onEditDone={() => setTplManage(false)}
          blocked={false} copiedId={copiedId} copyFail={copyFail} onPick={() => undefined} canEdit={canEdit} send={sendOut} sampleName="" />
      )}
      {tplManage === "list" && (
        // The message deck on its own, to add and change templates without a target.
        <div className="modal-overlay" onClick={() => setTplManage(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="tpl-manage-h" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <h2 id="tpl-manage-h" style={{ margin: 0, fontSize: "var(--fs-section)", fontWeight: 700 }}>Template pesan</h2>
              <button className="sp-x" onClick={() => setTplManage(false)} aria-label="Tutup"><span><Icon name="close" size={13} stroke={2.4} /></span></button>
            </div>
            <TemplateBoard templates={templates} scores={scores} data={fillData} stage={stageFor(undefined, undefined)} manage
              blocked={false} copiedId={copiedId} copyFail={copyFail} onPick={() => undefined} canEdit={canEdit} send={sendOut} sampleName="" />
          </div>
        </div>
      )}
      {open ? (
      <div className="sp-hunt-send" style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div className="sp-kback-row">
          <button className="sp-kback" onClick={backToList} aria-label="Kembali ke daftar"><Icon name="chevronLeft" size={18} stroke={2} />Daftar</button>
          {queued && queued.ids.length > 0 && <button className="sp-knext" onClick={takeNext}>Berikutnya<Icon name="chevronRight" size={16} stroke={2} /></button>}
        </div>
        {queued && (
          <p className="sp-kqueue">
            Dari antrian <b>{queued.label}</b> · {queued.ids.length} lagi ·{" "}
            <button onClick={() => setQueued(null)} aria-label="Berhenti ambil dari antrian">Selesai</button>
          </p>
        )}
        <label htmlFor="hunt-target" className="vh">Target</label>
        <div className="sp-target" style={{ marginBottom: pasteMsg || url ? 6 : 12 }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
            <input id="hunt-target" ref={targetRef} value={target}
              onPaste={e => { const v = e.clipboardData.getData("text"); if (/https?:\/\//.test(v) && apply(v)) e.preventDefault(); }}
              onChange={e => {
                const v = e.target.value;
                if (/https?:\/\//.test(v) && apply(v)) return;
                // Typed by hand: the last person's link and post don't belong to this name.
                setTarget(v); setUrl(""); setSource({ kind: "manual" }); setChannel("dm");
              }}
              placeholder="@akun atau link" autoComplete="off" className="sp-ktitle" style={{ paddingRight: target ? 44 : undefined }} />
            {target && <button onClick={clearTarget} aria-label="Target lain (kosongin)" title="Target lain"
              style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, border: "none", background: "none", color: "var(--app-muted)", fontSize: 18, cursor: "pointer" }}>×</button>}
          </div>
        </div>
        {url && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}><Icon name="link" size={14} style={{ flexShrink: 0 }} /><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{url}</span></div>}
        <div role="status" style={{ fontSize: 12, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginBottom: pasteMsg ? 12 : 0 }}>{pasteMsg}</div>
        <div role="radiogroup" aria-label="Platform" className="sp-seg" style={{ marginBottom: 16 }}>
          {PLATFORMS.map(p => (
            <button key={p} role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)} className="sp-seg-btn"><span>{p}</span></button>
          ))}
        </div>

        {isBlocked && (
          <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#ff44441a", border: "1px solid #ff444460", fontSize: 12, marginBottom: 16 }}>
            <b>{target.trim()}</b> minta ga dihubungi. Pesan dimatiin buat orang ini.
          </div>
        )}
        {cur && (
          <CustomerContext key={cur.id} p={cur} v={view(cur, now, strategy)} strategy={strategy} stage={stageFor(cur, view(cur, now, strategy))} now={now} jobs={jobs} defaults={defaults}
            onSave={c => saveProspect(space, cur, { context: c, updatedAt: Date.now() })} />
        )}
        {!cur && target.trim() && !isBlocked && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 12, borderRadius: 12, border: "1px dashed var(--app-border)", marginBottom: 16, fontSize: 12 }}>
            <span style={{ color: "var(--app-muted)" }}><b style={{ color: "var(--app-text)" }}>{target.trim()}</b> belum ada di journey. Kirim pesan otomatis nyimpen, atau simpan dulu.</span>
            <button onClick={saveTarget} disabled={savingTarget} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)", border: "1px solid #005eb060" }}>{savingTarget ? "Menyimpan…" : "＋ Simpan ke journey"}</button>
          </div>
        )}
        {(curPost || source.kind === "post") && !isBlocked && (
          <div role="radiogroup" aria-label="Kirim lewat" className="sp-via" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "var(--app-muted)", marginRight: 2 }}>Kirim lewat</span>
            {([["post", "Balas di post"], ["dm", "DM"]] as [Channel, string][]).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={channel === k} onClick={() => setChannel(k)}
                style={{ ...chip, minHeight: 36, padding: "8px 14px", fontSize: 12, fontWeight: 700, ...(channel === k ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{l}</button>
            ))}
          </div>
        )}

        <TemplateBoard templates={templates} scores={scores} data={fillData} stage={stageFor(cur, cur ? view(cur, now, strategy) : undefined)}
          blocked={isBlocked} copiedId={copiedId} copyFail={copyFail} onPick={pick} canEdit={canEdit} send={sendOut}
          sampleName={target.trim() ? (cur?.name || target.trim()) : ""}
          newRequest={open ? tplNew : 0}
          extra={<button onClick={() => setAddMenu(true)} aria-haspopup="dialog" style={{ ...chip, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="plus" size={15} stroke={2} />Template & script</button>} />

        {/* Mounted before its text, so screen readers announce "Tercatat". */}
        <div role="status">
          {undo && (
            // Pinned above the bottom nav, so a wrong tap can be taken back
            // without scrolling to find it (QA 15 Okt).
            <div className="sp-toast">
              <div style={{ fontSize: 14, minWidth: 0, flex: 1 }}>{undo.label}</div>
              <button onClick={takeBack} aria-label="Batal catat" style={{ ...btnMuted, minHeight: 44, padding: "8px 16px", flexShrink: 0, background: "#fff", color: "#141414" }}>Batal</button>
              {queued && queued.ids.length > 0 && <button onClick={takeNext} style={{ ...btnMuted, minHeight: 44, padding: "8px 16px", flexShrink: 0, background: "#005eb0", color: "#fff" }}>Berikutnya →</button>}
              <button onClick={() => setUndo(null)} aria-label="Tutup pemberitahuan" style={{ width: 44, height: 44, border: 0, background: "transparent", color: "#fff", fontSize: 20, cursor: "pointer", flexShrink: 0 }}>×</button>
            </div>
          )}
        </div>
      </div>
      ) : (
        <>
      <section aria-label="Daftar prospek" className="sp-ktable">
        {/* A database header, as in Notion: the list's name, then its tools. */}
        <div className="sp-ktool">
          {/* The view, as in Notion: one list, picked from the title. */}
          <label className="sp-kview">
            <span className="vh">Tampilan</span>
            <select value={prospectFilter} onChange={e => setProspectFilter(e.target.value as ProspectFilter)}>
              {PROSPECT_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <Icon name="chevronDown" size={16} stroke={2} />
          </label>
          <div className="sp-ktools">
            <div className="sp-split">
              <button onClick={() => searchRef.current?.focus()} aria-label="Target baru"><Icon name="plus" size={18} stroke={2} /></button>
              <button onClick={() => setAddMenu(true)} aria-label="Menu tambah: target, template, script" aria-haspopup="dialog"><Icon name="chevronDown" size={16} stroke={2} /></button>
            </div>
          </div>
        </div>
        <div className="sp-ksearch">
          <Icon name="search" size={18} />
          <label htmlFor="hunt-search" className="vh">Cari prospek pakai ID atau @username</label>
          <input id="hunt-search" ref={searchRef} type="search" value={q} enterKeyHint="go" autoComplete="off"
            placeholder="Cari nama, @akun, ID, atau tempel link"
            onPaste={e => { const v = e.clipboardData.getData("text"); if (/https?:\/\//.test(v)) { e.preventDefault(); commitSearch(v); } }}
            onChange={e => { const v = e.target.value; if (/https?:\/\//.test(v)) { commitSearch(v); return; } setQ(v); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitSearch(); } }} />
          {/* Phones can't paste into a field as easily; a mouse and keyboard can (⌘V). */}
          <button onClick={pasteLink} className="touch-only sp-kpaste" aria-label="Tempel link profil dari clipboard"><Icon name="clipboard" size={16} />Tempel</button>
        </div>
        <div role="status" className="sp-kmsg">{pasteMsg}</div>
        {target.trim() && (
          <div className="sp-kresume">
            <button onClick={() => setOpen(true)}><Icon name="pencil" size={16} />Lanjut ke {target.trim()}</button>
            <button className="sp-icon44" onClick={() => { clearTarget(); setQueued(null); }} aria-label={`Tutup ${target.trim()}`}><Icon name="close" size={14} stroke={2.2} /></button>
          </div>
        )}
        {q.trim() && !prospects.some(p => p.handle.replace(/^@/, "").toLowerCase() === q.trim().replace(/^@/, "").toLowerCase()) && (
          <button className="sp-krow sp-knew" onClick={() => commitSearch()}>
            <span className="sp-kini" aria-hidden="true"><Icon name="plus" size={16} stroke={2} /></span>
            <span className="sp-knm">Kirim ke “{q.trim()}”<span className="sp-ksub">Target baru, belum ada di journey</span></span>
          </button>
        )}
        <ProspectList prospects={prospects} ready={journey.ready} hunts={hunts} strategy={strategy} sessionId={live?.id} embedded query={q}
          filter={prospectFilter} setFilter={setProspectFilter} onOpen={p => setThreadId(p.id)}
          onCompose={(p, next, from) => { setQ(""); setQueued({ label: from, ids: next }); compose(p); }} />
      </section>
          <div id="radar-threads"><ThreadsRadar uid={space.me.uid} hunts={hunts} onTarget={targetFromRadar} /></div>
        </>
      )}
      </div>

      <div id="hpane-performa" role="tabpanel" aria-labelledby="hp-performa" hidden={pane !== "performa"}>
      <Campaigns prospects={prospects} templates={templates} strategy={strategy} sessionId={live?.id} defaults={defaults} />
      {/* The old per-message log, folded: every send is in its conversation now. */}
      <details style={{ ...card, padding: "4px 20px", marginBottom: 20 }}>
        <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700 }}>Log kiriman ({sorted.length})</summary>
      <div style={{ padding: "4px 0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>Log DM</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([["Semua", sorted.length], ["Follow-up", stale.length], ["Tertarik", interested.length]] as [Filter, number][]).map(([f, n]) => (
              <button key={f} onClick={() => { setFilter(f); setLimit(PAGE); }} aria-pressed={filter === f}
                style={{ ...chip, fontWeight: 700, ...(filter === f ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
                {f} {n > 0 && <span>{n}</span>}
              </button>
            ))}
          </div>
        </div>
        {filter === "Follow-up" && stale.length > 0 && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>Terkirim {STALE_DAYS}+ hari tanpa balasan. Follow-up sekali, kalau tetap diam tandai 👻.</div>}
        {shown.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "16px 0" }}>
            {filter === "Semua" ? "Belum ada DM. Isi target, pilih pesan, lalu Copy — langsung kecatat." : filter === "Follow-up" ? "Ga ada yang nunggu follow-up." : "Belum ada yang tertarik. Terus kirim 💪"}
          </div>
        )}
        {shown.slice(0, limit).map(h => {
          const age = daysBetween(h.date, now);
          const sentAt = new Date(h.createdAt);
          const clock = `${String(sentAt.getHours()).padStart(2, "0")}.${String(sentAt.getMinutes()).padStart(2, "0")}`;
          const after = h.statusAt && h.status !== "Terkirim" ? Math.max(0, Math.round((h.statusAt - h.createdAt) / 86_400_000)) : null;
          const next =
            h.status === "Terkirim" ? (age >= STALE_DAYS ? `Udah ${age} hari belum dibales. Follow-up sekali, kalau tetap diam tandai Ga dibales.` : "Nunggu balasan. Begitu dia bales, tandai di bawah.")
            : h.status === "Dibales" ? "Dia bales. Lanjut ngobrol, lalu tandai Tertarik atau Ditolak."
            : h.status === "Tertarik" ? (h.leadId ? "Udah jadi lead, lanjut di Jualan → Leads." : "Tertarik: jadiin lead biar masuk pipeline.")
            : h.status === "Ditolak" ? "Ditolak. Catat alasannya, buka Balas buat jawab keberatannya."
            : "Ga dibales. Diparkir; coba lagi nanti lewat kampanye.";
          return (
            <div key={h.id} style={{ padding: "12px 0", borderTop: "1px solid var(--app-inner)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.target || "Tanpa nama"}</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>
                    {h.platform} · {h.templateTitle} · {h.channel === "post" ? "balas di post" : "DM"} {age === 0 ? "hari ini" : age === 1 ? "kemarin" : longDate(h.date)} {clock}
                    {after !== null && ` · ${h.status.toLowerCase()} ${after === 0 ? "di hari yang sama" : `${after} hari kemudian`}`}
                  </div>
                  {h.note && <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 4 }}>“{h.note}”</div>}
                </div>
                <span style={badge(huntColor[h.status])}>{huntIcon[h.status]} {h.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 8 }}>{next}</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 10, marginBottom: 6 }}>Ubah jadi</div>
              <div role="group" aria-label={`Hasil DM ke ${h.target || "target"}`} className="sp-choice-grid">
                {HUNT_STATUS.filter(s => s !== h.status).map(s => (
                  <button key={s} onClick={() => setStatus(h, s)} aria-label={`Tandai ${huntAction[s]}`}
                    style={{ ...chip, minHeight: 36, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderColor: `${huntColor[s]}60` }}>{huntIcon[s]} {huntAction[s]}</button>
                ))}
                <button onClick={() => { setNoting(null); setReferring(referring?.id === h.id ? null : { id: h.id, who: "" }); }} aria-expanded={referring?.id === h.id}
                  style={{ ...chip, minHeight: 36, fontSize: 12, fontWeight: 600 }}>↪ Rekomendasiin orang</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                {isStale(h, now) && <button onClick={() => followUp(h)} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", border: "1px solid #ff990060" }}>↻ Follow-up</button>}
                {h.status === "Tertarik" && !leadOf(h) && <button onClick={() => makeLead(h)} style={{ ...chip, minHeight: 36, background: "#00a862", color: "#1c2128", border: "none", fontWeight: 700 }}>Jadiin Lead →</button>}
                {leadOf(h) && <span style={{ fontSize: 12, color: "var(--ok)", fontWeight: 700 }}>✓ Sudah jadi lead</span>}
                {h.url && <a href={h.url} target="_blank" rel="noreferrer" className="sp-tap" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>Profil ↗</a>}
                {h.status !== "Terkirim" && (
                  <button onClick={() => setReplyFor(replyFor?.id === h.id ? null : { id: h.id, topic: defaultTopic(h.status, h.note), tone: "santai" })}
                    aria-expanded={replyFor?.id === h.id}
                    style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)", border: "1px solid #005eb060" }}>💡 Balas</button>
                )}
                {h.status === "Ditolak" && noting?.id !== h.id && <button onClick={() => { setReferring(null); setNoting({ id: h.id, note: h.note }); }} style={{ ...chip, minHeight: 36 }}>{h.note ? "✎ Ubah alasan" : "+ Alasan"}</button>}
                <button onClick={() => remove(h)} aria-label={`Hapus DM ke ${h.target || "target"}`} style={{ ...chip, minHeight: 36, marginLeft: "auto", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>🗑 Hapus</button>
              </div>
              {replyFor?.id === h.id && h.status !== "Terkirim" && (
                <div role="region" aria-label={`Saran balasan untuk ${h.target || "target"}`} style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
                  <div ref={topicsRef} role="group" aria-label="Jenis balasan" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
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
                        <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>{r.hint}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button onClick={() => copy(text, key, setCopiedReply)}
                            style={{ ...chip, minHeight: 36, minWidth: 80, fontWeight: 700, color: copiedReply === key ? "var(--ok)" : "var(--app-text)", border: `1px solid ${copiedReply === key ? "var(--ok)" : "var(--app-border)"}` }}>
                            {copiedReply === key ? "✓ Tersalin" : "Copy"}
                          </button>
                          {h.platform === "WA"
                            ? <a href={waLinkFor(h.target, text)} target="_blank" rel="noreferrer" className="sp-tap" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700, background: btnWA.background, color: btnWA.color, border: "none" }}>Kirim WA</a>
                            : h.url && <a href={h.url} target="_blank" rel="noreferrer" className="sp-tap" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>Buka profil ↗</a>}
                        </div>
                        {copyFail === key && <div role="status" style={{ fontSize: 12, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginTop: 6 }}>Gagal menyalin. Pilih teks di atas, lalu salin manual.</div>}
                      </div>
                    );
                  })}
                  {fromLibrary(replyFor.topic) && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Pilih yang paling mirip gaya orangnya.</div>
                      {onOpenScripts && <button onClick={onOpenScripts} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)" }}>Buka Script Library →</button>}
                    </div>
                  )}
                  <button onClick={() => setReplyFor(null)} style={{ ...chip, width: "100%", minHeight: 40, marginTop: 10, fontWeight: 700, color: "var(--app-text)" }}>Tutup saran balasan</button>
                </div>
              )}
              {referring?.id === h.id && (
                <div style={inlineEditor}>
                  <label htmlFor={`ref-${h.id}`} style={label}>Siapa yang dia rekomendasiin?</label>
                  <input id={`ref-${h.id}`} autoFocus value={referring.who} onChange={e => setReferring({ ...referring, who: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") saveReferral(); if (e.key === "Escape") setReferring(null); }}
                    placeholder="@akun atau link profilnya" aria-label="Akun yang direkomendasiin" style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
                  <div style={editorButtons}>
                    <button onClick={() => setReferring(null)} style={{ ...btnMuted, minHeight: 44 }}>Batal</button>
                    <button onClick={saveReferral} disabled={!referring.who.trim()} style={{ ...btnPrimary, minHeight: 44, opacity: referring.who.trim() ? 1 : 0.5 }}>Jadiin target</button>
                  </div>
                </div>
              )}
              {noting?.id === h.id && (
                <div style={inlineEditor}>
                  <label htmlFor={`why-${h.id}`} style={label}>Kenapa ditolak? (opsional)</label>
                  <input id={`why-${h.id}`} autoFocus value={noting.note} onChange={e => setNoting({ ...noting, note: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") setNoting(null); }}
                    placeholder="mis. udah punya fotografer" aria-label="Alasan ditolak" style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
                  <div style={editorButtons}>
                    <button onClick={() => setNoting(null)} style={{ ...btnMuted, minHeight: 44 }}>Lewati</button>
                    <button onClick={saveNote} style={{ ...btnPrimary, minHeight: 44 }}>Simpan</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {shown.length > limit && <button onClick={() => setLimit(limit + PAGE)} style={{ ...chip, width: "100%", marginTop: 8, minHeight: 40 }}>Tampilkan {Math.min(PAGE, shown.length - limit)} lagi</button>}
      </div>
      </details>

      <OccupancyCalendar quotes={allQuotes} invoices={allInvoices} />
      {/* Which message works */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Pesan mana yang works?</div>
        <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 14 }}>Dibales = dijawab apa pun, termasuk ditolak. Tertarik = mau lanjut. Angka mulai bisa dipercaya setelah {MIN_SAMPLE} DM per template.</div>
        {advice && <div style={{ fontSize: 12, padding: 12, borderRadius: 10, background: "#f59e0b14", border: "1px solid #f59e0b50", marginBottom: 14 }}>💡 {advice}</div>}
        {scores.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Belum ada data. Catat beberapa DM dulu.</div>}
        {scores.map(s => (
          <div key={s.templateId} style={{ padding: "10px 0", borderTop: "1px solid var(--app-inner)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)", flexShrink: 0 }}>{s.sent} DM{s.sent < MIN_SAMPLE ? " · sampel kecil" : ""}</div>
            </div>
            {([["Dibales", s.responseRate, "#f59e0b"], ["Tertarik", s.winRate, "#00a862"]] as [string, number, string][]).map(([k, r, c]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <div style={{ fontSize: 12, color: "var(--app-muted)", width: 56 }}>{k}</div>
                <div style={{ flex: 1, height: 6, background: "var(--app-inner)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r * 100}%`, height: "100%", background: c }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(r)}</div>
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

      <HunterStats prospects={prospects} sessions={journey.sessions} />
      </div>

      {editDefaults && <DefaultsSheet value={savedDefaults} tagline={business.tagline} onClose={() => setEditDefaults(false)} />}

      {goalDraft !== null && (
        <div className="modal-overlay" onClick={() => { if (!savingGoal) setGoalDraft(null); }}>
          <form noValidate aria-labelledby="goal-h" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); saveGoal(); }} style={{ ...modalBox, maxWidth: 400 }}>
            <div id="goal-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>Target DM per hari</div>
            <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--app-muted)" }}>Berapa DM yang mau kamu kirim tiap hari? Progresnya keliatan di kartu DM hari ini dan di bar sesi.</p>
            <label htmlFor="goal-n" style={label}>Jumlah DM</label>
            <input id="goal-n" type="number" inputMode="numeric" min={1} step={1} autoFocus value={goalDraft}
              onChange={e => { setGoalDraft(e.target.value); setGoalError(""); }} placeholder="Contoh: 20"
              aria-invalid={Boolean(goalError)} aria-describedby={goalError ? "goal-err" : undefined}
              style={{ ...inputStyle, fontSize: 16, minHeight: 48 }} />
            {goalError && <p id="goal-err" role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--hot)" }}>{goalError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setGoalDraft(null)} disabled={savingGoal} style={{ ...btnMuted, flex: 1, minHeight: 44 }}>Batal</button>
              <button type="submit" disabled={savingGoal} style={{ ...btnPrimary, flex: 1, minHeight: 44, opacity: savingGoal ? 0.7 : 1 }}>{savingGoal ? "Menyimpan…" : "Simpan target"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
