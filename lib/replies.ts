// Balas cepat: what to send back once a hunted DM gets an answer (or none).
// Objection replies come from the Script Library (lib/salespal-data.ts), one
// per customer type, so the owner picks the one that fits the person.

import { archetypes, objections, scriptMatrix } from "@/lib/salespal-data";
import type { HuntStatus } from "@/lib/hunting";

export type Tone = "santai" | "formal";
export const NEXT_STEP = "next";

export interface Reply {
  key: string;
  text: string;
  hint: string;   // who it suits, or why it works
}

// A positive answer: move towards a shoot, one step at a time.
const NEXT_STEPS: Record<Tone, Reply[]> = {
  santai: [
    { key: "n1", text: "Makasih udah bales, {nama}! Biar pas, lagi butuh foto buat menu baru, sosmed, atau GoFood/GrabFood? Kira-kira berapa item?", hint: "Tanya kebutuhan dulu, jangan langsung harga." },
    { key: "n2", text: "Aku kirim contoh hasil + daftar paketnya ya, {nama}. Tinggal pilih yang paling cocok, nanti aku sesuaikan.", hint: "Kasih bukti + pilihan, biar gampang bilang iya." },
    { key: "n3", text: "Minggu ini aku masih ada slot. Mau aku bookin jadwal fotonya? Tinggal kabarin hari yang enak.", hint: "Ajak ke langkah konkret: jadwal." },
  ],
  formal: [
    { key: "n1", text: "Terima kasih atas balasannya, {nama}. Boleh saya tahu kebutuhan fotonya untuk apa, dan kira-kira berapa item menu?", hint: "Pahami kebutuhan sebelum menawarkan paket." },
    { key: "n2", text: "Saya kirimkan contoh hasil dan daftar paket kami. Silakan dipilih, nanti saya sesuaikan dengan kebutuhan Anda.", hint: "Bukti karya + pilihan paket." },
    { key: "n3", text: "Minggu ini kami masih memiliki jadwal kosong. Apakah berkenan saya jadwalkan sesi fotonya?", hint: "Tutup dengan ajakan jadwal." },
  ],
};

// Words the owner tends to type as the reason for a no, per objection.
const CUES: [string, RegExp][] = [
  ["price", /mahal|harga|budget|bujet|murah|diskon|kemahalan/i],
  ["already_own", /punya|udah ada|sudah ada|langganan|fotografer sendiri|foto sendiri|in-?house/i],
  ["timing", /nanti|belum sekarang|bulan depan|next|kapan-?kapan|tunggu/i],
  ["busy", /sibuk|repot|gak sempat|ga sempat|tidak sempat/i],
  ["not_confident", /pikir|ragu|belum yakin|diskusi|tanya (dulu|partner|owner)|mikir/i],
];

export function detectObjection(note: string): string | null {
  for (const [id, re] of CUES) if (re.test(note || "")) return id;
  return null;
}

// Where to start for a DM in this state.
export function defaultTopic(status: HuntStatus, note: string): string {
  if (status === "Ghosting") return "ghosting";
  if (status === "Ditolak") return detectObjection(note) || "not_confident";
  return NEXT_STEP;
}

export const TOPICS: { id: string; label: string }[] = [
  { id: NEXT_STEP, label: "👍 Lanjut ngobrol" },
  ...objections.map(o => ({ id: o.id, label: `${o.icon} ${o.label}` })),
];

export function repliesFor(topic: string, tone: Tone): Reply[] {
  if (topic === NEXT_STEP) return NEXT_STEPS[tone];
  const out: Reply[] = [];
  for (const a of archetypes) {
    const s = scriptMatrix[a.id]?.[topic]?.find(x => x.tone === tone);
    if (s) out.push({ key: `${a.id}_${topic}_${tone}`, text: s.script, hint: `${a.animal} ${a.name}: ${s.tips}` });
  }
  return out;
}
