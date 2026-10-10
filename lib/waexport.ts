// Tarik dari WhatsApp (PRD-008 §5): read a chat exported from WhatsApp
// ("Ekspor chat › Tanpa media") on the phone and keep only a summary. The
// text never leaves the device and is never stored.
//
// Android exports a .txt; iPhone a .zip holding _chat.txt. Both line styles:
//   08/10/26 14.05 - Dita: Boleh kirim pricelist-nya?
//   [08/10/26 14.05.33] Dita: Boleh kirim pricelist-nya?
// A line without that prefix continues the message above it.

import { archetypes } from "@/lib/salespal-data";
import { detectObjection } from "@/lib/replies";

export interface WaMessage { at: Date; from: string; text: string }

const LINE = /^‎?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*([AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?([^:]{1,60}?):\s([\s\S]*)$/;
const SKIP = /<(Media|Media tidak|media omitted)|tidak disertakan|omitted>|^null$|pesan ini (telah )?dihapus|this message was deleted/i;

// Dates are day-first in Indonesia; a US export (month first) is detected when
// a first number goes above 12 nowhere but the second one does.
export function parseWaExport(raw: string): WaMessage[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const hits: { m: RegExpMatchArray; text: string }[] = [];
  for (const line of lines) {
    const m = line.match(LINE);
    if (m) hits.push({ m, text: m[9] });
    else if (hits.length && line.trim()) hits[hits.length - 1].text += "\n" + line;
  }
  const monthFirst = hits.some(h => +h.m[2] > 12) && !hits.some(h => +h.m[1] > 12);
  const out: WaMessage[] = [];
  for (const { m, text } of hits) {
    let [d, mo] = [+m[1], +m[2]];
    if (monthFirst) [d, mo] = [mo, d];
    let y = +m[3]; if (y < 100) y += 2000;
    let h = +m[4];
    const ap = (m[7] || "").toLowerCase();
    if (ap.startsWith("p") && h < 12) h += 12;
    if (ap.startsWith("a") && h === 12) h = 0;
    const at = new Date(y, mo - 1, d, h, +m[5], +(m[6] || 0));
    const t = text.trim();
    if (isNaN(at.getTime()) || !t || SKIP.test(t)) continue;
    out.push({ at, from: m[8].replace(/^‎/, "").trim(), text: t });
  }
  return out;
}

export function senders(msgs: WaMessage[]): { name: string; n: number }[] {
  const c = new Map<string, number>();
  msgs.forEach(m => c.set(m.from, (c.get(m.from) || 0) + 1));
  return Array.from(c, ([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
}

// Which sender is the customer: the one whose name looks like the lead's,
// else the one who isn't the account owner's most likely name (the other one).
export function guessThem(msgs: WaMessage[], leadName: string): string {
  const s = senders(msgs);
  const words = leadName.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  return (s.find(x => words.some(w => x.name.toLowerCase().includes(w))) || s[1] || s[0])?.name || "";
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface WaSummary {
  messages: number; since: string; until: string; mine: number; theirs: number;
  avgReplyMin: number | null;          // how fast THEY answer you
  activeHours: string | null;          // "10–12"
  perWeek: { week: string; n: number }[];  // their messages, last 5 weeks
  cues: { word: string; n: number }[];
  archetype: string | null;
  objectionType: string | null;
  questions: { text: string; at: string; answered: boolean }[];
  lastReplyAt: string | null;
  brief: string;
}

export function summarize(msgs: WaMessage[], them: string): WaSummary {
  const theirs = msgs.filter(m => m.from === them);
  const mine = msgs.filter(m => m.from !== them);

  // Reply time: from your message to their next one, within a day.
  const gaps: number[] = [];
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].from === them && msgs[i - 1].from !== them) {
      const g = (msgs[i].at.getTime() - msgs[i - 1].at.getTime()) / 60000;
      if (g >= 0 && g < 24 * 60) gaps.push(g);
    }
  }
  const avgReplyMin = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  const hours = new Array(24).fill(0);
  theirs.forEach(m => hours[m.at.getHours()]++);
  let best = -1, bestN = 0;
  for (let h = 0; h < 23; h++) if (hours[h] + hours[h + 1] > bestN) { bestN = hours[h] + hours[h + 1]; best = h; }
  const activeHours = best >= 0 ? `${best}–${best + 2}` : null;

  const last = msgs.length ? msgs[msgs.length - 1].at : new Date();
  const perWeek = [4, 3, 2, 1, 0].map(k => {
    const end = new Date(last); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - 7 * k);
    const start = new Date(end); start.setDate(start.getDate() - 7);
    const n = theirs.filter(m => m.at > start && m.at <= end).length;
    return { week: start.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), n };
  });

  const said = theirs.map(m => m.text.toLowerCase()).join("\n");
  const cueCount = new Map<string, number>();
  let archetype: string | null = null, archN = 0;
  for (const a of archetypes) {
    let n = 0;
    for (const w of a.triggerWords) {
      const k = said.split(w.toLowerCase()).length - 1;
      if (k) { n += k; cueCount.set(w, (cueCount.get(w) || 0) + k); }
    }
    if (n > archN) { archN = n; archetype = a.id; }
  }
  const cues = Array.from(cueCount, ([word, n]) => ({ word, n })).sort((a, b) => b.n - a.n).slice(0, 5);

  const questions = msgs
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.from === them && /\?/.test(m.text))
    .slice(-5)
    .map(({ m, i }) => ({
      text: m.text.split("\n").find(l => l.includes("?"))?.trim().slice(0, 160) || m.text.slice(0, 160),
      at: ymd(m.at),
      answered: msgs.slice(i + 1).some(x => x.from !== them),
    }));

  const lastTheirs = theirs.length ? theirs[theirs.length - 1].at : null;
  const since = msgs.length ? ymd(msgs[0].at) : "";
  const until = msgs.length ? ymd(last) : "";
  const a = archetypes.find(x => x.id === archetype);
  const open = questions.filter(q => !q.answered).length;
  const brief = [
    `${msgs.length} pesan sejak ${msgs.length ? msgs[0].at.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}.`,
    avgReplyMin !== null && `Mereka bales rata-rata ${avgReplyMin < 60 ? `${avgReplyMin} menit` : `${Math.round(avgReplyMin / 60)} jam`}${activeHours ? `, paling aktif jam ${activeHours}` : ""}.`,
    a && `Gaya ngobrolnya mirip ${a.name}: ${a.comStyle.toLowerCase()}.`,
    open && `${open} pertanyaan belum dijawab.`,
  ].filter(Boolean).join(" ");

  return {
    messages: msgs.length, since, until, mine: mine.length, theirs: theirs.length,
    avgReplyMin, activeHours, perWeek, cues, archetype,
    objectionType: detectObjection(theirs.slice(-30).map(m => m.text).join("\n")),
    questions, lastReplyAt: lastTheirs ? ymd(lastTheirs) : null, brief,
  };
}

// iPhone wraps the export in a zip: pull _chat.txt out of it in the browser.
export async function readExportFile(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  if (!(buf[0] === 0x50 && buf[1] === 0x4b)) return new TextDecoder().decode(buf);
  const dv = new DataView(buf.buffer);
  let p = 0;
  while (p + 30 < buf.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true);
    let size = dv.getUint32(p + 18, true);
    const nameLen = dv.getUint16(p + 26, true), extra = dv.getUint16(p + 28, true);
    const name = new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    if (size === 0 && (dv.getUint16(p + 6, true) & 8)) {
      // Size comes after the data: find the next header to know where it ends.
      let q = start; while (q + 4 < buf.length && dv.getUint32(q, true) !== 0x08074b50 && dv.getUint32(q, true) !== 0x04034b50) q++;
      size = q - start;
    }
    if (/\.txt$/i.test(name)) {
      const data = buf.subarray(start, start + size);
      if (method === 0) return new TextDecoder().decode(data);
      const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(ds).text();
    }
    p = start + size;
    if (dv.getUint32(p, true) === 0x08074b50) p += 16;
  }
  throw new Error("Ga nemu file chat di dalam zip-nya.");
}
