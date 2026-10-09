// Skor potensi (docs/prd/PRD-008 §2): how worth chasing a lead is right now,
// 0–100 from five signals, each with its reason. Computed, never stored, so it
// is always as fresh as the lead.

export interface ScoreInput {
  status?: string;
  value?: number;
  phone?: string;
  lastContact?: string;      // YYYY-MM-DD
  lastReplyAt?: string;      // YYYY-MM-DD, when they last answered
  nextActionDate?: string;   // YYYY-MM-DD
}

export interface Signal { key: string; label: string; pts: number; max: number; detail: string; tip: string }
// Five levels, shown as five heat dots (canvas): 1 = sangat rendah … 5 = sangat tinggi.
export type Level = 1 | 2 | 3 | 4 | 5;
export interface Score { total: number; level: Level; word: string; signals: Signal[]; tip: string }

// Where "nilai besar" starts (PRD-008 §1, the map's horizontal line).
export const VALUE_LINE = 10_000_000;
export const SCORE_LINE = 60;

const day = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
const ago = (iso: string | undefined, on: string) => (iso ? Math.round((day(on) - day(iso)) / 86400000) : null);
const agoText = (d: number) => (d <= 0 ? "hari ini" : d === 1 ? "kemarin" : `${d} hari lalu`);
const jt = (n: number) => `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;

export const levelOf = (total: number): Level => (total >= 85 ? 5 : total >= 70 ? 4 : total >= 50 ? 3 : total >= 30 ? 2 : 1);
export const LEVEL_WORD: Record<Level, string> = { 5: "Sangat tinggi", 4: "Tinggi", 3: "Sedang", 2: "Rendah", 1: "Sangat rendah" };
// "Potensi tinggi" on Beranda = level 4 and up (skor 70+).
export const isHigh = (total: number) => total >= 70;
export const HEAT = ["#22a06b", "#8cc63f", "#f5b72f", "#f2792b", "#e5402f"];

export function scoreLead(l: ScoreInput, on: string, valueLine = VALUE_LINE): Score {
  const reply = ago(l.lastReplyAt, on);
  const contact = ago(l.lastContact, on);
  const next = ago(l.nextActionDate, on);   // negative = still ahead
  const value = Number(l.value) || 0;

  const respons: Signal = {
    key: "respons", label: "Respons", max: 30,
    pts: reply === null ? 0 : reply <= 0 ? 30 : reply <= 2 ? 24 : reply <= 6 ? 16 : reply <= 13 ? 8 : 0,
    detail: reply === null ? "Belum pernah bales" : `Bales ${agoText(reply)}`,
    tip: "tandai \"Mereka bales\" begitu ada jawaban",
  };
  const langkah: Signal = {
    key: "langkah", label: "Langkah berikutnya", max: 20,
    pts: next === null ? 0 : next > 0 ? 10 : 20,   // overdue still counts, less
    detail: next === null ? "Belum dijadwalkan" : next > 0 ? `Lewat ${next} hari` : next === 0 ? "Hari ini" : `Dijadwal ${l.nextActionDate}`,
    tip: "jadwalin langkah berikutnya",
  };
  const nilai: Signal = {
    key: "nilai", label: "Nilai deal", max: 20,
    pts: Math.min(20, Math.round((value / (2 * valueLine)) * 20)),
    detail: value ? jt(value) : "Belum ada nilai",
    tip: "isi perkiraan nilai deal-nya",
  };
  const wa: Signal = {
    key: "wa", label: "WhatsApp", max: 10,
    pts: l.phone && l.phone.replace(/\D/g, "").length >= 8 ? 10 : 0,
    detail: l.phone ? "Nomor ada" : "Belum ada nomor",
    tip: "tambah nomor WhatsApp-nya",
  };
  const kontak: Signal = {
    key: "kontak", label: "Kontak terakhir", max: 20,
    pts: contact === null ? 0 : contact <= 0 ? 20 : contact <= 2 ? 16 : contact <= 6 ? 10 : contact <= 13 ? 5 : 0,
    detail: contact === null ? "Belum pernah" : agoText(contact).replace(/^./, c => c.toUpperCase()),
    tip: "hubungi lagi minggu ini",
  };

  const signals = [respons, langkah, nilai, wa, kontak];
  const total = signals.reduce((a, s) => a + s.pts, 0);
  // The one move that would add the most.
  const gap = signals.slice().sort((a, b) => (b.max - b.pts) - (a.max - a.pts))[0];
  const lv = levelOf(total);
  const room = gap.max - gap.pts;
  return { total, level: lv, word: LEVEL_WORD[lv], signals, tip: room > 0 ? `${gap.tip}, skor naik ${room}` : "" };
}

// The lead map's quadrant (PRD-008 §1).
export type Quadrant = "kejar" | "rawat" | "cepat" | "nanti";
export const QUADRANTS: Record<Quadrant, { label: string; advice: string }> = {
  kejar: { label: "Kejar sekarang", advice: "Skor tinggi, nilai besar. Hubungi minggu ini." },
  rawat: { label: "Rawat", advice: "Nilai besar, tapi belum responsif." },
  cepat: { label: "Cepat closing", advice: "Responsif, nilainya kecil. Tutup cepat." },
  nanti: { label: "Nanti", advice: "Belum prioritas." },
};

export function quadrantOf(score: number, value: number, valueLine = VALUE_LINE): Quadrant {
  const big = (Number(value) || 0) >= valueLine;
  return score >= SCORE_LINE ? (big ? "kejar" : "cepat") : (big ? "rawat" : "nanti");
}

// Leads still in play: closed or lost ones are off the map.
export const inPlay = (status?: string) => status !== "Closed" && status !== "Lost";
