// Templates by stage, and the words that make each one personal (docs/prd/
// PRD-009 §13). A template sits in one stage of the journey — intro, follow-up,
// digging into the need, the offer, closing, existing customers — so the deck
// reads like a kanban of the conversation, and the stage that fits the person
// in front of you is the one lit up.

import type { Prospect, View } from "@/lib/prospects";
import type { PostContext } from "@/lib/postContext";

export const STAGES = [
  { id: "intro", label: "Intro", when: "Prospek baru, belum pernah disapa", tip: "Sebut kebutuhannya, satu ajakan kecil: lihat contoh atau kisaran harga." },
  { id: "followup", label: "Follow-up", when: "Udah di-intro, belum bales", tip: "Pendek, ga maksa, kasih jalan keluar buat bilang belum." },
  { id: "gali", label: "Gali kebutuhan", when: "Baru bales pertama kali", tip: "Tanya buat apa, berapa banyak, kapan, kisaran budget." },
  { id: "offering", label: "Penawaran", when: "Tertarik", tip: "Dua pilihan paket + contoh hasil, satu langkah berikutnya." },
  { id: "closing", label: "Closing", when: "Pikir-pikir / Hubungi nanti", tip: "Ingetin slot atau waktunya, kasih tenggat yang wajar." },
  { id: "etb", label: "ETB / repeat", when: "Udah kasih data atau pernah order", tip: "Jaga hubungan: info buat pelanggan lama, minta referensi." },
] as const;
export type Stage = (typeof STAGES)[number]["id"];
export const STAGE_IDS = STAGES.map(s => s.id) as Stage[];

export interface StagedTemplate { id: string; title: string; body: string; stage?: string }

// Templates saved before stages existed land by their title.
export function stageOf(t: { stage?: string; title: string }): Stage {
  if (t.stage && (STAGE_IDS as string[]).includes(t.stage)) return t.stage as Stage;
  const s = t.title.toLowerCase();
  if (/follow|fu\b|ingetin/.test(s)) return "followup";
  if (/gali|kebutuhan|tanya/.test(s)) return "gali";
  if (/offer|penawaran|paket|harga|pricelist/.test(s)) return "offering";
  if (/closing|deal|slot/.test(s)) return "closing";
  if (/etb|repeat|langganan|pelanggan|promo/.test(s)) return "etb";
  return "intro";
}

// The stage for where this person is in their journey.
export function stageFor(p: Prospect | undefined, v: View | undefined): Stage {
  if (!p || !v) return "intro";
  if (p.segment === "ETB" || p.result === "data") return "etb";
  switch (v.status) {
    case "baru": return "intro";
    case "intro": case "belum": case "tidak": return "followup";
    default:
      if (p.result === "tertarik") return "offering";
      if (p.result === "pikir" || p.result === "nanti") return "closing";
      if (p.result === "tolak") return "followup";
      return "gali";
  }
}

// ---- the words a template can carry ---------------------------------------

export const VARIABLES = [
  { key: "nama", desc: "Nama atau username orangnya", example: "Rina" },
  { key: "kebutuhan", desc: "Yang dia cari, dibaca dari post-nya", example: "foto katalog F&B" },
  { key: "waktu", desc: "Kapan dia butuh", example: "besok jam 1-5 sore" },
  { key: "lokasi", desc: "Di mana", example: "Sentul" },
  { key: "post", desc: "Kutipan pendek post-nya", example: "“ada yang open jasa foto katalog?”" },
  { key: "bisnis", desc: "Nama bisnis lo (Info bisnis di Paket)", example: "Visufavor" },
] as const;
export type VarKey = (typeof VARIABLES)[number]["key"];
export type FillData = Partial<Record<VarKey, string>>;

// What a variable says when there's nothing to put in it.
const FALLBACK: Record<VarKey, string> = { nama: "kak", kebutuhan: "kebutuhannya", waktu: "", lokasi: "", post: "", bisnis: "" };

export const SAMPLE: FillData = Object.fromEntries(VARIABLES.map(v => [v.key, v.example])) as FillData;

