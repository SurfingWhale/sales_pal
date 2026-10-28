// A lead's own fields, as a seller edits them (Ubah data lead): where it
// stands, what the deal is worth, and when it first counts as contacted.
// Pure; no Firestore.

// Lost shows as "Gugur": they said no, or went quiet for good. A lost lead is
// off the map, the follow-ups and the pipeline (lib/score.ts inPlay); why it
// was lost goes to the Rejection Log.
export const STATUSES = ["Cold", "Warm", "Hot", "Closed", "Lost"] as const;
export const statusWord = (s: string) => (s === "Lost" ? "Gugur" : s);
export const STATUS_COLOR: Record<string, string> = {
  Hot: "var(--hot)", Warm: "var(--warm)", Cold: "var(--cold)", Closed: "var(--ok)", Lost: "var(--app-muted)",
};

export const SOURCES = ["GMaps", "DM IG", "Threads", "Cold Email", "Referral", "WhatsApp", "LinkedIn", "Lainnya"];
export const CATEGORIES = ["F&B", "Retail", "Health", "Property", "Service", "Tech", "Education"];

// Money as people type it: "5.000.000", "Rp 5.000.000,-", "5jt", "5,5 juta",
// "750rb", "750k". Plain numbers read every dot and comma as a thousands mark;
// with a unit, a comma or a lone dot is the decimal point.
export function parseRupiah(v: unknown): number {
  const s = String(v ?? "").toLowerCase().replace(/rp\.?/g, "").replace(/\s+/g, "").replace(/,(-|0{1,2})$/, "");
  const m = s.match(/^(\d[\d.,]*)(jt|juta|rb|ribu|k)$/);
  if (m) {
    const n = m[1].includes(",") ? m[1].replace(/\./g, "").replace(",", ".")
      : /^\d{1,3}(\.\d{3})+$/.test(m[1]) ? m[1].replace(/\./g, "")
      : m[1];
    const x = parseFloat(n) * (m[2] === "jt" || m[2] === "juta" ? 1_000_000 : 1_000);
    return Number.isFinite(x) ? Math.round(x) : 0;
  }
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// A new lead counts as contacted only when the seller is already talking with
// them. A Cold one waits for its first chat instead of starting with
// "Kontak terakhir: hari ini" points it never earned.
export const firstContact = (status: string, on: string) => (status === "Warm" || status === "Hot" || status === "Closed" ? on : "");

// The Rejection Log's channel for a lead, from where it came.
export function channelOf(source: string): string {
  if (/\big\b|insta/i.test(source)) return "DM Instagram";
  if (/mail/i.test(source)) return "Email";
  if (/linkedin/i.test(source)) return "LinkedIn";
  return "WhatsApp";
}
