"use client";

import { useState, useEffect } from "react";
import { signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import Image from "next/image";
import SalesTracker from "@/components/SalesTracker";

type Tab = "home" | "scripts" | "simulator" | "archetype" | "crm";

interface Script {
  id: string;
  title: string;
  kategori: "harga" | "kompetitor" | "budget" | "authority" | "timing" | "value";
  emosi: "assertif" | "empatik" | "logis" | "urgensi";
  urgency: "low" | "medium" | "high";
  archetypes: string[];
  objection: string;
  script: string;
  notes: string;
}

interface SimScenario {
  id: string;
  title: string;
  context: string;
  objection: string;
  options: { text: string; score: number; feedback: string }[];
  bestScript: string;
  archetype: string;
}

interface ArchetypeQ {
  q: string;
  opts: { text: string; type: string }[];
}

const SCRIPTS: Script[] = [
  {
    id: "s1",
    title: "Acknowledge + Nilai Balik (Harga)",
    kategori: "harga",
    emosi: "empatik",
    urgency: "medium",
    archetypes: ["🐰", "🐬"],
    objection: "Harga lo terlalu mahal",
    script: "Gw ngerti banget kekhawatiran lo soal harga. Banyak klien gw awalnya ngerasa sama. Boleh gw tanya — kalau misal lo BISA dapetin [hasil X] dalam [waktu Y], apakah investasi ini worth it buat lo? Karena yang sering terjadi, klien gw yang awalnya ragu soal harga justru sekarang jadi yang paling seneng karena hasilnya jauh melampaui ekspektasi.",
    notes: "Jangan defensif soal harga. Shift conversation ke value & ROI.",
  },
  {
    id: "s2",
    title: "ROI Calculator Script (Harga)",
    kategori: "harga",
    emosi: "logis",
    urgency: "high",
    archetypes: ["🦉", "🐯"],
    objection: "Budget kami tidak sampai segitu",
    script: "Boleh gw tunjukin quick math? Kalau lo bisa [hemat/generate] X per bulan dari tools ini, dalam 3 bulan lo udah balik modal. Banyak klien gw malah ngerasa ini bukan cost — ini investasi. Mau gw breakdown angkanya bareng lo?",
    notes: "Siapkan data konkret. Burung Hantu & Singa butuh angka, bukan cerita.",
  },
  {
    id: "s3",
    title: "Feel Felt Found Framework",
    kategori: "kompetitor",
    emosi: "empatik",
    urgency: "low",
    archetypes: ["🐬", "🐰"],
    objection: "Kami sudah pakai [kompetitor]",
    script: "Gw ngerti banget itu. Banyak klien gw juga ngerasain hal yang sama waktu pertama ketemu — mereka juga udah punya tools yang jalan. Tapi yang mereka temuin setelah coba ini adalah [diferensiasi spesifik]. Mau gw ceritain studi kasusnya?",
    notes: "Feel = validasi. Felt = normalisasi. Found = pivot ke value unik lo.",
  },
  {
    id: "s4",
    title: "Competitive Intelligence Script",
    kategori: "kompetitor",
    emosi: "assertif",
    urgency: "medium",
    archetypes: ["🐯", "🦉"],
    objection: "Kompetitor lo lebih murah",
    script: "Betul, dan itu pilihan yang valid. Tapi izinkan gw tanya — apa yang lo paling prioritasin: harga awal yang lebih murah, atau total cost of ownership dalam 12 bulan? [Kompetitor X] charge per-user fee yang naik 40% setelah 50 users. Kita flat. Untuk skala lo, kita actually lebih murah.",
    notes: "Siapkan competitive matrix. Singa & Burung Hantu akan appreciate detail ini.",
  },
  {
    id: "s5",
    title: "Budget Discovery Script",
    kategori: "budget",
    emosi: "logis",
    urgency: "high",
    archetypes: ["🦉", "🐯"],
    objection: "Tidak ada budget saat ini",
    script: "Appreciate kejujurannya. Boleh gw tanya — ini soal timing budget cycle, atau memang priority-nya belum match? Karena kalau ini soal timing, kita bisa set up struktur pembayaran yang align sama fiscal year lo. Dan kalau soal priority, gw mau bantu lo build business case ke atasannya.",
    notes: "Bedain 'tidak ada budget' vs 'tidak mau budget'. Dua hal yang beda pendekatannya.",
  },
  {
    id: "s6",
    title: "Urgency + Cost of Inaction",
    kategori: "timing",
    emosi: "urgensi",
    urgency: "high",
    archetypes: ["🐯", "🦉"],
    objection: "Kami butuh waktu untuk pikir-pikir dulu",
    script: "Gw fully respect itu. Tapi boleh gw share satu hal? Setiap bulan lo delay, lo kehilangan [spesifik: X leads, Y revenue, Z time]. Kompetitor lo yang udah pakai ini — mereka udah 3 bulan ahead. Kalau lo mau, kita bisa mulai dengan pilot kecil biar lo bisa lihat hasilnya tanpa full commitment dulu.",
    notes: "Hitung cost of inaction secara konkret. Jangan rush tapi tunjukkan real opportunity cost.",
  },
  {
    id: "s7",
    title: "Stakeholder Mapping Script",
    kategori: "authority",
    emosi: "logis",
    urgency: "medium",
    archetypes: ["🦉", "🐯"],
    objection: "Perlu approval dari atasan/komite dulu",
    script: "Totally makes sense. Justru gw mau bantu lo supaya presentasi ke beliau semulus mungkin. Biasanya apa yang paling penting buat bos lo — ROI, risk mitigation, atau competitive advantage? Gw bisa bikinin executive summary yang spesifik buat dia.",
    notes: "Jadi internal champion-nya. Bantu mereka sell ke internal, bukan cuma jual ke mereka.",
  },
  {
    id: "s8",
    title: "Pain Amplification Script",
    kategori: "value",
    emosi: "empatik",
    urgency: "medium",
    archetypes: ["🐬", "🐰"],
    objection: "Kami tidak merasa butuh ini sekarang",
    script: "Gw appreciate honesty lo. Boleh gw tanya satu hal? Apa yang terjadi kalau problem [X yang lo solve] ini dibiarkan 6 bulan lagi? Banyak klien gw bilang hal yang sama... sampai akhirnya situasinya jadi lebih urgent. Gw ga mau lo sampai di titik itu. Mau gw tunjukin bagaimana ini bisa prevent [worst case]?",
    notes: "Amplify pain sebelum present solution. Lumba-Lumba & Kelinci respond ke empati + pencegahan.",
  },
  {
    id: "s9",
    title: "Social Proof Stacking",
    kategori: "value",
    emosi: "logis",
    urgency: "low",
    archetypes: ["🐰", "🐬"],
    objection: "Gw belum yakin ini akan works untuk kami",
    script: "Gw ngerti rasa ragu itu. Makanya gw mau share — [nama klien mirip industri] yang punya challenge yang sama persis sama lo, dalam 90 hari pertama mereka berhasil [hasil spesifik]. Gw bisa connect lo sama mereka kalau lo mau dengar langsung dari mereka.",
    notes: "Kelinci butuh social proof kuat. Offer referral conversation jika possible.",
  },
  {
    id: "s10",
    title: "The Pilot Proposal",
    kategori: "timing",
    emosi: "logis",
    urgency: "medium",
    archetypes: ["🐰", "🦉"],
    objection: "Kami perlu test dulu sebelum commit",
    script: "Justru itu yang gw recommend! Kita mulai dengan 30-day pilot — lo set KPI-nya, gw commit untuk hit itu atau kita stop. No hard feelings. Ini cara paling fair untuk lo see the value tanpa full risk. Kapan lo mau mulai?",
    notes: "Lower perceived risk. Burung Hantu & Kelinci lebih comfortable dengan structured trial.",
  },
  {
    id: "s11",
    title: "Assumptive Close",
    kategori: "timing",
    emosi: "assertif",
    urgency: "high",
    archetypes: ["🐯"],
    objection: "Belum ada keputusan",
    script: "Satu hal yang gw respect dari lo adalah lo action-oriented. Jadi gw mau langsung — gw ada 2 slot onboarding untuk bulan ini. Mau kita set jadwal kick-off untuk Senin atau Rabu?",
    notes: "Hanya untuk Singa. Jangan pakai ini untuk tipe lain — akan backfire.",
  },
  {
    id: "s12",
    title: "Empathy Bridge + Future Pacing",
    kategori: "harga",
    emosi: "empatik",
    urgency: "low",
    archetypes: ["🐬", "🐰"],
    objection: "Ini terlalu mahal untuk bisnis kami yang masih kecil",
    script: "Gw paham banget posisi lo — gw juga pernah di posisi itu. Dan justru karena itu gw pengen bantu. Bayangkan 6 bulan dari sekarang, kalau [problem X] udah solved dan lo bisa fokus ke [growth goal lo] — gimana rasanya? Ini yang terjadi untuk klien gw yang mulai dari posisi yang sama.",
    notes: "Paint the future vision. Emotional resonance dulu sebelum logic.",
  },
  {
    id: "s13",
    title: "Reframe Objection Script",
    kategori: "kompetitor",
    emosi: "assertif",
    urgency: "medium",
    archetypes: ["🐯", "🦉"],
    objection: "Produk/jasa lo sama saja dengan yang lain",
    script: "Gw appreciate perspektif itu — dan gw challenge dengan respect. Boleh gw tunjukin 3 hal yang beda? [Diferensiasi 1], [Diferensiasi 2], [Diferensiasi 3]. Kalau setelah itu lo masih ngerasa sama, gw akan jadi orang pertama yang bilang kita bukan fit yang tepat untuk lo.",
    notes: "Confident reframe. Jangan apologetik. Tunjukkan 3 differentiators konkret.",
  },
  {
    id: "s14",
    title: "The Bridge Question",
    kategori: "value",
    emosi: "logis",
    urgency: "medium",
    archetypes: ["🦉", "🐯"],
    objection: "Kami sedang evaluasi beberapa opsi",
    script: "Bagus — itu keputusan yang smart. Boleh tanya, apa kriteria utama yang lo gunakan untuk evaluasi? Dan siapa yang terlibat dalam keputusan ini? Gw ingin pastiin lo punya semua informasi yang lo butuhkan untuk banding apple-to-apple.",
    notes: "Discovery question untuk understand decision criteria. Data untuk build proposal yang tepat.",
  },
  {
    id: "s15",
    title: "Loss Aversion Trigger",
    kategori: "timing",
    emosi: "urgensi",
    urgency: "high",
    archetypes: ["🐯", "🦉"],
    objection: "Kami akan consider di kuartal depan",
    script: "Gw respect itu. Tapi mau gw share satu data point? Dari 100 perusahaan yang bilang 'kuartal depan' ke gw, 73% akhirnya tidak jadi karena ada prioritas baru yang muncul — dan 6 bulan kemudian mereka menyesal. Gw ga mau lo ada di 73% itu. Apa yang bisa kita lakukan sekarang untuk secure posisi lo?",
    notes: "Data-driven urgency creation. Authentic kalau lo punya real data. Jangan fabricate.",
  },
];

const SCENARIOS: SimScenario[] = [
  {
    id: "sim1",
    title: "Klien Bilang Harga Terlalu Mahal",
    context: "Lo udah 30 menit presentasi. Produk lo Rp 5jt/bulan. Klien nods throughout, tapi di akhir bilang...",
    objection: "\"Wah, harganya di luar budget kami. Kompetitor lo ada yang Rp 2jt.\"",
    options: [
      { text: "\"Oke, kita bisa kasih diskon 30% untuk lo.\"", score: 5, feedback: "❌ Langsung diskon = lo devalue product lo sendiri. Klien jadi curiga kualitasnya." },
      { text: "\"Gw ngerti. Boleh gw tanya — apa yang paling penting buat lo: harga awal atau total value dalam 12 bulan?\"", score: 25, feedback: "✅ Perfect! Shift conversation ke value & ROI. Bukan defensif soal harga." },
      { text: "\"Tapi kan fiturnya jauh lebih bagus dari kompetitor!\"", score: 10, feedback: "⚠️ Defensif dan tidak menjawab kekhawatiran real mereka soal budget." },
      { text: "\"Yaudah, gimana kalau kita coba dulu 1 bulan gratis?\"", score: 15, feedback: "⚠️ Lumayan, tapi langsung offer free trial tanpa understand root concern dulu." },
    ],
    bestScript: "\"Gw appreciate kejujurannya. Banyak klien gw awalnya punya concern yang sama. Boleh gw tanya dulu — budget Rp 2jt itu angka final atau ada fleksibilitas kalau ROI-nya prove out? Karena kalau gw bisa tunjukin bahwa tools ini generate Rp 15jt+ per bulan untuk bisnis sejenis lo, apakah investasi Rp 5jt masih terasa mahal?\"",
    archetype: "🦉🐯",
  },
  {
    id: "sim2",
    title: "Klien Sudah Punya Kompetitor",
    context: "Discovery call. Klien adalah Head of Marketing perusahaan mid-size. Mereka sudah pakai tools lain.",
    objection: "\"Kami sudah pakai [Tool X] dan cukup happy dengan itu. Kenapa harus pindah?\"",
    options: [
      { text: "\"[Tool X] itu bagus juga sih, tapi kami lebih bagus di [fitur Y].\"", score: 15, feedback: "⚠️ Terlalu defensive. Jangan dismiss pilihan mereka sekarang." },
      { text: "\"Oke siap, makasih ya untuk waktunya.\"", score: 0, feedback: "❌ Give up terlalu cepat! Ini baru satu objection." },
      { text: "\"Banyak klien gw juga awalnya di posisi yang sama. Mereka tetap pakai [Tool X] tapi tambah kami untuk [use case spesifik]. Boleh gw tanya, apa pain point terbesar lo dengan [Tool X] saat ini?\"", score: 25, feedback: "✅ Excellent! Ga langsung fight kompetitor. Cari gap & pain point." },
      { text: "\"Wah sayang banget, produk kami jauh lebih unggul dari [Tool X].\"", score: 5, feedback: "❌ Arrogant approach. Bikin klien defensive dan melindungi pilihan mereka." },
    ],
    bestScript: "\"Gw totally respect loyalty itu — [Tool X] memang proven. Justru gw mau tanya, bukan untuk replace, tapi untuk understand: kalau ada satu hal yang bisa [Tool X] lakukan lebih baik, apa itu? Karena banyak tim yang pakai kami justru sebagai complement, bukan replacement — dan di area [spesifik gap], kami cover apa yang [Tool X] tidak bisa.\"",
    archetype: "🐬🐰",
  },
  {
    id: "sim3",
    title: "Klien Minta Approval Atasan",
    context: "Udah 2 meeting. Klien (Manager level) antusias. Tapi di meeting ketiga bilang...",
    objection: "\"Saya suka, tapi keputusan ini harus melalui Direktur saya. Dan beliau susah untuk di-convince soal tools baru.\"",
    options: [
      { text: "\"Oke, lo bisa connect gw sama Direkturnya?\"", score: 15, feedback: "⚠️ Boleh, tapi persiapkan dulu. Jangan meeting tanpa ammo yang tepat." },
      { text: "\"Gw bisa bikin executive summary + ROI deck khusus untuk beliau. Biasanya apa yang paling penting buat Direkturnya — cost savings, risk reduction, atau competitive advantage?\"", score: 25, feedback: "✅ Champion-enabling! Lo bantu mereka sell ke internal. Smart move." },
      { text: "\"Yaudah, gw tunggu kabarnya ya.\"", score: 5, feedback: "❌ Passive. Deal akan mati di sini. Never leave without next step." },
      { text: "\"Coba lo ajak Direkturnya meeting sama gw langsung.\"", score: 10, feedback: "⚠️ Bisa works tapi persiapkan klien untuk jadi internal champion dulu." },
    ],
    bestScript: "\"That's actually a great sign — artinya lo udah see the value. Gw ingin bantu supaya presentasi ke Direkturnya seamless. Dua hal: pertama, boleh gw bikinin executive one-pager yang highlight business case + ROI yang spesifik buat perusahaan lo? Kedua, biasanya Direktur di industri ini paling concern soal apa — downside risk atau opportunity cost? Gw mau pastiin kita address itu langsung.\"",
    archetype: "🦉🐯",
  },
  {
    id: "sim4",
    title: "Klien Bilang Belum Butuh Sekarang",
    context: "Warm lead dari referral. Tapi setelah demo mereka bilang...",
    objection: "\"Produknya bagus, tapi kami belum di stage itu. Mungkin 6 bulan lagi.\"",
    options: [
      { text: "\"Siap, gw akan follow up 6 bulan lagi.\"", score: 5, feedback: "⚠️ 6 bulan = deal mati. Lo akan dilupakan." },
      { text: "\"Gw ngerti. Tapi boleh gw tanya — apa yang harus terjadi di bisnis lo dalam 6 bulan ini supaya lo siap? Karena gw mau pastiin kita bantu lo reach stage itu lebih cepat.\"", score: 25, feedback: "✅ Brilliant! Redirect ke what needs to happen. Jadikan lo bagian dari solusinya." },
      { text: "\"Tapi kalau lo tunggu 6 bulan, kompetitor lo sudah 6 bulan ahead.\"", score: 15, feedback: "⚠️ Urgency yang valid, tapi terlalu pushy tanpa understand their situation dulu." },
      { text: "\"Oke fair enough, kalau ada yang bisa gw bantu kabarin ya.\"", score: 0, feedback: "❌ Completely passive. No next step, no value left." },
    ],
    bestScript: "\"Respect itu — dan gw ga mau push lo ke sesuatu yang premature. Tapi boleh gw challenge sedikit dengan respect? Stage yang lo mention itu — apa specifically yang harus lo capai sebelum ini make sense? Karena dari yang gw lihat di [industri mereka], biasanya yang paling cepat reach that stage adalah yang sudah setup sistemnya dari awal. Gw bisa tunjukin bagaimana kami bisa jadi accelerator untuk reach stage itu 2x lebih cepat.\"",
    archetype: "🐬🦉",
  },
  {
    id: "sim5",
    title: "Klien Minta Waktu Berpikir",
    context: "Proposal udah di-send seminggu lalu. Follow up call. Klien bilang...",
    objection: "\"Kami masih evaluasi. Perlu waktu lagi untuk think it over.\"",
    options: [
      { text: "\"Oke, take your time. Gw tunggu ya.\"", score: 0, feedback: "❌ Paling buruk. Lo akan di-ghosting setelah ini." },
      { text: "\"Gw ngerti. Boleh gw tanya — apa yang masih bikin ragu atau ada info yang kurang dari proposal kita?\"", score: 25, feedback: "✅ Diagnostic question. Uncover the real objection yang belum terucap." },
      { text: "\"Gw bisa kasih deadline khusus — kalau deal bulan ini, ada bonus tambahan.\"", score: 10, feedback: "⚠️ Kadang works, tapi artificial urgency bisa backfire dan devalue brand lo." },
      { text: "\"Evaluasinya kira-kira berapa lama lagi? Gw bisa follow up kapan?\"", score: 15, feedback: "⚠️ Boleh, tapi terlalu passive. Tidak menggali root cause objection." },
    ],
    bestScript: "\"Gw totally respect itu — keputusan ini penting dan worth dipikirkan matang. Tapi gw ingin pastiin lo punya semua yang lo butuhkan. Boleh gw tanya langsung: dari proposal yang gw kirim, bagian mana yang masih ada pertanyaan atau concern? Gw lebih suka address itu sekarang daripada lo evaluate dengan incomplete info.\"",
    archetype: "🦉🐰",
  },
];

const ARCHETYPE_QUESTIONS: ArchetypeQ[] = [
  {
    q: "Ketika lo pertama kali ketemu vendor baru, hal pertama yang lo tanya adalah...",
    opts: [
      { text: "Berapa biaya totalnya dan apa ROI-nya?", type: "🦉" },
      { text: "Siapa yang udah pakai ini dan hasilnya gimana?", type: "🐰" },
      { text: "Seberapa cepat ini bisa gw implementasikan?", type: "🐯" },
      { text: "Gimana support-nya dan tim lo seperti apa?", type: "🐬" },
    ],
  },
  {
    q: "Ketika ada risiko dalam keputusan bisnis, lo cenderung...",
    opts: [
      { text: "Analisis semua data dulu, bikin spreadsheet perbandingan", type: "🦉" },
      { text: "Tanya rekomendasi dari network / orang yang lo percaya", type: "🐰" },
      { text: "Ambil keputusan cepat dan adjust kalau ada yang salah", type: "🐯" },
      { text: "Diskusi sama tim dulu untuk dapat buy-in semua pihak", type: "🐬" },
    ],
  },
  {
    q: "Dalam meeting dengan vendor, lo paling suka...",
    opts: [
      { text: "Lihat data, case study, dan proof of concept konkret", type: "🦉" },
      { text: "Ada testimonial dan referensi yang bisa gw hubungi", type: "🐰" },
      { text: "Demo langsung yang cepat dan straight to the point", type: "🐯" },
      { text: "Ngobrol santai dulu, build relationship sebelum bisnis", type: "🐬" },
    ],
  },
  {
    q: "Ketika lo close sebuah deal besar, yang paling lo prioritasin adalah...",
    opts: [
      { text: "Semua terms dan kontrak sudah perfectly negotiated", type: "🦉" },
      { text: "Lo yakin ini pilihan aman dan tidak akan nyesel", type: "🐰" },
      { text: "Deal closed sebelum deadline dan lo yang menang", type: "🐯" },
      { text: "Relationship dengan vendor baik untuk jangka panjang", type: "🐬" },
    ],
  },
];

const ARCHETYPE_INFO: Record<string, { name: string; emoji: string; tagline: string; traits: string[]; approach: string; avoid: string; scripts: string[] }> = {
  "🦉": {
    name: "Burung Hantu",
    emoji: "🦉",
    tagline: "The Analyst — Data-driven, logic-first, skeptical but fair",
    traits: ["Butuh data & proof konkret", "Analitis & systematic", "Slow to decide tapi loyal kalau yakin", "Suka ROI calculations & case studies"],
    approach: "Siapkan data, angka, dan case studies. Berikan waktu untuk analisis. Jangan rush. Offer trial period dengan clear KPIs.",
    avoid: "Jangan hype tanpa bukti. Jangan pressure dengan urgency palsu. Jangan oversimplify.",
    scripts: ["s2", "s5", "s7", "s14", "s15"],
  },
  "🐯": {
    name: "Singa",
    emoji: "🐯",
    tagline: "The Dominant — Results-first, competitive, wants to win fast",
    traits: ["Action-oriented, tidak suka buang waktu", "Kompetitif, mau jadi yang pertama/terbaik", "ROI dan competitive advantage = key", "Respond ke exclusive / limited offers"],
    approach: "Be direct dan confident. Tunjukkan competitive advantage. Beri sense of exclusivity. Close decisively.",
    avoid: "Jangan bertele-tele. Jangan terlalu banyak detail teknis. Jangan lemah atau ragu-ragu.",
    scripts: ["s4", "s6", "s11", "s13", "s15"],
  },
  "🐬": {
    name: "Lumba-Lumba",
    emoji: "🐬",
    tagline: "The Relationship Builder — Trust-first, collaborative, community-driven",
    traits: ["Relationship dan trust sangat penting", "Suka referral dan rekomendasi dari orang dekat", "Collaborative decision-making", "Long-term partnership minded"],
    approach: "Build genuine rapport dulu. Share cerita dan testimonial. Involve them in the process. Be authentic, tidak pushy.",
    avoid: "Jangan transaksional. Jangan skip small talk. Jangan close terlalu cepat sebelum trust terbangun.",
    scripts: ["s3", "s8", "s9", "s12"],
  },
  "🐰": {
    name: "Kelinci",
    emoji: "🐰",
    tagline: "The Cautious — Risk-averse, needs reassurance, social-proof driven",
    traits: ["Takut salah keputusan", "Butuh banyak social proof & testimonials", "Risk mitigation sangat penting", "Prefer bertahap daripada big commitment"],
    approach: "Berikan banyak social proof. Offer low-risk entry (trial, pilot). Reassure mereka di setiap step. Be patient.",
    avoid: "Jangan pressure atau push. Jangan highlight risk tanpa solusinya. Jangan minta big commitment di awal.",
    scripts: ["s1", "s9", "s10", "s12"],
  },
};

const TAG_COLORS: Record<string, string> = {
  harga: "#1b6cf2",
  kompetitor: "#8b5cf6",
  budget: "#f59e0b",
  authority: "#10b981",
  timing: "#ef4444",
  value: "#06b6d4",
  assertif: "#f97316",
  empatik: "#ec4899",
  logis: "#3b82f6",
  urgensi: "#ef4444",
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

function Tag({ label, type }: { label: string; type: string }) {
  return (
    <span style={{
      background: (TAG_COLORS[type] || "#1e2028") + "22",
      color: TAG_COLORS[type] || "#a0aec0",
      border: `1px solid ${TAG_COLORS[type] || "#1e2028"}44`,
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      textTransform: "uppercase",
    }}>
      {label}
    </span>
  );
}

export default function SalesPalApp({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("home");
  const [scriptFilter, setScriptFilter] = useState({ kategori: "all", emosi: "all", urgency: "all" });
  const [scriptSearch, setScriptSearch] = useState("");
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [simIdx, setSimIdx] = useState(0);
  const [simSelected, setSimSelected] = useState<number | null>(null);
  const [simDone, setSimDone] = useState(false);
  const [simScore, setSimScore] = useState(0);
  const [simAnswers, setSimAnswers] = useState<number[]>([]);
  const [archetypeAnswers, setArchetypeAnswers] = useState<string[]>([]);
  const [archetypeResult, setArchetypeResult] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function loadFavorites() {
      if (!db) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setFavorites(snap.data().favorites || []);
    }
    loadFavorites();
  }, [user.uid]);

  async function toggleFavorite(id: string) {
    if (!db) return;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { favorites: [id] });
      setFavorites([id]);
      return;
    }
    const isFav = favorites.includes(id);
    await updateDoc(ref, { favorites: isFav ? arrayRemove(id) : arrayUnion(id) });
    setFavorites(isFav ? favorites.filter(f => f !== id) : [...favorites, id]);
  }

  const filteredScripts = SCRIPTS.filter(s => {
    if (scriptFilter.kategori !== "all" && s.kategori !== scriptFilter.kategori) return false;
    if (scriptFilter.emosi !== "all" && s.emosi !== scriptFilter.emosi) return false;
    if (scriptFilter.urgency !== "all" && s.urgency !== scriptFilter.urgency) return false;
    if (scriptSearch && !s.title.toLowerCase().includes(scriptSearch.toLowerCase()) && !s.objection.toLowerCase().includes(scriptSearch.toLowerCase())) return false;
    return true;
  });

  function handleSimAnswer(optIdx: number) {
    if (simSelected !== null) return;
    setSimSelected(optIdx);
  }

  function nextSimQuestion() {
    const newAnswers = [...simAnswers, simSelected!];
    setSimAnswers(newAnswers);
    if (simIdx + 1 >= SCENARIOS.length) {
      const total = newAnswers.reduce((acc, i) => acc + SCENARIOS[simIdx - (SCENARIOS.length - 1 - simIdx)].options[i].score, 0);
      const realTotal = SCENARIOS.reduce((acc, sc, i) => acc + (sc.options[newAnswers[i]]?.score ?? 0), 0);
      setSimScore(realTotal);
      setSimDone(true);
    } else {
      setSimIdx(simIdx + 1);
      setSimSelected(null);
    }
  }

  function resetSim() {
    setSimIdx(0); setSimSelected(null); setSimDone(false);
    setSimScore(0); setSimAnswers([]);
  }

  function handleArchetypeAnswer(type: string) {
    const next = [...archetypeAnswers, type];
    setArchetypeAnswers(next);
    if (next.length >= ARCHETYPE_QUESTIONS.length) {
      const counts: Record<string, number> = {};
      next.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
      const result = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      setArchetypeResult(result);
    }
  }

  const navItems: { id: Tab; label: string; emoji: string }[] = [
    { id: "home", label: "Home", emoji: "🏠" },
    { id: "scripts", label: "Script Library", emoji: "📚" },
    { id: "simulator", label: "Simulator", emoji: "🎯" },
    { id: "archetype", label: "Archetype Finder", emoji: "🧠" },
    { id: "crm", label: "CRM Tracker", emoji: "📊" },
  ];

  const styles = {
    wrap: { display: "flex", minHeight: "100vh", background: "#04040a", color: "#e8edf4" } as React.CSSProperties,
    sidebar: {
      width: 220, background: "#08090f", borderRight: "1px solid #14151c",
      display: "flex", flexDirection: "column" as const, flexShrink: 0,
      position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 50,
      transform: sidebarOpen ? "translateX(0)" : "translateX(-220px)",
      transition: "transform 0.25s ease",
    },
    main: { flex: 1, overflowY: "auto" as const, marginLeft: 0 },
    topbar: {
      position: "sticky" as const, top: 0, zIndex: 40,
      background: "rgba(4,4,10,0.9)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid #14151c",
      padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
    },
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#04040a", color: "#e8edf4" }}>
      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 45 }}
        />
      )}

      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #14151c" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo.png" alt="SalesPal" width={32} height={32} style={{ borderRadius: 8, objectFit: "contain", background: "#0c1a3a" }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>
              SALES<em style={{ color: "#1b6cf2", fontStyle: "normal" }}>PAL</em>
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSidebarOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, border: "none",
                background: tab === item.id ? "rgba(27,108,242,0.15)" : "transparent",
                color: tab === item.id ? "#1b6cf2" : "#7d8590",
                cursor: "pointer", fontSize: 14, fontWeight: tab === item.id ? 600 : 400,
                textAlign: "left", width: "100%",
                borderLeft: tab === item.id ? "2px solid #1b6cf2" : "2px solid transparent",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px 8px", borderTop: "1px solid #14151c" }}>
          <div style={{ padding: "8px 12px", fontSize: 12, color: "#5a6270", marginBottom: 8 }}>
            {user.displayName || user.email?.split("@")[0]}
          </div>
          <button
            onClick={() => signOut(auth)}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 500,
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", minHeight: "100vh" }}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", color: "#7d8590", cursor: "pointer", fontSize: 20, padding: "2px 6px", borderRadius: 6 }}
          >
            ☰
          </button>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15 }}>
            {navItems.find(n => n.id === tab)?.emoji} {navItems.find(n => n.id === tab)?.label}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#5a6270", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00d26a" }} />
              {user.email}
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 20px", maxWidth: 960, margin: "0 auto" }}>
          {/* HOME */}
          {tab === "home" && <HomeTab user={user} favorites={favorites} setTab={setTab} />}

          {/* SCRIPT LIBRARY */}
          {tab === "scripts" && (
            <ScriptLibraryTab
              scripts={filteredScripts}
              allScripts={SCRIPTS}
              filter={scriptFilter}
              setFilter={setScriptFilter}
              search={scriptSearch}
              setSearch={setScriptSearch}
              expanded={expandedScript}
              setExpanded={setExpandedScript}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
            />
          )}

          {/* SIMULATOR */}
          {tab === "simulator" && (
            <SimulatorTab
              scenarios={SCENARIOS}
              idx={simIdx}
              selected={simSelected}
              done={simDone}
              score={simScore}
              answers={simAnswers}
              onAnswer={handleSimAnswer}
              onNext={nextSimQuestion}
              onReset={resetSim}
            />
          )}

          {/* ARCHETYPE */}
          {tab === "archetype" && (
            <ArchetypeTab
              questions={ARCHETYPE_QUESTIONS}
              answers={archetypeAnswers}
              result={archetypeResult}
              info={ARCHETYPE_INFO}
              onAnswer={handleArchetypeAnswer}
              onReset={() => { setArchetypeAnswers([]); setArchetypeResult(null); }}
              allScripts={SCRIPTS}
              setTab={setTab}
            />
          )}

          {/* CRM */}
          {tab === "crm" && <SalesTracker user={user} />}
        </div>
      </main>
    </div>
  );
}

