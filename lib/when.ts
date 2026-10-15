// "tgl 24", "besok", "sabtu depan", "31 October 2026" → the day it means, so a
// prospect's date can be checked against the jobs already booked (QA 11 Okt).
// Local calendar dates (YYYY-MM-DD), like lib/billing.ts.

import { addDays } from "@/lib/billing";

const MONTHS: [RegExp, number][] = [
  [/^jan/, 1], [/^feb/, 2], [/^mar/, 3], [/^apr/, 4], [/^(mei|may)/, 5], [/^jun/, 6], [/^jul/, 7],
  [/^(agu|agt|aug)/, 8], [/^sep/, 9], [/^(okt|oct)/, 10], [/^nov/, 11], [/^(des|dec)/, 12],
];
const DAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const DAY_LABEL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const valid = (y: number, m: number, d: number) => {
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
};
const monthOf = (word: string) => MONTHS.find(([re]) => re.test(word.toLowerCase()))?.[1];

// The first day the words point to, on or after `on`. Null when there's no date in it.
export function resolveWhen(text: string | undefined, on: string): string | null {
  const t = (text || "").toLowerCase().replace(/jum'at/g, "jumat");
  if (!t.trim()) return null;
  const [y, m, d] = on.split("-").map(Number);

  if (/\bhari ini\b/.test(t)) return on;
  if (/\blusa\b/.test(t)) return addDays(on, 2);
  if (/\bbesok\b/.test(t)) return addDays(on, 1);

  // 24 okt / 24 oktober 2026 / 31 October
  const dm = t.match(/\b(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?\b/);
  const mon = dm ? monthOf(dm[2]) : undefined;
  if (dm && mon) {
    const day = +dm[1];
    let year = dm[3] ? +dm[3] : y;
    if (!dm[3] && iso(year, mon, day) < on) year++;
    if (valid(year, mon, day)) return iso(year, mon, day);
  }
  // October 31, 2026
  const md = t.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/);
  const mon2 = md ? monthOf(md[1]) : undefined;
  if (md && mon2) {
    const day = +md[2];
    let year = md[3] ? +md[3] : y;
    if (!md[3] && iso(year, mon2, day) < on) year++;
    if (valid(year, mon2, day)) return iso(year, mon2, day);
  }
  // tgl 24 / tanggal 24: this month, or next if it has passed
  const only = t.match(/\b(?:tgl|tanggal)\.?\s*(\d{1,2})\b/);
  if (only) {
    const day = +only[1];
    for (let k = 0; k < 3; k++) {
      const mm = ((m - 1 + k) % 12) + 1, yy = y + Math.floor((m - 1 + k) / 12);
      if (valid(yy, mm, day) && iso(yy, mm, day) >= on) return iso(yy, mm, day);
    }
  }
  // sabtu / sabtu depan / weekend
  // ("minggu ini/depan" is a week, not Sunday.)
  const wd = t.replace(/\bminggu (ini|depan)\b/g, "").match(/\b(minggu|senin|selasa|rabu|kamis|jumat|sabtu)\b(\s+depan)?/);
  const weekend = /\b(weekend|akhir pekan)\b/.test(t);
  if (wd || weekend) {
    const want = wd ? DAYS.indexOf(wd[1]) : 6;
    const gap = (want - new Date(y, m - 1, d).getDay() + 7) % 7;
    return addDays(on, wd?.[2] ? gap || 7 : gap);
  }
  if (/\bminggu depan\b/.test(t)) return addDays(on, 7);
  return null;
}

export function dayName(isoDate: string): string {
  return DAY_LABEL[new Date(isoDate + "T00:00:00").getDay()];
}

// "Sabtu, 24 Okt 2026"
export function fullDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return `${DAY_LABEL[d.getDay()]}, ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
}
