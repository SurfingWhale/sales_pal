"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut, User } from "firebase/auth";
import { STALL_DAYS, stalledWhat, useStalledDeals } from "@/lib/stalled";
import { LEVEL_WORD, Level, inPlay, isHigh, scoreLead } from "@/lib/score";
import Beranda from "@/components/Beranda";
import HeatDots from "@/components/HeatDots";
import { DetailActions, LeadPage, LeadPanel } from "@/components/LeadDetail";
import Icon, { IconName } from "@/components/Icon";
import { downscaleImage } from "@/lib/image";
import { registerWorker, takeSharedFile } from "@/lib/share";
import type { LeadProfile } from "@/lib/profile";
import { Space, SpaceContext, seesEveryone, spaceDoc, spaceQuery, stamp } from "@/lib/space";
import { SpaceOption, useSpaceChoice } from "@/lib/spaceChoice";
import { disablePush, restorePush } from "@/lib/push";
import PushToggle from "@/components/PushToggle";
import { collection, doc, getDoc, setDoc, onSnapshot, deleteDoc, writeBatch, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { auth, db } from "@/lib/firebase";
import { clearCacheAndReload as resetAppCache } from "@/lib/appCache";
import SalesSimulator from "@/components/SalesSimulator";
import ScriptLibrary from "@/components/ScriptLibrary";
import QuickPitch from "@/components/QuickPitch";
import Services from "@/components/Services";
import Quotes, { LeadRef } from "@/components/Quotes";
import Invoices from "@/components/Invoices";
import Hunting from "@/components/Hunting";
import HuntBar from "@/components/HuntBar";
import ClientHub from "@/components/ClientHub";
import GuildHub from "@/components/GuildHub";
import LeadSources from "@/components/LeadSources";
import ModalA11y from "@/components/ModalA11y";
import { Hunt, useClosingTarget, useHuntGoal } from "@/lib/hunting";
import { queue, statusLabel, view } from "@/lib/prospects";
import { useHuntSession, useProspects, useStrategy } from "@/lib/prospectStore";
import { InboundLead, isMember, leadFromInbound, leadIdFor, mergeInbound } from "@/lib/inbound";
import { parseVCards } from "@/lib/vcard";
import { authFetch } from "@/lib/authFetch";
import { Invoice, Quote, Service, addDays, balance, daysBetween, invoiceState, longDate, rupiah, today, useBusiness, useSpaceCollection, waLink } from "@/lib/billing";

// Five places, so a phone never scrolls sideways to find one. Jualan and
// Lainnya hold several tabs, picked from a second row.
const SECTIONS: { id: string; label: string; icon: string; tabs: string[] }[] = [
  { id: "home", label: "Beranda", icon: "home" as IconName, tabs: ["Dashboard"] },
  { id: "hunt", label: "Hunting", icon: "target" as IconName, tabs: ["Hunting"] },
  { id: "leads", label: "Leads", icon: "users" as IconName, tabs: ["Leads"] },
  { id: "sell", label: "Jualan", icon: "briefcase" as IconName, tabs: ["Penawaran", "Invoice", "Paket"] },
  { id: "more", label: "Lainnya", icon: "grid" as IconName, tabs: ["Guild", "Report Klien", "Outreach", "Rejection Log", "Simulator", "Script Library", "AI Playbook"] },
];
const sectionOf = (tab: string) => SECTIONS.find(x => x.tabs.includes(tab)) || SECTIONS[0];

interface Lead {
  id: string; name: string; contact: string; source: string; status: string;
  score?: number; email: string; phone: string; category: string; notes: string;
  lastContact: string; value: number;
  nextAction?: string; nextActionDate?: string;
  accountUid?: string;
  ownerUid?: string; ownerName?: string;   // in a guild space
  lastReplyAt?: string;                    // when they last answered (PRD-008 §2)
  profile?: LeadProfile;                   // need, pain, objection, type (PRD-008 §3)
}
interface Outreach {
  id: string; leadName: string; type: string; date: string; subject: string;
  status: string; opens: number; clicks: number;
}
interface Rejection {
  id: string; leadName: string; date: string; reason: string; channel: string;
  followUpDate: string; lesson: string;
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

// --- XLS/CSV import ---
const IMPORT_FIELDS: { key: string; label: string; required?: boolean; keywords: string[] }[] = [
  { key: "name", label: "Nama Perusahaan", required: true, keywords: ["perusahaan", "nama", "company", "name", "client", "bisnis"] },
  { key: "contact", label: "Kontak", keywords: ["kontak", "contact", "pic", "person", "cp"] },
  { key: "email", label: "Email", keywords: ["email", "e-mail", "mail"] },
  { key: "phone", label: "No. HP", keywords: ["hp", "phone", "telp", "telepon", "wa", "whatsapp", "nomor", "no."] },
  { key: "category", label: "Kategori", keywords: ["kategori", "category", "industri", "industry", "segmen"] },
  { key: "source", label: "Source", keywords: ["source", "sumber", "channel", "asal"] },
  { key: "status", label: "Status", keywords: ["status", "stage", "tahap"] },
  { key: "value", label: "Value (Rp)", keywords: ["value", "nilai", "deal", "amount", "harga", "estimasi", "potensi"] },
  { key: "notes", label: "Notes", keywords: ["notes", "catatan", "note", "keterangan", "remark"] },
];

const VALID_STATUS = ["Cold", "Warm", "Hot", "Closed"];

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of IMPORT_FIELDS) {
    const hit = headers.find(h => {
      const n = h.toLowerCase().trim();
      return f.keywords.some(k => n === k || n.includes(k));
    });
    if (hit) map[f.key] = hit;
  }
  return map;
}

function normStatus(v: unknown): string {
  const s = String(v ?? "").toLowerCase();
  const hit = VALID_STATUS.find(st => s.includes(st.toLowerCase()));
  return hit || "Cold";
}

