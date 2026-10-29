// Which of your scripts fits a lead (owner, 29 Okt: "tipe bisnis udah keliatan,
// automate pemilihannya"). Within the stage that fits, a script scores for:
// - being tagged for the lead's type of business (TemplateBoard → "Buat tipe
//   bisnis"): the strongest signal, and a script tagged only for other types
//   is left out;
// - speaking that type's words ("menu", "katalog", "klinik", …);
// - sharing words with what the lead needs or struggles with.
// Plain words, no model: the reasons are shown, so a pick can be checked and
// the tags tuned.

import { CATEGORIES } from "@/lib/leadEdit";

// Words that say a type of business, in Indonesian as people write it.
export const CATEGORY_WORDS: Record<string, string[]> = {
  "F&B": ["f&b", "makan", "makanan", "minuman", "menu", "resto", "restoran", "rumah makan", "warung", "kuliner", "kafe", "cafe", "kopi", "coffee", "bakery", "kue", "catering", "katering", "food", "dapur"],
  Retail: ["retail", "toko", "produk", "katalog", "fashion", "baju", "butik", "olshop", "online shop", "e-commerce", "brand", "marketplace"],
  Health: ["health", "klinik", "dokter", "gigi", "kesehatan", "apotek", "salon", "beauty", "kecantikan", "spa", "skincare", "gym", "fitness"],
  Property: ["property", "properti", "rumah", "villa", "apartemen", "kost", "perumahan", "interior", "real estate"],
  Service: ["service", "jasa", "layanan", "bengkel", "laundry", "travel", "event", "wedding", "agency"],
  Tech: ["tech", "aplikasi", "app", "software", "startup", "saas", "digital", "it"],
  Education: ["education", "sekolah", "kursus", "les", "bimbel", "kampus", "pelatihan", "training", "akademi"],
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim()} `;
const has = (text: string, word: string) => norm(text).includes(` ${word.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim()} `);

// The type of business a lead's words point to: "Restoran Keluarga" → F&B.
export function categoryOf(...texts: (string | undefined)[]): string | null {
  const all = texts.filter(Boolean).join(" ");
  if (!all.trim()) return null;
  for (const c of CATEGORIES) if (has(all, c)) return c;
  let best: string | null = null, n = 0;
  for (const [c, words] of Object.entries(CATEGORY_WORDS)) {
    const hits = words.filter(w => has(all, w)).length;
    if (hits > n) { best = c; n = hits; }
  }
  return best;
}

const STOP = new Set(["yang", "dan", "atau", "buat", "untuk", "dengan", "belum", "sudah", "udah", "punya", "soal", "lagi", "kami", "kamu", "mereka", "ini", "itu", "ada", "bisa", "mau", "jadi", "dari", "pakai", "pake", "kak", "halo"]);
const words = (s = "") => Array.from(new Set(norm(s).trim().split(" ").filter(w => w.length >= 4 && !STOP.has(w))));

export interface ScriptFit<T> { t: T; score: number; why: string[]; out: boolean }

export function rankScripts<T extends { title: string; body: string; categories?: string[] }>(
  scripts: T[], lead: { category: string | null; need?: string; pain?: string },
): ScriptFit<T>[] {
  const want = lead.category;
  // A word most of these scripts say ("foto", for a photographer) tells them apart from nothing.
  const common = (w: string) => scripts.length > 1 && scripts.filter(t => has(`${t.title} ${t.body}`, w)).length * 2 > scripts.length;
  const asked = words(`${lead.need || ""} ${lead.pain || ""}`).filter(w => !common(w));
  return scripts.map(t => {
    const why: string[] = [];
    let score = 0;
    const tags = t.categories || [];
    // Tagged for other types only: not for this lead.
    const out = !!want && tags.length > 0 && !tags.includes(want);
    if (want && tags.includes(want)) { score += 10; why.push(`ditandai buat ${want}`); }
    const text = `${t.title} ${t.body}`;
    if (want) {
      const said = (CATEGORY_WORDS[want] || []).filter(w => has(text, w));
      if (said.length) { score += 3 + Math.min(2, said.length - 1); why.push(`nyebut ${said.slice(0, 2).join(", ")}`); }
      // Speaks to another type of business (and not this one): a poorer fit.
      else if (Object.entries(CATEGORY_WORDS).some(([c, ws]) => c !== want && ws.some(w => w.length > 3 && has(text, w)))) score -= 2;
    }
    const shared = asked.filter(w => has(text, w));
    if (shared.length) { score += Math.min(3, shared.length); why.push(`nyambung ke "${shared.slice(0, 2).join(", ")}"`); }
    return { t, score, why, out };
  }).sort((a, b) => Number(a.out) - Number(b.out) || b.score - a.score || a.t.title.localeCompare(b.t.title));
}