// {var} fills in; a part in [square brackets] that holds a {var} disappears
// when that var is empty: "Halo {nama}![ Butuh {kebutuhan}[ {waktu}]?]".
// Brackets nest, innermost first; brackets around no {var} stay as typed.
export function fillTemplate(body: string, data: FillData): string {
  const val = (k: string) => (data[k as VarKey] || "").trim();
  const known = (k: string) => (VARIABLES as readonly { key: string }[]).some(v => v.key === k.toLowerCase());
  const OPEN = "\u0001", CLOSE = "\u0002";
  let out = body;
  for (let i = 0; i < 6; i++) {
    const next = out.replace(/\[([^[\]]*)\]/g, (_, inner: string) => {
      const keys = Array.from(inner.matchAll(/\{(\w+)\}/g), m => m[1].toLowerCase()).filter(known);
      if (!keys.length) return OPEN + inner + CLOSE;
      return keys.every(k => val(k)) ? inner : "";
    });
    if (next === out) break;
    out = next;
  }
  out = out.split(OPEN).join("[").split(CLOSE).join("]");
  out = out.replace(/\{(\w+)\}/g, (whole, k: string) => (known(k) ? val(k.toLowerCase()) || FALLBACK[k.toLowerCase() as VarKey] : whole));
  return out.replace(/[ \t]{2,}/g, " ").replace(/ +([,.!?])/g, "$1").trim();
}

export function missingIn(body: string, data: FillData): VarKey[] {
  const used = Array.from(body.matchAll(/\{(\w+)\}/g), m => m[1].toLowerCase());
  return VARIABLES.map(v => v.key).filter(k => used.includes(k) && !(data[k] || "").trim()) as VarKey[];
}

// "@kopisenja" → "kopisenja", a phone number → nothing (the fallback says "kak").
function nameOf(target: string, p?: Prospect): string {
  if (p?.name?.trim()) return p.name.trim();
  const t = target.trim().replace(/^@/, "");
  return !t || /^\+?[0-9][0-9 -]{6,}$/.test(t) ? "" : t;
}

export function dataFor(target: string, p: (Prospect & { context?: PostContext }) | undefined, business?: string): FillData {
  const post = p ? [...(p.history || [])].reverse().find(e => e.kind === "post")?.text : undefined;
  const c = p?.context;
  return {
    nama: nameOf(target, p),
    kebutuhan: c?.need || "",
    waktu: c?.when || "",
    lokasi: c?.where || "",
    post: post ? `“${post.length > 80 ? post.slice(0, 77).trimEnd() + "…" : post}”` : "",
    bisnis: (business || "").trim(),
  };
}

// One example per stage, for an empty column. Freelance photographer voice,
// like the starter DMs; every word stays editable.
export const STARTERS: Record<Stage, { title: string; body: string }> = {
  intro: { title: "Intro — sebut kebutuhannya", body: "Halo {nama}![ Aku liat kamu lagi nyari {kebutuhan}[ buat {waktu}][ di {lokasi}].] Aku[ dari {bisnis}] biasa pegang yang kayak gini. Boleh aku kirim contoh hasil + kisaran harganya?" },
  followup: { title: "Follow-up — ga maksa", body: "Hai {nama}, nyambung soal {kebutuhan} kemarin. Masih nyari? Kalau udah dapet juga gapapa, semoga lancar ya 🙌" },
  gali: { title: "Gali kebutuhan", body: "Makasih udah bales, {nama}! Biar aku siapin yang pas:[ {kebutuhan}-nya] buat apa, kira-kira berapa banyak, dan budget-nya di kisaran berapa?[ Jadwalnya masih {waktu}?]" },
  offering: { title: "Penawaran — dua pilihan", body: "Siap {nama}! Aku ada dua pilihan paket[ buat {kebutuhan}][ {waktu}], aku kirim detail + contoh hasilnya ya. Tinggal pilih yang paling cocok." },
  closing: { title: "Closing — ingetin slot", body: "Hai {nama}, slot[ {waktu}] tinggal sedikit. Kalau masih kepikiran[ {kebutuhan}], aku bisa tahan jadwalnya sampai besok ya." },
  etb: { title: "ETB — pelanggan lama", body: "Halo {nama}! Makasih udah order[ di {bisnis}] kemarin 🙏 Bulan ini ada harga khusus buat pelanggan lama. Mau aku kirim detailnya?" },
};