function parseValue(v: unknown): number {
  const digits = String(v ?? "").replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}


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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterLevel, setFilterLevel] = useState<0 | Level>(0);
  const [leadQ, setLeadQ] = useState("");
  const [leadLimit, setLeadLimit] = useState(20);
  const [pageOpen, setPageOpen] = useState(false);
  const wide = !useIsNarrow(1023);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddOutreach, setShowAddOutreach] = useState(false);
  const [showAddRejection, setShowAddRejection] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({ name: "", contact: "", source: "GMaps", status: "Cold", email: "", phone: "", category: "F&B", notes: "", value: "" });
  const [newOutreach, setNewOutreach] = useState({ leadName: "", type: "Email", subject: "", status: "Sent" });
  const [newRejection, setNewRejection] = useState({ leadName: "", reason: "", channel: "Email", followUpDate: "", lesson: "" });
  const [showImport, setShowImport] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [colMap, setColMap] = useState<Record<string, string>>({});
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<"file" | "scan">("file");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ latest: string; hasUpdate: boolean; error?: boolean } | null>(null);
  const [clearing, setClearing] = useState(false);

  const uid = user.uid;
  const spaceKey = `${space.kind}:${space.id}:${space.role || ""}`;
  const showOwner = seesEveryone(space);
  const services = useSpaceCollection<Service>(space, "services");
  const quotes = useSpaceCollection<Quote>(space, "quotes");
  const invoices = useSpaceCollection<Invoice>(space, "invoices");
  const business = useBusiness(space);
  const hunts = useSpaceCollection<Hunt>(space, "hunts");
  const huntGoal = useHuntGoal(space);
  const closingTarget = useClosingTarget(space);
  // Prospect journeys and the hunting session (PRD-009), shared by the bar,
  // Hunting and Perlu Ditindak.
  const { rows: prospects, ready: prospectsReady } = useProspects(space);
  const strategy = useStrategy(space);
  const huntSession = useHuntSession(space);
  const stuck = useStalledDeals(uid);
  useEffect(() => { restorePush(); registerWorker(); }, []);

  // A WhatsApp export shared from Android (PRD-008 §5): ask which lead it's for.
  const [shared, setShared] = useState<File | null>(null);
  const [shareFor, setShareFor] = useState<{ leadId: string; file: File } | null>(null);
  const [shareMsg, setShareMsg] = useState("");
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

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    // Website leads (always into the owner's own space). Only the owner may read them (firestore.rules); for
    // anyone else this listener is refused and simply stays quiet.
    unsubs.push(
      onSnapshot(
        query(collection(db, "inbound_leads"), where("status", "==", "new")),
        (snap) => {
          snap.docs.forEach(async (d) => {
            try {
              const l = d.data() as InboundLead;
              const ref = doc(db, "users", uid, "leads", leadIdFor(l, d.id));
              const existing = await getDoc(ref);
              const lead = mergeInbound(existing.exists() ? existing.data() : null, leadFromInbound(l), isMember(l));
              if (lead) await setDoc(ref, lead, { merge: true });
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
  }, [uid]);

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportDone(null);
    // Phone contacts exported as vCard (iPhone Contacts / iCloud.com).
    if (/\.vcf$/i.test(file.name) || file.type === "text/vcard" || file.type === "text/x-vcard") {
      file.text().then((text) => {
        const rows = parseVCards(text) as unknown as Record<string, unknown>[];
        if (!rows.length) { setImportHeaders([]); setImportRows([]); setColMap({}); return; }
        const headers = IMPORT_FIELDS.map(f => f.key).filter(k => rows.some(r => String(r[k] ?? "").trim()));
        const map: Record<string, string> = {};
        headers.forEach(k => { map[k] = k; });
        setImportHeaders(headers);
        setImportRows(rows);
        setColMap(map);
      }).catch(() => { setImportHeaders([]); setImportRows([]); setColMap({}); });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        if (!rows.length) { setImportHeaders([]); setImportRows([]); setColMap({}); return; }
        const headers = Object.keys(rows[0]);
        setImportHeaders(headers);
        setImportRows(rows);
        setColMap(autoMap(headers));
      } catch {
        setImportHeaders([]); setImportRows([]); setColMap({});
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function resetParsed() {
    setImportHeaders([]); setImportRows([]); setColMap({});
    setImportFileName(""); setScanError("");
  }

  async function handleScanImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setScanError(""); setImportDone(null); setScanning(true);
    setImportHeaders([]); setImportRows([]); setColMap({});
    try {
      const dataUrl = await downscaleImage(file);
      const res = await authFetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gambar ga kebaca. Coba foto yang lebih terang dan lurus, atau pakai Excel/CSV.");
      const leads: Record<string, unknown>[] = Array.isArray(json?.rows) ? json.rows : [];
      const rows = leads.map(l => {
        const o: Record<string, unknown> = {};
        IMPORT_FIELDS.forEach(f => { o[f.key] = (l as Record<string, unknown>)[f.key] ?? ""; });
        return o;
      });
      const withData = rows.filter(r => String(r.name ?? "").trim() || String(r.contact ?? "").trim());
      if (!withData.length) { setScanError("Ga ada lead yang kebaca dari gambar ini. Coba gambar yang lebih jelas."); return; }
      setImportRows(withData);
      const headers = IMPORT_FIELDS.map(f => f.key).filter(k => withData.some(r => String(r[k] ?? "").trim()));
      setImportHeaders(headers);
      const map: Record<string, string> = {};
      IMPORT_FIELDS.forEach(f => { if (headers.includes(f.key)) map[f.key] = f.key; });
      setColMap(map);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Gambar ga kebaca. Coba foto yang lebih terang dan lurus, atau pakai Excel/CSV.");
    } finally {
      setScanning(false);
    }
  }

  function mappedPreview(row: Record<string, unknown>) {
    const out: Record<string, string> = {};
    for (const f of IMPORT_FIELDS) {
      const src = colMap[f.key];
      out[f.key] = src ? String(row[src] ?? "") : "";
    }
    return out;
  }

  const importableCount = colMap.name
    ? importRows.filter(r => String(r[colMap.name] ?? "").trim()).length
    : 0;

  async function runImport() {
    if (!colMap.name) return;
    setImporting(true);
    const valid = importRows.filter(r => String(r[colMap.name] ?? "").trim());
    let written = 0;
    for (let i = 0; i < valid.length; i += 400) {
      const batch = writeBatch(db);
      const slice = valid.slice(i, i + 400);
      slice.forEach((r, j) => {
        const id = `imp_${Date.now()}_${i + j}`;
        const get = (k: string) => (colMap[k] ? String(r[colMap[k]] ?? "").trim() : "");
        batch.set(spaceDoc(space, "leads", id), stamp(space, {
          name: get("name"),
          contact: get("contact"),
          email: get("email"),
          phone: get("phone"),
          category: get("category") || "F&B",
          source: get("source") || "Import",
          status: normStatus(colMap.status ? r[colMap.status] : ""),
          value: parseValue(colMap.value ? r[colMap.value] : ""),
          notes: get("notes"),
          lastContact: new Date().toISOString().split("T")[0],
        }));
      });
      await batch.commit();
      written += slice.length;
    }
    setImporting(false);
    setImportDone(written);
    setImportRows([]); setImportHeaders([]); setColMap({});
  }

  function closeImport() {
    setShowImport(false);
    setImportHeaders([]); setImportRows([]); setColMap({});
    setImportFileName(""); setImportDone(null); setImporting(false);
    setImportMode("file"); setScanning(false); setScanError("");
  }

  async function addLead() {
    if (!newLead.name) return;
    const id = `lead_${Date.now()}`;
    await setDoc(spaceDoc(space, "leads", id), stamp(space, {
      ...newLead, lastContact: new Date().toISOString().split("T")[0],
      value: parseInt(newLead.value) || 5000000,
    }));
    setNewLead({ name: "", contact: "", source: "GMaps", status: "Cold", email: "", phone: "", category: "F&B", notes: "", value: "" });
    setShowAddLead(false);
  }

  async function addOutreach() {
    if (!newOutreach.leadName) return;
    const id = `out_${Date.now()}`;
    await setDoc(spaceDoc(space, "outreach", id), stamp(space, {
      ...newOutreach, date: new Date().toISOString().split("T")[0], opens: 0, clicks: 0,
    }));
    setNewOutreach({ leadName: "", type: "Email", subject: "", status: "Sent" });
    setShowAddOutreach(false);
  }

  async function addRejection() {
    if (!newRejection.leadName) return;
    const id = `rej_${Date.now()}`;
    await setDoc(spaceDoc(space, "rejections", id), stamp(space, {
      ...newRejection, date: new Date().toISOString().split("T")[0],
    }));
    setNewRejection({ leadName: "", reason: "", channel: "Email", followUpDate: "", lesson: "" });
    setShowAddRejection(false);
  }

  async function deleteLead(id: string) {
    const name = leads.find(l => l.id === id)?.name || "lead ini";
    if (!confirm(`Hapus ${name}? Ga bisa dibatalkan.`)) return;
    await deleteDoc(spaceDoc(space, "leads", id));
  }

  function openLead(lead: Lead) {
    setSelectedLead(lead);
    setFu({ action: lead.nextAction || "", date: lead.nextActionDate || "" });
    if (wide) { setActiveTab("Leads"); setPageOpen(false); } else setPageOpen(true);
  }

  // Everything a lead's panel or page can do (components/LeadDetail.tsx).
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
      onReplied: () => markReplied(l.id),
      onSchedule: (action, date) => updateDoc(spaceDoc(space, "leads", l.id), { nextAction: action, nextActionDate: date }),
      onDone: () => doneFollowUp(l.id),
      onQuote: () => { setPageOpen(false); startQuote(l); },
      onDelete: async () => { await deleteLead(l.id); setPageOpen(false); setSelectedLead(null); },
    };
  }

  async function saveFollowUp(id: string) {
    await updateDoc(spaceDoc(space, "leads", id), { nextAction: fu.action.trim(), nextActionDate: fu.date });
  }

  // Done: log today as the last contact and clear the reminder.
  async function doneFollowUp(id: string) {
    await updateDoc(spaceDoc(space, "leads", id), { nextAction: "", nextActionDate: "", lastContact: today() });
    setFu({ action: "", date: "" });
  }

  // They answered: the strongest sign a lead is alive (PRD-008 §2, Respons).
  async function markReplied(id: string) {
    await updateDoc(spaceDoc(space, "leads", id), { lastReplyAt: today(), lastContact: today() });
  }

  function startQuote(lead: Lead) {
    setQuoteFor({ id: lead.id, name: lead.name, contact: lead.contact, phone: lead.phone });
    setSelectedLead(null);
    setActiveTab("Penawaran");
  }

  const isSeed = (id: string) => id.startsWith("seed_");
  const seedCount = leads.filter(l => isSeed(l.id)).length + outreach.filter(o => isSeed(o.id)).length + rejections.filter(r => isSeed(r.id)).length;

  async function removeSeedData() {
    if (!confirm(`Hapus ${seedCount} data contoh? Data yang lo isi sendiri ga kesentuh.`)) return;
    const batch = writeBatch(db);
    leads.filter(l => isSeed(l.id)).forEach(l => batch.delete(spaceDoc(space, "leads", l.id)));
    outreach.filter(o => isSeed(o.id)).forEach(o => batch.delete(spaceDoc(space, "outreach", o.id)));
    rejections.filter(r => isSeed(r.id)).forEach(r => batch.delete(spaceDoc(space, "rejections", r.id)));
    await batch.commit();
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
  const filteredLeads = (filterStatus === "All" ? leads : leads.filter(l => l.status === filterStatus))
    .filter(l => !filterLevel || sc(l).level === filterLevel)
    .filter(l => !leadQ.trim() || `${l.name} ${l.category} ${l.contact}`.toLowerCase().includes(leadQ.trim().toLowerCase()))
    .sort((a, b) => sc(b).total - sc(a).total);
  const liveLead = selectedLead ? leads.find(l => l.id === selectedLead.id) || selectedLead : null;

  // Everything that needs a move today: reminders due, quotes left hanging,
  // invoices late or nearly due. Upcoming reminders show three days ahead.
  const now = today();
  const soon = addDays(now, 3);
  const todo = [
    ...leads.filter(l => l.nextActionDate && l.nextActionDate <= soon && l.status !== "Closed").map(l => ({
      key: `l_${l.id}`, when: l.nextActionDate as string, icon: "calendar" as IconName, title: l.name,
      what: l.nextAction || "Follow-up", phone: l.phone, text: `Halo ${l.contact || l.name}, `,
      kind: "Follow-up", action: "Buka lead", wa: false,
      snooze: () => { updateDoc(spaceDoc(space, "leads", l.id), { nextActionDate: addDays(today(), 1) }); },
      open: () => openLead(l),
    })),
    ...queue(prospects, now, strategy).map(p => ({
      key: `p_${p.id}`, when: view(p, now, strategy).due as string, icon: "target" as IconName, title: p.name ? `${p.name} (${p.handle})` : p.handle,
      what: `${statusLabel(p, view(p, now, strategy))} via ${p.platform}`, phone: "", text: "",
      kind: "Hunting", action: p.contact === "baru" ? "Kirim intro" : "Follow-up", wa: false,
      open: () => setActiveTab("Hunting"),
    })),
    ...hunts.filter(h => h.status === "Tertarik" && !h.leadId && !h.prospectId).map(h => ({
      key: `h_${h.id}`, when: h.date, icon: "target" as IconName, title: h.target || "Tanpa nama",
      what: `Tertarik via ${h.platform} — jadiin lead`, phone: "", text: "",
      kind: "Tertarik di Hunting", action: "Jadiin lead", wa: false,
      open: () => setActiveTab("Hunting"),
    })),
    ...quotes.filter(q => q.status === "Terkirim" && q.sentAt && daysBetween(q.sentAt, now) >= 3).map(q => ({
      key: `q_${q.id}`, when: addDays(q.sentAt as string, 3), icon: "doc" as IconName, title: q.leadName,
      what: `Penawaran ${q.number} belum dijawab ${daysBetween(q.sentAt as string, now)} hari`, phone: q.phone,
      text: `Halo ${q.contact || q.leadName}, mau follow up penawaran ${q.number} kemarin. Ada yang bisa aku bantu jelasin?`,
      kind: "Penawaran nunggu", action: q.phone ? "Follow up via WA" : "Lihat penawaran", wa: Boolean(q.phone),
      open: () => setActiveTab("Penawaran"),
    })),
    ...stuck.map(s => ({
      key: `s_${s.key}`, when: addDays(s.lastMove, STALL_DAYS), icon: "pause" as IconName, title: s.deal.contactName,
      what: stalledWhat(s), phone: s.deal.phone || "", text: `Halo ${s.deal.contactName}, `,
      kind: "Deal macet", action: "Geser deal", wa: false,
      open: () => setActiveTab(s.where === "guild" ? "Guild" : "Report Klien"),
    })),
    ...rejections.filter(r => r.followUpDate && r.followUpDate <= soon && r.followUpDate >= addDays(now, -14)).map(r => ({
      key: `r_${r.id}`, when: r.followUpDate, icon: "refresh" as IconName, title: r.leadName,
      what: `Coba lagi setelah ditolak (${r.reason || r.channel})`, phone: "", text: "",
      kind: "Coba lagi", action: "Lihat catatan", wa: false,
      open: () => setActiveTab("Rejection Log"),
    })),
    ...invoices.filter(i => balance(i) > 0 && i.dueDate && i.dueDate <= soon).map(i => ({
      key: `i_${i.id}`, when: i.dueDate, icon: "receipt" as IconName, title: i.leadName,
      what: `${invoiceState(i, now) === "Telat" ? "Telat bayar" : "Jatuh tempo"} ${i.number} · sisa ${rupiah(balance(i))}`, phone: i.phone,
      text: `Halo ${i.contact || i.leadName}, reminder invoice ${i.number} jatuh tempo ${longDate(i.dueDate)}, sisa ${rupiah(balance(i))}. Terima kasih!`,
      kind: invoiceState(i, now) === "Telat" ? "Invoice telat" : "Invoice jatuh tempo", action: i.phone ? "Kirim pengingat" : "Lihat invoice", wa: Boolean(i.phone),
      open: () => setActiveTab("Invoice"),
    })),
  ].sort((a, b) => a.when.localeCompare(b.when));

  // Beranda's four numbers and the lead map (PRD-008 §1).
  const active = leads.filter(l => inPlay(l.status));
  const weekAgo = Date.now() - 7 * 86400000;
  const month = now.slice(0, 7);
  const paidThisMonth = invoices.reduce((a, i) => a + (i.payments || []).filter(p => (p.date || "").startsWith(month)).reduce((b, p) => b + (p.amount || 0), 0), 0);
  const numbers = {
    active: active.length,
    newThisWeek: active.filter(l => Number(l.id.match(/_(\d{13})/)?.[1] || 0) > weekAgo).length,
    high: highPotential,
    closedThisMonth: invoices.filter(i => (i.date || "").startsWith(month)).length,
    closingTarget,
    paidThisMonth: paidThisMonth ? `${rupiah(paidThisMonth)} masuk bulan ini` : "invoice dibuat bulan ini",
    pipeline: active.reduce((a, l) => a + (Number(l.value) || 0), 0),
    pipelineHigh: active.filter(l => isHigh(sc(l).total)).reduce((a, l) => a + (Number(l.value) || 0), 0),
  };
  const mapLeads = active.map(l => ({
    id: l.id, name: l.name, score: sc(l).total, value: Number(l.value) || 0, phone: l.phone,
    why: l.nextActionDate ? `${l.nextAction || "Follow-up"} ${longDate(l.nextActionDate)}` : sc(l).tip ? `Biar naik: ${sc(l).tip}` : "",
  }));

  return (
    <div style={{ background: "var(--app-bg)", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "var(--app-text)" }}>
      <style>{`
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: var(--app-card); } ::-webkit-scrollbar-thumb { background: var(--app-border); border-radius: 4px; }
        .sp-top { position: sticky; top: 0; z-index: 50; }
        .sp-top-in { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 0 32px; height: 68px; display: flex; align-items: center; gap: 24px; }
        .sp-nav { margin: 0 auto; display: flex; gap: 2px; padding: 3px; border-radius: 999px; }
        .sp-nav-btn { position: relative; height: 38px; padding: 0 16px; display: flex; align-items: center; gap: 6px; border: none; border-radius: 999px; background: transparent; color: var(--app-ink-2); font: 500 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; white-space: nowrap; }
        .sp-nav-btn.is-on { color: var(--app-text); font-weight: 600; background: var(--thumb); box-shadow: var(--thumb-shadow); }
        .sp-nav-icon { display: none; }
        .sp-iconbtn { width: 44px; height: 44px; border: 0; border-radius: 999px; color: var(--app-ink-2); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; flex-shrink: 0; font-family: inherit; }
        .sp-space { display: flex; align-items: center; height: 44px; border-radius: 999px; color: var(--app-ink-2); font-size: 13px; font-weight: 500; padding: 0 12px 0 16px; gap: 6px; }
        .sp-space select { appearance: none; -webkit-appearance: none; background: transparent; border: none; color: inherit; font: inherit; max-width: 150px; text-overflow: ellipsis; cursor: pointer; outline: none; }
        .sp-subnav { display: flex; gap: 8px; max-width: 1200px; margin: 0 auto; padding: 8px 32px 0; overflow-x: auto; scrollbar-width: none; }
        .sp-subnav::-webkit-scrollbar { display: none; }
        .sp-sub-btn { flex-shrink: 0; height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--app-line-strong); background: transparent; color: var(--app-ink-2); font: 500 13px 'Plus Jakarta Sans', sans-serif; cursor: pointer; white-space: nowrap; }
        .sp-sub-btn.is-on { background: var(--app-text); border-color: var(--app-text); color: var(--app-card); }
        @media (max-width: 767px) {
          .sp-top-in { padding: 0 14px 0 20px; height: 60px; gap: 8px; }
          .sp-brand-word { font-size: 17px !important; }
          .sp-nav { position: fixed; z-index: 60; left: 14px; right: 14px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); height: 64px; padding: 4px; border-radius: 32px; margin: 0; gap: 0; }
          .sp-nav-btn { flex: 1; height: auto; flex-direction: column; justify-content: center; gap: 3px; padding: 0; border-radius: 28px; font-size: 11px; }
          .sp-nav-btn.is-on { background: var(--tab-on); box-shadow: none; color: var(--brand-text); }
          .sp-nav-icon { display: block; }
          .sp-space { padding: 0 10px 0 12px; font-size: 12px; }
          .sp-space select { max-width: 96px; }
          .sp-subnav { padding: 6px 16px 0; }
          .sp-main { padding: 16px 16px calc(110px + env(safe-area-inset-bottom, 0px)) !important; }
          .sp-fab { bottom: calc(92px + env(safe-area-inset-bottom, 0px)) !important; }
        }
        @media (hover: hover) {
          .sp-nav-btn:hover { color: var(--app-text); }
          .tab-btn:hover { background: var(--app-inner) !important; }
          .lead-row:hover { background: var(--app-inner) !important; }
          .step-card:hover { border-color: var(--accent) !important; }
        }
        .lead-row { cursor: pointer; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        input:focus, select:focus, textarea:focus { border-color: #005eb0 !important; }
      `}</style>

      {/* Header: glass over a soft edge blur, like the canvas */}
      <header className="sp-top">
        {/* The hunting session's bar over every tab (PRD-009 §4) */}
        {huntSession.live && (
          <HuntBar session={huntSession.live} queued={queue(prospects, now, strategy).length}
            sentToday={hunts.filter(h => h.date === now).length} goal={huntGoal}
            onOpen={gotoHunting} onEnd={huntSession.end} />
        )}
        <div className="pb t" aria-hidden="true" style={{ top: 0, height: 96 }}><span /><span /><span /><span /><span /><span /></div>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 96, background: "linear-gradient(to bottom, var(--bar-tint) 0%, var(--bar-tint) 40%, transparent 100%)", pointerEvents: "none" }} />
        <div className="sp-top-in">
          <button onClick={() => setActiveTab("Dashboard")} aria-label="SalesPal, ke Beranda" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--app-text)", background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={18} height={18} style={{ width: 18, height: 18, objectFit: "contain" }} />
            <span className="num sp-brand-word" style={{ fontSize: 19, letterSpacing: "0.06em", paddingTop: 3 }}>SALESPAL</span>
          </button>
          {/* Navigation: a pill in the header on wide screens, a floating bar on phones */}
          <nav className="sp-nav glass" aria-label="Menu utama">
            {SECTIONS.map(sec => {
              const on = sectionOf(activeTab).id === sec.id;
              return (
                <button key={sec.id} className={`sp-nav-btn${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}
                  onClick={() => { if (!on) setActiveTab(sec.tabs[0]); }}>
                  <span className="sp-nav-icon"><Icon name={sec.icon} size={22} stroke={on ? 1.9 : 1.6} /></span>
                  <span className="sp-nav-label">{sec.label}</span>
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
            <button className="sp-iconbtn glass" aria-label={`Notifikasi${todo.length ? `, ${todo.length} perlu ditindak` : ""}`} aria-expanded={showBell} onClick={() => setShowBell(!showBell)}>
              <Icon name="bell" size={19} stroke={1.6} />
              {todo.some(t => t.when <= now) && <span aria-hidden="true" style={{ position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#005eb0", boxShadow: "0 0 0 2px var(--app-bg)" }} />}
            </button>
            <button className="sp-iconbtn" onClick={() => { setShowProfile(true); setUpdateInfo(null); }} aria-label="Profil dan pengaturan" title="Profil & pengaturan">
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--app-inner)", color: "var(--app-ink-2)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
              </span>
            </button>
          </div>
        </div>
        {showBell && (
          <div role="dialog" aria-label="Notifikasi" className="frost" style={{ position: "absolute", zIndex: 70, right: "max(16px, calc((100vw - 1200px) / 2 + 32px))", top: 64, width: "min(360px, calc(100vw - 32px))", borderRadius: 24, padding: 16, boxShadow: "inset 0 0 0 1px var(--frost-ring), 0 12px 32px var(--frost-float)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Notifikasi</div>
              <button className="sp-iconbtn" onClick={() => setShowBell(false)} aria-label="Tutup" style={{ width: 36, height: 36 }}>
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
              <button key={tab} role="tab" aria-selected={activeTab === tab} className={`sp-sub-btn${activeTab === tab ? " is-on" : ""}`} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </div>
        )}
      </header>

      <div className="sp-main" style={{ padding: "32px 32px 96px", maxWidth: 1200, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {activeTab === "Dashboard" && (
          <Beranda now={now} todo={todo} numbers={numbers} mapLeads={mapLeads}
            onOpenLead={id => { const l = leads.find(x => x.id === id); if (l) openLead(l); }}
            onImport={() => setShowImport(true)} onAdd={() => setShowAddLead(true)} onAllLeads={() => setActiveTab("Leads")}
            onSetTarget={async () => {
              const v = prompt("Target closing bulan ini (jumlah deal)?", String(closingTarget || ""));
              const n = parseInt(v || "", 10);
              if (n > 0) await setDoc(spaceDoc(space, "settings", "hunting"), { monthlyClosing: n }, { merge: true }).catch(() => alert("Target tim diatur Leader atau Officer."));
            }}>
            {space.kind === "guild" && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: -16 }}>Ruang guild {space.name} — {showOwner ? "angka seluruh tim" : "angka kamu di guild ini"}.</div>}
            {seedCount > 0 && (
              <div role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 10, padding: "12px 14px", fontSize: 12.5 }}>
                <span>Ada <b>{seedCount} data contoh</b> (PT Maju Jaya dkk.) dari versi lama yang ikut kehitung di angka lo.</span>
                <button onClick={removeSeedData} style={{ background: "#005eb0", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Hapus data contoh</button>
              </div>
            )}
            <LeadSources leads={leads} invoices={invoices} />
          </Beranda>
        )}

        {/* LEADS (canvas "Leads + skor potensi") */}
        {activeTab === "Leads" && (() => {
          const shownLeads = filteredLeads.slice(0, leadLimit);
          const panelLead = wide ? (liveLead && filteredLeads.some(l => l.id === liveLead.id) ? liveLead : filteredLeads[0]) : null;
          return (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.025em" }}>Leads <span className="tabnum" style={{ fontSize: 20, fontWeight: 500, color: "var(--app-muted)", letterSpacing: 0 }}>{leads.length}</span></h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", width: wide ? "auto" : "100%" }}>
                <div style={{ position: "relative", flex: wide ? "0 0 auto" : "1 1 100%" }}>
                  <label htmlFor="lead-search" className="vh">Cari lead</label>
                  <Icon name="search" style={{ position: "absolute", left: 14, top: 13, color: "var(--app-muted)" }} />
                  <input id="lead-search" type="search" value={leadQ} onChange={e => setLeadQ(e.target.value)} placeholder="Cari nama atau kategori" style={{ width: wide ? 260 : "100%", height: 44, padding: "0 16px 0 42px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "var(--app-card)", color: "var(--app-text)", fontSize: 14, fontFamily: "inherit" }} />
                </div>
                <label className="vh" htmlFor="status-filter">Status</label>
                <select id="status-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ height: 44, padding: "0 14px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "var(--app-card)", color: "var(--app-text)", fontSize: 14, fontFamily: "inherit" }}>
                  {[["All", "Semua status"], ["Hot", "Hot"], ["Warm", "Warm"], ["Cold", "Cold"], ["Closed", "Closed"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={() => setShowImport(true)} style={{ height: 44, padding: "0 18px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Import</button>
                <button onClick={() => setShowAddLead(true)} style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Icon name="plus" stroke={1.8} />Tambah lead</button>
              </div>
            </div>

            {leads.length > 0 && (
              <div role="group" aria-label="Saring menurut potensi" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
                {([0, 5, 4, 3, 2, 1] as (0 | Level)[]).map(lv => {
                  const on = filterLevel === lv;
                  const n = lv ? leads.filter(l => sc(l).level === lv).length : leads.length;
                  return (
                    <button key={lv} onClick={() => setFilterLevel(lv)} aria-pressed={on}
                      style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? "var(--app-text)" : "var(--app-line-strong)"}`, background: on ? "var(--app-text)" : "transparent", color: on ? "var(--app-card)" : "var(--app-ink-2)", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                      {lv > 0 && <HeatDots level={lv as Level} size={5} gap={2} />}
                      {lv ? LEVEL_WORD[lv as Level] : "Semua"} <span className="tabnum" style={{ opacity: 0.7 }}>{n}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredLeads.length === 0 ? (
              <div style={{ marginTop: 24, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: "56px 24px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--app-muted)" }}><Icon name={leads.length === 0 ? "users" : "search"} size={34} stroke={1.4} /></div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{leads.length === 0 ? "Belum ada lead" : "Ga ada lead yang cocok"}</div>
                <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 20 }}>{leads.length === 0 ? "Mulai dengan import Excel/CSV, atau tambah manual." : "Coba ganti pencarian atau saringannya."}</div>
                {leads.length === 0 ? (
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => setShowImport(true)} style={{ height: 44, padding: "0 18px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Import Excel/CSV</button>
                    <button onClick={() => setShowAddLead(true)} style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Lead pertama</button>
                  </div>
                ) : (
                  <button onClick={() => { setFilterStatus("All"); setFilterLevel(0); setLeadQ(""); }} style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reset saringan</button>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
                <section aria-label="Daftar lead" style={{ flex: "999 1 560px", minWidth: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                    {shownLeads.map(lead => {
                      const s = sc(lead);
                      const on = panelLead?.id === lead.id;
                      const contactAgo = lead.lastContact ? (() => { const d = daysBetween(lead.lastContact, now); return d <= 0 ? "hari ini" : d === 1 ? "kemarin" : `${d} hari lalu`; })() : "—";
                      return (
                        <button key={lead.id} className="lead-row lift" aria-pressed={wide ? on : undefined} aria-label={`Buka lead ${lead.name}`} onClick={() => openLead(lead)}
                          style={{ textAlign: "left", padding: 18, borderRadius: 16, border: `1px solid ${on ? "#005eb0" : "var(--app-border)"}`, boxShadow: on ? "0 0 0 1px #005eb0" : "none", background: on ? "var(--brand-tint)" : "var(--app-card)", color: "var(--app-text)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 16, fontFamily: "inherit" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                            <span aria-hidden="true" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "var(--app-inner)", color: "var(--app-ink-2)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{lead.name.replace(/[^A-Za-z0-9À-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"}</span>
                            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.name}</span>
                              <span style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.category} · {lead.source}{showOwner && lead.ownerName ? ` · 👤 ${lead.ownerName}` : ""}</span>
                            </span>
                            <span style={{ flexShrink: 0, alignSelf: "flex-start", padding: "3px 9px", borderRadius: 999, background: "var(--app-inner)", color: ({ Hot: "var(--hot)", Warm: "var(--warm)", Cold: "var(--cold)", Closed: "var(--ok)" } as Record<string, string>)[lead.status] || "var(--app-ink-2)", fontSize: 12, fontWeight: 600 }}>{lead.status}</span>
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                            <HeatDots level={s.level} />
                            <span style={{ fontSize: 13, color: "var(--app-ink-2)" }}>Potensi {s.word.toLowerCase()}</span>
                            <span className="tabnum" style={{ marginLeft: "auto", fontSize: 15, fontWeight: 600 }} aria-label={`Skor potensi ${s.total}`}>{s.total}</span>
                          </span>
                          {lead.nextActionDate && <span style={{ fontSize: 12.5, color: lead.nextActionDate < now ? "var(--hot)" : lead.nextActionDate === now ? "var(--warm)" : "var(--app-muted)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="clock" size={14} />{lead.nextAction || "Follow-up"} · {longDate(lead.nextActionDate)}</span>}
                          <span style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%", paddingTop: 12, borderTop: "1px solid var(--app-border)", fontSize: 13, color: "var(--app-muted)" }}>
                            <span>Kontak: {contactAgo}</span>
                            <span className="tabnum" style={{ color: "var(--app-ink-2)", fontWeight: 500 }}>{lead.value ? `Rp ${(lead.value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : "—"}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <p className="tabnum" style={{ margin: 0, fontSize: 13, color: "var(--app-muted)" }}>Menampilkan {shownLeads.length} dari {filteredLeads.length} lead</p>
                    {filteredLeads.length > shownLeads.length && <button onClick={() => setLeadLimit(leadLimit + 20)} style={{ height: 44, padding: "0 18px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Muat lagi</button>}
                  </div>
                </section>
                {panelLead && (
                  <div style={{ flex: "1 1 360px", maxWidth: 440, minWidth: 0, alignSelf: "stretch" }}>
                    <LeadPanel key={panelLead.id + (shareFor?.leadId === panelLead.id ? "_share" : "")} lead={panelLead} score={sc(panelLead)} actions={leadActions(panelLead)}
                      onOpenFull={() => { setSelectedLead(panelLead); setPageOpen(true); }} shareFile={shareFor?.leadId === panelLead.id ? shareFor.file : null} />
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })()}

        {/* HUNTING */}
        {activeTab === "Hunting" && <Hunting hunts={hunts} goal={huntGoal} onOpenScripts={gotoScripts}
          journey={{ prospects, ready: prospectsReady, strategy, live: huntSession.live, sessions: huntSession.sessions, start: huntSession.start, end: huntSession.end }} />}

        {/* REPORT KLIEN (PRD-005) */}
        {activeTab === "Report Klien" && <ClientHub />}

        {/* GUILD (PRD-007) */}
        {activeTab === "Guild" && <GuildHub uid={uid} name={user.displayName || (user.email || "").split("@")[0]} email={user.email || ""} />}

        {activeTab === "Penawaran" && (
          <Quotes quotes={quotes} invoices={invoices} services={services} business={business}
            leads={leads.map(l => ({ id: l.id, name: l.name, contact: l.contact, phone: l.phone }))}
            startFor={quoteFor} onStarted={clearQuoteFor} onInvoiceCreated={gotoInvoices} />
        )}
        {activeTab === "Invoice" && <Invoices invoices={invoices} business={business} />}
        {activeTab === "Paket" && <Services services={services} business={business} />}

        {/* OUTREACH */}
        {activeTab === "Outreach" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Outreach Tracker</div>
                <div style={{ color: "var(--app-muted)", fontSize: 12, marginTop: 2 }}>Track semua DM, email, dan WA lo</div>
              </div>
              <button onClick={() => setShowAddOutreach(true)} style={btnPrimary}>+ Catat outreach</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Sent", value: outreach.length, color: "var(--brand-text)" },
                { label: "Replied", value: outreach.filter(o => o.status === "Replied").length, color: "var(--ok)" },
                { label: "Seen/Open", value: outreach.filter(o => o.status === "Seen").length, color: "color-mix(in srgb, #f59e0b 55%, var(--app-text))" },
                { label: "No Response", value: outreach.filter(o => o.status === "No Response").length, color: "var(--app-muted)" },
                { label: "Rejected", value: outreach.filter(o => o.status === "Rejected").length, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: `color-mix(in srgb, ${s.color} 55%, var(--app-text))`, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {outreach.length === 0 && (
                <div style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 34, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada outreach</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>Catat email, DM, atau WA pertama lo biar bisa dilacak.</div>
                  <button onClick={() => setShowAddOutreach(true)} style={btnPrimary}>+ Log Outreach</button>
                </div>
              )}
              {outreach.map(o => {
                const statusColors: Record<string, string> = { Replied: "#00a862", Seen: "#f59e0b", Sent: "#005eb0", "No Response": "var(--app-muted)", Rejected: "#ff4444" };
                return (
                  <div key={o.id} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 10, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div style={{ fontSize: 20 }}>{o.type === "Email" ? "📧" : o.type === "DM Instagram" ? "📸" : "💬"}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{o.leadName}</div>
                        <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{o.subject}</div>
                        <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{o.type} · {o.date}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge" style={{ background: `${statusColors[o.status]}20`, color: statusColors[o.status], border: `1px solid ${statusColors[o.status]}40` }}>{o.status}</span>
                      <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>Opens: {o.opens} · Clicks: {o.clicks}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REJECTION LOG */}
        {activeTab === "Rejection Log" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rejection Log</div>
                <div style={{ color: "var(--app-muted)", fontSize: 12, marginTop: 2 }}>Tiap rejection = data buat improve. Catat & belajar.</div>
              </div>
              <button onClick={() => setShowAddRejection(true)} style={btnPrimary}>+ LOG REJECTION</button>
            </div>
            <div style={{ background: "#ff44440d", border: "1px solid #ff444430", borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 12, color: "#ff8888" }}>
              <span style={{ fontWeight: 700 }}>💡 Mindset:</span> Rejection bukan kegagalan — itu adalah data. Setiap &quot;tidak&quot; lo adalah insight buat close deal berikutnya lebih cepet.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {rejections.length === 0 && (
                <div style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 34, marginBottom: 12 }}>🗂️</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada rejection dicatat</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>Setiap penolakan itu data. Catat biar bisa dipelajari & di-follow up.</div>
                  <button onClick={() => setShowAddRejection(true)} style={btnPrimary}>+ Log Rejection</button>
                </div>
              )}
              {rejections.map(r => (
                <div key={r.id} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.leadName}</div>
                      <div style={{ fontSize: 12, color: "var(--app-muted)" }}>{r.channel} · {r.date}</div>
                    </div>
                    <span className="badge" style={{ background: "#ff44441a", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444430" }}>REJECTED</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "var(--app-inner)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--app-muted)", letterSpacing: "1px", marginBottom: 4 }}>ALASAN REJECTION</div>
                      <div style={{ fontSize: 12, color: "#ff8888" }}>{r.reason}</div>
                    </div>
                    <div style={{ background: "var(--app-inner)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--app-muted)", letterSpacing: "1px", marginBottom: 4 }}>FOLLOW-UP DATE</div>
                      <div style={{ fontSize: 12, color: "color-mix(in srgb, #f59e0b 55%, var(--app-text))" }}>{r.followUpDate || "Belum dijadwal"}</div>
                    </div>
                  </div>
                  <div style={{ background: "#00ff881a", borderRadius: 8, padding: 12, marginTop: 12, border: "1px solid #00ff8820" }}>
                    <div style={{ fontSize: 12, color: "var(--ok)", letterSpacing: "1px", marginBottom: 4 }}>💡 LESSON LEARNED</div>
                    <div style={{ fontSize: 12 }}>{r.lesson}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SIMULATOR */}
        {activeTab === "Simulator" && <SalesSimulator />}

        {/* SCRIPT LIBRARY */}
        {activeTab === "Script Library" && <ScriptLibrary />}

        {/* AI PLAYBOOK */}
        {activeTab === "AI Playbook" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>AI Sales Playbook</div>
              <div style={{ color: "var(--app-muted)", fontSize: 12, marginTop: 4 }}>Cara scraping, outreach, dan dominasi sales di era AI</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {AI_PLAYBOOK.map((section, si) => (
                <div key={si} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20, color: section.color }}>{section.category}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    {section.steps.map((step, i) => (
                      <div key={i} className="step-card" style={{ ["--accent" as string]: section.color, background: "var(--app-inner)", borderRadius: 10, padding: 16, border: "1px solid var(--app-border)", transition: "border-color 0.2s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: `${section.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: section.color, border: `1px solid ${section.color}40` }}>{i + 1}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: section.color }}>{step.title}</div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6 }}>{step.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--app-card)", border: "1px solid #a78bfa40", borderRadius: 14, padding: 24, marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "color-mix(in srgb, #a78bfa 55%, var(--app-text))", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🎯 Target Benchmark Sales Metrics Lo</div>
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
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{m.target}</div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>Rata-rata industri: {m.world}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add Lead */}
      {showAddLead && (
        <div className="modal-overlay" onClick={() => setShowAddLead(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20 }}>+ Add New Lead</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([["name", "Nama Perusahaan"], ["contact", "Nama Kontak"], ["email", "Email"], ["phone", "No. HP"], ["value", "Estimasi Value (Rp)"]] as [string, string][]).map(([k, label]) => (
                <div key={k} style={{ gridColumn: k === "name" || k === "value" ? "1/-1" : "auto" }}>
                  <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>{label}</label>
                  <input value={(newLead as Record<string, string>)[k]} onChange={e => setNewLead({ ...newLead, [k]: e.target.value })} style={inputStyle} placeholder={label} />
                </div>
              ))}
              {([["source", "Source", ["GMaps", "DM IG", "Threads", "Cold Email", "Referral", "WhatsApp", "LinkedIn", "Lainnya"]], ["status", "Status", ["Cold", "Warm", "Hot", "Closed"]], ["category", "Kategori", ["F&B", "Retail", "Health", "Property", "Service", "Tech", "Education"]]] as [string, string, string[]][]).map(([k, label, opts]) => (
                <div key={k}>
                  <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>{label}</label>
                  <select value={(newLead as Record<string, string>)[k]} onChange={e => setNewLead({ ...newLead, [k]: e.target.value })} style={inputStyle}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>Notes</label>
                <textarea value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} style={{ ...inputStyle, resize: "none", height: 70 }} placeholder="Catatan tentang lead ini..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={addLead} style={btnPrimary}>Simpan lead</button>
              <button onClick={() => setShowAddLead(false)} style={{ ...btnPrimary, background: "var(--app-border)", color: "var(--app-text)" }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Outreach */}
      {showAddOutreach && (
        <div className="modal-overlay" onClick={() => setShowAddOutreach(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20 }}>+ Log Outreach</div>
            {([["leadName", "Nama Lead/Perusahaan"], ["subject", "Subject / Pesan Pembuka"]] as [string, string][]).map(([k, label]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>{label}</label>
                <input value={(newOutreach as Record<string, string>)[k]} onChange={e => setNewOutreach({ ...newOutreach, [k]: e.target.value })} style={inputStyle} placeholder={label} />
              </div>
            ))}
            {([["type", "Tipe", ["Email", "DM Instagram", "WhatsApp", "LinkedIn", "Telepon"]], ["status", "Status", ["Sent", "Seen", "Replied", "No Response", "Rejected"]]] as [string, string, string[]][]).map(([k, label, opts]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>{label}</label>
                <select value={(newOutreach as Record<string, string>)[k]} onChange={e => setNewOutreach({ ...newOutreach, [k]: e.target.value })} style={inputStyle}>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={addOutreach} style={btnPrimary}>Simpan</button>
              <button onClick={() => setShowAddOutreach(false)} style={{ ...btnPrimary, background: "var(--app-border)", color: "var(--app-text)" }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Rejection */}
      {showAddRejection && (
        <div className="modal-overlay" onClick={() => setShowAddRejection(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20 }}>+ Log Rejection</div>
            {([["leadName", "Nama Lead/Perusahaan"], ["reason", "Alasan Rejection"], ["lesson", "Lesson Learned"]] as [string, string][]).map(([k, label]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>{label}</label>
                {k === "lesson"
                  ? <textarea value={(newRejection as Record<string, string>)[k]} onChange={e => setNewRejection({ ...newRejection, [k]: e.target.value })} style={{ ...inputStyle, resize: "none", height: 70 }} placeholder={label} />
                  : <input value={(newRejection as Record<string, string>)[k]} onChange={e => setNewRejection({ ...newRejection, [k]: e.target.value })} style={inputStyle} placeholder={label} />}
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>Channel</label>
              <select value={newRejection.channel} onChange={e => setNewRejection({ ...newRejection, channel: e.target.value })} style={inputStyle}>
                {["Email", "DM Instagram", "WhatsApp", "LinkedIn", "Telepon"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 6 }}>Jadwal Follow-Up</label>
              <input type="date" value={newRejection.followUpDate} onChange={e => setNewRejection({ ...newRejection, followUpDate: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={addRejection} style={btnPrimary}>Simpan</button>
              <button onClick={() => setShowAddRejection(false)} style={{ ...btnPrimary, background: "var(--app-border)", color: "var(--app-text)" }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Profil customer: full screen on phones, "Profil lengkap" on desktop */}
      {liveLead && pageOpen && (
        <LeadPage key={liveLead.id + (shareFor?.leadId === liveLead.id ? "_share" : "")} lead={liveLead} score={sc(liveLead)} actions={leadActions(liveLead)}
          onClose={() => { setPageOpen(false); if (!wide) setSelectedLead(null); }} shareFile={!wide && shareFor?.leadId === liveLead.id ? shareFor.file : null} />
      )}

      {/* Profile & Settings Modal */}
      {showProfile && (        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Profil & Pengaturan</div>
              <button onClick={() => setShowProfile(false)} aria-label="Tutup" style={{ background: "transparent", border: "none", color: "var(--app-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {/* User */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#005eb0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName || (user.email || "").split("@")[0]}</div>
                <div style={{ fontSize: 12, color: "var(--app-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
              </div>
            </div>

            {/* Version / update */}
            <div style={{ background: "var(--app-inner)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Versi aplikasi</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", fontFamily: "monospace", marginTop: 2 }}>{APP_VERSION}</div>
                </div>
                <button onClick={checkUpdate} disabled={checkingUpdate} style={{ ...btnPrimary, background: "transparent", color: "var(--brand-text)", border: "1px solid #005eb0", padding: "8px 14px", opacity: checkingUpdate ? 0.6 : 1 }}>
                  {checkingUpdate ? "Cek..." : "Cek update"}
                </button>
              </div>
              {updateInfo && (
                <div style={{ marginTop: 12, fontSize: 12 }}>
                  {updateInfo.error ? (
                    <span style={{ color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>Gagal cek update. Coba lagi.</span>
                  ) : updateInfo.hasUpdate ? (
                    <div>
                      <div style={{ color: "var(--ok)", fontWeight: 700, marginBottom: 8 }}>🎉 Update tersedia (versi {updateInfo.latest})</div>
                      <button onClick={clearCacheAndReload} disabled={clearing} style={{ ...btnPrimary, width: "100%" }}>{clearing ? "Memperbarui..." : "Update sekarang"}</button>
                    </div>
                  ) : (
                    <span style={{ color: "var(--app-muted)" }}>✓ Kamu udah di versi terbaru.</span>
                  )}
                </div>
              )}
            </div>

            <button onClick={toggleTheme} aria-pressed={isDark} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--app-inner)", border: "none", borderRadius: 12, padding: 16, cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)", marginBottom: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700 }}><Icon name={isDark ? "moon" : "sun"} size={18} /> Tampilan</span>
              <span style={{ fontSize: 12, color: "var(--app-muted)" }}>{isDark ? "Gelap" : "Terang"} · ganti</span>
            </button>
            <PushToggle />

            {/* Clear cache */}
            <button onClick={clearCacheAndReload} disabled={clearing} style={{ width: "100%", background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 16, textAlign: "left", cursor: "pointer", fontFamily: "inherit", marginBottom: 12, opacity: clearing ? 0.6 : 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>🧹 {clearing ? "Membersihkan..." : "Clear cache & muat ulang"}</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>Hapus cache app & load versi terbaru. Login kamu tetap aman.</div>
            </button>

            {/* Logout */}
            <button onClick={handleLogout} style={{ width: "100%", background: "transparent", border: "1px solid #ff444440", borderRadius: 12, padding: 14, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Logout
            </button>
          </div>
        </div>
      )}

      {shared && (
        <div className="modal-overlay" onClick={() => setShared(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="share-h" onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 22, width: "100%", maxWidth: 440, maxHeight: "86vh", display: "flex", flexDirection: "column" }}>
            <div id="share-h" style={{ fontSize: 16, fontWeight: 700 }}>Chat ini buat lead mana?</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", margin: "4px 0 12px" }}>{shared.name}</div>
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
                        style={{ width: "100%", textAlign: "left", padding: "11px 4px", border: "none", borderBottom: "1px solid var(--app-inner)", background: "transparent", color: "inherit", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}>
                        {l.name} <span style={{ fontWeight: 400, color: "var(--app-muted)", fontSize: 12 }}>· {l.category}</span>
                      </button>
                    ))}
                    <button onClick={async () => {
                      const id = `lead_${Date.now()}`;
                      const lead = stamp(space, { name: guess || "Lead dari WhatsApp", contact: "", source: "WhatsApp", status: "Warm", email: "", phone: "", category: "F&B", notes: "", value: 0, lastContact: today() });
                      await setDoc(spaceDoc(space, "leads", id), lead);
                      setShareFor({ leadId: id, file: shared }); setShared(null); setActiveTab("Leads");
                      openLead({ id, ...lead } as Lead);
                    }} style={{ ...btnPrimary, width: "100%", marginTop: 10 }}>+ Lead baru: {guess || "dari WhatsApp"}</button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {shareMsg && (
        <div role="alert" onClick={() => setShareMsg("")} style={{ position: "fixed", left: 16, right: 16, bottom: 90, zIndex: 120, maxWidth: 480, margin: "0 auto", background: "var(--app-text)", color: "var(--app-bg)", borderRadius: 12, padding: "12px 14px", fontSize: 13 }}>{shareMsg}</div>
      )}

      {/* Import Leads Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={closeImport}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Import Leads dari Excel/CSV</div>
              <button onClick={closeImport} aria-label="Tutup" style={{ background: "transparent", border: "none", color: "var(--app-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Upload Excel/CSV, atau scan gambar (screenshot/foto data) pakai AI. Kolom dipetakan otomatis — bisa diubah sebelum simpan.</div>

            {importDone !== null ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{importDone} lead masuk</div>
                <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>Data udah masuk ke Lead Database lo.</div>
                <button onClick={closeImport} style={btnPrimary}>Selesai</button>
              </div>
            ) : (
              <>
                {/* Mode switcher */}
                <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "var(--app-inner)", padding: 4, borderRadius: 10 }}>
                  {([["file", "📄 Excel / CSV / Kontak"], ["scan", "📷 Scan Gambar"]] as const).map(([m, label]) => (
                    <button key={m} onClick={() => { setImportMode(m); resetParsed(); }}
                      style={{ flex: 1, padding: "9px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                        background: importMode === m ? "var(--app-card)" : "transparent",
                        color: importMode === m ? "#005eb0" : "var(--app-muted)",
                        boxShadow: importMode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {importMode === "file" ? (
                  <label style={{ display: "block", border: "1.5px dashed var(--app-border)", borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer", marginBottom: 20, background: "var(--app-inner)" }}>
                    <input type="file" accept=".xlsx,.xls,.csv,.vcf,text/vcard" onChange={handleImportFile} style={{ display: "none" }} />
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{importFileName || "Klik buat pilih file"}</div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>.xlsx, .xls, .csv, atau kontak HP (.vcf)</div>
                  </label>
                ) : (
                  <>
                    <label style={{ display: "block", border: "1.5px dashed var(--app-border)", borderRadius: 12, padding: 24, textAlign: "center", cursor: scanning ? "wait" : "pointer", marginBottom: 12, background: "var(--app-inner)", opacity: scanning ? 0.7 : 1 }}>
                      <input type="file" accept="image/*" onChange={handleScanImage} disabled={scanning} style={{ display: "none" }} />
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{scanning ? "🤖" : "📷"}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{scanning ? "Membaca gambar dengan AI..." : (importFileName || "Klik buat pilih / foto data")}</div>
                      <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>Screenshot chat, tabel, atau kartu nama · JPG/PNG</div>
                    </label>
                    {scanError && (
                      <div style={{ fontSize: 12, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", background: "#ff44440d", border: "1px solid #ff444430", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>{scanError}</div>
                    )}
                  </>
                )}

                {importHeaders.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Petakan kolom · {importRows.length} baris ditemukan</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 20 }}>
                      {IMPORT_FIELDS.map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 4 }}>
                            {f.label}{f.required && <span style={{ color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}> *</span>}
                          </label>
                          <select value={colMap[f.key] || ""} onChange={e => setColMap({ ...colMap, [f.key]: e.target.value })} style={inputStyle} aria-label={`Kolom untuk ${f.label}`}>
                            <option value="">— lewati —</option>
                            {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Preview (3 baris pertama)</div>
                    <div style={{ overflowX: "auto", border: "1px solid var(--app-border)", borderRadius: 8, marginBottom: 20 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
                        <thead>
                          <tr style={{ background: "var(--app-inner)" }}>
                            {IMPORT_FIELDS.filter(f => colMap[f.key]).map(f => (
                              <th key={f.key} style={{ padding: "8px 10px", textAlign: "left", color: "var(--app-muted)", whiteSpace: "nowrap" }}>{f.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 3).map((r, i) => {
                            const m = mappedPreview(r);
                            return (
                              <tr key={i} style={{ borderTop: "1px solid var(--app-inner)" }}>
                                {IMPORT_FIELDS.filter(f => colMap[f.key]).map(f => (
                                  <td key={f.key} style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{m[f.key] || "—"}</td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {!colMap.name && (
                      <div style={{ fontSize: 12, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", marginBottom: 12 }}>⚠️ Kolom &quot;Nama Perusahaan&quot; wajib dipetakan.</div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={runImport} disabled={!colMap.name || importing} style={{ ...btnPrimary, opacity: (!colMap.name || importing) ? 0.5 : 1, cursor: (!colMap.name || importing) ? "not-allowed" : "pointer" }}>
                        {importing ? "Mengimport..." : `Import ${importableCount} lead`}
                      </button>
                      <button onClick={closeImport} style={{ ...btnPrimary, background: "var(--app-border)", color: "var(--app-text)" }}>Batal</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Global Quick Pitch floating button */}
      {/* Always mounted: it seeds the starter templates Hunting shows too. On
          Hunting the templates are on the page, and the button would sit on Kirim WA. */}
      <QuickPitch hideButton={activeTab === "Hunting"} />
      <ModalA11y />
    </div>
  );
}
