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

// No answer even after the one follow-up (that is when a DM gets 👻). The
// Script Library's ghosting scripts assume a conversation already happened
// ("did the PDF arrive?"); a cold DM needs a new angle, or a polite last word.
const GHOSTED: Record<Tone, Reply[]> = {
  santai: [
    { key: "g1", text: "Halo {nama}! Biar kebayang, ini contoh foto menu yang aku kerjain 👇 Kalau cocok, aku bisa bikinin yang serupa.", hint: "Lampirkan 1 foto terbaik. Ganti sudut, jangan tanya ulang." },
    { key: "g2", text: "{nama}, boleh tanya satu hal aja? Sekarang foto menunya dikerjain sendiri atau udah ada yang bantu?", hint: "Pertanyaan yang gampang dijawab, tanpa jualan." },
    { key: "g3", text: "Terakhir dari aku ya, {nama}. Kalau suatu saat butuh foto menu, tinggal chat aja. Sukses terus!", hint: "Pesan penutup sering justru dibales. Setelah ini berhenti." },
  ],
  formal: [
    { key: "g1", text: "Halo {nama}, sebagai gambaran, berikut contoh foto menu yang kami kerjakan. Jika berkenan, kami dapat membuat yang serupa untuk menu Anda.", hint: "Lampirkan satu foto terbaik." },
    { key: "g2", text: "Halo {nama}, boleh saya bertanya satu hal? Saat ini foto menu dikerjakan sendiri atau sudah ada fotografer?", hint: "Pertanyaan ringan yang mudah dijawab." },
    { key: "g3", text: "Ini pesan terakhir dari saya, {nama}. Jika suatu saat membutuhkan foto menu, silakan hubungi saya kapan saja. Terima kasih.", hint: "Penutup sopan. Setelah ini berhenti." },
  ],
};

// The Script Library says "Bapak/Ibu"; a DM to a business account says "Kak".
function address(script: string): string {
  return script.replace(/\b(Bapak\/Ibu|Bu\/Pak)\b(?=,)/g, "Kak").replace(/\b(Bapak\/Ibu|Bu\/Pak)\b/g, "Kakak");
}

// A script with a blank to fill ("[tanggal]") is not ready to send.
const hasBlank = (script: string) => /\[[^\]]+\]/.test(script);

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

// Replies picked per customer type from the Script Library, rather than written here.
export function fromLibrary(topic: string): boolean {
  return topic !== NEXT_STEP && topic !== "ghosting";
}

export function repliesFor(topic: string, tone: Tone): Reply[] {
  if (topic === NEXT_STEP) return NEXT_STEPS[tone];
  if (topic === "ghosting") return GHOSTED[tone];
  const out: Reply[] = [];
  for (const a of archetypes) {
    const s = scriptMatrix[a.id]?.[topic]?.find(x => x.tone === tone);
    if (s && !hasBlank(s.script)) out.push({ key: `${a.id}_${topic}_${tone}`, text: address(s.script), hint: `${a.animal} ${a.name}: ${s.tips}` });
  }
  return out;
}
