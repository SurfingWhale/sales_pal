"use client";

import { useState, useEffect } from "react";
import { signOut, User } from "firebase/auth";
import { collection, doc, setDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

const TABS = ["Dashboard", "Leads", "Outreach", "Rejection Log", "AI Playbook"];

interface Lead {
  id: string; name: string; contact: string; source: string; status: string;
  score: number; email: string; phone: string; category: string; notes: string;
  lastContact: string; value: number;
}
interface Outreach {
  id: string; leadName: string; type: string; date: string; subject: string;
  status: string; opens: number; clicks: number;
}
interface Rejection {
  id: string; leadName: string; date: string; reason: string; channel: string;
  followUpDate: string; lesson: string;
}

const SEED_LEADS: Omit<Lead, "id">[] = [
  { name: "PT Maju Jaya", contact: "Budi Santoso", source: "GMaps", status: "Hot", score: 92, email: "budi@majujaya.com", phone: "0812-3456-7890", category: "F&B", notes: "Interested in digital menu", lastContact: "2025-04-20", value: 15000000 },
  { name: "Toko Elektronik Sinar", contact: "Dewi Rahayu", source: "DM IG", status: "Warm", score: 74, email: "dewi@sinar.co.id", phone: "0813-9876-5432", category: "Retail", notes: "Follow up minggu depan", lastContact: "2025-04-18", value: 8500000 },
  { name: "Klinik Sehat Prima", contact: "Dr. Andi", source: "Cold Email", status: "Cold", score: 45, email: "andi@kliniksehat.com", phone: "0877-1234-5678", category: "Health", notes: "Belum respon email ke-2", lastContact: "2025-04-10", value: 22000000 },
  { name: "Rumah Makan Padang Sederhana", contact: "Pak Rusdi", source: "GMaps", status: "Closed", score: 100, email: "rusdi@sederhana.id", phone: "0811-2233-4455", category: "F&B", notes: "Deal signed!", lastContact: "2025-04-22", value: 12000000 },
];
const SEED_OUTREACH: Omit<Outreach, "id">[] = [
  { leadName: "PT Maju Jaya", type: "Email", date: "2025-04-20", subject: "Solusi Digital untuk Bisnis Anda", status: "Replied", opens: 3, clicks: 2 },
  { leadName: "Toko Elektronik Sinar", type: "DM Instagram", date: "2025-04-18", subject: "Halo kak, ada penawaran spesial!", status: "Seen", opens: 1, clicks: 0 },
  { leadName: "Klinik Sehat Prima", type: "Email", date: "2025-04-10", subject: "Tingkatkan Pasien dengan Strategi Digital", status: "No Response", opens: 0, clicks: 0 },
  { leadName: "CV Berkah Motor", type: "WhatsApp", date: "2025-04-19", subject: "Perkenalan layanan kami", status: "Rejected", opens: 1, clicks: 0 },
];
const SEED_REJECTIONS: Omit<Rejection, "id">[] = [
  { leadName: "CV Berkah Motor", date: "2025-04-19", reason: "Tidak butuh sekarang", channel: "WhatsApp", followUpDate: "2025-07-19", lesson: "Timing salah, coba 3 bulan lagi saat mereka renewal" },
  { leadName: "Salon Cantik Abadi", date: "2025-04-15", reason: "Budget tidak ada", channel: "Email", followUpDate: "2025-06-15", lesson: "Tawarkan paket starter yang lebih affordable" },
  { leadName: "Apotek Sehat Selalu", date: "2025-04-12", reason: "Sudah pakai kompetitor", channel: "DM IG", followUpDate: "2025-10-12", lesson: "Highlight differentiator kita vs kompetitor saat follow up" },
];

const AI_PLAYBOOK = [
  {
    category: "🗺️ Scraping Google Maps", color: "#00ff88",
    steps: [
      { title: "Tool: PhantomBuster / Outscraper", desc: "Scrape bisnis lokal dari GMaps: nama, telepon, email, rating, kategori, jam buka. Filter rating 4.0+ = prospek aktif." },
      { title: "Tool: Apollo.io / Hunter.io", desc: "Enrich data dengan email decision maker. Tambah LinkedIn profile otomatis." },
      { title: "Segmentasi Smart", desc: "Kelompokkan: F&B, Retail, Health, Service. Buat template pitch berbeda per segmen." },
      { title: "Validasi Email", desc: "Gunakan NeverBounce / ZeroBounce sebelum kirim. Bounce rate tinggi = domain banned." },
    ]
  },
  {
    category: "📩 Cold Outreach di Era AI", color: "#ff6b35",
    steps: [
      { title: "AI Personalization Hook", desc: "Pakai Claude/GPT untuk generate opening line unik per lead berdasarkan Google review, post IG, atau berita terbaru mereka." },
      { title: "Sequence: 7-Touch Formula", desc: "D1: Email → D3: LinkedIn/IG DM → D5: Follow-up email → D8: WhatsApp → D14: Nilai tambah konten → D21: Last call → D30: Break-up email." },
      { title: "Subject Line A/B Test", desc: "Test 3 variasi subject per batch 50 leads. Pakai Lemlist/Instantly.ai untuk automasi + tracking open rate." },
      { title: "Social Proof First", desc: "Mulai DM dengan social proof lokal: 'Kami bantu [bisnis sejenis di kota mereka] naik X%' lebih powerful dari feature pitch." },
    ]
  },
  {
    category: "📊 Meningkatkan Sales Metrics", color: "#a78bfa",
    steps: [
      { title: "AI Scoring Leads", desc: "Pakai model sederhana: website ada? (20pts) → Review GMaps 4+ (20pts) → Aktif sosmed (20pts) → Kategori high-intent (20pts) → Budget signals (20pts). Score 70+ = prioritas utama." },
      { title: "Conversion Rate Optimization", desc: "Target: Cold email reply rate 5-15% | DM reply rate 20-35% | Meeting rate dari reply 40%+ | Close rate dari meeting 25%+." },
      { title: "AI Call Coaching", desc: "Record sales call, transkrip pakai Whisper/Otter.ai, analisis objection patterns. Build objection handling script dari data nyata." },
      { title: "Predictive Follow-Up", desc: "Track kapan lead buka email (time zone + jam aktif). Kirim follow-up 1-2 jam setelah mereka buka email pertama." },
    ]
  },
  {
    category: "🤖 Stack AI Sales Modern", color: "#f59e0b",
    steps: [
      { title: "Prospecting: Clay.com", desc: "Build lead list dinamis dari 50+ sumber data. Auto-enrich + auto-personalize dengan AI waterfall." },
      { title: "Outreach: Instantly.ai / Lemlist", desc: "Kirim cold email skala besar (100-500/hari) dengan warming otomatis. Deliverability terjaga." },
      { title: "CRM: HubSpot Free / Notion", desc: "Track semua touchpoint. Set reminder follow-up otomatis. Jangan andalkan ingatan." },
      { title: "Closing: AI Proposal Generator", desc: "Gunakan ChatGPT + template untuk buat proposal custom dalam 5 menit. Win rate naik 30% vs proposal generic." },
    ]
  },
];

const statusColor: Record<string, string> = { Hot: "#ff4444", Warm: "#ff9900", Cold: "#4488ff", Closed: "#00cc66" };
const statusBg: Record<string, string> = { Hot: "#ff44441a", Warm: "#ff99001a", Cold: "#4488ff1a", Closed: "#00cc661a" };

const inputStyle = {
  background: "#0d1117", border: "1px solid #21262d", borderRadius: 8,
  color: "#e6edf3", padding: "10px 14px", fontSize: 13, width: "100%",
  outline: "none", fontFamily: "'IBM Plex Mono', monospace",
};
const btnPrimary = {
  background: "linear-gradient(135deg, #00ff88, #00cc6a)", color: "#000",
  border: "none", borderRadius: 8, padding: "10px 20px",
  fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
};

export default function SalesTracker({ user }: { user: User }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddOutreach, setShowAddOutreach] = useState(false);
  const [showAddRejection, setShowAddRejection] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({ name: "", contact: "", source: "GMaps", status: "Cold", email: "", phone: "", category: "F&B", notes: "", value: "" });
  const [newOutreach, setNewOutreach] = useState({ leadName: "", type: "Email", subject: "", status: "Sent" });
  const [newRejection, setNewRejection] = useState({ leadName: "", reason: "", channel: "Email", followUpDate: "", lesson: "" });

  const uid = user.uid;

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "users", uid, "leads"), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead));
        setLeads(docs);
        // Seed demo data on first load
        if (!seeded && docs.length === 0) {
          setSeeded(true);
          SEED_LEADS.forEach((l) => {
            const id = `seed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            setDoc(doc(db, "users", uid, "leads", id), { ...l });
          });
        }
      }),
      onSnapshot(collection(db, "users", uid, "outreach"), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Outreach));
        setOutreach(docs);
        if (!seeded && docs.length === 0) {
          SEED_OUTREACH.forEach((o) => {
            const id = `seed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            setDoc(doc(db, "users", uid, "outreach", id), { ...o });
          });
        }
      }),
      onSnapshot(collection(db, "users", uid, "rejections"), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Rejection));
        setRejections(docs);
        if (!seeded && docs.length === 0) {
          SEED_REJECTIONS.forEach((r) => {
            const id = `seed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            setDoc(doc(db, "users", uid, "rejections", id), { ...r });
          });
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid, seeded]);

  async function addLead() {
    if (!newLead.name) return;
    const score = Math.floor(50 + Math.random() * 40);
    const id = `lead_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "leads", id), {
      ...newLead, score, lastContact: new Date().toISOString().split("T")[0],
      value: parseInt(newLead.value) || 5000000,
    });
    setNewLead({ name: "", contact: "", source: "GMaps", status: "Cold", email: "", phone: "", category: "F&B", notes: "", value: "" });
    setShowAddLead(false);
  }

  async function addOutreach() {
    if (!newOutreach.leadName) return;
    const id = `out_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "outreach", id), {
      ...newOutreach, date: new Date().toISOString().split("T")[0], opens: 0, clicks: 0,
    });
    setNewOutreach({ leadName: "", type: "Email", subject: "", status: "Sent" });
    setShowAddOutreach(false);
  }

  async function addRejection() {
    if (!newRejection.leadName) return;
    const id = `rej_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "rejections", id), {
      ...newRejection, date: new Date().toISOString().split("T")[0],
    });
    setNewRejection({ leadName: "", reason: "", channel: "Email", followUpDate: "", lesson: "" });
    setShowAddRejection(false);
  }

  async function deleteLead(id: string) {
    await deleteDoc(doc(db, "users", uid, "leads", id));
  }

  function handleLogout() {
    signOut(auth);
    router.replace("/login");
  }

  const totalValue = leads.reduce((a, b) => a + b.value, 0);
  const closedLeads = leads.filter(l => l.status === "Closed");
  const hotLeads = leads.filter(l => l.status === "Hot");
  const conversionRate = leads.length ? ((closedLeads.length / leads.length) * 100).toFixed(0) : "0";
  const avgScore = leads.length ? (leads.reduce((a, b) => a + b.score, 0) / leads.length).toFixed(0) : "0";
  const repliedOutreach = outreach.filter(o => o.status === "Replied").length;
  const replyRate = outreach.length ? ((repliedOutreach / outreach.length) * 100).toFixed(0) : "0";
  const filteredLeads = filterStatus === "All" ? leads : leads.filter(l => l.status === filterStatus);

  return (
    <div style={{ background: "#010409", minHeight: "100vh", fontFamily: "'IBM Plex Mono', monospace", color: "#e6edf3" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;600;700&display=swap');
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0d1117; } ::-webkit-scrollbar-thumb { background: #21262d; border-radius: 4px; }
        .tab-btn:hover { background: #161b22 !important; }
        .lead-row:hover { background: #0d1117 !important; cursor: pointer; }
        .stat-card-dash { transition: transform 0.2s; } .stat-card-dash:hover { transform: translateY(-2px); }
        .step-card:hover { border-color: var(--accent) !important; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        input:focus, select:focus, textarea:focus { border-color: #00ff88 !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #21262d", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #00ff88, #00cc6a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.5px" }}>SALES<span style={{ color: "#00ff88" }}>PAL</span></div>
            <div style={{ fontSize: 10, color: "#7d8590", letterSpacing: "2px" }}>AI-POWERED LEAD TRACKER</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 11, color: "#7d8590", textAlign: "right" }}>
            <span style={{ color: "#00ff88" }}>● </span>
            {user.displayName || user.email}
          </div>
          <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid #21262d", borderRadius: 8, color: "#7d8590", padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #21262d", padding: "0 24px", display: "flex", gap: 4, overflowX: "auto" }}>
        {TABS.map(tab => (
          <button key={tab} className="tab-btn" onClick={() => setActiveTab(tab)}
            style={{ background: activeTab === tab ? "#161b22" : "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid #00ff88" : "2px solid transparent", color: activeTab === tab ? "#e6edf3" : "#7d8590", padding: "12px 16px", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontWeight: activeTab === tab ? 700 : 400, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {activeTab === "Dashboard" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Sales Command Center</div>
              <div style={{ color: "#7d8590", fontSize: 12, marginTop: 4 }}>Overview pipeline & performance real-time lo</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Leads", value: leads.length, sub: `${hotLeads.length} hot leads`, color: "#ff4444", icon: "👥" },
                { label: "Pipeline Value", value: `${(totalValue / 1000000).toFixed(1)}M`, sub: "estimasi total", color: "#00ff88", icon: "💰" },
                { label: "Conversion Rate", value: `${conversionRate}%`, sub: `${closedLeads.length} closed`, color: "#a78bfa", icon: "📈" },
                { label: "Reply Rate", value: `${replyRate}%`, sub: `${repliedOutreach}/${outreach.length} outreach`, color: "#f59e0b", icon: "📬" },
                { label: "Avg Lead Score", value: avgScore, sub: "dari 100", color: "#00ccff", icon: "⭐" },
                { label: "Rejections", value: rejections.length, sub: "perlu follow up", color: "#ff6b35", icon: "❌" },
              ].map(s => (
                <div key={s.label} className="stat-card-dash" style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: "20px 16px" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#e6edf3", marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "#7d8590", marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Sales Pipeline</div>
              {["Cold", "Warm", "Hot", "Closed"].map(s => {
                const count = leads.filter(l => l.status === s).length;
                const pct = leads.length ? (count / leads.length) * 100 : 0;
                return (
                  <div key={s} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: statusColor[s], fontWeight: 600 }}>{s}</span>
                      <span style={{ fontSize: 11, color: "#7d8590" }}>{count} leads · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ background: "#161b22", borderRadius: 4, height: 8 }}>
                      <div style={{ background: statusColor[s], width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif" }}>🔥 Hot Leads - Prioritas Sekarang</div>
              {hotLeads.length === 0 && <div style={{ fontSize: 12, color: "#7d8590" }}>Belum ada hot leads.</div>}
              {hotLeads.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #161b22" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#ff44441a", border: "1px solid #ff444430", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔥</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: "#7d8590" }}>{l.contact} · {l.category}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#00ff88" }}>Rp {(l.value / 1000000).toFixed(1)}M</div>
                    <div style={{ fontSize: 11, color: "#7d8590" }}>Score: {l.score}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEADS */}
        {activeTab === "Leads" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Lead Database</div>
                <div style={{ color: "#7d8590", fontSize: 12, marginTop: 2 }}>{filteredLeads.length} leads ditampilkan</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All", "Hot", "Warm", "Cold", "Closed"].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    style={{ background: filterStatus === s ? (statusColor[s] || "#21262d") : "#0d1117", color: filterStatus === s ? "#fff" : "#7d8590", border: "1px solid #21262d", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {s}
                  </button>
                ))}
                <button onClick={() => setShowAddLead(true)} style={btnPrimary}>+ ADD LEAD</button>
              </div>
            </div>
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
                    {["PERUSAHAAN", "KONTAK", "SOURCE", "STATUS", "SCORE", "VALUE", "LAST CONTACT", ""].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, color: "#7d8590", letterSpacing: "1px", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => (
                    <tr key={lead.id} className="lead-row" onClick={() => setSelectedLead(lead)} style={{ borderBottom: "1px solid #161b22" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{lead.name}</div>
                        <div style={{ fontSize: 11, color: "#7d8590" }}>{lead.category}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "#7d8590" }}>{lead.contact}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 11, background: "#161b22", border: "1px solid #21262d", borderRadius: 4, padding: "3px 8px" }}>{lead.source}</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span className="badge" style={{ background: statusBg[lead.status], color: statusColor[lead.status], border: `1px solid ${statusColor[lead.status]}30` }}>{lead.status}</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 40, height: 4, background: "#161b22", borderRadius: 2 }}>
                            <div style={{ width: `${lead.score}%`, height: "100%", background: lead.score > 80 ? "#00ff88" : lead.score > 60 ? "#f59e0b" : "#ff4444", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{lead.score}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "#00ff88" }}>Rp {(lead.value / 1000000).toFixed(1)}M</td>
                      <td style={{ padding: "14px 16px", fontSize: 11, color: "#7d8590" }}>{lead.lastContact}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <button onClick={(e) => { e.stopPropagation(); deleteLead(lead.id); }} style={{ background: "transparent", border: "1px solid #ff444430", color: "#ff4444", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* OUTREACH */}
        {activeTab === "Outreach" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Outreach Tracker</div>
                <div style={{ color: "#7d8590", fontSize: 12, marginTop: 2 }}>Track semua DM, email, dan WA lo</div>
              </div>
              <button onClick={() => setShowAddOutreach(true)} style={btnPrimary}>+ LOG OUTREACH</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Sent", value: outreach.length, color: "#00ccff" },
                { label: "Replied", value: outreach.filter(o => o.status === "Replied").length, color: "#00ff88" },
                { label: "Seen/Open", value: outreach.filter(o => o.status === "Seen").length, color: "#f59e0b" },
                { label: "No Response", value: outreach.filter(o => o.status === "No Response").length, color: "#7d8590" },
                { label: "Rejected", value: outreach.filter(o => o.status === "Rejected").length, color: "#ff4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#7d8590", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {outreach.map(o => {
                const statusColors: Record<string, string> = { Replied: "#00ff88", Seen: "#f59e0b", Sent: "#00ccff", "No Response": "#7d8590", Rejected: "#ff4444" };
                return (
                  <div key={o.id} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div style={{ fontSize: 20 }}>{o.type === "Email" ? "📧" : o.type === "DM Instagram" ? "📸" : "💬"}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{o.leadName}</div>
                        <div style={{ fontSize: 11, color: "#7d8590", marginTop: 2 }}>{o.subject}</div>
                        <div style={{ fontSize: 10, color: "#7d8590", marginTop: 2 }}>{o.type} · {o.date}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge" style={{ background: `${statusColors[o.status]}20`, color: statusColors[o.status], border: `1px solid ${statusColors[o.status]}40` }}>{o.status}</span>
                      <div style={{ fontSize: 10, color: "#7d8590", marginTop: 6 }}>Opens: {o.opens} · Clicks: {o.clicks}</div>
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
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Rejection Log</div>
                <div style={{ color: "#7d8590", fontSize: 12, marginTop: 2 }}>Tiap rejection = data buat improve. Catat & belajar.</div>
              </div>
              <button onClick={() => setShowAddRejection(true)} style={btnPrimary}>+ LOG REJECTION</button>
            </div>
            <div style={{ background: "#ff44440d", border: "1px solid #ff444430", borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 12, color: "#ff8888" }}>
              <span style={{ fontWeight: 700 }}>💡 Mindset:</span> Rejection bukan kegagalan — itu adalah data. Setiap &quot;tidak&quot; lo adalah insight buat close deal berikutnya lebih cepet.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {rejections.map(r => (
                <div key={r.id} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{r.leadName}</div>
                      <div style={{ fontSize: 11, color: "#7d8590" }}>{r.channel} · {r.date}</div>
                    </div>
                    <span className="badge" style={{ background: "#ff44441a", color: "#ff4444", border: "1px solid #ff444430" }}>REJECTED</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "#161b22", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "#7d8590", letterSpacing: "1px", marginBottom: 4 }}>ALASAN REJECTION</div>
                      <div style={{ fontSize: 12, color: "#ff8888" }}>{r.reason}</div>
                    </div>
                    <div style={{ background: "#161b22", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "#7d8590", letterSpacing: "1px", marginBottom: 4 }}>FOLLOW-UP DATE</div>
                      <div style={{ fontSize: 12, color: "#f59e0b" }}>{r.followUpDate || "Belum dijadwal"}</div>
                    </div>
                  </div>
                  <div style={{ background: "#00ff881a", borderRadius: 8, padding: 12, marginTop: 12, border: "1px solid #00ff8820" }}>
                    <div style={{ fontSize: 10, color: "#00ff88", letterSpacing: "1px", marginBottom: 4 }}>💡 LESSON LEARNED</div>
                    <div style={{ fontSize: 12 }}>{r.lesson}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI PLAYBOOK */}
        {activeTab === "AI Playbook" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>AI Sales Playbook</div>
              <div style={{ color: "#7d8590", fontSize: 12, marginTop: 4 }}>Cara scraping, outreach, dan dominasi sales di era AI</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {AI_PLAYBOOK.map((section, si) => (
                <div key={si} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 14, padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 20, color: section.color }}>{section.category}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    {section.steps.map((step, i) => (
                      <div key={i} className="step-card" style={{ ["--accent" as string]: section.color, background: "#161b22", borderRadius: 10, padding: 16, border: "1px solid #21262d", transition: "border-color 0.2s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: `${section.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: section.color, border: `1px solid ${section.color}40` }}>{i + 1}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: section.color }}>{step.title}</div>
                        </div>
                        <div style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.6 }}>{step.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#0d1117", border: "1px solid #a78bfa40", borderRadius: 14, padding: 24, marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#a78bfa", fontFamily: "'Space Grotesk', sans-serif" }}>🎯 Target Benchmark Sales Metrics Lo</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {[
                  { metric: "Cold Email Reply Rate", target: "5–15%", world: "< 3%", color: "#00ff88" },
                  { metric: "DM Instagram Reply", target: "20–35%", world: "< 10%", color: "#f59e0b" },
                  { metric: "Meeting Rate dari Reply", target: "40%+", world: "< 20%", color: "#00ccff" },
                  { metric: "Close Rate dari Meeting", target: "25–35%", world: "< 15%", color: "#a78bfa" },
                  { metric: "Follow-up Response Rate", target: "30%+", world: "< 10%", color: "#ff6b35" },
                  { metric: "Avg Deal Cycle", target: "< 14 hari", world: "> 30 hari", color: "#ff4444" },
                ].map(m => (
                  <div key={m.metric} style={{ background: "#161b22", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#7d8590", marginBottom: 6 }}>{m.metric}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "'Space Grotesk', sans-serif" }}>{m.target}</div>
                    <div style={{ fontSize: 10, color: "#7d8590", marginTop: 4 }}>Rata-rata industri: {m.world}</div>
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
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 20 }}>+ Add New Lead</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([["name", "Nama Perusahaan"], ["contact", "Nama Kontak"], ["email", "Email"], ["phone", "No. HP"], ["value", "Estimasi Value (Rp)"]] as [string, string][]).map(([k, label]) => (
                <div key={k} style={{ gridColumn: k === "name" || k === "value" ? "1/-1" : "auto" }}>
                  <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>{label}</label>
                  <input value={(newLead as Record<string, string>)[k]} onChange={e => setNewLead({ ...newLead, [k]: e.target.value })} style={inputStyle} placeholder={label} />
                </div>
              ))}
              {([["source", "Source", ["GMaps", "DM IG", "Cold Email", "Referral", "WhatsApp", "LinkedIn"]], ["status", "Status", ["Cold", "Warm", "Hot", "Closed"]], ["category", "Kategori", ["F&B", "Retail", "Health", "Property", "Service", "Tech", "Education"]]] as [string, string, string[]][]).map(([k, label, opts]) => (
                <div key={k}>
                  <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>{label}</label>
                  <select value={(newLead as Record<string, string>)[k]} onChange={e => setNewLead({ ...newLead, [k]: e.target.value })} style={inputStyle}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>Notes</label>
                <textarea value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} style={{ ...inputStyle, resize: "none", height: 70 }} placeholder="Catatan tentang lead ini..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={addLead} style={btnPrimary}>SIMPAN LEAD</button>
              <button onClick={() => setShowAddLead(false)} style={{ ...btnPrimary, background: "#21262d", color: "#e6edf3" }}>BATAL</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Outreach */}
      {showAddOutreach && (
        <div className="modal-overlay" onClick={() => setShowAddOutreach(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 20 }}>+ Log Outreach</div>
            {([["leadName", "Nama Lead/Perusahaan"], ["subject", "Subject / Pesan Pembuka"]] as [string, string][]).map(([k, label]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>{label}</label>
                <input value={(newOutreach as Record<string, string>)[k]} onChange={e => setNewOutreach({ ...newOutreach, [k]: e.target.value })} style={inputStyle} placeholder={label} />
              </div>
            ))}
            {([["type", "Tipe", ["Email", "DM Instagram", "WhatsApp", "LinkedIn", "Telepon"]], ["status", "Status", ["Sent", "Seen", "Replied", "No Response", "Rejected"]]] as [string, string, string[]][]).map(([k, label, opts]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>{label}</label>
                <select value={(newOutreach as Record<string, string>)[k]} onChange={e => setNewOutreach({ ...newOutreach, [k]: e.target.value })} style={inputStyle}>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={addOutreach} style={btnPrimary}>SIMPAN</button>
              <button onClick={() => setShowAddOutreach(false)} style={{ ...btnPrimary, background: "#21262d", color: "#e6edf3" }}>BATAL</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Rejection */}
      {showAddRejection && (
        <div className="modal-overlay" onClick={() => setShowAddRejection(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 20 }}>+ Log Rejection</div>
            {([["leadName", "Nama Lead/Perusahaan"], ["reason", "Alasan Rejection"], ["lesson", "Lesson Learned"]] as [string, string][]).map(([k, label]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>{label}</label>
                {k === "lesson"
                  ? <textarea value={(newRejection as Record<string, string>)[k]} onChange={e => setNewRejection({ ...newRejection, [k]: e.target.value })} style={{ ...inputStyle, resize: "none", height: 70 }} placeholder={label} />
                  : <input value={(newRejection as Record<string, string>)[k]} onChange={e => setNewRejection({ ...newRejection, [k]: e.target.value })} style={inputStyle} placeholder={label} />}
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>Channel</label>
              <select value={newRejection.channel} onChange={e => setNewRejection({ ...newRejection, channel: e.target.value })} style={inputStyle}>
                {["Email", "DM Instagram", "WhatsApp", "LinkedIn", "Telepon"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#7d8590", display: "block", marginBottom: 6 }}>Jadwal Follow-Up</label>
              <input type="date" value={newRejection.followUpDate} onChange={e => setNewRejection({ ...newRejection, followUpDate: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={addRejection} style={btnPrimary}>SIMPAN</button>
              <button onClick={() => setShowAddRejection(false)} style={{ ...btnPrimary, background: "#21262d", color: "#e6edf3" }}>BATAL</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{selectedLead.name}</div>
                <span className="badge" style={{ background: statusBg[selectedLead.status], color: statusColor[selectedLead.status], border: `1px solid ${statusColor[selectedLead.status]}30`, marginTop: 6, display: "inline-block" }}>{selectedLead.status}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#00ff88", fontFamily: "'Space Grotesk', sans-serif" }}>Rp {(selectedLead.value / 1000000).toFixed(1)}M</div>
            </div>
            {([["👤 Kontak", selectedLead.contact], ["📧 Email", selectedLead.email], ["📱 Phone", selectedLead.phone], ["🏷️ Kategori", selectedLead.category], ["📍 Source", selectedLead.source], ["📅 Last Contact", selectedLead.lastContact]] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #161b22", fontSize: 13 }}>
                <span style={{ color: "#7d8590" }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ background: "#161b22", borderRadius: 8, padding: 12, marginTop: 16 }}>
              <div style={{ fontSize: 10, color: "#7d8590", letterSpacing: "1px", marginBottom: 6 }}>NOTES</div>
              <div style={{ fontSize: 12 }}>{selectedLead.notes || "—"}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: "#7d8590", letterSpacing: "1px", marginBottom: 8 }}>LEAD SCORE</div>
              <div style={{ background: "#161b22", borderRadius: 6, height: 10 }}>
                <div style={{ width: `${selectedLead.score}%`, height: "100%", background: selectedLead.score > 80 ? "#00ff88" : selectedLead.score > 60 ? "#f59e0b" : "#ff4444", borderRadius: 6, transition: "width 0.6s" }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: selectedLead.score > 80 ? "#00ff88" : selectedLead.score > 60 ? "#f59e0b" : "#ff4444" }}>{selectedLead.score} / 100</div>
            </div>
            <button onClick={() => setSelectedLead(null)} style={{ ...btnPrimary, width: "100%", marginTop: 20 }}>TUTUP</button>
          </div>
        </div>
      )}
    </div>
  );
}