/* ─── HOME TAB ─── */
function HomeTab({ user, favorites, setTab }: { user: User; favorites: string[]; setTab: (t: Tab) => void }) {
  const name = user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "Sales";
  const cards = [
    { emoji: "📚", title: "Script Library", desc: "15 battle-tested scripts untuk setiap objection. Filter by kategori, emosi & urgency.", tab: "scripts" as Tab, color: "#1b6cf2" },
    { emoji: "🎯", title: "Simulator", desc: "Practice 5 skenario closing real. Lihat score lo dan script terbaik untuk setiap situasi.", tab: "simulator" as Tab, color: "#8b5cf6" },
    { emoji: "🧠", title: "Archetype Finder", desc: "Identify tipe klien lo: 🦉🐯🐬🐰. Dapatkan pendekatan yang paling efektif.", tab: "archetype" as Tab, color: "#10b981" },
    { emoji: "📊", title: "CRM Tracker", desc: "Track leads, outreach, dan rejection log. Pipeline visual real-time.", tab: "crm" as Tab, color: "#f59e0b" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: -1, marginBottom: 6 }}>
          Hai, {name}! 👋
        </h1>
        <p style={{ color: "#7d8590", fontSize: 15 }}>Selamat datang di SALESPAL — sales training platform lo.</p>
      </div>

      {favorites.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5a6270", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            ⭐ Favorite Scripts ({favorites.length})
          </div>
          <div style={{ fontSize: 13, color: "#7d8590" }}>
            {favorites.length} script tersimpan.{" "}
            <button onClick={() => setTab("scripts")} style={{ color: "#1b6cf2", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
              Lihat →
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {cards.map(c => (
          <button
            key={c.tab}
            onClick={() => setTab(c.tab)}
            style={{
              background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 16,
              padding: "20px", textAlign: "left", cursor: "pointer",
              transition: "border-color 0.2s, transform 0.15s",
              display: "flex", flexDirection: "column", gap: 10,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = c.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2028"; (e.currentTarget as HTMLElement).style.transform = ""; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              {c.emoji}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e8edf4" }}>{c.title}</div>
            <div style={{ fontSize: 13, color: "#5a6270", lineHeight: 1.5 }}>{c.desc}</div>
            <div style={{ fontSize: 12, color: c.color, fontWeight: 600, marginTop: 4 }}>Buka →</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 32, background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#5a6270", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
          📌 Tips Hari Ini
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { n: "7×", label: "Rata-rata touchpoint sebelum deal closed" },
            { n: "5–15%", label: "Target cold email reply rate" },
            { n: "+30%", label: "Win rate naik dengan AI-personalized proposal" },
            { n: "40%+", label: "Meeting rate dari setiap reply yang lo dapat" },
          ].map(s => (
            <div key={s.n} style={{ background: "#0d0e16", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900, color: "#1b6cf2", marginBottom: 4 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: "#5a6270" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SCRIPT LIBRARY TAB ─── */
function ScriptLibraryTab({
  scripts, allScripts, filter, setFilter, search, setSearch,
  expanded, setExpanded, favorites, toggleFavorite,
}: {
  scripts: Script[]; allScripts: Script[];
  filter: { kategori: string; emosi: string; urgency: string };
  setFilter: (f: { kategori: string; emosi: string; urgency: string }) => void;
  search: string; setSearch: (s: string) => void;
  expanded: string | null; setExpanded: (id: string | null) => void;
  favorites: string[]; toggleFavorite: (id: string) => void;
}) {
  const kategoriOpts = ["all", "harga", "kompetitor", "budget", "authority", "timing", "value"];
  const emosiOpts = ["all", "assertif", "empatik", "logis", "urgensi"];
  const urgencyOpts = ["all", "low", "medium", "high"];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 4 }}>📚 Script Library</h2>
        <p style={{ color: "#7d8590", fontSize: 14 }}>{allScripts.length} scripts · filter by kategori, emosi & urgency</p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="🔍  Cari script atau objection..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", marginBottom: 16, padding: "12px 16px",
          background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 10,
          color: "#e8edf4", fontSize: 14, outline: "none", boxSizing: "border-box",
        }}
      />

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {["kategori", "emosi", "urgency"].map(key => {
          const opts = key === "kategori" ? kategoriOpts : key === "emosi" ? emosiOpts : urgencyOpts;
          return (
            <select
              key={key}
              value={(filter as Record<string, string>)[key]}
              onChange={e => setFilter({ ...filter, [key]: e.target.value })}
              style={{
                background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 8,
                color: "#e8edf4", fontSize: 13, padding: "8px 12px", cursor: "pointer", outline: "none",
              }}
            >
              {opts.map(o => <option key={o} value={o}>{key}: {o}</option>)}
            </select>
          );
        })}
        <button
          onClick={() => { setFilter({ kategori: "all", emosi: "all", urgency: "all" }); setSearch(""); }}
          style={{ background: "none", border: "1px solid #1e2028", borderRadius: 8, color: "#5a6270", padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
        >
          Reset
        </button>
      </div>

      {/* Script cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {scripts.length === 0 && (
          <div style={{ textAlign: "center", color: "#5a6270", padding: 40 }}>Tidak ada script yang match filter ini.</div>
        )}
        {scripts.map(s => (
          <div
            key={s.id}
            style={{
              background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 14,
              overflow: "hidden", transition: "border-color 0.2s",
            }}
          >
            {/* Header */}
            <div
              style={{ padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#7d8590", fontStyle: "italic", marginBottom: 10 }}>"{s.objection}"</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Tag label={s.kategori} type={s.kategori} />
                  <Tag label={s.emosi} type={s.emosi} />
                  <Tag label={`${s.urgency} urgency`} type={s.urgency} />
                  {s.archetypes.map(a => (
                    <span key={a} style={{ fontSize: 16 }}>{a}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <button
                  onClick={e => { e.stopPropagation(); toggleFavorite(s.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: favorites.includes(s.id) ? "#f59e0b" : "#3a4050" }}
                  title={favorites.includes(s.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  {favorites.includes(s.id) ? "⭐" : "☆"}
                </button>
                <span style={{ color: "#5a6270", fontSize: 18 }}>{expanded === s.id ? "▴" : "▾"}</span>
              </div>
            </div>

            {/* Expanded */}
            {expanded === s.id && (
              <div style={{ borderTop: "1px solid #1e2028", padding: "16px 18px" }}>
                <div style={{ fontSize: 12, color: "#5a6270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Script</div>
                <div style={{
                  background: "#07080f", border: "1px solid #1e2028", borderRadius: 10,
                  padding: "14px 16px", fontSize: 14, color: "#c5d0e0", lineHeight: 1.7,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  "{s.script}"
                </div>
                <div style={{ fontSize: 12, color: "#5a6270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginTop: 14, marginBottom: 6 }}>
                  💡 Notes
                </div>
                <div style={{ fontSize: 13, color: "#7d8590", lineHeight: 1.6 }}>{s.notes}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SIMULATOR TAB ─── */
function SimulatorTab({
  scenarios, idx, selected, done, score, answers,
  onAnswer, onNext, onReset,
}: {
  scenarios: SimScenario[]; idx: number; selected: number | null;
  done: boolean; score: number; answers: number[];
  onAnswer: (i: number) => void; onNext: () => void; onReset: () => void;
}) {
  const maxScore = scenarios.length * 25;
  const pct = Math.round((score / maxScore) * 100);

  if (done) {
    const grade = pct >= 80 ? { label: "Expert Closer 🏆", color: "#00d26a" } :
      pct >= 60 ? { label: "Sales Pro 💪", color: "#1b6cf2" } :
        pct >= 40 ? { label: "Developing 📈", color: "#f59e0b" } :
          { label: "Keep Practicing 🔄", color: "#ef4444" };

    return (
      <div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 24 }}>🎯 Hasil Simulator</h2>
        <div style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 20, padding: 32, textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, fontFamily: "'Syne', sans-serif", fontWeight: 900, color: grade.color, marginBottom: 8 }}>
            {score}/{maxScore}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{grade.label}</div>
          <div style={{ fontSize: 14, color: "#7d8590" }}>{pct}% score — {scenarios.length} skenario</div>
          <div style={{ margin: "16px auto", maxWidth: 300, height: 6, background: "#14151c", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: grade.color, borderRadius: 99, transition: "width 1s ease" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {scenarios.map((sc, i) => {
            const ans = answers[i];
            const opt = sc.options[ans];
            return (
              <div key={sc.id} style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 14, padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>Skenario {i + 1}: {sc.title}</div>
                <div style={{ fontSize: 13, color: "#7d8590", marginBottom: 8 }}>Jawaban lo: "{opt?.text}"</div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>{opt?.feedback}</div>
                <div style={{ fontSize: 12, color: "#5a6270", marginBottom: 4 }}>✅ Best script:</div>
                <div style={{ fontSize: 12, color: "#c5d0e0", background: "#07080f", borderRadius: 8, padding: "10px 12px", fontStyle: "italic" }}>
                  {sc.bestScript}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onReset}
          style={{
            width: "100%", padding: 14, background: "#1b6cf2", border: "none", borderRadius: 12,
            color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}
        >
          🔄 Ulangi Simulator
        </button>
      </div>
    );
  }

  const sc = scenarios[idx];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900 }}>🎯 Simulator Closing</h2>
        <div style={{ fontSize: 13, color: "#5a6270" }}>
          {idx + 1} / {scenarios.length}
        </div>
      </div>

      <div style={{ height: 4, background: "#14151c", borderRadius: 99, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${((idx) / scenarios.length) * 100}%`, background: "#1b6cf2", borderRadius: 99, transition: "width 0.3s" }} />
      </div>

      <div style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#5a6270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Skenario</div>
        <div style={{ fontSize: 14, color: "#a0aec0", lineHeight: 1.6, marginBottom: 16 }}>{sc.context}</div>
        <div style={{ background: "#07080f", border: "1px solid #1e2028", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, color: "#5a6270", marginBottom: 6 }}>Klien bilang:</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e8edf4", fontStyle: "italic" }}>{sc.objection}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {sc.options.map((opt, i) => {
          const isSelected = selected === i;
          const showFeedback = selected !== null;
          const isCorrect = opt.score === 25;
          let border = "1px solid #1e2028";
          let bg = "#0c0d13";
          if (showFeedback && isSelected) {
            border = `1px solid ${opt.score >= 20 ? "#00d26a" : opt.score >= 10 ? "#f59e0b" : "#ef4444"}`;
            bg = `${opt.score >= 20 ? "#00d26a" : opt.score >= 10 ? "#f59e0b" : "#ef4444"}11`;
          }
          if (showFeedback && isCorrect && !isSelected) {
            border = "1px solid #00d26a44";
          }

          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              disabled={selected !== null}
              style={{
                background: bg, border, borderRadius: 12, padding: "14px 16px",
                color: "#e8edf4", cursor: selected !== null ? "default" : "pointer",
                textAlign: "left", fontSize: 14, lineHeight: 1.5, transition: "all 0.2s",
              }}
            >
              <div style={{ fontWeight: isSelected ? 600 : 400, marginBottom: showFeedback && isSelected ? 8 : 0 }}>
                {String.fromCharCode(65 + i)}. {opt.text}
              </div>
              {showFeedback && isSelected && (
                <div style={{ fontSize: 12, color: "#a0aec0" }}>{opt.feedback}</div>
              )}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          onClick={onNext}
          style={{
            width: "100%", padding: 14, background: "#1b6cf2", border: "none", borderRadius: 12,
            color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}
        >
          {idx + 1 >= scenarios.length ? "Lihat Hasil →" : "Skenario Berikutnya →"}
        </button>
      )}
    </div>
  );
}

/* ─── ARCHETYPE TAB ─── */
function ArchetypeTab({
  questions, answers, result, info, onAnswer, onReset, allScripts, setTab,
}: {
  questions: ArchetypeQ[]; answers: string[]; result: string | null;
  info: typeof ARCHETYPE_INFO; onAnswer: (t: string) => void; onReset: () => void;
  allScripts: Script[]; setTab: (t: Tab) => void;
}) {
  if (result) {
    const r = info[result];
    const matchScripts = allScripts.filter(s => s.archetypes.includes(result)).slice(0, 4);

    return (
      <div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 24 }}>🧠 Archetype Finder</h2>

        <div style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 20, padding: 28, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>{r.emoji}</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 900, marginBottom: 6 }}>{r.name}</div>
          <div style={{ fontSize: 14, color: "#7d8590", fontStyle: "italic" }}>{r.tagline}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 12, color: "#5a6270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🔑 Traits</div>
            {r.traits.map(t => (
              <div key={t} style={{ fontSize: 13, color: "#a0aec0", marginBottom: 6, display: "flex", gap: 8 }}>
                <span style={{ color: "#1b6cf2" }}>→</span> {t}
              </div>
            ))}
          </div>
          <div style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 12, color: "#5a6270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>✅ Pendekatan</div>
            <div style={{ fontSize: 13, color: "#a0aec0", lineHeight: 1.7 }}>{r.approach}</div>
          </div>
        </div>

        <div style={{ background: "#0c0d13", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>❌ Hindari</div>
          <div style={{ fontSize: 13, color: "#a0aec0", lineHeight: 1.7 }}>{r.avoid}</div>
        </div>

        {matchScripts.length > 0 && (
          <div style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#5a6270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📚 Scripts untuk {r.name}</div>
            {matchScripts.map(s => (
              <div key={s.id} style={{ fontSize: 13, color: "#a0aec0", marginBottom: 8, display: "flex", gap: 8 }}>
                <span style={{ color: "#1b6cf2" }}>→</span> {s.title}
              </div>
            ))}
            <button
              onClick={() => setTab("scripts")}
              style={{ marginTop: 8, color: "#1b6cf2", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              Lihat semua scripts →
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onReset}
            style={{
              flex: 1, padding: 14, background: "transparent", border: "1px solid #1e2028",
              borderRadius: 12, color: "#e8edf4", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            🔄 Coba Lagi
          </button>
          <button
            onClick={() => setTab("scripts")}
            style={{
              flex: 1, padding: 14, background: "#1b6cf2", border: "none",
              borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            📚 Lihat Scripts →
          </button>
        </div>
      </div>
    );
  }

  const qIdx = answers.length;
  if (qIdx >= questions.length) return null;
  const q = questions[qIdx];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900 }}>🧠 Archetype Finder</h2>
        <div style={{ fontSize: 13, color: "#5a6270" }}>{qIdx + 1} / {questions.length}</div>
      </div>

      <div style={{ height: 4, background: "#14151c", borderRadius: 99, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(qIdx / questions.length) * 100}%`, background: "#10b981", borderRadius: 99, transition: "width 0.3s" }} />
      </div>

      <div style={{ background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#5a6270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Pertanyaan {qIdx + 1}</div>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>{q.q}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.opts.map((opt, i) => (
          <button
            key={i}
            onClick={() => onAnswer(opt.type)}
            style={{
              background: "#0c0d13", border: "1px solid #1e2028", borderRadius: 12,
              padding: "14px 18px", color: "#e8edf4", cursor: "pointer", textAlign: "left",
              fontSize: 14, lineHeight: 1.5, transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#10b981"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2028"; }}
          >
            {String.fromCharCode(65 + i)}. {opt.text}
          </button>
        ))}
      </div>

      {qIdx > 0 && (
        <button
          onClick={onReset}
          style={{ marginTop: 16, color: "#5a6270", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
        >
          ← Mulai ulang
        </button>
      )}
    </div>
  );
}
