"use client";

import { ink } from "@/components/ui";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { signOut, User } from "firebase/auth";
import { STALL_DAYS, stalledWhat, useStalledDeals } from "@/lib/stalled";
import { inPlay, isHigh, scoreLead } from "@/lib/score";
import Beranda from "@/components/Beranda";
import BerandaReport from "@/components/BerandaReport";
import { sentIn } from "@/lib/activity";
import BerandaLearn from "@/components/BerandaLearn";
import { DetailActions, LeadPage, LeadPatch, LostNote } from "@/components/LeadDetail";
import { channelOf } from "@/lib/leadEdit";
import Icon, { IconName } from "@/components/Icon";
import ProfileSheet, { MeAvatar, useMyAvatar } from "@/components/ProfileSheet";
import AddLead, { AddWay } from "@/components/AddLead";
import { nextMove, withStand } from "@/lib/leadStand";
import LeadCard from "@/components/LeadCard";
import { leadHistory } from "@/lib/leadHistory";
import { registerWorker, takeSharedFile } from "@/lib/share";
import type { LeadProfile } from "@/lib/profile";
import { Space, SpaceContext, seesEveryone, spaceDoc, spaceQuery, stamp } from "@/lib/space";
import { SpaceOption, useSpaceChoice } from "@/lib/spaceChoice";
import { disablePush, restorePush } from "@/lib/push";
import PushToggle from "@/components/PushToggle";
import { collection, doc, getCountFromServer, getDoc, setDoc, onSnapshot, deleteDoc, deleteField, writeBatch, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { clearCacheAndReload as resetAppCache } from "@/lib/appCache";
import SalesSimulator from "@/components/SalesSimulator";
import ChatAnalysis from "@/components/ChatAnalysis";
import ScriptLibrary from "@/components/ScriptLibrary";
import QuickPitch from "@/components/QuickPitch";
import Services from "@/components/Services";
import Quotes, { LeadRef } from "@/components/Quotes";
import Invoices from "@/components/Invoices";
import Hunting from "@/components/Hunting";
import HuntBar from "@/components/HuntBar";
import OccupancyCalendar from "@/components/OccupancyCalendar";
import FollowUpRun from "@/components/FollowUpRun";
import { SORTS, Sort, VIEWS, View as LeadView, followUpQueue, inView, matches, sortLeads } from "@/lib/leadQuery";
import ClientHub from "@/components/ClientHub";
import SalesReport from "@/components/SalesReport";
import GuildHub from "@/components/GuildHub";
import { OutreachTab, RejectionTab, type Outreach, type Rejection } from "@/components/TeamLogs";
import ActivityLog from "@/components/ActivityLog";
import TeamDashboard from "@/components/TeamDashboard";
import LeadSources from "@/components/LeadSources";
import ModalA11y from "@/components/ModalA11y";
import { Hunt, useClosingTarget, useHuntGoal } from "@/lib/hunting";
import { JOURNEY_STEPS, Prospect, journeyStep, queue, statusColor as prospectColor, statusLabel, view } from "@/lib/prospects";
import { profileUrl } from "@/lib/threads";
import { recordSend, useHuntSession, useProspects, useStrategy } from "@/lib/prospectStore";
import PendingSends from "@/components/PendingSends";
import AppToast from "@/components/AppToast";
import { toast, withToast } from "@/lib/toast";
import type { PendingSend } from "@/lib/pendingSend";
import { InboundLead, isMember, leadFromInbound, leadIdFor, mergeInbound } from "@/lib/inbound";
import { Component, Invoice, PriceChange, Quote, QuoteTemplate, Service, addDays, balance, daysBetween, invoiceState, owed, longDate, rupiah, today, total, useBusiness, useSpaceCollection, waLink } from "@/lib/billing";
import { useConfirm } from "@/components/ConfirmSheet";
import { LeadGeo, validGeo } from "@/lib/geo";

// Five places, in the order the work goes (owner, 2026-10-10): find people,
// sell to them, report as a team, learn. A place with several tabs picks them
// from a second row, and each tab says in one line what it's for.
const SECTIONS: { id: string; label: string; short: string; icon: string; tabs: string[] }[] = [
  { id: "home", label: "Beranda", short: "Beranda", icon: "home" as IconName, tabs: ["Dashboard"] },
  { id: "hunt", label: "Hunting", short: "Hunting", icon: "target" as IconName, tabs: ["Hunting"] },
  { id: "sell", label: "Jualan", short: "Jualan", icon: "briefcase" as IconName, tabs: ["Leads", "Penawaran", "Invoice", "Paket"] },
  { id: "team", label: "Tim & Report", short: "Tim", icon: "shield" as IconName, tabs: ["Dashboard tim", "Guild", "Report Klien", "Log aktivitas", "Outreach", "Rejection Log"] },
  { id: "learn", label: "Belajar", short: "Belajar", icon: "book" as IconName, tabs: ["Script Library", "Analisis Chat", "Simulator", "AI Playbook"] },
];
// Only tabs without a heading of their own get a line here; the others say
// what they're for under their own title, and saying it twice read as clutter.
const TAB_HINT: Record<string, string> = {
  Leads: "Semua calon customer: siapa yang belum dikontak, posisinya di mana, dan riwayatnya.",
  "Report Klien": "Report bulanan buat klien: konten, chat, sampai lunas.",
};
const sectionOf = (tab: string) => SECTIONS.find(x => x.tabs.includes(tab)) || SECTIONS[0];

interface Lead {
  id: string; name: string; contact: string; source: string; status: string;
  score?: number; email: string; phone: string; category: string; notes: string;
  lastContact: string; value: number;
  nextAction?: string; nextActionDate?: string;
  accountUid?: string;
  ownerUid?: string; ownerName?: string;   // in a guild space
  lastReplyAt?: string;                    // when they last answered (PRD-008 §2)
  contactedAt?: string;                    // last confirmed contact from us; everyone in a guild reads it (PRD-022 Q3)
  profile?: LeadProfile;                   // need, pain, objection, type (PRD-008 §3)
  address?: string;
  geo?: LeadGeo;                           // where it is on the street map (PRD-013)
}

// New accounts start empty. Earlier versions wrote example rows (ids seed_…)
// into every new account; the dashboard offers to remove any still there.

const AI_PLAYBOOK = [
  {
    category: "🗺️ Scraping Google Maps", color: "var(--ok)",
    steps: [
      { title: "Tool: PhantomBuster / Outscraper", desc: "Scrape bisnis lokal dari GMaps: nama, telepon, email, rating, kategori, jam buka. Filter rating 4.0+ = prospek aktif." },
      { title: "Tool: Apollo.io / Hunter.io", desc: "Enrich data dengan email decision maker. Tambah LinkedIn profile otomatis." },
      { title: "Segmentasi Smart", desc: "Kelompokkan: F&B, Retail, Health, Service. Buat template pitch berbeda per segmen." },
      { title: "Validasi Email", desc: "Gunakan NeverBounce / ZeroBounce sebelum kirim. Bounce rate tinggi = domain banned." },
    ]
  },
  {
    category: "📩 Cold Outreach di Era AI", color: "color-mix(in srgb, #ff6b35 55%, var(--app-text))",
    steps: [
      { title: "AI Personalization Hook", desc: "Pakai Claude/GPT untuk generate opening line unik per lead berdasarkan Google review, post IG, atau berita terbaru mereka." },
      { title: "Sequence: 7-Touch Formula", desc: "D1: Email → D3: LinkedIn/IG DM → D5: Follow-up email → D8: WhatsApp → D14: Nilai tambah konten → D21: Last call → D30: Break-up email." },
      { title: "Subject Line A/B Test", desc: "Test 3 variasi subject per batch 50 leads. Pakai Lemlist/Instantly.ai untuk automasi + tracking open rate." },
      { title: "Social Proof First", desc: "Mulai DM dengan social proof lokal: 'Kami bantu [bisnis sejenis di kota mereka] naik X%' lebih powerful dari feature pitch." },
    ]
  },
  {
    category: "📊 Meningkatkan Sales Metrics", color: "color-mix(in srgb, #a78bfa 55%, var(--app-text))",
    steps: [
      { title: "AI Scoring Leads", desc: "Pakai model sederhana: website ada? (20pts) → Review GMaps 4+ (20pts) → Aktif sosmed (20pts) → Kategori high-intent (20pts) → Budget signals (20pts). Score 70+ = prioritas utama." },
      { title: "Conversion Rate Optimization", desc: "Target: Cold email reply rate 5-15% | DM reply rate 20-35% | Meeting rate dari reply 40%+ | Close rate dari meeting 25%+." },
      { title: "AI Call Coaching", desc: "Record sales call, transkrip pakai Whisper/Otter.ai, analisis objection patterns. Build objection handling script dari data nyata." },
      { title: "Predictive Follow-Up", desc: "Track kapan lead buka email (time zone + jam aktif). Kirim follow-up 1-2 jam setelah mereka buka email pertama." },
    ]
  },
  {
    category: "🤖 Stack AI Sales Modern", color: "color-mix(in srgb, #f59e0b 55%, var(--app-text))",
    steps: [
      { title: "Prospecting: Clay.com", desc: "Build lead list dinamis dari 50+ sumber data. Auto-enrich + auto-personalize dengan AI waterfall." },
      { title: "Outreach: Instantly.ai / Lemlist", desc: "Kirim cold email skala besar (100-500/hari) dengan warming otomatis. Deliverability terjaga." },
      { title: "CRM: HubSpot Free / Notion", desc: "Track semua touchpoint. Set reminder follow-up otomatis. Jangan andalkan ingatan." },
      { title: "Closing: AI Proposal Generator", desc: "Gunakan ChatGPT + template untuk buat proposal custom dalam 5 menit. Win rate naik 30% vs proposal generic." },
    ]
  },
];

// ---- Website leads -------------------------------------------------------
// Every website (Visufavor, BeUntamed, UNTMD Sports) adds its sign-ups to
// inbound_leads, in the shape firestore.rules checks — the standard is
// docs/LEADS-PRD.md in the Visufavor repo. The owner's SalesPal turns each new
// one into a lead here and marks it imported, so it arrives exactly once.
// Cold uses a slate/dormant hue kept distinct from the brand blue (#005eb0)
const statusColor: Record<string, string> = { Hot: "#ff4444", Warm: "#ff9900", Cold: "#64748b", Closed: "#00a862" };
const statusBg: Record<string, string> = { Hot: "#ff44441a", Warm: "#ff99001a", Cold: "#64748b1a", Closed: "#00a8621a" };

const inputStyle = {
  background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 8,
  color: "var(--app-text)", padding: "10px 14px", fontSize: 13, width: "100%", fontFamily: "'Plus Jakarta Sans', sans-serif",
};
const btnPrimary = {
  background: "#005eb0", color: "#fff",
  border: "none", borderRadius: 8, padding: "11px 20px",
  fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";


function useIsNarrow(bp = 640) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return narrow;
}

export default function SalesTracker({ user }: { user: User }) {
  const myName = user.displayName || (user.email || "").split("@")[0];
  const { space, options, choose } = useSpaceChoice(user.uid, myName);
  if (!space) {
    return <div role="status" style={{ background: "var(--app-bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--app-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Membuka ruang kerja…</div>;
  }
  return (
    <SpaceContext.Provider value={space}>
      <Tracker user={user} space={space} spaces={options} chooseSpace={choose} />
    </SpaceContext.Provider>
  );
}

function Tracker({ user, space, spaces, chooseSpace }: { user: User; space: Space; spaces: SpaceOption[]; chooseSpace: (id: string) => void }) {
  const [ask, askSheet] = useConfirm();
  const router = useRouter();
  const isNarrow = useIsNarrow();
  // A share or bookmarklet opens straight into Hunting (/dashboard?hunt&target=…);
  // joining a guild lands on it (/dashboard?guild).
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "Dashboard";
    const q = new URLSearchParams(window.location.search);
    return q.has("hunt") ? "Hunting" : q.has("guild") ? "Guild" : "Dashboard";
  });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sp-theme") || "light";
    setIsDark(saved === "dark");
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    localStorage.setItem("sp-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }
  const [storedLeads, setLeads] = useState<Lead[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [leadQ, setLeadQ] = useState("");
  const [leadLimit, setLeadLimit] = useState(20);
  const [leadView, setLeadView] = useState<LeadView>("semua");
  const [leadSort, setLeadSort] = useState<Sort>("kerja");
  const [fuRun, setFuRun] = useState<Lead[] | null>(null);
  const [pageOpen, setPageOpen] = useState(false);
  const [pageStart, setPageStart] = useState<"chat" | "edit" | null>(null);
  const [runList, setRunList] = useState<string[] | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);   // a quote or invoice opened from a lead's Riwayat
  // Where a jump to another tab came from (PRD-026): closing what you went to see
  // brings you back there, by its name, instead of leaving you on another tab.
  const [cameFrom, setCameFrom] = useState<{ tab: string; label: string; leadId?: string } | null>(null);
  const [huntFocus, setHuntFocus] = useState<string | null>(null);   // a prospect opened from Beranda
  // Offline: say so once, at the top, instead of buttons that spin (AMB-07).
  // Changes wait on this phone (Firestore persistence) and go out when the signal is back.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  const wide = !useIsNarrow(1023);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  // Tambah lead: one door, opened on the way the button asked for (PRD-022 Q12).
  const [door, setDoor] = useState<AddWay | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showBell, setShowBell] = useState(false);
  // "Atur target": a small sheet with Batal/Simpan instead of the browser's prompt().
  const bellBtn = useRef<HTMLButtonElement>(null);
  const bellPop = useRef<HTMLDivElement>(null);
  const profileBtn = useRef<HTMLButtonElement>(null);
  // What sticks under the header (Hunting's tabs, "‹ Daftar") sits at its real
  // height: the session bar and a section's sub-tabs change it.
  const topRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--sp-head", `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The bell's popover closes like any popover: Escape (focus back on the
  // bell) or a tap/click anywhere outside it.
  useEffect(() => {
    if (!showBell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".modal-overlay")) return;
      setShowBell(false); bellBtn.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (bellPop.current?.contains(t) || bellBtn.current?.contains(t)) return;
      setShowBell(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [showBell]);
  const [targetDraft, setTargetDraft] = useState<string | null>(null);
  const [targetError, setTargetError] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const myAvatar = useMyAvatar(user.uid);
  const [updateInfo, setUpdateInfo] = useState<{ latest: string; hasUpdate: boolean; error?: boolean } | null>(null);
  const [clearing, setClearing] = useState(false);

  const uid = user.uid;
  const spaceKey = `${space.kind}:${space.id}:${space.role || ""}`;
  const showOwner = seesEveryone(space);
  const services = useSpaceCollection<Service>(space, "services");
  const components = useSpaceCollection<Component>(space, "components");
  const quoteTemplates = useSpaceCollection<QuoteTemplate>(space, "quoteTemplates");
  const priceHistory = useSpaceCollection<PriceChange>(space, "pricelistHistory");
  const quotes = useSpaceCollection<Quote>(space, "quotes");
  const invoices = useSpaceCollection<Invoice>(space, "invoices");
  const business = useBusiness(space);
  const hunts = useSpaceCollection<Hunt>(space, "hunts");
  const huntGoal = useHuntGoal(space);
  const closingTarget = useClosingTarget(space);
  // Prospect journeys and the hunting session (PRD-009), shared by the bar,
  // Hunting and Perlu Ditindak.
  const { rows: prospects, ready: prospectsReady } = useProspects(space);
  // The list, the score and the scripts all see leads through this (PRD-021):
  // a contact counts only if something shows it happened.
  const leads = useMemo(() => withStand(storedLeads, { outreach, hunts, quotes, invoices }), [storedLeads, outreach, hunts, quotes, invoices]);
  const strategy = useStrategy(space);
  const huntSession = useHuntSession(space);
  const stuck = useStalledDeals(uid);
  useEffect(() => { restorePush(); registerWorker(); }, []);

  // A WhatsApp export shared from Android (PRD-008 §5): ask which lead it's for.
  const [shared, setShared] = useState<File | null>(null);
  const [shareFor, setShareFor] = useState<{ leadId: string; file: File } | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState("");
  const [shareQ, setShareQ] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("share")) return;
    history.replaceState(null, "", "/dashboard");
    if (q.get("share")) { setShareMsg("File-nya ga kebawa. Buka SalesPal sekali dari ikon di layar utama, terus bagikan ulang dari WhatsApp."); return; }
    takeSharedFile().then(f => f ? setShared(f) : setShareMsg("File-nya ga ketemu. Coba bagikan ulang dari WhatsApp."));
  }, []);
  const [quoteFor, setQuoteFor] = useState<LeadRef | null>(null);
  const [fu, setFu] = useState({ action: "", date: "" });
  const clearQuoteFor = useCallback(() => setQuoteFor(null), []);
  const gotoInvoices = useCallback(() => setActiveTab("Invoice"), []);
  const gotoHunting = useCallback(() => setActiveTab("Hunting"), []);
  const gotoScripts = useCallback(() => { setActiveTab("Script Library"); window.scrollTo({ top: 0 }); }, []);

  useEffect(() => {
    // A different space: start from empty rather than show the last one's rows.
    setLeads([]); setOutreach([]); setRejections([]); setSelectedLead(null);
    const unsubs = [
      onSnapshot(spaceQuery(space, "leads"), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead));
        setLeads(docs);
      }),
      onSnapshot(spaceQuery(space, "outreach"), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Outreach));
        setOutreach(docs);
      }),
      onSnapshot(spaceQuery(space, "rejections"), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Rejection));
        setRejections(docs);
      }),
    ];
    return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceKey]);

  // A guild picked as the main workspace (PRD-007 §2.7) also takes the website leads.
  const [mainGuild, setMainGuild] = useState<string | null>(null);
  useEffect(() => onSnapshot(doc(db, "users", uid, "settings", "workspace"),
    s => setMainGuild((s.data() as { mainGuild?: string | null } | undefined)?.mainGuild || null), () => setMainGuild(null)), [uid]);
  const inboundTo = mainGuild && spaces.some(o => o.id === mainGuild) ? mainGuild : null;
  // In a guild, leads still sitting in Pribadi (Leads shows a way to bring them in).
  const [personalLeads, setPersonalLeads] = useState(0);
  useEffect(() => {
    if (space.kind !== "guild") { setPersonalLeads(0); return; }
    getCountFromServer(collection(db, "users", uid, "leads")).then(c => setPersonalLeads(c.data().count), () => setPersonalLeads(0));
  }, [spaceKey, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    // Website leads: into the owner's own space, or the guild they made their main one. Only the owner may
    // read them (firestore.rules); for anyone else this listener is refused and simply stays quiet.
    unsubs.push(
      onSnapshot(
        query(collection(db, "inbound_leads"), where("status", "==", "new")),
        (snap) => {
          snap.docs.forEach(async (d) => {
            try {
              const l = d.data() as InboundLead;
              const id = leadIdFor(l, d.id);
              const ref = inboundTo ? doc(db, "guilds", inboundTo, "leads", id) : doc(db, "users", uid, "leads", id);
              // A Member can't read a guild lead that isn't there yet: treat that as new.
              const existing = await getDoc(ref).catch(() => null);
              const lead = mergeInbound(existing?.exists() ? existing.data() : null, leadFromInbound(l), isMember(l));
              if (lead) await setDoc(ref, inboundTo ? { ...lead, ownerUid: uid, ownerName: space.me.name } : lead, { merge: true });
              await updateDoc(doc(db, "inbound_leads", d.id), { status: "imported", importedAt: serverTimestamp(), importedBy: uid });
            } catch (err) {
              console.warn("Could not import website lead", d.id, err);
            }
          });
        },
        () => { /* not the owner: no website leads for this account */ }
      )
    );
    return () => unsubs.forEach(u => u());
  }, [uid, inboundTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Asked first in the lead's own "Hapus lead?" sheet (components/LeadDetail).
  async function deleteLead(id: string) {
    await deleteDoc(spaceDoc(space, "leads", id));
  }

  // `list`: who to go on to after this one, when it wasn't opened from Leads.
  // Labels for "Kembali ke …": what the place is called where you came from.
  const TAB_WORD: Record<string, string> = { Dashboard: "Beranda" };
  function jump(tab: string) {
    setCameFrom({ tab: activeTab, label: TAB_WORD[activeTab] || activeTab });
    setActiveTab(tab);
  }
  function goBack() {
    const c = cameFrom;
    if (!c) return;
    setCameFrom(null);
    setActiveTab(c.tab);
    const l = c.leadId ? leads.find(x => x.id === c.leadId) : null;
    if (l) openLead(l);
  }

  function openLead(lead: Lead, start: "chat" | "edit" | null = null, list: string[] | null = null) {
    setRunList(list);
    setSelectedLead(lead);
    setFu({ action: lead.nextAction || "", date: lead.nextActionDate || "" });
    setPageStart(start);
    setPageOpen(true);
  }

  // Everything a lead's page can do (components/LeadDetail.tsx).
  function leadActions(l: Lead): DetailActions {
    return {
      onSaveProfile: profile => updateDoc(spaceDoc(space, "leads", l.id), { profile }),
      onImport: patch => {
        const { lastReplyAt, ...rest } = patch;
        const newer = lastReplyAt && (!l.lastReplyAt || lastReplyAt > l.lastReplyAt);
        setShareFor(null);
        return updateDoc(spaceDoc(space, "leads", l.id), {
          ...rest, ...(newer ? { lastReplyAt, ...(lastReplyAt > (l.lastContact || "") ? { lastContact: lastReplyAt } : {}) } : {}),
        });
      },
      onReplied: () => withToast(`Balasan ${l.name} dicatat`, () => markReplied(l.id)),
      onSchedule: async (action, date) => {
        // The date it's set to, said back (GAP-LEAD-3).
        const ref = spaceDoc(space, "leads", l.id);
        const prev = { nextAction: l.nextAction || "", nextActionDate: l.nextActionDate || "" };
        await updateDoc(ref, { nextAction: action, nextActionDate: date });
        toast({ text: `${action || "Follow-up"} ${l.name} ${longDate(date)}`, undo: () => updateDoc(ref, prev) });
      },
      onDone: async () => { await doneFollowUp(l.id); toast({ text: `Follow-up ${l.name} selesai` }); },
      onQuote: () => { const from = { tab: activeTab, label: l.name, leadId: l.id }; setPageOpen(false); startQuote(l); setCameFrom(from); },
      onDelete: async () => { await deleteLead(l.id); setPageOpen(false); setSelectedLead(null); toast({ text: `Lead ${l.name} dihapus` }); },
      onSavePhone: phone => updateDoc(spaceDoc(space, "leads", l.id), { phone }),
      onSaveGeo: (geo, address) => updateDoc(spaceDoc(space, "leads", l.id), { geo: geo || deleteField(), ...(address !== undefined ? { address } : {}) }),
      onSaveLead: (patch, lost) => saveLead(l, patch, lost),
      onContacted: what => logContact(l, what),
      onMarkContacted: () => markContacted(l),
    };
  }

  // Ubah data lead. Gugur clears the reminder and writes why to the Rejection
  // Log, under the lead's owner, in the same commit.
  async function saveLead(l: Lead, patch: LeadPatch, lost?: LostNote) {
    const ref = spaceDoc(space, "leads", l.id);
    const change = { ...patch, ...(lost ? { nextAction: "", nextActionDate: "" } : {}) } as Record<string, unknown>;
    const rej = spaceDoc(space, "rejections", `rej_${Date.now()}`);
    const batch = writeBatch(db);
    batch.update(ref, change);
    if (lost) batch.set(rej, stamp(space, {
      leadName: patch.name, leadId: l.id, date: today(), reason: lost.reason, channel: channelOf(patch.source),
      followUpDate: lost.retry, lesson: "",
    }, l));
    await batch.commit();
    // Gugur is a big change made inside a form: say so, and let it be taken
    // back with its Rejection Log row (GAP-LEAD-2). Other edits: just say so.
    const prev = Object.fromEntries(Object.keys(change).map(k => {
      const v = (l as unknown as Record<string, unknown>)[k];
      return [k, v === undefined ? deleteField() : v];
    }));
    toast(lost
      ? { text: `${patch.name} ditandai Gugur · alasannya masuk Rejection Log`, undo: async () => { const b = writeBatch(db); b.update(ref, prev); b.delete(rej); await b.commit(); } }
      : { text: `Data ${patch.name} disimpan` });
  }

  // A message confirmed sent is today's contact: once a day per lead, logged in
  // Outreach under whoever chatted (Log aktivitas, Dashboard tim). The undo
  // puts both back.
  const contacted = useRef(new Set<string>());
  async function logContact(l: Lead, what: string) {
    const on = today();
    const key = `${l.id}_${on}`;
    if (l.contactedAt === on || contacted.current.has(key)) return;
    contacted.current.add(key);
    const prev = { lastContact: l.lastContact || "", contactedAt: l.contactedAt ?? deleteField() };
    const ref = spaceDoc(space, "leads", l.id);
    const out = spaceDoc(space, "outreach", `out_${Date.now()}`);
    const batch = writeBatch(db);
    batch.update(ref, { lastContact: on, contactedAt: on });
    batch.set(out, stamp(space, { leadName: l.name, leadId: l.id, type: "WhatsApp", date: on, subject: what, status: "Sent", opens: 0, clicks: 0 }));
    try { await batch.commit(); } catch (e) { contacted.current.delete(key); throw e; }
    return async () => {
      const b = writeBatch(db);
      b.update(ref, prev);
      b.delete(out);
      await b.commit();
      contacted.current.delete(key);
    };
  }

  // Contact made outside the app (PRD-022 Q2): on the lead, not in Outreach,
  // since nothing was sent from here.
  async function markContacted(l: Lead) {
    const on = today();
    const ref = spaceDoc(space, "leads", l.id);
    const prev = { lastContact: l.lastContact || "", contactedAt: l.contactedAt ?? deleteField() };
    await updateDoc(ref, { lastContact: on, contactedAt: on });
    return async () => { await updateDoc(ref, prev); };
  }

  // WhatsApp sent from a Perlu Ditindak card. Each writes down what it was, so
  // the card steps aside instead of asking again tomorrow; Batal puts it back.
  // A follow-up: today's contact, and the same reminder three days on.
  const FOLLOW_AGAIN = 3;
  async function followedUp(l: Lead) {
    const ref = spaceDoc(space, "leads", l.id);
    const prev = l.nextActionDate || "";
    const undoContact = await logContact(l, `Follow-up: ${l.nextAction || "Follow-up"}`);
    await updateDoc(ref, { nextActionDate: addDays(today(), FOLLOW_AGAIN) });
    return async () => { await updateDoc(ref, { nextActionDate: prev }); await undoContact?.(); };
  }
  // A quote nudged (the same field the Penawaran tab's Follow-up WA sets), and
  // the chat counted on its lead.
  async function nudgedQuote(q: Quote) {
    const ref = spaceDoc(space, "quotes", q.id);
    const prev = q.followUpAt;
    const lead = leads.find(l => l.id === q.leadId);
    const undoContact = lead ? await logContact(lead, `Follow-up penawaran ${q.number}`) : undefined;
    await updateDoc(ref, { followUpAt: today() });
    return async () => { await updateDoc(ref, { followUpAt: prev ?? deleteField() }); await undoContact?.(); };
  }
  // A bill reminded: off the list for two days.
  async function remindedInvoice(i: Invoice) {
    const ref = spaceDoc(space, "invoices", i.id);
    const prev = i.remindedAt;
    await updateDoc(ref, { remindedAt: today() });
    return async () => { await updateDoc(ref, { remindedAt: prev ?? deleteField() }); };
  }

  async function saveFollowUp(id: string) {
    await updateDoc(spaceDoc(space, "leads", id), { nextAction: fu.action.trim(), nextActionDate: fu.date });
  }

  // Done: log today as the last contact and clear the reminder. `sent` false:
  // they answered, which doesn't say a message went out today.
  async function doneFollowUp(id: string, sent = true) {
    const l = leads.find(x => x.id === id);
    if (l && sent) await logContact(l, `Follow-up: ${l.nextAction || "selesai"}`);
    await updateDoc(spaceDoc(space, "leads", id), { nextAction: "", nextActionDate: "", lastContact: today() });
    setFu({ action: "", date: "" });
  }

  // They answered: the strongest sign a lead is alive (PRD-008 §2, Respons).
  // They answered: said only after it's written, with Batal (GAP-LEAD-1).
  async function markReplied(id: string) {
    const l = leads.find(x => x.id === id);
    const ref = spaceDoc(space, "leads", id);
    const prev = { lastReplyAt: l?.lastReplyAt ?? deleteField(), lastContact: l?.lastContact || "" };
    await updateDoc(ref, { lastReplyAt: today(), lastContact: today() });
    return async () => { await updateDoc(ref, prev); };
  }

  function startQuote(lead: Lead) {
    setQuoteFor({ id: lead.id, name: lead.name, contact: lead.contact, phone: lead.phone });
    setSelectedLead(null);
    setActiveTab("Penawaran");
  }

  const isSeed = (id: string) => id.startsWith("seed_");
  const seedCount = leads.filter(l => isSeed(l.id)).length + outreach.filter(o => isSeed(o.id)).length + rejections.filter(r => isSeed(r.id)).length;

  function removeSeedData() {
    ask(`Hapus ${seedCount} data contoh?`, "Data yang kamu isi sendiri ga kesentuh.", async () => {
      const batch = writeBatch(db);
      leads.filter(l => isSeed(l.id)).forEach(l => batch.delete(spaceDoc(space, "leads", l.id)));
      outreach.filter(o => isSeed(o.id)).forEach(o => batch.delete(spaceDoc(space, "outreach", o.id)));
      rejections.filter(r => isSeed(r.id)).forEach(r => batch.delete(spaceDoc(space, "rejections", r.id)));
      await batch.commit();
    });
  }

  async function handleLogout() {
    // A signed-out device gets no more reminders meant for this account.
    await disablePush().catch(() => undefined);
    signOut(auth);
    router.replace("/login");
  }

  async function checkUpdate() {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      const j = await res.json();
      const latest = String(j?.version || "");
      setUpdateInfo({ latest, hasUpdate: !!latest && latest !== APP_VERSION });
    } catch {
      setUpdateInfo({ latest: "", hasUpdate: false, error: true });
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function clearCacheAndReload() {
    setClearing(true);
    await resetAppCache();
  }

  // Skor potensi, computed from the lead itself (lib/score.ts), never stored.
  const scores = new Map(leads.map(l => [l.id, scoreLead(l, today())]));
  const sc = (l: Lead) => scores.get(l.id) || scoreLead(l, today());
  const highPotential = leads.filter(l => inPlay(l.status) && isHigh(sc(l).total)).length;
  // Search every field, a quick view, then the chosen order (lib/leadQuery.ts).
  const filteredLeads = sortLeads(
    leads.filter(l => inView(l, leadView, today()))
      .filter(l => matches(l, leadQ)),
    leadSort, l => sc(l).total, today());
  const dueLeads = followUpQueue(leads, today());
  const liveLead = selectedLead ? leads.find(l => l.id === selectedLead.id) || selectedLead : null;
  // Who comes after this one in the list as it's shown, so a run of intros
  // doesn't go back to the list each time (PRD-022 §2).
  const runLeads = runList ? runList.flatMap(id => leads.filter(l => l.id === id)) : filteredLeads;
  const liveAt = liveLead ? runLeads.findIndex(l => l.id === liveLead.id) : -1;
  const nextUp = liveAt < 0 ? undefined : runLeads.slice(liveAt + 1).find(l => nextMove(l).kind === "chat");

  // Everything that needs a move today: reminders due, quotes left hanging,
  // invoices late or nearly due. Upcoming reminders show three days ahead.
  const now = today();
  const sentToday = sentIn(hunts, outreach, space, now);
  const soon = addDays(now, 3);
  // A prospect's line and the chat so far, for its card on Beranda.
  const journeyOf = (p: Prospect) => {
    const v = view(p, now, strategy);
    const h = p.handle.replace(/^@/, "");
    return {
      steps: JOURNEY_STEPS, at: journeyStep(p, v), color: prospectColor(p, v),
      chat: (p.history || []).filter(e => e.kind === "sent" || e.kind === "reply" || e.kind === "post").slice(-6)
        .map(e => ({ who: (e.kind === "sent" ? "kamu" : "dia") as "kamu" | "dia", text: (e.text || "").trim() || (e.kind === "reply" ? "(bales)" : "(pesan)"), at: e.at })),
      profile: p.url || (p.platform === "Threads" ? profileUrl(h) : p.platform === "IG" ? `https://www.instagram.com/${h}/` : undefined),
    };
  };
  const hasWa = (phone?: string) => (phone || "").replace(/\D/g, "").length >= 8;
  // A quote waits three days after it went out or was last nudged.
  const lastAsk = (q: Quote) => (q.followUpAt && q.followUpAt > (q.sentAt || "") ? q.followUpAt : q.sentAt || "");
  const todo = [
    ...leads.filter(l => l.nextActionDate && l.nextActionDate <= soon && inPlay(l.status)).map(l => ({
      key: `l_${l.id}`, when: l.nextActionDate as string, icon: "calendar" as IconName, title: l.name,
      what: l.nextAction || "Follow-up", phone: l.phone, text: `Halo ${l.contact || l.name}, `,
      kind: "Follow-up", action: hasWa(l.phone) ? "Chat" : "Buka lead", wa: hasWa(l.phone), amount: Number(l.value) || 0,
      onSent: () => followedUp(l), logged: `Follow-up ke ${l.name} dicatat · berikutnya ${longDate(addDays(now, FOLLOW_AGAIN))}`,
      target: { type: "lead" as const, id: l.id },
      snooze: async () => {
        const ref = spaceDoc(space, "leads", l.id), prev = l.nextActionDate || "";
        await updateDoc(ref, { nextActionDate: addDays(today(), 1) });
        return async () => { await updateDoc(ref, { nextActionDate: prev }); };
      },
      open: () => openLead(l), inPlace: true,
    })),
    ...queue(prospects, now, strategy).map(p => ({
      key: `p_${p.id}`, when: view(p, now, strategy).due as string, icon: "target" as IconName, title: p.name ? `${p.name} (${p.handle})` : p.handle,
      what: `${statusLabel(p, view(p, now, strategy))} via ${p.platform}`, phone: "", text: "",
      kind: "Hunting", action: p.contact === "baru" ? "Kirim intro" : "Follow-up", wa: false, amount: 0,
      open: () => { setHuntFocus(p.id); jump("Hunting"); },
      journey: journeyOf(p),
    })),
    ...hunts.filter(h => h.status === "Tertarik" && !h.leadId && !h.prospectId).map(h => ({
      key: `h_${h.id}`, when: h.date, icon: "target" as IconName, title: h.target || "Tanpa nama",
      what: `Tertarik via ${h.platform} — jadiin lead`, phone: "", text: "",
      kind: "Tertarik di Hunting", action: "Jadiin lead", wa: false, amount: 0,
      open: () => jump("Hunting"),
    })),
    ...quotes.filter(q => q.status === "Terkirim" && q.sentAt && daysBetween(lastAsk(q), now) >= 3).map(q => ({
      key: `q_${q.id}`, when: addDays(lastAsk(q), 3), icon: "doc" as IconName, title: q.leadName,
      what: `Penawaran ${q.number} belum dijawab ${daysBetween(q.sentAt as string, now)} hari${q.followUpAt ? ` · follow-up ${longDate(q.followUpAt)}` : ""}`, phone: q.phone,
      text: `Halo ${q.contact || q.leadName}, mau follow up penawaran ${q.number} kemarin. Ada yang bisa aku bantu jelasin?`,
      kind: "Penawaran nunggu", action: q.phone ? "Follow up via WA" : "Lihat penawaran", wa: Boolean(q.phone), amount: total(q),
      target: { type: "quote" as const, id: q.id },
      onSent: () => nudgedQuote(q), logged: `Follow-up ${q.number} dicatat · muncul lagi ${longDate(addDays(now, 3))} kalau belum dijawab`,
      open: () => { setOpenDoc(q.id); jump("Penawaran"); },
    })),
    ...stuck.map(s => ({
      key: `s_${s.key}`, when: addDays(s.lastMove, STALL_DAYS), icon: "pause" as IconName, title: s.deal.contactName,
      what: stalledWhat(s), phone: s.deal.phone || "", text: `Halo ${s.deal.contactName}, `,
      kind: "Deal macet", action: "Geser deal", wa: false, amount: s.deal.quoteValue || 0,
      open: () => jump(s.where === "guild" ? "Guild" : "Report Klien"),
    })),
    ...rejections.filter(r => r.followUpDate && r.followUpDate <= soon && r.followUpDate >= addDays(now, -14)).map(r => ({
      key: `r_${r.id}`, when: r.followUpDate, icon: "refresh" as IconName, title: r.leadName,
      what: `Coba lagi setelah ditolak (${r.reason || r.channel})`, phone: "", text: "",
      kind: "Coba lagi", action: "Lihat catatan", wa: false, amount: 0,
      open: () => jump("Rejection Log"),
    })),
    // A reminder sent today or yesterday rests the bill for those two days.
    ...invoices.filter(i => owed(i) > 0 && i.dueDate && i.dueDate <= soon && !(i.remindedAt && i.remindedAt >= addDays(now, -1))).map(i => ({
      key: `i_${i.id}`, when: i.dueDate, icon: "receipt" as IconName, title: i.leadName,
      what: `${invoiceState(i, now) === "Telat" ? "Telat bayar" : "Jatuh tempo"} ${i.number} · sisa ${rupiah(balance(i))}`, phone: i.phone,
      text: `Halo ${i.contact || i.leadName}, reminder invoice ${i.number} jatuh tempo ${longDate(i.dueDate)}, sisa ${rupiah(balance(i))}. Terima kasih!`,
      kind: invoiceState(i, now) === "Telat" ? "Invoice telat" : "Invoice jatuh tempo", action: i.phone ? "Kirim pengingat" : "Lihat invoice", wa: Boolean(i.phone), amount: balance(i),
      target: { type: "invoice" as const, id: i.id },
      onSent: () => remindedInvoice(i), logged: `Pengingat ${i.number} dicatat · muncul lagi ${longDate(addDays(now, 2))} kalau belum lunas`,
      open: () => { setOpenDoc(i.id); jump("Invoice"); },
    })),
  ].sort((a, b) => a.when.localeCompare(b.when));
  // Paling mendesak is the due task with the most money at stake (a late
  // Rp 10 jt bill before a follow-up on a lead with no value). The rest keep
  // date order: desktop shows four cards, and the day's Hunting and
  // follow-ups must stay among them.
  const top = todo.filter(t => t.when <= now && t.amount > 0).reduce<(typeof todo)[number] | null>((m, t) => (!m || t.amount > m.amount ? t : m), null);
  if (top) todo.splice(0, todo.length, top, ...todo.filter(t => t !== top));

  function setClosingTarget() {
    setTargetError("");
    setTargetDraft(closingTarget ? String(closingTarget) : "");
  }
  async function saveClosingTarget() {
    const n = parseInt(targetDraft || "", 10);
    if (!(n > 0)) { setTargetError("Isi jumlah deal, minimal 1."); return; }
    setSavingTarget(true);
    try {
      await setDoc(spaceDoc(space, "settings", "hunting"), { monthlyClosing: n }, { merge: true });
      setTargetDraft(null);
    } catch {
      setTargetError("Target tim cuma bisa diatur Leader atau Officer.");
    } finally {
      setSavingTarget(false);
    }
  }

  // Beranda's four numbers and the lead map (PRD-008 §1).
  const active = leads.filter(l => inPlay(l.status));
  const weekAgo = Date.now() - 7 * 86400000;
  const month = now.slice(0, 7);
  const paidThisMonth = invoices.reduce((a, i) => a + (i.payments || []).filter(p => (p.date || "").startsWith(month)).reduce((b, p) => b + (p.amount || 0), 0), 0);
  const numbers = {
    active: active.length,
    newThisWeek: active.filter(l => Number(l.id.match(/_(\d{13})/)?.[1] || 0) > weekAgo).length,
    high: highPotential,
    closedThisMonth: invoices.filter(i => i.issue !== "Dibatalkan" && (i.date || "").startsWith(month)).length,
    closingTarget,
    paidThisMonth: paidThisMonth ? `${rupiah(paidThisMonth)} masuk bulan ini` : "invoice dibuat bulan ini",
    pipeline: active.reduce((a, l) => a + (Number(l.value) || 0), 0),
    pipelineHigh: active.filter(l => isHigh(sc(l).total)).reduce((a, l) => a + (Number(l.value) || 0), 0),
  };
  const mapLeads = active.map(l => ({
    id: l.id, name: l.name, score: sc(l).total, value: Number(l.value) || 0, phone: l.phone,
    category: l.category, address: l.address, status: l.status, archetype: l.profile?.archetype, ...(validGeo(l.geo) ? { geo: l.geo } : {}),
    why: l.nextActionDate ? `${l.nextAction || "Follow-up"} ${longDate(l.nextActionDate)}` : sc(l).tip ? `Biar naik: ${sc(l).tip}` : "",
  }));

  return (
    <div style={{ background: "var(--app-bg)", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "var(--app-text)" }}>
      {askSheet}
      <style>{`
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: var(--app-card); } ::-webkit-scrollbar-thumb { background: var(--app-border); border-radius: 4px; }
        /* Solid: what scrolls under it must not show through the tabs. */
        .sp-top { position: sticky; top: 0; z-index: 50; background: var(--app-bg); }
        .sp-leads-bar { position: sticky; top: var(--sp-head, 68px); z-index: 6; background: var(--app-bg); padding-block: 8px; margin-top: 4px !important; }
        .sp-top-in { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 0 32px; height: 68px; display: flex; align-items: center; gap: 24px; }
        .sp-nav { margin: 0 auto; display: flex; gap: 2px; padding: 3px; border-radius: 999px; }
        .sp-nav-btn { position: relative; height: 44px; padding: 0 16px; display: flex; align-items: center; gap: 6px; border: none; border-radius: 999px; background: transparent; color: var(--app-ink-2); font: 500 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; white-space: nowrap; }
        .sp-nav-btn.is-on { color: var(--app-text); font-weight: 600; background: var(--thumb); box-shadow: var(--thumb-shadow); }
        .sp-nav-icon { display: none; }
        .sp-nav-short { display: none; }
        .sp-subhint { max-width: 1200px; margin: 0 auto; padding: 8px 32px 0; font-size: 13px; color: var(--app-muted); position: relative; z-index: 1; }
        .sp-iconbtn { width: 44px; height: 44px; border: 0; border-radius: 999px; color: var(--app-ink-2); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; flex-shrink: 0; font-family: inherit; }
        .sp-iconbtn:not(.glass) { background: transparent; }
        .sp-brand-tile { position: relative; flex-shrink: 0; width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(150deg, #3a8fdc 0%, #005eb0 55%, #004a8c 100%); box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.25), 0 1px 2px rgba(0,40,90,0.25); }
        .sp-brand-tile::after { content: ""; position: absolute; inset: 0; background: #fff; -webkit-mask: url(/logo-mark.png) center / 66% no-repeat; mask: url(/logo-mark.png) center / 66% no-repeat; }
        .sp-space { display: flex; align-items: center; height: 44px; border-radius: 999px; color: var(--app-ink-2); font-size: 13px; font-weight: 500; padding: 0 12px 0 16px; gap: 6px; }
        .sp-space select { appearance: none; -webkit-appearance: none; background: transparent; border: none; color: inherit; font: inherit; max-width: 150px; text-overflow: ellipsis; cursor: pointer; outline: none; }
        .sp-subnav { display: flex; gap: 8px; max-width: 1200px; margin: 0 auto; padding: 8px 32px 0; overflow-x: auto; scrollbar-width: none; }
        .sp-subnav::-webkit-scrollbar { display: none; }
        .sp-sub-btn { flex-shrink: 0; height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--app-line-strong); background: transparent; color: var(--app-ink-2); font: 500 13px 'Plus Jakarta Sans', sans-serif; cursor: pointer; white-space: nowrap; }
        .sp-sub-btn.is-on { background: var(--app-text); border-color: var(--app-text); color: var(--app-card); }
        @media (max-width: 767px) {
          .sp-top-in { padding: 0 8px 0 16px; height: 52px; gap: 4px; }
          .sp-brand-word { font-size: 17px !important; }
          /* An iOS tab bar: docked to the bottom edge, 50pt over the home indicator. */
          .sp-nav { position: fixed; z-index: 60; left: 0; right: 0; bottom: 0; height: calc(50px + env(safe-area-inset-bottom, 0px)); padding: 0 4px env(safe-area-inset-bottom, 0px); border-radius: 0; margin: 0; gap: 0; box-shadow: inset 0 0.5px 0 var(--app-line-strong); }
          .sp-nav::before { display: none; }
          .sp-nav.glass { background: var(--app-bg); -webkit-backdrop-filter: none; backdrop-filter: none; }
          /* Header buttons: a light chip, not a floating shadow. */
          /* The bell: a 36px chip inside its 44px tap box. */
          .sp-top .sp-iconbtn.glass { box-shadow: none; background: radial-gradient(circle closest-side, var(--glass-strong) 0 17px, var(--app-line-strong) 17px 17.6px, transparent 18px); -webkit-backdrop-filter: none; backdrop-filter: none; }
          .sp-top .sp-iconbtn.glass::before { display: none; }
          /* The workspace picker: the same flat 36px chip, 44px to the finger. */
          .sp-top .sp-space.glass { border: 0 solid transparent; border-block-width: 4px; background-clip: padding-box; background-color: var(--glass-strong); box-shadow: inset 0 0 0 0.5px var(--app-line-strong); -webkit-backdrop-filter: none; backdrop-filter: none; }
          .sp-top .sp-space.glass::before { display: none; }
          .sp-nav-btn { flex: 1; min-width: 0; height: 50px; flex-direction: column; justify-content: center; gap: 2px; padding: 0; border-radius: 0; font-size: 11px; font-weight: 500; }
          .sp-nav-btn.is-on { background: transparent; box-shadow: none; color: var(--brand-text); font-weight: 600; }
          .sp-nav-icon { display: block; }
          .sp-nav-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
          .sp-nav-short { display: inline; }
          .sp-subhint { padding: 6px 16px 0; font-size: 12px; }
          .sp-space { padding: 0 10px 0 12px; font-size: 12px; }
          .sp-space select { max-width: 132px; }
          .sp-space { min-width: 0; }
          /* Sub-tabs: one segmented control, every tab in view (no sideways scroll). */
          .sp-subnav { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0; margin: 4px 16px 0; padding: 0 2px; overflow: visible; }
          .sp-subnav::before { content: ""; position: absolute; inset: 4px 0; border-radius: 10px; background: color-mix(in srgb, var(--app-text) 7%, transparent); }
          /* 40px pills, 44px to the finger: the hit area reaches past the pill. */
          .sp-sub-btn { position: relative; height: 44px; min-width: 0; padding: 0 4px; border: 0 solid transparent; border-block-width: 6px; background: transparent; background-clip: padding-box; border-radius: 14px; font-size: 13px; color: var(--app-ink-2); overflow: hidden; text-overflow: ellipsis; }
          .sp-sub-btn.is-on { background-color: var(--thumb); border-color: transparent; color: var(--app-text); font-weight: 600; }
          /* Room for the tab bar and Quick Pitch above it: the page always ends clear. */
          .sp-main { padding: 16px 16px calc(124px + env(safe-area-inset-bottom, 0px)) !important; }
          /* Quick Pitch sits just above the tab bar and steps aside while scrolling down. */
          .sp-fab { right: 16px !important; bottom: calc(62px + env(safe-area-inset-bottom, 0px)) !important; width: 48px !important; height: 48px !important; font-size: 20px !important; box-shadow: 0 4px 12px rgba(0,94,176,0.28) !important; }
          /* Filter rows stay one line and slide sideways, bleeding to the screen edge. */
          .sp-chiprow { flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; }
          .sp-chiprow::-webkit-scrollbar { display: none; }
        }
        /* The header gains its edge as content slides under it. Nothing else
           moves with the scroll: the page goes where the finger goes (PRD-018 §3). */
        @supports (animation-timeline: scroll()) {
          .sp-top::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--app-border); opacity: 0; pointer-events: none;
            animation: sp-edge linear both; animation-timeline: scroll(root); animation-range: 0 56px; }
          @keyframes sp-edge { to { opacity: 1; } }
        }
        /* A small phone with the workspace picker: the paw alone says SalesPal,
           so the bell and the avatar keep their place on screen. */
        @media (max-width: 420px) {
          .sp-top-in.has-space .sp-brand-word { display: none; }
          .sp-top-in.has-space { padding-left: 16px; }
        }
        @media (hover: hover) {
          .sp-nav-btn:hover { color: var(--app-text); }
          .tab-btn:hover { background: var(--app-inner) !important; }
          .lead-row:hover { background: var(--app-inner) !important; }
          .step-card:hover { border-color: var(--accent) !important; }
        }
        .lead-row { cursor: pointer; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 100; display: flex; align-items: center; justify-content: center; padding: max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom)); }
        input:focus, select:focus, textarea:focus { border-color: #005eb0 !important; }
      `}</style>

      {/* Header: glass over a soft edge blur, like the canvas */}
      <header ref={topRef} className="sp-top">
        {/* The hunting session's bar over every tab (PRD-009 §4) */}
        {huntSession.live && (
          <HuntBar session={huntSession.live} queued={queue(prospects, now, strategy).length}
            sentToday={sentToday} goal={huntGoal}
            onOpen={gotoHunting} onEnd={huntSession.end} />
        )}
        <div className="pb t" aria-hidden="true" style={{ top: 0, height: 96 }}><span /><span /><span /><span /><span /><span /></div>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 96, background: "linear-gradient(to bottom, var(--bar-tint) 0%, var(--bar-tint) 40%, transparent 100%)", pointerEvents: "none" }} />
        <div className={`sp-top-in${spaces.length > 0 ? " has-space" : ""}`}>
          <button onClick={() => setActiveTab("Dashboard")} aria-label="SalesPal, ke Beranda" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, color: "var(--app-text)", background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
            {/* The app icon, as on the home screen: the paw in white on the brand blue. */}
            <span className="sp-brand-tile" aria-hidden="true" />
            <span className="num sp-brand-word" style={{ fontSize: 19, letterSpacing: "0.06em", paddingTop: 3 }}>SALESPAL</span>
          </button>
          {/* Navigation: a pill in the header on wide screens, a floating bar on phones */}
          <nav className="sp-nav glass" aria-label="Menu utama">
            {SECTIONS.map(sec => {
              const on = sectionOf(activeTab).id === sec.id;
              return (
                <button key={sec.id} className={`sp-nav-btn${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}
                  onClick={() => { setCameFrom(null); if (on) window.scrollTo({ top: 0 }); else setActiveTab(sec.tabs[0]); }}>
                  <span className="sp-nav-icon"><Icon name={sec.icon} size={22} stroke={on ? 1.9 : 1.6} /></span>
                  <span className="sp-nav-label">{sec.label}</span>
                  <span className="sp-nav-short" aria-hidden="true">{sec.short}</span>
                </button>
              );
            })}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
            {spaces.length > 0 && (
              // Workspace: your own data, or a guild's (PRD-007 §2.5).
              <label className="sp-space glass" style={space.kind === "guild" ? { color: "var(--brand-text)" } : undefined}>
                <span className="vh">Ruang kerja</span>
                <select id="space-pick" aria-label="Ruang kerja" value={space.kind === "me" ? uid : space.id}
                  onChange={e => { chooseSpace(e.target.value); setSelectedLead(null); }}>
                  <option value={uid}>👤 Pribadi</option>
                  {spaces.map(o => <option key={o.id} value={o.id}>🛡️ {o.name}</option>)}
                </select>
                <Icon name="chevronDown" size={14} stroke={1.8} />
              </label>
            )}
            <button ref={bellBtn} className="sp-iconbtn glass" aria-haspopup="dialog" aria-label={`Notifikasi${todo.length ? `, ${todo.length} perlu ditindak` : ""}`} aria-expanded={showBell} onClick={() => setShowBell(!showBell)}>
              <Icon name="bell" size={19} stroke={1.6} />
              {todo.some(t => t.when <= now) && <span aria-hidden="true" style={{ position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#005eb0", boxShadow: "0 0 0 2px var(--app-bg)" }} />}
            </button>
            <button ref={profileBtn} className="sp-iconbtn" aria-haspopup="dialog" aria-expanded={showProfile} onClick={() => { setShowProfile(true); setUpdateInfo(null); }} aria-label="Profil dan pengaturan" title="Profil & pengaturan">
              <MeAvatar avatar={myAvatar} name={user.displayName || user.email || "U"} size={32} />
            </button>
          </div>
        </div>
        {showBell && (
          <div ref={bellPop} role="dialog" aria-label="Notifikasi" className="frost" style={{ position: "absolute", zIndex: 70, right: "max(16px, calc((100vw - 1200px) / 2 + 32px))", top: 64, width: "min(360px, calc(100vw - 32px))", borderRadius: 24, padding: 16, boxShadow: "inset 0 0 0 1px var(--frost-ring), 0 12px 32px var(--frost-float)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Notifikasi</div>
              <button className="sp-iconbtn" onClick={() => { setShowBell(false); bellBtn.current?.focus(); }} aria-label="Tutup notifikasi" style={{ width: 44, height: 44, marginRight: -8 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--glass-btn)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={12} stroke={2.4} /></span>
              </button>
            </div>
            <button onClick={() => { setShowBell(false); setActiveTab("Dashboard"); }} className="rowhover" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, margin: "8px 0", padding: "10px 8px", border: "none", borderRadius: 14, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#005eb0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="clock" size={18} /></span>
              <span style={{ flex: 1, fontSize: 14 }}><b>{todo.filter(t => t.when <= now).length}</b> perlu ditindak hari ini<span style={{ display: "block", fontSize: 12, color: "var(--app-muted)" }}>{todo.length} total di Beranda</span></span>
              <Icon name="chevronRight" size={16} />
            </button>
            <PushToggle />
          </div>
        )}
        {sectionOf(activeTab).tabs.length > 1 && (
          <div className="sp-subnav" role="tablist" aria-label={sectionOf(activeTab).label} style={{ position: "relative", zIndex: 1 }}>
            {sectionOf(activeTab).tabs.map(tab => (
              <button key={tab} role="tab" aria-selected={activeTab === tab} className={`sp-sub-btn${activeTab === tab ? " is-on" : ""}`} onClick={() => { setCameFrom(null); if (activeTab === tab) window.scrollTo({ top: 0 }); else setActiveTab(tab); }}>{tab}</button>
            ))}
          </div>
        )}
      </header>
      {/* The hint scrolls away with the page, so the sticky header stays short. */}
      {TAB_HINT[activeTab] && <p className="sp-subhint">{TAB_HINT[activeTab]}</p>}
      {/* The same number as Beranda and Hunting (PRD-022 §2). */}
      {activeTab === "Log aktivitas" && <p className="sp-subhint" aria-label="Rekap hari ini"><b className="tabnum" style={{ color: "var(--app-text)" }}>{sentToday}</b> terkirim hari ini, target {huntGoal}</p>}

      <div className="sp-main" style={{ padding: "32px 32px 96px", maxWidth: 1200, margin: "0 auto" }}>
        {offline && (
          <p role="status" className="sp-offline">Offline. Perubahan disimpan di HP ini dan dikirim begitu ada sinyal.</p>
        )}
        {/* You jumped here from somewhere: one tap back to it, by its name (PRD-026). */}
        {cameFrom && cameFrom.tab !== activeTab && (
          <button type="button" className="sp-return" onClick={goBack}><Icon name="chevronLeft" size={18} stroke={2} />Kembali ke {cameFrom.label}</button>
        )}

        {/* DASHBOARD */}
        {activeTab === "Dashboard" && (
          <Beranda now={now} todo={todo} numbers={numbers} mapLeads={mapLeads}
            hunting={{ live: Boolean(huntSession.live), sentToday, goal: huntGoal, queued: queue(prospects, now, strategy).length,
              onStart: async () => { await huntSession.start(); setActiveTab("Hunting"); }, onOpen: gotoHunting }}
            report={<BerandaReport now={now} numbers={numbers} paid={paidThisMonth} receivable={invoices.reduce((a, i) => a + owed(i), 0)}
              leadsByStatus={leads.reduce((m, l) => ({ ...m, [l.status]: (m[l.status] || 0) + 1 }), {} as Record<string, number>)}
              prospects={prospects} hunts={hunts} outreach={outreach} sessions={huntSession.sessions} onGo={tab => { setActiveTab(tab); window.scrollTo({ top: 0 }); }}
              onSetTarget={setClosingTarget} />}
            learn={<BerandaLearn prospects={prospects} hunts={hunts} rejections={rejections} onGo={tab => { setActiveTab(tab); window.scrollTo({ top: 0 }); }} />}
            onOpenLead={id => { const l = leads.find(x => x.id === id); if (l) openLead(l); }}
            onImport={() => setDoor("excel")} onFind={() => setDoor("maps")} onAdd={() => setDoor("tempel")} onAllLeads={() => setActiveTab("Leads")}
            onSetTarget={setClosingTarget}>
            {space.kind === "guild" && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: -16 }}>Ruang guild {space.name} — {showOwner ? "angka seluruh tim" : "angka kamu di guild ini"}.</div>}
            {seedCount > 0 && (
              <div role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 10, padding: "12px 14px", fontSize: 12.5 }}>
                <span>Ada <b>{seedCount} data contoh</b> (PT Maju Jaya dkk.) dari versi lama yang ikut kehitung di angka kamu.</span>
                <button onClick={removeSeedData} style={{ background: "#005eb0", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Hapus data contoh</button>
              </div>
            )}
            <LeadSources leads={leads} invoices={invoices} />
          </Beranda>
        )}

        {/* LEADS (canvas "Leads + skor potensi") */}
        {activeTab === "Leads" && (() => {
          const shownLeads = filteredLeads.slice(0, leadLimit);
          const leadField: React.CSSProperties = { height: 44, border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "var(--app-card)", color: "var(--app-text)", fontSize: wide ? 14 : 16, fontFamily: "inherit" };
          return (
          <div className="sp-leads">
            {space.kind === "guild" && personalLeads > 0 && (
              <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: "12px 16px", marginBottom: 16, fontSize: 14 }}>
                <span>Ada <b>{personalLeads} lead</b> di ruang Pribadi kamu, belum ada di {space.name}.</span>
                <button onClick={() => setActiveTab("Guild")} style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 18px", borderRadius: 999, border: 0, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Bawa ke {space.name} →</button>
              </div>
            )}
            {/* Phone: title with Tambah lead, then search, then status + Import.
                Wide: title left, everything in one row on the right. */}
            <div className="sp-leads-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: wide ? 16 : 12 }}>
              <h1 style={{ margin: 0, fontSize: wide ? 34 : 26, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.025em" }}>Leads <span className="tabnum" style={{ fontSize: 20, fontWeight: 500, color: "var(--app-muted)", letterSpacing: 0 }}>{leads.length}</span></h1>
              {!wide && <button onClick={() => setDoor("tempel")} style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}><Icon name="plus" stroke={1.8} />Tambah lead</button>}
              <div style={{ display: "flex", gap: 8, flexWrap: wide ? "nowrap" : "wrap", alignItems: "center", width: wide ? "auto" : "100%" }}>
                <div style={{ position: "relative", flex: wide ? "0 0 auto" : "1 1 100%" }}>
                  <label htmlFor="lead-search" className="vh">Cari lead</label>
                  <Icon name="search" style={{ position: "absolute", left: 14, top: 13, color: "var(--app-muted)" }} />
                  <input id="lead-search" type="search" value={leadQ} onChange={e => setLeadQ(e.target.value)} placeholder="Cari nama, nomor, catatan, kebutuhan…" style={{ ...leadField, width: wide ? 260 : "100%", padding: "0 16px 0 42px" }} />
                </div>
                {leads.length > 0 && <>
                  <label className="vh" htmlFor="lead-sort">Urutkan</label>
                  <select id="lead-sort" value={leadSort} onChange={e => setLeadSort(e.target.value as Sort)} style={{ ...leadField, padding: "0 14px", flex: wide ? "0 0 auto" : "1 1 0", minWidth: 0 }}>
                    {SORTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </>}
                <button onClick={() => setDoor("excel")} aria-label="Import lead dari file" title="Import" style={{ height: 44, minWidth: 44, padding: wide ? "0 18px" : 0, border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="upload" stroke={1.7} />{wide && "Import"}</button>
                {wide && <button onClick={() => setDoor("tempel")} style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}><Icon name="plus" stroke={1.8} />Tambah lead</button>}
              </div>
            </div>

            {leads.length > 0 && (
              <div className="sp-leads-head sp-leads-bar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
                {dueLeads.length > 0 && (
                  <button onClick={() => setFuRun(dueLeads)} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    <Icon name="play" size={14} />Follow-up beruntun <span className="tabnum" style={{ background: "rgba(0,0,0,0.28)", borderRadius: 999, padding: "1px 8px" }}>{dueLeads.length}</span>
                  </button>
                )}
                <div role="group" aria-label="Tampilan cepat" className="sp-chiprow" style={{ display: "flex", gap: 8, overflowX: "auto", flex: "1 1 260px", minWidth: 0 }}>
                  {VIEWS.map(v => {
                    const n = v.id === "semua" ? leads.length : leads.filter(l => inView(l, v.id, today())).length;
                    const on = leadView === v.id;
                    if (v.id !== "semua" && !n && !on) return null;
                    return (
                      <button key={v.id} onClick={() => { setLeadView(v.id); setLeadLimit(20); }} aria-pressed={on}
                        style={{ flexShrink: 0, height: 44, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? "var(--app-text)" : "var(--app-line-strong)"}`, background: on ? "var(--app-text)" : "transparent", color: on ? "var(--app-card)" : "var(--app-ink-2)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        {v.label} <span className="tabnum">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredLeads.length === 0 ? (
              <div style={{ marginTop: 24, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: "56px 24px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--app-muted)" }}><Icon name={leads.length === 0 ? "users" : "search"} size={34} stroke={1.4} /></div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{leads.length === 0 ? "Belum ada lead" : "Ga ada lead yang cocok"}</div>
                <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 20 }}>{leads.length === 0 ? "Mulai dengan import Excel/CSV, atau tambah manual." : "Coba ganti pencarian atau saringannya."}</div>
                {leads.length === 0 ? (
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => setDoor("excel")} style={{ height: 44, padding: "0 18px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Import Excel/CSV</button>
                    <button onClick={() => setDoor("tempel")} style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Lead pertama</button>
                  </div>
                ) : (
                  <button onClick={() => { setLeadView("semua"); setLeadQ(""); }} style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reset saringan</button>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
                <section aria-label="Daftar lead" style={{ flex: "999 1 560px", minWidth: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                    {shownLeads.map(lead => {
                      return (
                        <LeadCard key={lead.id} lead={lead} now={now} showOwner={showOwner} onOpen={start => openLead(lead, start)} />
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <p className="tabnum" style={{ margin: 0, fontSize: 13, color: "var(--app-muted)" }}>Menampilkan {shownLeads.length} dari {filteredLeads.length} lead</p>
                    {filteredLeads.length > shownLeads.length && <button onClick={() => setLeadLimit(leadLimit + 20)} style={{ height: 44, padding: "0 18px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Muat lagi</button>}
                  </div>
                </section>
              </div>
            )}
          </div>
          );
        })()}

        {/* HUNTING */}
        {activeTab === "Hunting" && <Hunting hunts={hunts} goal={huntGoal} onOpenScripts={gotoScripts}
          focus={huntFocus && cameFrom ? { id: huntFocus, label: cameFrom.label, back: () => { setHuntFocus(null); goBack(); } } : null}
          leads={leads} outreach={outreach} rejections={rejections} quotes={quotes} invoices={invoices} score={l => sc(l as Lead).total}
          onOpenLead={(id, start, list) => { const l = leads.find(x => x.id === id); if (l) openLead(l, start, list); }}
          onGo={tab => setActiveTab(tab)}
          journey={{ prospects, ready: prospectsReady, strategy, live: huntSession.live, sessions: huntSession.sessions, start: huntSession.start, end: huntSession.end }} />}

        {/* REPORT KLIEN (PRD-005) */}
        {activeTab === "Report Klien" && <><SalesReport quotes={quotes} invoices={invoices} /><ClientHub /></>}

        {/* GUILD (PRD-007) */}
        {activeTab === "Guild" && <GuildHub uid={uid} onUseSpace={g => { chooseSpace(g); setSelectedLead(null); }} name={user.displayName || (user.email || "").split("@")[0]} email={user.email || ""} />}

        {(activeTab === "Penawaran" || activeTab === "Invoice") && <OccupancyCalendar quotes={quotes} invoices={invoices} />}
        {activeTab === "Penawaran" && (
          <Quotes quotes={quotes} invoices={invoices} services={services} components={components} templates={quoteTemplates} business={business}
            leads={leads.map(l => ({ id: l.id, name: l.name, contact: l.contact, phone: l.phone }))}
            startFor={quoteFor} onStarted={clearQuoteFor} onInvoiceCreated={gotoInvoices} openId={openDoc} onOpened={() => setOpenDoc(null)} />
        )}
        {activeTab === "Invoice" && <Invoices invoices={invoices} business={business} services={services} components={components}
          leads={leads.map(l => ({ id: l.id, name: l.name, contact: l.contact, phone: l.phone }))} openId={openDoc} onOpened={() => setOpenDoc(null)} />}
        {activeTab === "Paket" && <Services services={services} components={components} templates={quoteTemplates} history={priceHistory} business={business} />}

        {activeTab === "Dashboard tim" && <TeamDashboard hunts={hunts} quotes={quotes} invoices={invoices} outreach={outreach} rejections={rejections}
          onGo={tab => { setActiveTab(tab); window.scrollTo({ top: 0 }); }} />}
        {activeTab === "Log aktivitas" && <ActivityLog hunts={hunts} sessions={huntSession.sessions} quotes={quotes} invoices={invoices}
          outreach={outreach} rejections={rejections} onGo={tab => { setActiveTab(tab); window.scrollTo({ top: 0 }); }} />}
        {activeTab === "Outreach" && <OutreachTab outreach={outreach} />}
        {activeTab === "Rejection Log" && <RejectionTab rejections={rejections} />}

        {/* SIMULATOR */}
        {activeTab === "Analisis Chat" && <ChatAnalysis />}
        {activeTab === "Simulator" && <SalesSimulator />}

        {/* SCRIPT LIBRARY */}
        {activeTab === "Script Library" && <ScriptLibrary />}

        {/* AI PLAYBOOK */}
        {activeTab === "AI Playbook" && (
          <div className="sp-learn">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>AI Sales Playbook</div>
              <div style={{ color: "var(--app-muted)", fontSize: 13, marginTop: 4 }}>Cara pakai AI dan tools buat cari lead, outreach, dan ngejar angka sales.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {AI_PLAYBOOK.map((section, si) => (
                <div key={si} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: "clamp(16px, 4vw, 24px)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20, color: section.color }}>{section.category}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    {section.steps.map((step, i) => (
                      <div key={i} className="step-card" style={{ ["--accent" as string]: section.color, background: "var(--app-inner)", borderRadius: 10, padding: 16, border: "1px solid var(--app-border)", transition: "border-color 0.2s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: `${section.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: section.color, border: `1px solid ${section.color}40` }}>{i + 1}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: ink(section.color) }}>{step.title}</div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--app-sub)", lineHeight: 1.6 }}>{step.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--app-card)", border: "1px solid #a78bfa40", borderRadius: 14, padding: 24, marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "color-mix(in srgb, #a78bfa 55%, var(--app-text))", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🎯 Target angka sales kamu</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {[
                  { metric: "Cold Email Reply Rate", target: "5–15%", world: "< 3%", color: "var(--ok)" },
                  { metric: "DM Instagram Reply", target: "20–35%", world: "< 10%", color: "color-mix(in srgb, #f59e0b 55%, var(--app-text))" },
                  { metric: "Meeting Rate dari Reply", target: "40%+", world: "< 20%", color: "var(--brand-text)" },
                  { metric: "Close Rate dari Meeting", target: "25–35%", world: "< 15%", color: "color-mix(in srgb, #a78bfa 55%, var(--app-text))" },
                  { metric: "Follow-up Response Rate", target: "30%+", world: "< 10%", color: "color-mix(in srgb, #ff6b35 55%, var(--app-text))" },
                  { metric: "Avg Deal Cycle", target: "< 14 hari", world: "> 30 hari", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" },
                ].map(m => (
                  <div key={m.metric} style={{ background: "var(--app-inner)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 6 }}>{m.metric}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: ink(m.color), fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{m.target}</div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>Rata-rata industri: {m.world}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <AddLead way={door} onWay={setDoor} leads={leads} me={{ name: business.name, tagline: business.tagline }}
        onOpenLead={l => { setDoor(null); openLead(l); }} onClose={() => setDoor(null)} />

      {/* A lead's worksheet: over whatever opened it, so closing lands right back there */}
      {liveLead && pageOpen && (
        <LeadPage key={liveLead.id + (shareFor?.leadId === liveLead.id ? "_share" : "")} lead={liveLead} score={sc(liveLead)} actions={leadActions(liveLead)} wide={wide} start={pageStart}
          next={nextUp ? { name: nextUp.name, go: () => openLead(nextUp, "chat", runList) } : null}
          history={leadHistory(liveLead, { quotes, invoices, outreach, hunts })}
          onOpenDoc={item => { const from = { tab: activeTab, label: liveLead.name, leadId: liveLead.id }; setPageOpen(false); setSelectedLead(null); setOpenDoc(item.docId || null); setActiveTab(item.kind === "penawaran" ? "Penawaran" : "Invoice"); setCameFrom(from); }}
          backLabel={`Kembali ke ${TAB_WORD[activeTab] || activeTab}`}
          onClose={() => { setPageOpen(false); setSelectedLead(null); }} shareFile={shareFor?.leadId === liveLead.id ? shareFor.file : null} />
      )}

      {/* "Udah kekirim?" for sends whose screen is gone (AMB-06): recorded the same way. */}
      <PendingSends space={`${space.kind}:${space.id}`} record={async (p: PendingSend) => {
        if (p.kind === "hunt") return recordSend(space, p.send, prospects.find(x => x.id === p.prospectId), p.sessionId, strategy);
        if (p.kind === "todo") {
          // A Beranda card's WhatsApp, recorded as its card would have.
          const { type, id } = p.target;
          if (type === "lead") { const l = leads.find(x => x.id === id); return l ? (await followedUp(l)) || true : false; }
          if (type === "quote") { const q = quotes.find(x => x.id === id); return q ? (await nudgedQuote(q)) || true : false; }
          const i = invoices.find(x => x.id === id);
          return i ? (await remindedInvoice(i)) || true : false;
        }
        const l = leads.find(x => x.id === p.leadId);
        if (!l) return false;
        return (await logContact(l, p.what)) || true;
      }} />
      <AppToast />

      {/* Profile & Settings Modal */}
      {showProfile && (
        <ProfileSheet uid={user.uid} name={user.displayName || ""} email={user.email || ""} version={APP_VERSION} isDark={isDark} onTheme={toggleTheme}
          onCheckUpdate={checkUpdate} checking={checkingUpdate} update={updateInfo} onRefresh={clearCacheAndReload} refreshing={clearing}
          onLogout={handleLogout} onClose={() => setShowProfile(false)} anchor={profileBtn} />
      )}

      {/* Atur target closing */}
      {targetDraft !== null && (
        <div className="modal-overlay" onClick={() => { if (!savingTarget) setTargetDraft(null); }}>
          <form noValidate aria-labelledby="target-h" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); saveClosingTarget(); }}
            style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <div id="target-h" style={{ fontSize: 17, fontWeight: 700 }}>Target closing bulan ini</div>
            <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--app-muted)" }}>Berapa deal yang mau kamu tutup bulan ini? Progresnya keliatan di Beranda.</p>
            <label htmlFor="target-n" style={{ fontSize: 13, fontWeight: 600, color: "var(--app-sub)", display: "block", marginBottom: 6 }}>Jumlah deal</label>
            <input id="target-n" type="number" inputMode="numeric" min={1} step={1} autoFocus value={targetDraft}
              onChange={e => { setTargetDraft(e.target.value); setTargetError(""); }} placeholder="Contoh: 10"
              aria-invalid={Boolean(targetError)} aria-describedby={targetError ? "target-err" : undefined}
              style={{ ...inputStyle, fontSize: 16, height: 48 }} />
            {targetError && <p id="target-err" role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--hot)" }}>{targetError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setTargetDraft(null)} disabled={savingTarget} style={{ ...btnPrimary, flex: 1, minHeight: 44, background: "var(--app-inner)", color: "var(--app-text)" }}>Batal</button>
              <button type="submit" disabled={savingTarget} style={{ ...btnPrimary, flex: 1, minHeight: 44, opacity: savingTarget ? 0.7 : 1 }}>{savingTarget ? "Menyimpan…" : "Simpan target"}</button>
            </div>
          </form>
        </div>
      )}

      {shared && (
        <div className="modal-overlay" onClick={() => { if (!shareBusy) setShared(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="share-h" data-own-layout onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: "calc(env(safe-area-inset-top, 0px) + 22px) 22px calc(env(safe-area-inset-bottom, 0px) + 22px)", width: "100%", maxWidth: 440, maxHeight: "min(86vh, calc(100dvh - 48px))", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div id="share-h" style={{ fontSize: 17, fontWeight: 700 }}>Chat ini buat lead mana?</div>
                <div style={{ fontSize: 13, color: "var(--app-muted)", margin: "4px 0 12px", overflowWrap: "anywhere" }}>{shared.name}</div>
              </div>
              <button type="button" onClick={() => setShared(null)} disabled={shareBusy} aria-label="Tutup" style={{ flexShrink: 0, width: 44, height: 44, margin: "-10px -10px 0 0", borderRadius: "50%", background: "transparent", border: "none", color: "var(--app-ink-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} stroke={2} /></button>
            </div>
            <label htmlFor="share-q" style={{ position: "absolute", left: -9999 }}>Cari lead</label>
            <input id="share-q" value={shareQ} onChange={e => setShareQ(e.target.value)} placeholder="Cari nama lead" style={{ ...inputStyle, fontSize: 16 }} />
            <div style={{ overflowY: "auto", marginTop: 8, flex: 1 }}>
              {(() => {
                const guess = shared.name.replace(/\.(txt|zip|vcf)$/i, "").replace(/^(Chat WhatsApp dengan|WhatsApp Chat with|WhatsApp Chat -)\s*/i, "").trim();
                const q = (shareQ || "").toLowerCase();
                const list = leads.filter(l => !q || l.name.toLowerCase().includes(q))
                  .sort((a, b) => Number(b.name.toLowerCase().includes(guess.toLowerCase())) - Number(a.name.toLowerCase().includes(guess.toLowerCase())) || a.name.localeCompare(b.name)).slice(0, 30);
                return (
                  <>
                    {list.map(l => (
                      <button key={l.id} onClick={() => { setShareFor({ leadId: l.id, file: shared }); setShared(null); openLead(l); }}
                        className="rowhover" style={{ width: "100%", minHeight: 48, textAlign: "left", padding: "12px 4px", border: "none", borderBottom: "1px solid var(--app-inner)", background: "transparent", color: "inherit", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600 }}>
                        {l.name} <span style={{ fontWeight: 400, color: "var(--app-muted)", fontSize: 13 }}>· {l.category}</span>
                      </button>
                    ))}
                    {list.length === 0 && <p style={{ margin: "8px 0", fontSize: 13, color: "var(--app-muted)" }}>{leads.length ? "Ga ada lead yang cocok. Bikin lead baru di bawah." : "Belum ada lead. Bikin lead baru dari chat ini."}</p>}
                    {shareErr && <p role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--hot)" }}>{shareErr}</p>}
                    <button disabled={shareBusy} onClick={async () => {
                      const id = `lead_${Date.now()}`;
                      const lead = stamp(space, { name: guess || "Lead dari WhatsApp", contact: "", source: "WhatsApp", status: "Warm", email: "", phone: "", category: "F&B", notes: "", value: 0, lastContact: today() });
                      setShareBusy(true); setShareErr("");
                      try { await setDoc(spaceDoc(space, "leads", id), lead); }
                      catch { setShareBusy(false); setShareErr("Gagal bikin lead. Cek koneksi, lalu coba lagi."); return; }
                      setShareBusy(false);
                      setShareFor({ leadId: id, file: shared }); setShared(null); setActiveTab("Leads");
                      openLead({ id, ...lead } as Lead);
                    }} style={{ ...btnPrimary, width: "100%", minHeight: 44, marginTop: 10, opacity: shareBusy ? 0.7 : 1 }}>{shareBusy ? "Menyimpan…" : `+ Lead baru: ${guess || "dari WhatsApp"}`}</button>
                    <button type="button" onClick={() => setShared(null)} disabled={shareBusy} style={{ ...btnPrimary, width: "100%", minHeight: 44, marginTop: 8, background: "var(--app-inner)", color: "var(--app-text)" }}>Batal</button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {shareMsg && (
        <div role="alert" onClick={() => setShareMsg("")} style={{ position: "fixed", left: 16, right: 16, bottom: "calc(100px + env(safe-area-inset-bottom, 0px))", zIndex: 120, maxWidth: 480, margin: "0 auto", background: "var(--app-text)", color: "var(--app-bg)", borderRadius: 12, padding: "12px 14px", fontSize: 13 }}>{shareMsg}</div>
      )}

      {fuRun && (
        <FollowUpRun queue={fuRun} live={id => leads.find(l => l.id === id)}
          onSent={async id => { const l = leads.find(x => x.id === id); if (l) await logContact(l, `Follow-up: ${l.nextAction || "Follow-up"}`); }}
          onReplied={async id => { await markReplied(id); }} onDone={(id, sent) => doneFollowUp(id, sent)}
          onSchedule={(id, action, date) => updateDoc(spaceDoc(space, "leads", id), { nextAction: action, nextActionDate: date })}
          onOpen={id => { const l = leads.find(x => x.id === id); if (l) openLead(l); }}
          onClose={() => setFuRun(null)} />
      )}
      {/* Global Quick Pitch floating button */}
      {/* Always mounted: it seeds the starter templates Hunting shows too. On
          Hunting the templates are on the page, and the button would sit on Kirim WA. */}
      <QuickPitch hideButton={activeTab === "Hunting"} />
      <ModalA11y />
    </div>
  );
}
