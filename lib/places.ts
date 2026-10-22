// Finding businesses to pitch (PRD-012): what a Google Maps search returns,
// the weak spots its reviews show, an opening message built from them, and
// the Excel template for lists gathered elsewhere. Shared by the server route
// (app/api/places) and the finder sheet, so it has no browser or server API.

export interface PlaceReview { rating: number; text: string; when?: string }

export interface Place {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number;
  mapsUrl: string;
  email?: string;            // found on its website, not verified
  reviews: PlaceReview[];    // what Google returns (up to 5)
}

export interface Weakness { label: string; detail?: string }

// Complaint themes in low-star reviews (≤ 3★). Generic on purpose: SalesPal
// is used by more than photographers; the seller decides what fits their offer.
const THEMES: { label: string; words: RegExp }[] = [
  { label: "pelayanan", words: /pelayan|layanan|ramah|jutek|judes|staff|staf|kasir|service|rude/i },
  { label: "lama nunggu", words: /lama|lambat|antri|antre|nunggu|menunggu|slow|wait/i },
  { label: "harga", words: /mahal|harga|kemahalan|pricey|expensive|overpriced/i },
  { label: "kebersihan", words: /kotor|jorok|bau|kebersihan|dirty|smell/i },
  { label: "kualitas", words: /rasa|hambar|keasinan|kualitas|basi|quality|taste|bland/i },
  { label: "foto/tampilan beda", words: /foto|gambar|tidak sesuai|ga sesuai|nggak sesuai|beda dengan|picture|photo|menu.*(jelas|update)/i },
  { label: "info/kontak", words: /tutup|jam buka|ga bisa dihubungi|tidak bisa dihubungi|nomor|alamat salah|closed/i },
];

export function weaknesses(p: Pick<Place, "website" | "rating" | "reviewCount" | "reviews">): Weakness[] {
  const out: Weakness[] = [];
  if (!p.website) out.push({ label: "Belum punya website" });
  if (p.rating !== null && p.rating < 4.3 && p.reviewCount > 0) out.push({ label: `Rating ${p.rating.toLocaleString("id-ID")} dari ${p.reviewCount} ulasan` });
  if (p.reviewCount < 20) out.push({ label: p.reviewCount ? `Ulasan masih sedikit (${p.reviewCount})` : "Belum ada ulasan" });
  const low = p.reviews.filter(r => r.rating <= 3 && r.text.trim());
  for (const t of THEMES) {
    const hits = low.filter(r => t.words.test(r.text));
    if (hits.length) out.push({ label: `Keluhan soal ${t.label}`, detail: snippet(hits[0].text) });
  }
  return out;
}

export const snippet = (s: string, n = 160) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export const DEFAULT_OPENER = "Halo {nama}! Aku dari {bisnis}. Tadi lihat {nama} di Google Maps, {kelemahan}. Aku biasa bantu bisnis kayak gini lewat {jasa}. Boleh aku kirim contoh hasilnya?";

// {nama} {kelemahan} {rating} {bisnis} {jasa}; an empty weakness drops its clause.
export function opener(template: string, p: Place, w: Weakness[], me: { name?: string; tagline?: string }): string {
  const first = w[0];
  const weak = first ? phrase(first) : "";
  const map: Record<string, string> = {
    nama: p.name, kelemahan: weak, rating: p.rating === null ? "" : p.rating.toLocaleString("id-ID"),
    bisnis: me.name || "kami", jasa: (me.tagline || "jasa kami").toLowerCase(),
  };
  return template
    .replace(/,?\s*\{kelemahan\}/g, weak ? `, ${weak}` : "")
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k] : m))
    .replace(/\s+([,.!?])/g, "$1").replace(/,\s*,/g, ",").trim();
}

function phrase(w: Weakness): string {
  if (w.label === "Belum punya website") return "kayaknya belum ada website-nya";
  if (w.label.startsWith("Rating")) return `ratingnya ${w.label.replace(/^Rating /, "").replace(/ dari .*/, "")}`;
  if (w.label.startsWith("Ulasan masih sedikit") || w.label === "Belum ada ulasan") return "ulasannya masih sedikit";
  if (w.label.startsWith("Keluhan soal")) return `ada yang ngeluh soal ${w.label.replace("Keluhan soal ", "")}`;
  return w.label.toLowerCase();
}

// ---- Excel template ------------------------------------------------------
// One row per business. Column names match the importer's auto-mapping
// (components/SalesTracker.tsx IMPORT_FIELDS), so a filled template maps itself.

export const TEMPLATE_COLUMNS = [
  "Nama Bisnis", "Kategori", "Alamat", "No. HP", "Email", "Website",
  "Rating", "Jumlah Ulasan", "Link Google Maps", "Titik Lemah", "Kontak", "Catatan", "Status", "Value (Rp)",
] as const;

export const TEMPLATE_EXAMPLE: Record<(typeof TEMPLATE_COLUMNS)[number], string | number> = {
  "Nama Bisnis": "Kopi Contoh", "Kategori": "Coffee shop", "Alamat": "Jl. Contoh No. 1, Jakarta",
  "No. HP": "0812-0000-0000", "Email": "halo@kopicontoh.id", "Website": "",
  "Rating": 4.1, "Jumlah Ulasan": 86, "Link Google Maps": "https://maps.google.com/?cid=0",
  "Titik Lemah": "Belum punya website; foto menu kurang jelas", "Kontak": "", "Catatan": "Contoh baris, hapus sebelum import", "Status": "Cold", "Value (Rp)": 0,
};

export const TEMPLATE_GUIDE = [
  ["Kolom", "Wajib?", "Isi"],
  ["Nama Bisnis", "Ya", "Nama tempat/usaha seperti di Google Maps"],
  ["Kategori", "", "mis. Coffee shop, Klinik gigi, Butik"],
  ["Alamat", "", "Alamat lengkap atau kota"],
  ["No. HP", "", "Nomor WA/telepon; format bebas (0812…, +62…)"],
  ["Email", "", "Email bisnis yang terlihat publik"],
  ["Website", "", "Kosongkan kalau belum punya (jadi titik lemah)"],
  ["Rating", "", "Angka 1–5, mis. 4,3"],
  ["Jumlah Ulasan", "", "Angka"],
  ["Link Google Maps", "", "Link tempatnya"],
  ["Titik Lemah", "", "Pisahkan dengan ; — mis. Belum punya website; foto menu kurang"],
  ["Kontak", "", "Nama orang yang bisa dihubungi"],
  ["Catatan", "", "Bebas"],
  ["Status", "", "Cold / Warm / Hot / Closed (kosong = Cold)"],
  ["Value (Rp)", "", "Perkiraan nilai deal, angka"],
];
