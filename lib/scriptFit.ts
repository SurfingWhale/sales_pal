// A script fitted to the post it answers (owner, 5 Nov: "susah cocokin scrape
// thread dengan respons yang oke … suggestion based on informasi gathered yang
// ngasih context dan auto koreksi ke script yang ada biar relevan").
//
// No model and no paid call (PRD-022 §5: budget Rp 0). From what the post said
// (lib/postContext) it picks the script that fits best, then corrects it:
// - says what they're looking for when the script doesn't;
// - mentions their date, place and budget when the script doesn't, without
//   promising anything (it says you'll check, not that you're free);
// - leaves out a sentence that talks about another kind of business ("foto
//   menu" to someone planning a wedding).
// Every change is listed, and the text stays editable before it goes out.

import { CATEGORY_WORDS, categoryOf, rankScripts } from "@/lib/scriptPick";
import { fillTemplate, stageOf, workflowOf, type FillData, type Stage } from "@/lib/templates";
import type { PostContext } from "@/lib/postContext";

export interface Change { kind: "add" | "drop" | "edit"; note: string }
export interface Fitted { text: string; changes: Change[] }

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim()} `;
const has = (text: string, word: string) => norm(text).includes(` ${word.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim()} `);
const STOP = new Set(["yang", "buat", "untuk", "dengan", "lagi", "kak", "dong", "jasa", "open", "bisa", "nyari", "cari"]);
const keyWords = (s = "") => norm(s).trim().split(" ").filter(w => w.length >= 4 && !STOP.has(w));

// Sentences as people write them in a DM: ends at . ! ?, a line break, or an
// emoji followed by a new sentence ("Aku fotografer 📸 Biasa pegang …").
// (Built with RegExp: the project's TS target predates the "u" flag in literals.)
const BREAK = new RegExp("(?<=[.!?]|\\p{Extended_Pictographic})\\s+(?=\\p{Lu})|(?<=[.!?])\\s+|\\n+", "u");
function sentences(text: string): string[] {
  return text.split(BREAK).map(s => s.trim()).filter(Boolean);
}

// How a kind of business reads in a note to the seller.
const SAID: Record<string, string> = {
  "F&B": "makanan & minuman", Retail: "toko & produk", Health: "kesehatan & kecantikan", Property: "properti",
  Service: "event & jasa", Tech: "teknologi", Education: "pendidikan",
};
const said = (c: string) => SAID[c] || c;

// The kinds of business a sentence talks about, by its words.
function talksAbout(s: string): string[] {
  return Object.entries(CATEGORY_WORDS).filter(([, ws]) => ws.some(w => w.length > 2 && has(s, w))).map(([c]) => c);
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function fitToPost(body: string, data: FillData, ctx: PostContext = {}, postText = ""): Fitted {
  const filled = fillTemplate(body, data);
  const changes: Change[] = [];
  let parts = sentences(filled);
  if (!parts.length) return { text: filled, changes };

  // What they're about: the post's own words first.
  const theirs = categoryOf(ctx.business, ctx.need, postText);

  // A sentence about another kind of business reads like a copy-paste. The
  // greeting stays, and so does at least one more sentence.
  if (theirs) {
    const kept: string[] = [];
    parts.forEach((s, i) => {
      const about = talksAbout(s);
      if (i === 0 || !about.length || about.includes(theirs)) { kept.push(s); return; }
      // Who you are stays: "Aku fotografer makanan freelance" loses only "makanan".
      if (/^aku\b/i.test(s) && s.split(/\s+/).length <= 9) {
        const off = about.flatMap(c => CATEGORY_WORDS[c]).filter(w => w.length > 2 && has(s, w));
        const trimmed = off.reduce((x, w) => x.replace(new RegExp(`\\s*\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), ""), s).replace(/\s{2,}/g, " ").trim();
        if (trimmed.split(/\s+/).length >= 2 && !talksAbout(trimmed).some(c => c !== theirs)) {
          kept.push(trimmed);
          changes.push({ kind: "edit", note: `“${short(s)}” jadi “${short(trimmed)}”: ${about.map(said).join(" / ")} ga nyambung, dia butuh ${said(theirs)}` });
          return;
        }
      }
      changes.push({ kind: "drop", note: `“${short(s)}”: soal ${about.map(said).join(" / ")}, dia butuh ${said(theirs)}` });
    });
    if (kept.length >= 2) parts = kept;
    else changes.splice(0, changes.length);
  }

  const text = () => parts.join(" ");
  const adds: string[] = [];

  // What they're looking for.
  const need = (ctx.need || "").trim();
  if (need && !keyWords(need).some(w => has(text(), w))) {
    const line = ctx.kind === "kolaborasi" ? `Aku liat kamu lagi cari ${need} buat kolaborasi.`
      : ctx.kind === "rekomendasi" ? `Aku liat kamu lagi cari rekomendasi ${need}.`
      : `Aku liat kamu lagi nyari ${need}.`;
    parts.splice(1, 0, line);
    changes.push({ kind: "add", note: `sebut kebutuhannya: ${need}` });
  }

  // When and where: you'll check, nothing promised.
  const when = (ctx.when || "").trim(), where = (ctx.where || "").trim();
  const saysWhen = when && keyWords(when).some(w => has(text(), w));
  const saysWhere = where && has(text(), where);
  if ((when && !saysWhen) || (where && !saysWhere)) {
    const at = [when && !saysWhen ? `buat ${when}` : "", where && !saysWhere ? `di ${where}` : ""].filter(Boolean).join(" ");
    adds.push(`${at.charAt(0).toUpperCase()}${at.slice(1)}, aku cek jadwalnya dulu ya.`);
    changes.push({ kind: "add", note: `sebut ${[when && !saysWhen ? "waktunya" : "", where && !saysWhere ? "lokasinya" : ""].filter(Boolean).join(" & ")}` });
  }

  // Their budget, when they named one and the script doesn't talk money.
  if (ctx.budget && !/\b(budget|bujet|harga|paket|murah|hemat|biaya|pricelist)\b/i.test(text())) {
    adds.push("Ada pilihan yang bisa disesuaiin sama budget-nya juga.");
    changes.push({ kind: "add", note: `nyinggung budget (dia nyebut “${ctx.budget}”)` });
  }

  // Added lines go before the closing question, so the ask stays last.
  if (adds.length) {
    const last = parts.length - 1;
    const asks = /\?\s*$/.test(parts[last]) && last > 0;
    parts.splice(asks ? last : parts.length, 0, ...adds);
  }
  return { text: parts.join(" ").replace(/\s{2,}/g, " ").trim(), changes };
}

