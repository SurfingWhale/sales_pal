// What a public post says about the person who wrote it (docs/prd/PRD-009
// §13): what they need, when, where, whether price matters, and what kind of
// post it is. Guessed from the words, with no paid service, and always
// editable — a wrong guess costs one tap, a right one makes the intro personal.

export interface PostContext {
  need?: string;       // "foto katalog f&b"
  when?: string;       // "besok, jam 1-5 sore"
  where?: string;      // "Sentul"
  budget?: string;     // "ramah utk umk"
  business?: string;   // "f&b · umk"
  kind?: "rekomendasi" | "kolaborasi" | "butuh";
  edited?: boolean;    // the owner fixed it; a new post doesn't overwrite
}

export const KIND_LABEL: Record<NonNullable<PostContext["kind"]>, string> = {
  rekomendasi: "Minta rekomendasi",
  kolaborasi: "Ngajak kolaborasi",
  butuh: "Lagi nyari jasa",
};

// Where a public ask is best answered first.
export const KIND_HINT: Record<NonNullable<PostContext["kind"]>, string> = {
  rekomendasi: "Dia nanya ke publik: balas di post dulu biar keliatan, terus lanjut DM.",
  kolaborasi: "Ngajak kerja sama: DM dengan ide konkret, bukan pricelist.",
  butuh: "Butuh sekarang: langsung DM, sebut kebutuhannya, kasih contoh.",
};

const TRIGGER = /(?:ada (?:yang|yg) (?:punya )?(?:kenalan|rekomendasi|rekom)?\s*(?:yang |yg )?(?:open|bisa|terima)?|open\s+jasa|dicari|nyariin|nyari|cariin|cari|butuhin|butuh|perlu|looking for|need(?:ed)?)\s+(.+)/i;
const CUT = /\s(?:yg|yang|buat|untuk|utk|tgl|tanggal|jam|di|daerah|area|ramah|budget|bujet|harga|dengan|dgn|please|pls|dong|nih|kak|ya)\s|[?.!,\n(]/i;
const FILLER = /\s+(?:dong|nih|kak|ya|deh|guys|gaes)$/i;
const COLLAB = /\b(?:collab\w*|kolab\w*|kolaborasi|partnership|kerja ?sama|sponsor\w*)\b/i;
const ASKS = /(?:ada (?:yang|yg) (?:punya )?(?:kenalan|rekomendasi|rekom)|rekomendasi|\brekom\b|recommend|siapa (?:yang|yg) (?:bisa|open))/i;
const WHEN = /\b(?:hari ini|besok|lusa|nanti malam|minggu (?:ini|depan)|bulan (?:ini|depan)|weekend|akhir pekan|(?:senin|selasa|rabu|kamis|jum'?at|sabtu)(?: depan| ini)?|tanggal \d{1,2}(?:\s+[a-z]{3,9})?|tgl \d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)[a-z]*|jam \d{1,2}(?:[.:]\d{2})?(?:\s*-\s*\d{1,2}(?:[.:]\d{2})?)?(?:\s*(?:pagi|siang|sore|malam))?)\b/gi;
const BUDGET = /(?:ramah (?:utk |untuk |buat )?(?:umkm?|kantong|pelajar|mahasiswa)|low ?budget|\bbudget\b|\bbujet\b|\bmurah\b|terjangkau|harga (?:teman|pelajar|bersahabat))/i;
const BUSINESS = /\b(?:umkm|umk|f&b|fnb|cafe|kafe|coffee|kopi|resto(?:ran)?|bakery|toko|olshop|online shop|brand|startup|komunitas|klinik|clinic|salon|hotel|wedding|kampus|sekolah|basket|futsal|museum)\b/gi;

// Common places, as people write them; matched whole-word, any case.
const PLACES = [
  "Jakarta", "Jaksel", "Jakbar", "Jaktim", "Jakut", "Jakpus", "Bandung", "Bekasi", "Depok", "Tangerang", "Tangsel",
  "BSD", "Serpong", "Bintaro", "Bogor", "Sentul", "Cibubur", "Cikarang", "Karawang", "Kemang", "PIK", "Kelapa Gading",
  "Senayan", "Menteng", "Surabaya", "Sidoarjo", "Malang", "Jogja", "Yogyakarta", "Solo", "Semarang", "Bali", "Denpasar",
  "Canggu", "Ubud", "Medan", "Makassar", "Batam", "Palembang", "Pekanbaru", "Balikpapan", "Samarinda", "Lombok", "Cirebon",
];

const uniq = (xs: string[]) => Array.from(new Map(xs.map(x => [x.toLowerCase(), x])).values());

export function readPost(text: string): PostContext {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return {};
  const out: PostContext = {};

  const m = t.match(TRIGGER);
  if (m) {
    let need = m[1].replace(/^jasa\s+/i, "");
    const cut = need.search(CUT);
    if (cut >= 0) need = need.slice(0, cut);
    need = need.split(" ").slice(0, 6).join(" ").replace(FILLER, "").trim();
    if (need.length >= 3) out.need = need;
  }
  if (COLLAB.test(t)) {
    out.kind = "kolaborasi";
    out.need ||= "kolaborasi brand";
  } else if (ASKS.test(t)) out.kind = "rekomendasi";
  else if (out.need) out.kind = "butuh";

  const when = uniq((t.match(WHEN) || []).map(s => s.trim())).slice(0, 3);
  if (when.length) out.when = when.join(", ");

  const where = PLACES.filter(p => new RegExp(`\\b${p.replace(/ /g, "\\s+")}\\b`, "i").test(t));
  if (where.length) out.where = where.slice(0, 2).join(", ");

  const budget = t.match(BUDGET)?.[0];
  if (budget) out.budget = budget.toLowerCase();

  const SHOW: Record<string, string> = { umkm: "UMKM", umk: "UMK", "f&b": "F&B", fnb: "F&B" };
  const biz = uniq((t.match(BUSINESS) || []).map(s => SHOW[s.toLowerCase()] || s.toLowerCase())).slice(0, 3);
  if (biz.length) out.business = biz.join(" · ");

  return out;
}

// A new post fills in what's still empty, unless the owner edited it.
export function mergeContext(old: PostContext | undefined, fresh: PostContext): PostContext {
  if (old?.edited) return old;
  return { ...fresh, ...Object.fromEntries(Object.entries(old || {}).filter(([, v]) => v)) };
}