export interface Suggestion<T> { t: T; fit: Fitted; why: string[] }

// The script that answers this post best, at this stage, corrected for it.
// Scripts kept for Leads only (a business found on Maps) aren't offered here.
export function suggestForPost<T extends { title: string; body: string; stage?: string; workflow?: "leads" | "hunting" | "semua"; categories?: string[] }>(
  scripts: T[], stage: Stage, data: FillData, ctx: PostContext = {}, postText = "",
): Suggestion<T> | null {
  const pool = scripts.filter(t => stageOf(t) === stage && workflowOf(t) !== "leads");
  if (!pool.length) return null;
  const theirs = categoryOf(ctx.business, ctx.need, postText);
  const ranked = rankScripts(pool, { category: theirs, need: ctx.need, pain: postText }).filter(r => !r.out);
  if (!ranked.length) return null;
  // Among the best few, the one that needs the fewest sentences thrown away.
  const best = ranked.slice(0, 4).map(r => {
    const fit = fitToPost(r.t.body, data, ctx, postText);
    const drops = fit.changes.filter(c => c.kind === "drop").length;
    return { r, fit, rank: r.score - drops * 3 + (workflowOf(r.t) === "hunting" ? 1 : 0) };
  }).sort((a, b) => b.rank - a.rank)[0];
  return { t: best.r.t, fit: best.fit, why: best.r.why };
}
