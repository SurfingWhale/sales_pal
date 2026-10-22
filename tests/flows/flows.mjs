// Every flow a person takes through SalesPal, step by step. Each flow gets a
// fresh browser and a fresh account; a failed step stops that flow only.
// Selectors are the labels a person reads, so a renamed button fails here
// the same way it would confuse someone using the app.

import { readFileSync } from "node:fs";

const OWNER_EMAIL = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8").match(/email in \['([^']+)'\]/)?.[1];

// ---------- helpers ----------
// One DM in Hunting's log: the row that holds this target and its delete button.
// Hunting shows one part at a time: Kirim, Journey, Percakapan, Performa.
const pane = (page, name) => page.getByRole("tablist", { name: "Bagian Hunting" }).getByRole("tab", { name: new RegExp(`^${name}`) }).click();
// The per-message log sits folded under Percakapan.
const openLog = async (page) => {
  await pane(page, "Percakapan");
  const log = page.locator("details").filter({ has: page.locator("summary", { hasText: /^Log kiriman/ }) });
  if (!(await log.evaluate(d => d.open))) await log.locator("summary").click();
};
const huntRow = (page, target) => page.locator("div").filter({ has: page.getByText(target, { exact: true }) }).filter({ has: page.getByRole("button", { name: /^Hapus DM/ }) }).last();

// ---- Production-size account (PRD-010): written straight into the emulator
// as the owner, so a flow can open the app the way a busy seller sees it.
// Every name and number here is invented.
const fv = (v) =>
  v === null || v === undefined ? { nullValue: null }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(fv) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, fv(x)])) } };

export async function uidOf(project, email) {
  const r = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${project}/accounts:query`, {
    method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: "{}",
  });
  const j = await r.json();
  return (j.userInfo || []).find(u => u.email === email)?.localId;
}

export async function seedDocs(project, docs) {
  const root = `projects/${project}/databases/(default)/documents`;
  for (let i = 0; i < docs.length; i += 400) {
    const writes = docs.slice(i, i + 400).map(([path, data]) => ({ update: { name: `${root}/${path}`, fields: fv(data).mapValue.fields } }));
    const r = await fetch(`http://127.0.0.1:8089/v1/${root}:commit`, {
      method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ writes }),
    });
    if (!r.ok) throw new Error(`seed failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

// 200 leads, 40 quotes, 50 invoices, 60 prospects, 120 DMs, 3 clients.
export function bigAccount(uid) {
  const u = `users/${uid}`;
  const docs = [];
  const STATUS = ["Cold", "Warm", "Hot", "Closed", "Lost"];
  const CAT = ["F&B", "Retail", "Health", "Service"];
  for (let i = 1; i <= 200; i++) {
    const n = String(i).padStart(3, "0");
    docs.push([`${u}/leads/big_${n}`, {
      name: `Usaha Contoh ${n}`, contact: `Kontak ${n}`, source: ["GMaps", "Instagram", "Threads", "Referral"][i % 4], status: STATUS[i % 5],
      score: (i * 37) % 100, email: "", phone: i % 3 ? `0812000${n}${n.slice(1)}` : "", category: CAT[i % 4],
      notes: i % 7 ? "" : "Minta pricelist, follow-up minggu depan.", lastContact: daysAgo(i % 90), value: 1_000_000 + (i % 20) * 750_000,
      ...(i % 4 === 0 ? { nextActionDate: daysAgo((i % 9) - 4), nextAction: "Follow-up penawaran" } : {}),
      ...(i % 6 === 0 ? { lastReplyAt: daysAgo(i % 10) } : {}),
      // Half have a point around central Jakarta, for Peta 3D.
      ...(i % 2 === 0 ? { address: `Jl. Contoh No. ${i}, Jakarta`, geo: { lat: -6.17 - (i % 13) * 0.004, lng: 106.81 + (i % 11) * 0.005, by: "maps" } } : {}),
      // Two in three have a customer type from their chat: their pin wears the character.
      ...(i % 3 ? { profile: { archetype: ["owl", "lion", "dolphin", "rabbit"][Math.floor(i / 2) % 4], source: "wa-export" } } : {}),
    }]);
  }
  const item = (k) => ({ name: `Paket foto ${k}`, qty: 1, price: 750_000 + k * 250_000, description: "20 foto edit\n1x revisi" });
  for (let i = 1; i <= 40; i++) {
    const n = String(i).padStart(3, "0");
    docs.push([`${u}/quotes/big_q${n}`, {
      number: `Q-BIG-${n}`, leadId: `big_${n}`, leadName: `Usaha Contoh ${n}`, contact: `Kontak ${n}`, phone: "",
      items: [item(i % 4)], discount: 0, dpPercent: 50, notes: "", date: daysAgo(i * 2), validUntil: daysAgo(i * 2 - 14),
      status: ["Draft", "Terkirim", "Disetujui", "Ditolak"][i % 4], ...(i % 4 === 1 ? { sentAt: daysAgo(i * 2 - 1) } : {}),
    }]);
  }
  for (let i = 1; i <= 50; i++) {
    const n = String(i).padStart(3, "0");
    const total = 750_000 + (i % 4) * 250_000;
    const pays = i % 3 === 0 ? [] : i % 3 === 1 ? [{ date: daysAgo(i), amount: total / 2, note: "DP 50%" }] : [{ date: daysAgo(i + 3), amount: total / 2, note: "DP 50%" }, { date: daysAgo(i), amount: total / 2, note: "Pelunasan" }];
    docs.push([`${u}/invoices/big_i${n}`, {
      number: `INV-BIG-${n}`, quoteId: "", leadId: `big_${n}`, leadName: `Usaha Contoh ${n}`, contact: `Kontak ${n}`, phone: "",
      items: [item(i % 4)], discount: 0, dpPercent: 50, notes: "", date: daysAgo(i + 5), dueDate: daysAgo(i - 2), payments: pays,
      ...(i % 5 === 0 ? { project: `Foto katalog ${n}`, eventDate: daysAgo(-(i % 20)), eventTime: "10.00–12.00 WIB", venue: "Jl. Contoh No. 1" } : {}),
    }]);
  }
  for (let i = 1; i <= 60; i++) {
    const n = String(i).padStart(3, "0");
    const at = Date.now() - i * 86_400_000;
    docs.push([`${u}/prospects/Threads_contoh_${n}`, {
      platform: "Threads", handle: `@contoh_${n}`, segment: i % 10 === 0 ? "ETB" : "NTB", contact: ["baru", "intro", "terhubung"][i % 3], attempts: i % 3,
      firstSeenAt: daysAgo(i), source: { kind: "post", url: `https://www.threads.com/@contoh_${n}/post/X${n}`, text: "ada yang open jasa foto produk buat UMKM? budget ramah ya" },
      context: { need: "foto produk", budget: "budget ramah", kind: "rekomendasi" },
      history: [{ at, kind: "post", text: "ada yang open jasa foto produk buat UMKM?" }, ...(i % 3 ? [{ at: at + 3_600_000, kind: "sent", text: "Halo kak, aku fotografer produk…", channel: "dm" }] : [])],
      closed: false, createdAt: at, updatedAt: at, ...(i % 3 ? { firstSentAt: daysAgo(i), lastSentAt: daysAgo(i) } : {}),
    }]);
  }
  for (let i = 1; i <= 120; i++) {
    const n = String(i).padStart(3, "0");
    docs.push([`${u}/hunts/big_h${n}`, {
      target: `@contoh_${String((i % 60) + 1).padStart(3, "0")}`, platform: "Threads", templateId: "tpl_cold", templateTitle: "Cold DM — Tawarin Jasa",
      status: ["Terkirim", "Dibales", "Tertarik", "Ditolak", "Ghosting"][i % 5], note: "", date: daysAgo(i % 30), createdAt: Date.now() - (i % 30) * 86_400_000,
    }]);
  }
  for (const c of ["Toko Contoh A", "Toko Contoh B", "Toko Contoh C"]) {
    const id = c.toLowerCase().replace(/\W+/g, "_");
    docs.push([`${u}/clients/${id}`, { name: c, segmentThreshold: 5_000_000, createdAt: Date.now() }]);
    for (let k = 1; k <= 15; k++) docs.push([`${u}/clients/${id}/deals/d${k}`, {
      contactName: `Pembeli ${k}`, phone: "", firstTouch: { channel: ["Instagram", "TikTok", "WhatsApp"][k % 3], method: "self_report", at: daysAgo(k * 2) },
      stage: ["lead", "qualified", "quoted", "won", "paid"][k % 5], leadAt: daysAgo(k * 2), quoteValue: 500_000 + k * 100_000,
      ...(k % 5 === 4 ? { paidAt: daysAgo(k), paidAmount: 500_000 + k * 100_000, wonAt: daysAgo(k + 1) } : {}),
    }]);
  }
  return docs;
}

export async function signup(t) {
  const { page, base } = t;
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: "Daftar gratis" }).click();
  const email = `flow${Date.now()}${Math.floor(Math.random() * 1e4)}@contoh.id`;
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("rahasia123");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.getByRole("heading", { name: /^Perlu ditindak/ }).waitFor();
  return email;
}

export async function go(page, place, tab) {
  await page.locator(".sp-nav-btn", { hasText: place }).click();
  if (tab) await page.locator(".sp-sub-btn", { hasText: new RegExp(`^${tab}$`) }).click();
  await page.waitForTimeout(300);
}

const modal = (page) => page.locator(".modal-overlay").last();

// The server opens Threads links (/api/hunt/unfurl); flows answer for it, so
// nothing here reaches threads.com.
async function mockUnfurl(page) {
  const known = {
    AbC123: { handle: "@tokokue", name: "Toko Kue", text: "ada yang open jasa foto katalog buat UMKM? budget ramah UMKM", postUrl: "https://www.threads.com/@tokokue/post/AbC123", postId: "AbC123" },
  };
  await page.route("**/api/hunt/unfurl", async route => {
    const url = JSON.parse(route.request().postData() || "{}").url || "";
    const hit = Object.entries(known).find(([k]) => url.includes(k))?.[1];
    const handle = url.match(/\/(@[A-Za-z0-9._]+)\/post\//)?.[1];
    const body = hit || (handle ? { handle, name: "", text: `post dari ${handle}`, postUrl: url, postId: "p1" } : null);
    await route.fulfill({ status: body ? 200 : 422, contentType: "application/json", body: JSON.stringify(body || { error: "Link-nya nggak kebaca." }) });
  });
}
const expectText = async (page, text, ms = 8000) => page.getByText(text).first().waitFor({ timeout: ms });

async function addLead(page, name) {
  await go(page, "Jualan", "Leads");
  await page.getByRole("button", { name: /tambah lead/i }).click();
  await modal(page).locator("input").first().fill(name);
  await modal(page).getByRole("button", { name: "Simpan lead" }).click();
  // The dialog closes once the write is confirmed; the row can show up before that.
  await page.locator(".modal-overlay").waitFor({ state: "detached", timeout: 10000 });
  await expectText(page, name);
}

// Leads (PRD-008): on a wide screen a lead opens in the panel beside the
// list; on a phone it opens as a full-screen profile.
const isWide = (page) => (page.viewportSize()?.width || 0) >= 1024;

// The street map's tiles come from OpenFreeMap; tests draw a plain background
// instead, so a flow never waits on the internet.
export async function stubMap(page) {
  await page.route(/tiles\.openfreemap\.org/, route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#e9e5dc" } }] }),
  }));
}
async function openLeadRow(page, name) {
  await closeAll(page);
  await go(page, "Jualan", "Leads");
  await page.locator(".lead-row", { hasText: name }).first().click();
  if (!isWide(page)) await page.getByRole("dialog", { name: new RegExp(`^Profil ${name}`) }).waitFor();
}
// The full profile: already open on a phone, behind "Profil lengkap" on desktop.
async function fullProfile(page) {
  if (isWide(page)) await page.getByRole("button", { name: "Profil lengkap" }).click();
  await page.getByRole("dialog", { name: /^Profil / }).waitFor();
}
// The "Kenapa" list: always shown in the panel, folded on the phone profile.
async function showWhy(page) {
  const fold = page.getByRole("button", { name: /^\d+ Potensi .* Kenapa \d+/ });
  if (await fold.count()) await fold.first().click();
}
async function closeAll(page) {
  for (let i = 0; i < 4 && await page.locator(".modal-overlay").count(); i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

// Firestore REST against the emulator, as the websites write: public, server time.
async function sendInbound(project, lead) {
  const DB = `projects/${project}/databases/(default)/documents`;
  const v = (x) => typeof x === "number" ? { integerValue: String(x) } : typeof x === "string" ? { stringValue: x } : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } };
  const id = Math.random().toString(36).slice(2, 14);
  const res = await fetch(`http://127.0.0.1:8089/v1/${DB}:commit`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [{ update: { name: `${DB}/inbound_leads/${id}`, fields: Object.fromEntries(Object.entries(lead).map(([k, x]) => [k, v(x)])) }, updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] }),
  });
  if (!res.ok) throw new Error(`inbound write refused: ${res.status} ${(await res.text()).slice(0, 120)}`);
}

async function ownerLogin(t) {
  const A = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
  let r = await (await fetch(`${A}/accounts:signUp?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: OWNER_EMAIL, password: "rahasia123" }) })).json();
  if (r.error?.message === "EMAIL_EXISTS") r = await (await fetch(`${A}/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: OWNER_EMAIL, password: "rahasia123" }) })).json();
  await fetch(`${A}/accounts:update?key=fake`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ localId: r.localId, emailVerified: true }) });
  const { page, base } = t;
  await page.goto(`${base}/login`);
  await page.locator('input[type="email"]').fill(OWNER_EMAIL);
  await page.locator('input[type="password"]').fill("rahasia123");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

// ---------- flows ----------
export const flows = [
  {
    // Cari bisnis (PRD-012): Google Maps results with their weak spots become
    // leads once; a list from elsewhere comes in through the Excel template.
    name: "cari bisnis: maps results to leads, template to import",
    async run(t) {
      const { page } = t;
      const place = (id, name, extra) => ({ id, name, category: "Coffee shop", address: `Jl. Contoh ${id}, Jakarta`, lat: -6.2, lng: 106.81, phone: `0812000000${id.slice(-2)}`, website: "", rating: 4.0, reviewCount: 12, mapsUrl: `https://maps.google.com/?cid=${id}`, reviews: [{ rating: 2, text: "Pelayanannya lama banget, nunggu 30 menit", when: "" }], ...extra });
      await page.route("**/api/places", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        places: [place("p01", "Kopi Uji Satu"), place("p02", "Kopi Uji Dua", { website: "https://kopiujidua.id", rating: 4.7, reviewCount: 320, reviews: [] })], nextPageToken: "" }) }));
      await t.step("sign up", () => signup(t));
      await t.step("Beranda opens Cari bisnis", async () => {
        await page.getByRole("region", { name: "Cari calon klien" }).getByRole("button", { name: "Cari bisnis" }).click();
        await page.getByRole("dialog", { name: "Cari bisnis" }).waitFor();
      });
      const sheet = page.getByRole("dialog", { name: "Cari bisnis" });
      await t.step("a search shows each business with its weak spots", async () => {
        await sheet.locator("#lf-q").fill("coffee shop Jakarta Selatan");
        await sheet.getByRole("button", { name: "Cari", exact: true }).click();
        const one = sheet.getByRole("article", { name: "Kopi Uji Satu" });
        for (const w of ["Belum punya website", "Rating 4 dari 12 ulasan", "Ulasan masih sedikit (12)", "Keluhan soal lama nunggu"]) await one.getByText(w).waitFor();
        await sheet.getByText("2 bisnis · 1 dipilih").waitFor();
      });
      await t.step("the opening message names them and their weak spot", async () => {
        await sheet.getByRole("article", { name: "Kopi Uji Satu" }).getByRole("button", { name: "Salin pesan" }).click();
        const text = await page.evaluate(() => navigator.clipboard.readText());
        if (!text.includes("Kopi Uji Satu") || !text.includes("belum ada website")) throw new Error(`message: ${text}`);
      });
      await t.step("save as leads, once", async () => {
        await sheet.getByRole("checkbox", { name: "Pilih Kopi Uji Dua" }).check();
        await sheet.getByRole("button", { name: "Simpan 2 jadi lead" }).click();
        await sheet.getByText("2 bisnis masuk Leads.").waitFor();
        await sheet.getByRole("button", { name: "Cari", exact: true }).click();
        await sheet.getByText(/Kopi Uji Satu|udah ada di Leads/).first().waitFor();
        await sheet.getByRole("article", { name: "Kopi Uji Satu" }).getByText(/udah ada di Leads/).waitFor();
        await sheet.getByText("2 bisnis · 0 dipilih").waitFor();
      });
      await t.step("the Excel template downloads with its columns", async () => {
        const [dl] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download template Excel" }).click()]);
        if (dl.suggestedFilename() !== "SalesPal-template-leads.xlsx") throw new Error(dl.suggestedFilename());
        const XLSX = (await import("xlsx")).default;
        const wb = XLSX.readFile(await dl.path());
        const head = XLSX.utils.sheet_to_json(wb.Sheets.Leads, { header: 1 })[0];
        for (const c of ["Nama Bisnis", "No. HP", "Website", "Rating", "Link Google Maps", "Titik Lemah"]) if (!head.includes(c)) throw new Error(`template lacks ${c}`);
        await dl.saveAs(new URL("./out/template.xlsx", import.meta.url).pathname);
      });
      await t.step("the filled template imports itself", async () => {
        await sheet.getByRole("button", { name: "Import Excel" }).click();
        await page.locator('input[type="file"][accept*=".xlsx"]').setInputFiles(new URL("./out/template.xlsx", import.meta.url).pathname);
        await page.getByRole("button", { name: "Import 1 lead" }).click();
        await page.getByRole("button", { name: "Selesai" }).click();
        await go(page, "Jualan", "Leads");
        await page.locator(".lead-row", { hasText: "Kopi Contoh" }).first().waitFor();
        await page.locator(".lead-row", { hasText: "Kopi Uji Satu" }).first().waitFor();
      });
    },
  },
  {
    // The landing (TasteSkill v2): the hero is a quote you can fill in, and every way in leads to the login.
    name: "landing: fill the quote, then sign in",
    async run(t) {
      const { page, base } = t;
      await t.step("the landing opens on its headline", async () => { await page.goto(`${base}/`); await page.getByRole("heading", { level: 1, name: "Dari DM sampai lunas." }).waitFor(); });
      await t.step("the quote follows the name and the package", async () => {
        await page.locator("#lp-client").fill("Kedai Contoh");
        await page.getByRole("radiogroup", { name: "Paket" }).getByRole("radio", { name: /Liputan event sehari/ }).click();
        await page.getByText("DP 50% buat Kedai Contoh").waitFor();
        await page.getByText("Rp 3.000.000").first().waitFor();
        const href = await page.getByRole("link", { name: "Kirim contoh ini ke WhatsApp" }).getAttribute("href");
        if (!href || !decodeURIComponent(href).includes("Kedai Contoh")) throw new Error(`WhatsApp link: ${href}`);
      });
      await t.step("the showcase tabs switch", async () => {
        await page.getByRole("tablist", { name: "Bagian app" }).getByRole("tab", { name: "Guild" }).click();
        await page.getByRole("heading", { name: "Satu tim, satu angka." }).waitFor();
      });
      await t.step("Mulai gratis leads to the login", async () => {
        await page.getByRole("link", { name: "Mulai gratis" }).click();
        await page.waitForURL("**/login");
      });
    },
  },
  {
    name: "sign up and land on the dashboard",
    async run(t) {
      await t.step("login page loads with Google and email options", async () => {
        await t.page.goto(`${t.base}/login`);
        await t.page.getByRole("button", { name: "Lanjutkan dengan Google" }).waitFor();
      });
      await t.step("create an account with email", () => signup(t));
      await t.step("Beranda opens with the day's move, then the lead map, then the queue", async () => {
        await t.page.getByRole("heading", { level: 1, name: /perlu ditindak hari ini|mendesak hari ini/ }).waitFor();
        const order = await t.page.evaluate(() => [...document.querySelectorAll(".sp-main h2")].map(h => (h.textContent || "").trim()));
        const todo = order.findIndex(x => /^Perlu ditindak/.test(x)), map = order.findIndex(x => /^Peta lead/.test(x));
        if (todo < 0 || map < 0 || map > todo) throw new Error(`headings: ${order.join(" | ")}`);
      });
    },
  },
  {
    name: "navigation reaches every place and tab",
    async run(t) {
      await t.step("sign up", () => signup(t));
      const places = [["Beranda", null, "Perlu ditindak"], ["Hunting", null, "Hunting Mode"],
        ["Jualan", "Leads", "Belum ada lead"], ["Jualan", "Penawaran", "Susun dari paket"], ["Jualan", "Invoice", "Invoice & Pembayaran"], ["Jualan", "Paket", "Paket & Harga"],
        ["Tim", "Dashboard tim", "Belum ada yang bisa dihitung"], ["Tim", "Guild", "Belum ikut guild"], ["Tim", "Report Klien", "Report Klien"], ["Tim", "Log aktivitas", "Belum ada aktivitas"], ["Tim", "Outreach", "Outreach Tracker"], ["Tim", "Rejection Log", "Rejection"],
        ["Belajar", "Script Library", "Script Library"], ["Belajar", "Simulator", "Simulator"], ["Belajar", "AI Playbook", "Playbook"]];
      for (const [place, tab, heading] of places) {
        await t.step(`${place}${tab ? ` → ${tab}` : ""} shows "${heading}"`, async () => { await go(t.page, place, tab); await expectText(t.page, heading); });
      }
      await t.step("each tab says in one line what it's for, once", async () => {
        await go(t.page, "Tim", "Guild");
        await expectText(t.page, "Ruang tim: pipeline bersama");
        if (await t.page.locator(".sp-subhint").count()) throw new Error("Guild says what it's for twice");
        await go(t.page, "Belajar", "Simulator");
        await expectText(t.page, "Latihan jawab customer sebelum ketemu beneran");
        if (await t.page.locator(".sp-subhint").count()) throw new Error("Simulator says what it's for twice");
        await go(t.page, "Jualan", "Leads");
        await expectText(t.page, "Semua calon customer: skor potensi");
      });
      // WCAG 1.4.10: every place reflows at 320px (= 200% zoom) without sideways scroll.
      await t.step("no sideways scroll on any of them, also at 320px", async () => {
        const size = t.page.viewportSize();
        const wide = [];
        for (const width of [size.width, 320]) {
          await t.page.setViewportSize({ width, height: size.height });
          for (const [place, tab] of places) {
            await go(t.page, place, tab);
            const over = await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (over > 0) wide.push(`${place}${tab ? `/${tab}` : ""} @${width}px +${over}px`);
          }
        }
        await t.page.setViewportSize(size);
        if (wide.length) throw new Error(`wider than the screen: ${wide.join(", ")}`);
      });
      await t.step("dark mode toggles", async () => {
        await t.page.getByRole("button", { name: "Profil dan pengaturan" }).click();
        await t.page.getByRole("button", { name: /Tampilan/ }).click();
        const theme = await t.page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        if (theme !== "dark") throw new Error(`theme is ${theme}`);
        await t.page.getByRole("button", { name: /Tampilan/ }).click();
      });
      await t.step("pick a profile picture; the header shows it", async () => {
        await t.page.getByRole("button", { name: "Ganti foto profil" }).click();
        const pick = t.page.getByRole("dialog", { name: "Foto profil" });
        await pick.getByRole("radio", { name: "Singa" }).click();
        await pick.getByRole("button", { name: "Simpan" }).click();
        await pick.waitFor({ state: "detached" });
        await t.page.getByRole("dialog", { name: "Profil & Pengaturan" }).getByRole("button", { name: /Foto profil.*Singa/ }).waitFor();
        await t.page.keyboard.press("Escape");
        await t.page.getByRole("dialog", { name: "Profil & Pengaturan" }).waitFor({ state: "detached" });
        await t.page.getByRole("button", { name: "Profil dan pengaturan" }).locator('img[src*="animal-lion"]').waitFor();
      });
    },
  },
  {
    name: "leads: add, filter, follow-up, delete",
    async run(t) {
      await t.step("sign up", () => signup(t));
      await t.step("Simpan with no name says what is missing, Batal closes", async () => {
        await go(t.page, "Jualan", "Leads");
        await t.page.getByRole("button", { name: /tambah lead/i }).click();
        await modal(t.page).getByRole("button", { name: "Simpan lead" }).click();
        await modal(t.page).getByRole("alert").filter({ hasText: "Isi nama bisnisnya dulu." }).waitFor();
        await modal(t.page).getByRole("button", { name: "Batal" }).click();
        await t.page.locator(".modal-overlay").waitFor({ state: "detached" });
      });
      await t.step("add a lead", () => addLead(t.page, "Kopi Flow"));
      await t.step("filter Cold shows it", async () => { await t.page.locator("#status-filter").selectOption("Cold"); await expectText(t.page, "Kopi Flow"); });
      await t.step("open it and schedule a follow-up tomorrow", async () => {
        await t.page.locator("#status-filter").selectOption("All");
        await openLeadRow(t.page, "Kopi Flow");
        // Skor potensi (PRD-008 §2): contacted today + Rp 5 jt = 25, sangat rendah.
        await showWhy(t.page);
        await expectText(t.page, "Kenapa 25");
        await t.page.getByRole("button", { name: "Mereka bales hari ini" }).click();
        await expectText(t.page, "Kenapa 55");
        await t.page.getByRole("button", { name: /^Jadwal/ }).first().click();
        await t.page.getByPlaceholder(/Kirim portfolio/).fill("Kirim portfolio");
        await t.page.getByRole("button", { name: "Besok" }).click();
        await t.page.getByRole("button", { name: "Simpan jadwal" }).click();
        // Saved: the phone's sheet closes by itself; the panel's editor folds.
        await t.page.getByRole("button", { name: "Simpan jadwal" }).waitFor({ state: "detached" });
        await expectText(t.page, "Kenapa 75");
        await expectText(t.page, "Potensi tinggi");
        await closeAll(t.page);
      });
      await t.step("the Tinggi filter finds it", async () => {
        await go(t.page, "Jualan", "Leads");
        await t.page.getByRole("button", { name: /^Tinggi/ }).click();
        await expectText(t.page, "Kopi Flow");
        await t.page.getByRole("group", { name: "Saring menurut potensi" }).getByRole("button", { name: /^Semua/ }).click();
      });
      await t.step("it sits on the lead map as Cepat closing, and opens from there", async () => {
        await go(t.page, "Beranda");
        await t.page.getByRole("heading", { name: "Peta lead" }).first().waitFor();
        if (!isWide(t.page)) return; // the phone map is a picture; the list below it opens leads
        await t.page.getByRole("button", { name: "Kopi Flow, skor 75, Rp 5 jt, Cepat closing" }).click();
        await t.page.getByRole("region", { name: "Lead terpilih" }).getByRole("button", { name: "Buka lead" }).click();
        await expectText(t.page, "Kenapa 75");
        await closeAll(t.page);
      });
      await t.step("fill the profile by hand and get the script for that customer", async () => {
        await openLeadRow(t.page, "Kopi Flow");
        await t.page.getByRole("button", { name: "Isi manual" }).first().click();
        await t.page.locator("#pf-need").fill("Foto menu baru buat 2 cabang");
        await t.page.locator("#pf-obj").fill("Harganya kemahalan");
        await t.page.getByRole("button", { name: "Singa", exact: true }).click();
        await t.page.getByRole("button", { name: "Simpan profil" }).click();
        await expectText(t.page, "Foto menu baru buat 2 cabang");
        await fullProfile(t.page);
        await t.page.getByRole("button", { name: "Buka script Singa" }).click();
        await expectText(t.page, "Script: 💸 Harga Mahal");
        await closeAll(t.page);
      });
      await t.step("pull a WhatsApp chat export into the profile, keep only the summary", async () => {
        const d = (n) => { const x = new Date(Date.now() - n * 86400000); return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getFullYear()).slice(2)}`; };
        const chat = [
          `${d(12)} 10.01 - Aku: Halo kak, aku fotografer makanan. Boleh kirim portfolio?`,
          `${d(12)} 10.15 - Kopi Flow: Boleh. Berapa harganya? langsung aja`,
          `${d(12)} 10.20 - Aku: Paket mulai 1,5 jt kak`,
          `${d(2)} 11.40 - Kopi Flow: Bisa sekalian foto 2 cabang?`,
          `${d(1)} 09.00 - Kopi Flow: Boleh kirim pricelist-nya, Kak?`,
        ].join("\n");
        await openLeadRow(t.page, "Kopi Flow");
        await fullProfile(t.page);
        await t.page.getByRole("button", { name: "Tarik ulang dari WhatsApp" }).click();
        await t.page.getByLabel("File ekspor chat").setInputFiles({ name: "Chat WhatsApp dengan Kopi Flow.txt", mimeType: "text/plain", buffer: Buffer.from(chat) });
        await expectText(t.page, "Ketemu dari 5 pesan");
        await t.page.getByRole("switch", { name: /^Terakhir bales/ }).click();
        await t.page.getByRole("button", { name: /^Simpan \d bagian ke Kopi Flow$/ }).click();
        await expectText(t.page, "Pola chat");
        await expectText(t.page, "“Boleh kirim pricelist-nya, Kak?”");
        await expectText(t.page, "belum dijawab");
        await closeAll(t.page);
      });
      await t.step("the follow-up shows in Perlu Ditindak", async () => { await go(t.page, "Beranda"); await expectText(t.page, "Kirim portfolio"); });
      await t.step("a sheet closes on its own: Escape leaves the lead open", async () => {
        await openLeadRow(t.page, "Kopi Flow");
        await fullProfile(t.page);
        await t.page.getByRole("dialog", { name: /^Profil Kopi Flow/ }).getByRole("button", { name: /^Jadwal/ }).first().click();
        await t.page.getByRole("dialog", { name: "Langkah berikutnya" }).waitFor();
        await t.page.keyboard.press("Escape");
        await t.page.getByRole("dialog", { name: "Langkah berikutnya" }).waitFor({ state: "detached" });
        await t.page.getByRole("dialog", { name: /^Profil Kopi Flow/ }).waitFor({ timeout: 2000 });
        // The ⋯ menu closes on Escape without taking the page with it.
        await t.page.getByRole("dialog", { name: /^Profil Kopi Flow/ }).getByRole("button", { name: "Menu lead" }).click();
        await t.page.getByRole("menuitem", { name: "Ubah profil" }).waitFor();
        await t.page.keyboard.press("Escape");
        await t.page.getByRole("menuitem", { name: "Ubah profil" }).waitFor({ state: "detached" });
        await t.page.getByRole("dialog", { name: /^Profil Kopi Flow/ }).waitFor({ timeout: 2000 });
        await closeAll(t.page);
      });
      await t.step("delete asks first in a sheet, Batal keeps it, Hapus removes it", async () => {
        await openLeadRow(t.page, "Kopi Flow");
        await t.page.getByRole("button", { name: "Menu lead" }).first().click();
        await t.page.getByRole("menuitem", { name: "Hapus lead Kopi Flow" }).click();
        const ask = t.page.getByRole("dialog", { name: "Hapus lead?" });
        await ask.getByRole("button", { name: "Batal" }).click();
        await ask.waitFor({ state: "detached" });
        await t.page.locator(".lead-row", { hasText: "Kopi Flow" }).first().waitFor();
        await t.page.getByRole("button", { name: "Menu lead" }).first().click();
        await t.page.getByRole("menuitem", { name: "Hapus lead Kopi Flow" }).click();
        await ask.getByRole("button", { name: "Hapus", exact: true }).click();
        await t.page.locator(".lead-row", { hasText: "Kopi Flow" }).first().waitFor({ state: "detached", timeout: 8000 });
      });
    },
  },
  {
    name: "whatsapp: a chat shared from Android becomes a new lead's profile",
    serviceWorker: true,
    async run(t) {
      const { page, base } = t;
      await t.step("sign up", () => signup(t));
      await t.step("share a chat export the way Android's share sheet does", async () => {
        await page.evaluate(async () => {
          await navigator.serviceWorker.ready;
          for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
        });
        const chat = ["01/10/26 10.01 - Aku: Halo kak, boleh kirim portfolio?", "01/10/26 10.30 - Kopi Share: Boleh, berapa harganya?", "02/10/26 09.00 - Kopi Share: Bisa minggu depan?"].join("\n");
        await page.evaluate(async (txt) => {
          const fd = new FormData();
          fd.append("file", new File([txt], "Chat WhatsApp dengan Kopi Share.txt", { type: "text/plain" }));
          await fetch("/share-target", { method: "POST", body: fd });
        }, chat);
        await page.goto(`${base}/dashboard?share`);
        await page.getByText("Chat ini buat lead mana?").waitFor({ timeout: 15000 });
      });
      await t.step("make it a new lead and keep the summary", async () => {
        await page.getByRole("button", { name: "+ Lead baru: Kopi Share" }).click();
        await expectText(page, "Ketemu dari 3 pesan");
        await page.getByRole("button", { name: /^Simpan \d bagian ke Kopi Share$/ }).click();
        await fullProfile(page);
        await expectText(page, "Pola chat");
        await expectText(page, "“Bisa minggu depan?”");
      });
    },
  },
  {
    name: "lokasi lead: from an address, then fine-tuned on the map",
    async run(t) {
      const { page } = t;
      await stubMap(page);
      await page.route("**/api/geocode", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        hits: [{ lat: -6.2001, lng: 106.8166, label: "Kopi Lokasi Flow", address: "Jl. Contoh No. 7, Jakarta" }] }) }));
      await t.step("sign up and add a lead", async () => { await signup(t); await addLead(page, "Lokasi Flow"); });
      await t.step("the lead has no location yet", async () => {
        await page.locator(".lead-row", { hasText: "Lokasi Flow" }).first().click();
        await page.getByText("Belum ada lokasi").first().waitFor();
      });
      await t.step("search the address and pick the result", async () => {
        await page.getByRole("button", { name: "Atur lokasi" }).first().click();
        const sheet = page.getByRole("dialog", { name: "Lokasi lead" });
        await sheet.locator("#geo-addr").fill("Kopi Lokasi Flow Jakarta");
        await sheet.getByRole("button", { name: "Cari", exact: true }).click();
        await t.audit("Lokasi lead sheet with a result");
        await sheet.getByRole("list", { name: "Hasil alamat" }).getByRole("button", { name: /Kopi Lokasi Flow/ }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByText("Jl. Contoh No. 7, Jakarta").first().waitFor();
        await page.getByText(/Muncul di Peta 3D · dari alamat/).first().waitFor();
      });
      await t.step("move the pin on the map", async () => {
        await page.getByRole("button", { name: "Ubah", exact: true }).first().click();
        const sheet = page.getByRole("dialog", { name: "Lokasi lead" });
        await sheet.getByRole("button", { name: "Pakai titik ini" }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByText(/Muncul di Peta 3D · ditandai di peta/).first().waitFor();
      });
      await t.step("paste a Google Maps link: the point is read on the phone", async () => {
        await page.getByRole("button", { name: "Ubah", exact: true }).first().click();
        const sheet = page.getByRole("dialog", { name: "Lokasi lead" });
        const link = "https://www.google.com/maps/place/Kopi+Tempel+Flow/@-6.22,106.84,17z/data=!3m1!4b1!8m2!3d-6.2253771!4d106.8487123";
        await sheet.locator("#geo-addr").evaluate((el, text) => {
          const data = new DataTransfer();
          data.setData("text/plain", text);
          el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
        }, link);
        await sheet.getByRole("list", { name: "Hasil alamat" }).getByRole("button", { name: /Kopi Tempel Flow/ }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByText(/Muncul di Peta 3D · dari link peta/).first().waitFor();
      });
    },
  },
  {
    name: "sell: package → quote → accepted → invoice → DP",
    async run(t) {
      const { page } = t;
      await t.step("sign up", () => signup(t));
      await t.step("add a lead", () => addLead(page, "Bakso Flow"));
      await t.step("fill in Info bisnis", async () => {
        await go(page, "Jualan", "Paket");
        await page.getByRole("button", { name: "Kop & logo" }).click();
        await page.getByRole("button", { name: "Pakai logo Visufavor" }).click();
        await modal(page).getByRole("img", { name: "Logo" }).waitFor();
        await page.locator("#biz-name").fill("Studio Flow");
        await page.locator("#biz-tagline").fill("Fotografi menu");
        await page.locator("#biz-phone").fill("08123456789");
        await page.locator("#biz-bank").fill("BCA");
        await page.locator("#biz-accountNo").fill("1234567");
        await page.locator("#biz-accountName").fill("Flow");
        await page.locator("#biz-footer").fill("DP mengunci jadwal.");
        await page.locator("#biz-doc-dpWhen").fill("saat booking");
        await page.locator("#biz-doc-finalWhen").fill("H-1 acara");
        await page.locator("#biz-doc-revisions").fill("1x revisi minor");
        await page.locator("#biz-doc-spkAuto").check();
        await page.getByRole("button", { name: "Simpan kop" }).click();
        await page.locator("#biz-name").waitFor({ state: "detached" });
      });
      await t.step("add a package", async () => {
        await page.getByRole("button", { name: "+ Paket" }).click();
        const ins = modal(page).locator("input");
        await ins.nth(0).fill("Foto Menu Flow"); await ins.nth(1).fill("1500000");
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await expectText(page, "Foto Menu Flow");
      });
      await t.step("create a quote for the lead from the package", async () => {
        await go(page, "Jualan", "Penawaran");
        await page.getByRole("button", { name: "+ Penawaran" }).click();
        const sel = modal(page).locator("select").first();
        await sel.selectOption(await sel.locator("option", { hasText: "Bakso Flow" }).getAttribute("value"));
        await modal(page).locator("select", { has: page.locator('option:text("+ dari paket…")') }).selectOption({ index: 1 });
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await expectText(page, "Rp 1.500.000");
      });
      await t.step("send the quote with its SPK, filled from the quote and the defaults", async () => {
        await page.getByRole("button", { name: "Kirim penawaran" }).click();
        const sheet = page.getByRole("dialog", { name: "Kirim penawaran" });
        await sheet.getByRole("checkbox", { name: /Perjanjian Kerja/ }).waitFor();
        await sheet.getByText("Lihat & ubah isi Perjanjian Kerja").click();
        const body = await sheet.locator("#spk-body").inputValue();
        for (const want of ["Bakso Flow", "Studio Flow", "Rp 1.500.000", "saat booking", "H-1 acara", "1x revisi minor"]) if (!body.includes(want)) throw new Error(`SPK text is missing "${want}"`);
        const downloads = [];
        page.on("download", d => downloads.push(d));
        await sheet.getByText("Lampirkan PDF (2)").waitFor();
        await sheet.getByRole("button", { name: "Bagikan PDF" }).click();
        for (let i = 0; i < 100 && downloads.length < 2; i++) await page.waitForTimeout(100);
        if (downloads.length !== 2) throw new Error(`expected 2 PDFs (quote + SPK), got ${downloads.length}`);
        // Sending through your own WhatsApp is the send: logged at once, with Batal.
        await sheet.getByText(/Penawaran Q-\S+ tercatat terkirim/).waitFor();
        await sheet.getByRole("button", { name: "Batal", exact: true }).click();
        await sheet.getByText("Dibatalin, belum tercatat terkirim.").waitFor();
        await sheet.getByRole("button", { name: "Bagikan PDF" }).click();
        await sheet.getByText(/Penawaran Q-\S+ tercatat terkirim/).waitFor();
        await sheet.getByRole("button", { name: "Selesai" }).click();
        await sheet.waitFor({ state: "detached" });
        const spk = downloads.find(d => d.suggestedFilename().startsWith("SPK-"));
        if (!spk) throw new Error(`files: ${downloads.map(d => d.suggestedFilename()).join(", ")}`);
        const { readFileSync } = await import("node:fs");
        const pdf = readFileSync(await spk.path()).toString("latin1");
        for (const want of ["PERJANJIAN KERJA", "Bakso Flow", "PIHAK KEDUA", "Pihak Pertama"]) if (!pdf.includes(want)) throw new Error(`SPK PDF is missing "${want}"`);
        await page.getByText("Perjanjian Kerja · dikirim, belum ditandatangani").waitFor();
        await page.getByText("Terkirim").first().waitFor();
      });
      await t.step("signing is marked by hand, then the quote is accepted", async () => {
        await page.getByRole("button", { name: "Tandai SPK ditandatangani" }).click();
        await page.getByText(/Perjanjian Kerja · ditandatangani/).waitFor();
        await page.getByRole("button", { name: "✓ Disetujui" }).click();
        await page.getByRole("button", { name: "Buat invoice DP 50% →" }).waitFor();
      });
      await t.step("a sent quote keeps the letterhead it went out with", async () => {
        await go(page, "Jualan", "Paket");
        await page.getByRole("button", { name: "Kop & logo" }).click();
        await page.locator("#biz-name").fill("Studio Baru");
        await page.getByRole("button", { name: "Simpan kop" }).click();
        await page.locator("#biz-name").waitFor({ state: "detached" });
        await go(page, "Jualan", "Penawaran");
        await page.getByRole("button", { name: "PDF", exact: true }).first().click();
        await page.locator(".print-root").getByText("Studio Flow").first().waitFor();
        await page.getByText(/Kop dan syarat di dokumen ini dikunci/).waitFor();
        await modal(page).getByRole("button", { name: "Tutup", exact: true }).click();
        await go(page, "Jualan", "Paket");
        await page.getByRole("button", { name: "Kop & logo" }).click();
        await page.locator("#biz-name").fill("Studio Flow");
        await page.getByRole("button", { name: "Simpan kop" }).click();
        await page.locator("#biz-name").waitFor({ state: "detached" });
        await go(page, "Jualan", "Penawaran");
      });
      await t.step("accepting closed the lead", async () => { await go(page, "Jualan", "Leads"); await page.locator(".lead-row", { hasText: "Bakso Flow" }).getByText("Closed").first().waitFor(); });
      await t.step("raise the DP invoice: one term, as a draft", async () => {
        await go(page, "Jualan", "Penawaran");
        await page.getByRole("button", { name: "Buat invoice DP 50% →" }).click();
        await page.getByRole("button", { name: "Buat invoice Pelunasan 50% →" }).waitFor();
        await go(page, "Jualan", "Invoice");
        await expectText(page, "DP 50%");
        await page.getByRole("button", { name: "Terbitkan" }).waitFor();
      });
      await t.step("Tagih via WA: words and PDF through your WhatsApp; sending issues it, Batal takes it back", async () => {
        const downloads = [];
        const grab = d => downloads.push(d);
        page.on("download", grab);
        await page.getByRole("button", { name: "Tagih via WA" }).first().click();
        const sheet = page.getByRole("dialog", { name: /^Tagih INV-/ });
        await sheet.locator("#wa-text").waitFor();
        if (!(await sheet.locator("#wa-text").inputValue()).includes("INVOICE")) throw new Error("the bill's words are missing");
        await sheet.getByText("Lampirkan PDF (1)").waitFor();
        await sheet.getByRole("button", { name: "Bagikan PDF" }).click();
        await sheet.getByText(/diterbitkan dan tercatat terkirim/).waitFor();
        if (!downloads.some(d => d.suggestedFilename().startsWith("INV-"))) throw new Error(`files: ${downloads.map(d => d.suggestedFilename()).join(", ")}`);
        await sheet.getByRole("button", { name: "Batal", exact: true }).click();
        await sheet.getByText("Dibatalin, belum tercatat terkirim.").waitFor();
        await sheet.getByRole("button", { name: "Tutup" }).last().click();
        await sheet.waitFor({ state: "detached" });
        page.off("download", grab);
        await page.getByRole("button", { name: "Terbitkan" }).waitFor();
      });
      await t.step("money in issues the draft and settles the DP term", async () => {
        await page.getByRole("button", { name: "+ Catat pembayaran" }).click();
        await modal(page).locator("#pay-amount").fill("750000");
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await page.getByText("Lunas").first().waitFor();
        await page.getByRole("button", { name: "Terbitkan" }).waitFor({ state: "detached" });
      });
      await t.step("the quote shows what's received and what's left", async () => {
        await go(page, "Jualan", "Penawaran");
        const m = page.getByRole("group", { name: "Uang penawaran ini" });
        await m.getByText("Rp 750.000").first().waitFor();
      });
      await t.step("an accepted quote changes by revision; the DP already billed carries over", async () => {
        await page.getByRole("button", { name: "Revisi", exact: true }).click();
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await page.getByText(/^Revisi dari /).waitFor();
        await page.getByText(/-r1 ·/).waitFor();
        await page.getByRole("button", { name: "Tandai terkirim" }).click();
        await page.getByRole("button", { name: "✓ Disetujui" }).click();
        await page.getByText(/^Digantikan .* \(yang berlaku\)/).waitFor();
        await page.getByRole("button", { name: "Buat invoice Pelunasan 50% →" }).waitFor();
        if (await page.getByRole("button", { name: "Buat invoice DP 50% →" }).count()) throw new Error("the revision offers the DP again");
        await go(page, "Jualan", "Invoice");
      });
      await t.step("money this month opens to the payments behind it", async () => {
        await page.getByRole("button", { name: /^Rp 750(\.000| rb) Masuk / }).click();
        await page.getByRole("region", { name: /^Uang masuk/ }).getByText("Bakso Flow").waitFor();
      });
      await t.step("the PDF carries the letterhead and the terms", async () => {
        await page.getByRole("button", { name: "PDF", exact: true }).first().click();
        await page.locator(".print-root").getByText("Fotografi menu").waitFor();
        await page.locator(".print-root").getByText("SYARAT & KETENTUAN").waitFor();
      });
      await t.step("Simpan / kirim PDF hands over a real PDF file", async () => {
        // No share sheet in the test browser, so it falls back to a download.
        const [dl] = await Promise.all([
          page.waitForEvent("download", { timeout: 15000 }),
          page.getByRole("button", { name: "Simpan / kirim PDF" }).click(),
        ]);
        if (!/^INV-.*Bakso_Flow\.pdf$/.test(dl.suggestedFilename())) throw new Error(`file name: ${dl.suggestedFilename()}`);
        const { readFileSync } = await import("node:fs");
        await dl.saveAs(new URL("./out/invoice-sample.pdf", import.meta.url).pathname);
        const bytes = readFileSync(await dl.path());
        if (bytes.subarray(0, 5).toString() !== "%PDF-" || bytes.length < 2000) throw new Error(`not a PDF (${bytes.length} bytes)`);
        const body = bytes.toString("latin1");
        for (const want of ["Studio Flow", "Fotografi menu", "SYARAT & KETENTUAN", "DP mengunci jadwal.", "/Subtype /Image"]) if (!body.includes(want)) throw new Error(`PDF is missing "${want}"`);
      });
      await t.step("a closing without a quote: + Invoice with the job's details", async () => {
        await modal(page).getByRole("button", { name: "Tutup", exact: true }).click();
        await page.getByRole("button", { name: "+ Invoice" }).click();
        await page.locator("#doc-client").fill("Kafe Flow");
        await page.locator("#doc-project").fill("Event photography — Flow Night");
        await page.locator("#doc-event").fill("2026-10-31");
        await page.locator("#doc-time").fill("13.30–15.00 WIB");
        await page.locator("#doc-venue").fill("Jl. Flow No. 1");
        await modal(page).getByRole("button", { name: "+ item manual" }).click();
        await modal(page).getByLabel("Nama item").fill("Event photography");
        await modal(page).getByLabel("Harga").fill("300000");
        await modal(page).getByLabel("Rincian item").fill("Workshop, candid, suasana acara");
        await page.locator("#doc-deliverables").fill("Foto event hasil edit\n1 reel recap");
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await page.locator("#doc-client").waitFor({ state: "detached" });
        await expectText(page, "Event photography — Flow Night");
      });
      await t.step("its PDF has every part in place, named after the invoice", async () => {
        const card = page.locator("div").filter({ has: page.getByText("Kafe Flow", { exact: true }) }).filter({ has: page.getByRole("button", { name: "PDF", exact: true }) }).last();
        await card.getByRole("button", { name: "PDF", exact: true }).click();
        await page.locator(".print-root").getByText("DETAIL ACARA").waitFor();
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.getByRole("button", { name: "Simpan / kirim PDF" }).click()]);
        if (!/^INV-\d{4}-\d{3}_Kafe_Flow\.pdf$/.test(dl.suggestedFilename())) throw new Error(`file name: ${dl.suggestedFilename()}`);
        await dl.saveAs(new URL("./out/invoice-brief-sample.pdf", import.meta.url).pathname);
        const { readFileSync } = await import("node:fs");
        const body = readFileSync(await dl.path()).toString("latin1");
        for (const want of ["Flow Night", "DETAIL ACARA", "Jl. Flow No. 1", "LAYANAN & SCOPE", "Workshop, candid", "DELIVERABLES", "1 reel recap"]) if (!body.includes(want)) throw new Error(`PDF is missing "${want}"`);
        await modal(page).getByRole("button", { name: "Tutup", exact: true }).click();
      });
      await t.step("Kop & logo over the PDF: back closes Kop, then the PDF", async () => {
        await page.getByRole("button", { name: "PDF", exact: true }).first().click();
        await page.getByRole("button", { name: "Kop & logo" }).click();
        await page.locator("#biz-name").waitFor();
        await page.goBack();
        await page.locator("#biz-name").waitFor({ state: "detached" });
        await page.locator(".print-root").waitFor();
        await page.goBack();
        await page.locator(".print-root").waitFor({ state: "detached" });
        if (!page.url().includes("/dashboard")) throw new Error(`left the app: ${page.url()}`);
      });
      await t.step("Report Klien shows this month's sales from invoices", async () => {
        await go(page, "Tim", "Report Klien");
        await page.getByRole("heading", { name: /^Penjualan / }).waitFor();
        await page.getByRole("table").getByText("Bakso Flow").first().waitFor();
      });
      await t.step("a changed form asks before throwing it away", async () => {
        await go(page, "Jualan", "Invoice");
        await page.getByRole("button", { name: "Edit", exact: true }).first().click();
        await page.locator("#doc-project").fill("Judul baru");
        await page.keyboard.press("Escape");
        const ask = page.getByRole("dialog", { name: "Buang perubahan?" });
        await ask.getByRole("button", { name: "Batal" }).click();
        await ask.waitFor({ state: "detached" });
        if (await page.locator("#doc-project").inputValue() !== "Judul baru") throw new Error("Batal lost what was typed");
        await page.keyboard.press("Escape");
        await ask.getByRole("button", { name: "Buang" }).click();
        await page.locator("#doc-project").waitFor({ state: "detached" });
      });
      await t.step("deleting asks in the app: Batal keeps, Hapus removes", async () => {
        await go(page, "Jualan", "Penawaran");
        await page.getByRole("button", { name: /^Hapus Q-/ }).first().click();
        const ask = page.getByRole("dialog", { name: "Hapus penawaran?" });
        await ask.getByRole("button", { name: "Batal" }).click();
        await ask.waitFor({ state: "detached" });
        await page.getByRole("button", { name: /^Hapus Q-/ }).first().waitFor();
        await go(page, "Jualan", "Invoice");
        await page.getByRole("button", { name: /^Hapus pembayaran/ }).first().click();
        await page.getByRole("dialog", { name: "Hapus pembayaran?" }).getByRole("button", { name: "Hapus", exact: true }).click();
        await page.getByRole("dialog", { name: "Hapus pembayaran?" }).waitFor({ state: "detached" });
        await page.getByText("+Rp 750.000").first().waitFor({ state: "detached" });
      });
      await t.step("a payment's date changes with Simpan, and Batal leaves it", async () => {
        await page.getByRole("button", { name: "+ Catat pembayaran" }).first().click();
        await modal(page).locator("#pay-amount").fill("");
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await modal(page).getByText("Isi jumlahnya dulu.").waitFor();
        await modal(page).locator("#pay-amount").fill("100000");
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await page.locator("#pay-amount").waitFor({ state: "detached" });
        await page.getByRole("button", { name: /^Ganti tanggal pembayaran/ }).first().click();
        await page.getByRole("button", { name: "Batal", exact: true }).click();
        await page.getByRole("button", { name: /^Ganti tanggal pembayaran/ }).first().click();
        await page.getByLabel(/^Tanggal uang masuk/).first().fill("2026-01-02");
        await page.getByRole("button", { name: "Simpan", exact: true }).click();
        await page.getByRole("button", { name: /^Ganti tanggal pembayaran 2 Jan 2026/ }).waitFor();
      });
    },
  },
  {
    // PRD-010: a busy seller's account (200 leads, 50 invoices, 60 prospects…).
    // Every place must open, stay usable, and pass the HIG audit with real volume.
    name: "akun besar: every place with production-size data",
    async run(t) {
      const { page, project } = t;
      let email = "";
      await t.step("sign up", async () => { email = await signup(t); });
      await t.step("seed a production-size account", async () => {
        const uid = await uidOf(project, email);
        if (!uid) throw new Error(`no emulator user for ${email}`);
        await seedDocs(project, bigAccount(uid));
        await page.reload();
        await page.waitForURL("**/dashboard");
      });
      await t.step("Peta 3D: leads with a point show as pins; a pin opens its card with Rute", async () => {
        await stubMap(page);
        await go(page, "Beranda");
        const map = page.locator(isWide(page) ? ".sp-only-desk" : "section.sp-only-phone").filter({ has: page.getByRole("group", { name: "Mode peta" }) }).first();
        await map.getByRole("button", { name: "Peta 3D" }).click();
        const pins = map.locator(".sp-pin");
        await pins.first().waitFor({ timeout: 15000 });
        // A lead typed from its chat wears its character, on the pin and on the card.
        await map.locator(".sp-pin.typed img").first().waitFor();
        // The rest show their category as a coloured icon.
        await map.locator(".sp-pin.cat svg").first().waitFor();
        await map.locator(".sp-pin.typed").last().click();
        const card = map.getByRole("region", { name: /^Lead / });
        await card.getByText(/^(Burung Hantu|Singa|Lumba-Lumba|Kelinci)$/).waitFor();
        await card.getByRole("link", { name: /Rute/ }).waitFor();
        await t.audit("Beranda → Peta 3D with a lead card (big account)");
        await card.getByRole("button", { name: "Tutup kartu lead" }).click();
        await map.getByRole("button", { name: /belum ada lokasinya/ }).waitFor();
        await map.getByRole("button", { name: "Potensi" }).click();
      });
      await t.step("Perlu ditindak is a bounded queue: ten cards, the rest in a sheet that scrolls itself", async () => {
        await go(page, "Beranda");
        const queue = page.locator(".sp-todo");
        await queue.locator(".sp-task").first().waitFor({ timeout: 15000 });
        const cards = await queue.locator("article.sp-task").count();
        if (cards > 10) throw new Error(`${cards} cards on Beranda`);
        if (!isWide(page)) {
          const { sw, cw } = await queue.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
          if (sw <= cw) throw new Error("the queue does not swipe sideways");
          await queue.getByRole("button", { name: /Lihat semua \d+/ }).waitFor({ state: "attached" });
        }
        await page.getByRole("button", { name: "Lihat semua", exact: true }).first().click();
        const sheet = page.getByRole("dialog", { name: /^Perlu ditindak/ });
        const rows = await sheet.locator("li").count();
        if (rows <= cards) throw new Error(`the sheet lists ${rows}, the queue shows ${cards}`);
        const own = await sheet.locator(".sp-todo-list").evaluate(e => e.scrollHeight > e.clientHeight && getComputedStyle(e).overflowY === "auto");
        if (!own) throw new Error("the sheet's list does not scroll on its own");
        await t.audit("Beranda → Lihat semua sheet (big account)");
        await sheet.getByRole("button", { name: "Tutup" }).click();
        await sheet.waitFor({ state: "detached" });
      });
      const places = [
        ["Beranda", null, /Usaha Contoh|perlu ditindak/i],
        ["Hunting", null, /contoh_0/],
        ["Jualan", "Leads", /Usaha Contoh 1/],
        ["Jualan", "Penawaran", /Q-BIG-/],
        ["Jualan", "Invoice", /INV-BIG-/],
        ["Tim", "Report Klien", /Penjualan/],
      ];
      for (const [place, tab, want] of places) {
        await t.step(`${place}${tab ? ` → ${tab}` : ""} opens with its data`, async () => {
          const t0 = Date.now();
          await go(page, place, tab);
          if (place === "Hunting") await pane(page, "Journey");
          await page.getByText(want).first().waitFor({ timeout: 15000 });
          const ms = Date.now() - t0;
          if (ms > 8000) throw new Error(`took ${ms} ms to show`);
        });
        await t.audit(`${place}${tab ? ` → ${tab}` : ""} (big account)`);
      }
      await t.step("search 200 leads", async () => {
        await go(page, "Jualan", "Leads");
        await page.locator("#lead-search").fill("Contoh 137");
        await page.locator(".lead-row", { hasText: "Usaha Contoh 137" }).first().waitFor();
        if (await page.locator(".lead-row").count() > 3) throw new Error("search did not narrow the list");
      });
      await t.step("find a prospect by ID among 60", async () => {
        await go(page, "Hunting");
        await pane(page, "Journey");
        await page.getByLabel("Cari prospek pakai ID atau @username").fill("contoh_042");
        await expectText(page, "1 ketemu");
      });
      await t.step("the month's occupancy opens from one toggle", async () => {
        await go(page, "Jualan", "Invoice");
        const cal = page.getByRole("region", { name: "Kalender okupansi" });
        const toggle = cal.getByRole("button", { name: /^Kalender .* hari terisi/ });
        await toggle.click();
        await cal.getByRole("grid", { name: /^Okupansi / }).waitFor();
        await cal.getByRole("gridcell").filter({ hasText: /job/ }).first().click();
        await cal.getByRole("status").getByText(/Usaha Contoh/).first().waitFor();
        await toggle.click();
        if ((await toggle.getAttribute("aria-expanded")) !== "false") throw new Error("the calendar did not close");
      });
      await t.step("search finds a lead by part of its phone number", async () => {
        await go(page, "Jualan", "Leads");
        await page.locator("#lead-search").fill("13737");
        await page.locator(".lead-row", { hasText: "Usaha Contoh 137" }).first().waitFor();
        if (await page.locator(".lead-row").count() !== 1) throw new Error("phone search did not find exactly one lead");
        await page.locator("#lead-search").fill("");
      });
      await t.step("quick views and sort answer the daily questions", async () => {
        await page.getByRole("group", { name: "Tampilan cepat" }).getByRole("button", { name: /^Telat \d+/ }).click();
        await page.locator(".lead-row").first().waitFor();
        await page.locator("#lead-sort").selectOption("nilai");
        await page.getByRole("group", { name: "Tampilan cepat" }).getByRole("button", { name: /^Semua/ }).click();
      });
      await t.step("follow-up one lead after another, without going back to the list", async () => {
        const run = page.getByRole("button", { name: /Follow-up beruntun/ });
        const total = Number((await run.textContent()).match(/\d+/)[0]);
        await run.click();
        const sheet = page.getByRole("dialog", { name: "Follow-up beruntun" });
        await sheet.getByText(`1 dari ${total}`).waitFor();
        await sheet.getByRole("button", { name: "Besok" }).click();
        await sheet.getByText(`2 dari ${total}`).waitFor();
        await sheet.getByRole("button", { name: "💬 Dibales" }).click();
        await sheet.getByText(`3 dari ${total}`).waitFor();
        await sheet.getByRole("button", { name: "Lewati →" }).click();
        await sheet.getByRole("button", { name: "Tutup" }).first().click();
        await sheet.waitFor({ state: "detached" });
        const left = Number((await run.textContent()).match(/\d+/)[0]);
        if (left !== total - 2) throw new Error(`queue ${total} → ${left}, expected ${total - 2}`);
      });
    },
  },
  {
    // QA 15 Okt: in the installed app there is no browser back button, and a
    // tall dialog on a small phone hid its way out. Every dialog here must show
    // a way out, reach its last button, and close on the phone's back.
    name: "dialogs: × visible, last button reachable, back closes (small phone)",
    async run(t) {
      const { page } = t;
      if (!isWide(page)) await page.setViewportSize({ width: 375, height: 667 });
      const top = () => page.locator(".modal-overlay").last();
      async function check(label, open, { last, layers = 1 } = {}) {
        await t.step(`${label}: open, × and last button in reach`, async () => {
          await open();
          await top().waitFor();
          const x = top().getByRole("button", { name: /^(Tutup|Kembali)/ }).first();
          await x.waitFor();
          const vh = page.viewportSize().height;
          const box = await x.boundingBox();
          if (!box || box.y < 0 || box.y + box.height > vh) throw new Error(`the way out is off screen (y=${box?.y})`);
          if (!isWide(page)) {
            // A phone form: the sheet fills the screen, and no field crowds another.
            const bad = await top().evaluate((ov) => {
              const box = ov.querySelector("[aria-modal]");
              // The sheet must fill the space it has (a desktop-Linux WebKit scrollbar can take 4px of it; iOS has none).
              const vw = ov.clientWidth || document.documentElement.clientWidth, out = [];
              const r0 = box.getBoundingClientRect();
              if (ov.matches(":not(.print-overlay):not(.sp-leadpage):not([style*='flex-end'])") && (r0.width < vw - 1 || r0.left > 1)) out.push(`sheet is ${Math.round(r0.width)}px of ${vw}`);
              const fields = [...box.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea")].filter(e => e.offsetParent);
              const rects = fields.map(e => [e, e.getBoundingClientRect()]);
              for (const [e, r] of rects) {
                const name = e.getAttribute("aria-label") || e.id || e.name || e.tagName;
                if (r.right > vw + 1 || r.left < -1) out.push(`${name} spills off screen`);
                if (parseFloat(getComputedStyle(e).fontSize) < 16) out.push(`${name} text under 16px`);
                if (e.tagName !== "TEXTAREA" && r.height < 44) out.push(`${name} only ${Math.round(r.height)}px tall`);
              }
              for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
                const [a, b] = [rects[i][1], rects[j][1]];
                if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${rects[i][0].id || rects[i][0].getAttribute("aria-label")} overlaps ${rects[j][0].id || rects[j][0].getAttribute("aria-label")}`);
              }
              return out;
            });
            if (bad.length) throw new Error(bad.slice(0, 4).join("; "));
          }
          if (last) {
            const b = top().getByRole("button", { name: last, exact: true }).last();
            await b.scrollIntoViewIfNeeded();
            const r = await b.boundingBox();
            if (!r || r.y + r.height > vh + 1) throw new Error(`"${last}" can't be reached (y=${r?.y})`);
          }
        });
        await t.step(`${label}: back closes it and stays in the app`, async () => {
          const before = await page.locator(".modal-overlay").count();
          await page.goBack();
          await page.waitForFunction((n) => document.querySelectorAll(".modal-overlay").length === n, before - 1, { timeout: 5000 });
          if (!page.url().includes("/dashboard")) throw new Error(`left the app: ${page.url()}`);
          for (let i = 1; i < layers; i++) { await page.goBack(); await page.waitForFunction((n) => document.querySelectorAll(".modal-overlay").length === n, before - 1 - i, { timeout: 5000 }); }
        });
      }
      await t.step("sign up", () => signup(t));
      await check("Tambah lead", async () => { await go(page, "Jualan", "Leads"); await page.getByRole("button", { name: /tambah lead/i }).click(); }, { last: "Simpan lead" });
      // A lead's sheets: above the lead page, each with its own way out.
      const leadDlg = () => page.getByRole("dialog", { name: /^Profil Kopi Dialog/ });
      await check("Jadwal lead", async () => { await addLead(page, "Kopi Dialog"); await openLeadRow(page, "Kopi Dialog"); await fullProfile(page); await leadDlg().getByRole("button", { name: /^Jadwal/ }).first().click(); }, { last: "Simpan jadwal" });
      await check("Profil lead", () => leadDlg().getByRole("button", { name: "Isi manual" }).click(), { last: "Simpan profil" });
      await check("Tarik dari WhatsApp", () => leadDlg().getByRole("button", { name: "Tarik dari WhatsApp" }).first().click());
      await t.step("close the lead", () => closeAll(page));
      await check("Profil", () => page.getByRole("button", { name: "Profil dan pengaturan" }).click());
      await check("Kop & logo", async () => { await go(page, "Jualan", "Paket"); await page.getByRole("button", { name: "Kop & logo" }).click(); }, { last: "Simpan kop" });
      await t.step("a brand logo fills the letterhead", async () => {
        await go(page, "Jualan", "Paket");
        await page.getByRole("button", { name: "Kop & logo" }).click();
        await page.getByRole("button", { name: "Pakai logo Visufavor" }).click();
        await top().getByRole("img", { name: "Logo" }).waitFor();
        if (await page.locator("#biz-name").inputValue() !== "Visufavor") throw new Error("name not filled from the brand");
        await top().getByRole("button", { name: "Tutup" }).first().click();
        await page.locator("#biz-name").waitFor({ state: "detached" });
      });
      await check("Paket baru", async () => { await go(page, "Jualan", "Paket"); await page.getByRole("button", { name: "+ Paket" }).click(); }, { last: "Batal" });
      await check("Penawaran baru", async () => { await go(page, "Jualan", "Penawaran"); await page.getByRole("button", { name: "+ Penawaran" }).first().click(); }, { last: "Batal" });
      await check("Invoice baru", async () => { await go(page, "Jualan", "Invoice"); await page.getByRole("button", { name: "+ Invoice" }).first().click(); }, { last: "Simpan" });
      await t.step("typing in the invoice form keeps the field focused", async () => {
        await go(page, "Jualan", "Invoice");
        await page.getByRole("button", { name: "+ Invoice" }).first().click();
        await page.locator("#doc-project").click();
        await page.keyboard.type("Wedding Dina");
        if (await page.locator("#doc-project").inputValue() !== "Wedding Dina") throw new Error("typing lost focus");
        await page.locator("#doc-event").fill("2026-11-07");
        await top().getByRole("button", { name: "Tutup" }).first().click();
        await page.getByRole("dialog", { name: "Buang perubahan?" }).getByRole("button", { name: "Buang" }).click();
        await page.locator("#doc-project").waitFor({ state: "detached" });
      });
      await check("Klien baru", async () => { await go(page, "Tim", "Report Klien"); await page.getByRole("button", { name: /^\+ (Tambah k|K)lien$/ }).first().click(); }, { last: "Simpan klien" });
      await check("Catat outreach", async () => { await go(page, "Tim", "Outreach"); await page.getByRole("button", { name: "+ Catat outreach" }).first().click(); }, { last: "Simpan" });
      await check("Catat penolakan", async () => { await go(page, "Tim", "Rejection Log"); await page.getByRole("button", { name: "+ Catat penolakan" }).first().click(); }, { last: "Simpan" });
      await check("Bikin guild", async () => { await go(page, "Tim", "Guild"); await page.getByRole("button", { name: "+ Bikin guild" }).click(); }, { last: "Bikin guild" });
      await check("Template baru", async () => { await go(page, "Hunting"); await page.getByRole("button", { name: "+ Template" }).click(); }, { last: "Batal" });
      await check("Quick Pitch", async () => { await go(page, "Jualan", "Leads"); await page.getByRole("button", { name: /Quick Pitch/ }).click(); });
    },
  },
  {
    name: "hunting: paste a link, log DMs, statuses, lead, goal",
    async run(t) {
      const { page } = t;
      await t.step("sign up and open Hunting", async () => { await mockUnfurl(page); await signup(t); await go(page, "Hunting"); await expectText(page, "Cold DM — Tawarin Jasa"); });
      await t.step("Radar shows as coming soon", () => expectText(page, "Segera hadir"));
      await t.step("paste a Threads link fills target and platform", async () => {
        const link = "https://www.threads.com/@kopiflow/post/abc";
        if (isWide(page)) {
          // Desktop: ⌘V straight into the field, no clipboard prompt and no button.
          if (await page.getByRole("button", { name: /Tempel link profil/ }).isVisible()) throw new Error("the touch-only paste button shows on desktop");
          await page.locator("#hunt-target").evaluate((el, text) => { const dt = new DataTransfer(); dt.setData("text", text); el.focus(); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, link);
        } else {
          await page.evaluate((l) => navigator.clipboard.writeText(l), link);
          await page.getByRole("button", { name: /Tempel link/ }).click();
        }
        await page.waitForFunction(() => document.querySelector("#hunt-target")?.value === "@kopiflow", null, { timeout: 5000 });
        await page.getByRole("radio", { name: "Threads", checked: true }).waitFor();
      });
      await t.step("nothing floats over the Kirim WA button", async () => {
        const hit = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^(Kirim WA|Copy & )/.test(x.textContent.trim())); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.right - 8, r.top + r.height / 2); return b.contains(top) ? "" : (top?.getAttribute("aria-label") || top?.textContent || "?").slice(0, 40); });
        if (hit) throw new Error(`covered by "${hit}"`);
      });
      await t.step("copy a template: it is logged at once", async () => {
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await page.getByRole("button", { name: "Batal catat" }).waitFor();
      });
      await t.step("the person stays on screen after the send, short, with an ID under Detail", async () => {
        if (await page.locator("#hunt-target").inputValue() !== "@kopiflow") throw new Error("target cleared after sending");
        const card = page.getByLabel("Prospek @kopiflow");
        await card.getByRole("button", { name: "Detail ▾" }).click();
        await card.getByRole("button", { name: /Salin ID prospek Threads_kopiflow/ }).waitFor();
        await card.getByRole("button", { name: "Ringkas ▴" }).click();
      });
      await t.step("the log row says when it went out and what to do next", async () => {
        await openLog(page);
        await page.getByRole("link", { name: "Profil ↗" }).first().waitFor();
        await huntRow(page, "@kopiflow").getByText(/(DM|balas di post) hari ini \d{2}\.\d{2}/).waitFor();
        await huntRow(page, "@kopiflow").getByText("Nunggu balasan. Begitu dia bales, tandai di bawah.").waitFor();
        await huntRow(page, "@kopiflow").getByRole("button", { name: "Tandai Ga dibales" }).waitFor();
      });
      await t.step("mark it Tertarik and make it a lead", async () => {
        await page.getByRole("button", { name: "Tandai Tertarik" }).first().click();
        await page.getByRole("button", { name: "Jadiin Lead →" }).click();
        await expectText(page, "✓ Sudah jadi lead");
      });
      await t.step("log a second DM, decline it with a reason", async () => {
        await pane(page, "Kirim");
        await page.locator("#hunt-target").fill("@rotiflow");
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await openLog(page);
        await page.getByRole("button", { name: "Hapus DM ke @rotiflow" }).click();
        // Asked in the app, not the browser's confirm(): Batal keeps the row.
        const ask = page.getByRole("dialog", { name: "Hapus catatan DM?" });
        await ask.getByRole("button", { name: "Batal" }).click();
        await ask.waitFor({ state: "detached" });
        await huntRow(page, "@rotiflow").getByRole("button", { name: "Tandai Ditolak" }).click();
        await page.getByLabel("Alasan ditolak").fill("udah punya fotografer");
        await page.getByRole("button", { name: "Simpan", exact: true }).click();
        await expectText(page, "“udah punya fotografer”");
      });
      await t.step("Balas cepat picks 'Sudah Punya' from the reason and copies a reply", async () => {
        await huntRow(page, "@rotiflow").getByRole("button", { name: "💡 Balas" }).click();
        await page.getByRole("button", { name: "✋ Sudah Punya", pressed: true }).waitFor();
        const inView = await page.evaluate(() => {
          const b = document.querySelector('[role="region"][aria-label^="Saran balasan"] button[aria-pressed="true"]');
          const r = b.parentElement.getBoundingClientRect(), c = b.getBoundingClientRect();
          return c.left >= r.left - 1 && c.right <= r.right + 1;
        });
        if (!inView) throw new Error("the guessed topic is scrolled out of view");
        const panel = page.getByRole("region", { name: /Saran balasan/ });
        await panel.getByRole("button", { name: "Copy" }).first().click();
        const clip = await page.evaluate(() => navigator.clipboard.readText());
        if (clip.length < 20) throw new Error(`clipboard: "${clip}"`);
        await panel.getByRole("button", { name: "Formal" }).click();
        await panel.getByRole("button", { name: "👍 Lanjut ngobrol" }).click();
        await panel.getByText(/Terima kasih atas balasannya, rotiflow/).waitFor();
      });
      await t.step("back to Terkirim, Balas cepat closes with its button", async () => {
        await huntRow(page, "@rotiflow").getByRole("button", { name: "Tandai Belum dibales" }).click();
        await page.getByRole("region", { name: /Saran balasan/ }).waitFor({ state: "detached" });
      });
      await t.step("a Threads target: Copy & DM opens Instagram's DM to that username", async () => {
        await page.context().route("https://ig.me/**", r => r.fulfill({ status: 200, contentType: "text/html", body: "<title>ig</title>" }));
        await pane(page, "Kirim");
        await page.locator("#hunt-target").fill("@dmflow");
        await page.getByRole("radiogroup", { name: "Platform" }).getByRole("radio", { name: "Threads" }).click();
        const [pop] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Copy & DM (via IG)" }).first().click()]);
        if (!pop.url().startsWith("https://ig.me/m/dmflow")) throw new Error(`opened ${pop.url()}`);
        await pop.close();
        await page.getByRole("button", { name: "Batal catat" }).waitFor();
      });
      await t.step("a field the post didn't fill uses the default, set once", async () => {
        await page.getByRole("tablist", { name: "Tahap pesan" }).getByRole("tab", { name: /^1\. Intro/ }).click();
        await page.getByRole("button", { name: "+ Pakai contoh personal" }).click();
        const panel = page.getByRole("tabpanel", { name: /Tahap 1: Intro/ });
        await panel.getByText(/Halo dmflow! Aku biasa pegang/).waitFor();
        await page.getByRole("button", { name: "Default kalau kosong" }).click();
        const sheet = page.getByRole("dialog", { name: "Default kalau kosong" });
        await sheet.locator("#def-kebutuhan").fill("dokumentasi acara");
        await sheet.getByRole("button", { name: "Simpan default" }).click();
        await sheet.waitFor({ state: "detached" });
        await panel.getByText(/Halo dmflow! Aku liat kamu lagi nyari dokumentasi acara\. Aku biasa/).waitFor();
      });
      await t.step("change the daily goal to 25 in a sheet with Batal", async () => {
        await page.getByRole("button", { name: /Ubah target harian/ }).click();
        const sheet = page.getByRole("dialog", { name: /Target DM per hari/ });
        await sheet.getByRole("button", { name: "Batal" }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByRole("button", { name: /Ubah target harian/ }).click();
        await page.keyboard.press("Escape");
        await sheet.waitFor({ state: "detached" });
        await page.getByRole("button", { name: /Ubah target harian/ }).click();
        await page.locator("#goal-n").fill("0");
        await sheet.getByRole("button", { name: "Simpan target" }).click();
        await sheet.getByRole("alert").getByText("minimal 1").waitFor();
        await page.locator("#goal-n").fill("25");
        await sheet.getByRole("button", { name: "Simpan target" }).click();
        await page.getByRole("button", { name: /dari 25 DM/ }).waitFor();
      });
      await t.step("a name typed by hand drops the last person's link", async () => {
        await page.locator("#hunt-target").fill("@tehsenja");
        if (await page.getByText("🔗 https://www.threads.com/@kopiflow").count()) throw new Error("the old profile link stays with a new name");
        await page.locator("#hunt-target").fill("");
      });
      await t.step("the referral editor has Batal, and status buttons sit in a grid", async () => {
        await openLog(page);
        await huntRow(page, "@rotiflow").getByRole("button", { name: "↪ Rekomendasiin orang" }).click();
        await page.getByLabel("Akun yang direkomendasiin").waitFor();
        await huntRow(page, "@rotiflow").getByRole("button", { name: "Batal", exact: true }).click();
        await page.getByLabel("Akun yang direkomendasiin").waitFor({ state: "detached" });
        if (!isWide(page)) {
          const small = await page.evaluate(() => [...document.querySelectorAll(".sp-hunt button")].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 30)));
          if (small.length) throw new Error(`under 44px: ${small.slice(0, 5).join(", ")}`);
        }
      });
      await t.step("the new lead is in Leads", async () => { await go(page, "Jualan", "Leads"); await expectText(page, "@kopiflow"); });
    },
  },
  {
    name: "journey: shared post, intro, answer, data to ETB, DNC, session bar",
    async run(t) {
      const { page, base } = t;
      const row = (who) => page.getByRole("button", { name: `Journey ${who}`, exact: true });
      const pick = async (f) => { await pane(page, "Journey"); await page.getByRole("group", { name: "Saring prospek" }).getByRole("button", { name: new RegExp(`^${f}`) }).click(); };
      let email = "";
      await t.step("sign up and open Hunting", async () => { await mockUnfurl(page); email = await signup(t); await go(page, "Hunting"); await pane(page, "Journey"); await expectText(page, "Journey prospek"); await pane(page, "Kirim"); });
      await t.step("a post shared from Threads opens as a prospect with its words", async () => {
        // /share redirects to /dashboard, which then rewrites its own URL; waitForURL
        // reads that rewrite as an aborted navigation, so wait on the page instead.
        await page.goto(`${base}/share?text=${encodeURIComponent("liat deh https://www.threads.com/share/AbC123/")}`).catch(() => undefined);
        await page.waitForFunction(() => location.pathname === "/dashboard", null, { timeout: 15000 });
        await page.waitForFunction(() => document.querySelector("#hunt-target")?.value === "@tokokue", null, { timeout: 10000 });
        await page.getByLabel("Prospek @tokokue").getByText("ada yang open jasa foto katalog buat UMKM?").waitFor();
        await page.getByRole("radio", { name: "Balas di post", checked: true }).waitFor();
      });
      await t.step("before the message: the post's context and the stage that fits", async () => {
        const card = page.getByLabel("Prospek @tokokue");
        await card.getByText("foto katalog", { exact: true }).waitFor();
        await card.getByText("budget ramah UMKM", { exact: true }).waitFor();
        await card.getByRole("button", { name: "Detail ▾" }).click();
        await card.getByText("Saran tahap:").waitFor();
        await card.getByRole("button", { name: "Ringkas ▴" }).click();
        await page.getByRole("tabpanel", { name: "Tahap 1: Intro, cocok sekarang" }).waitFor();
        await card.getByRole("button", { name: "✎ Ubah konteks" }).click();
        await page.locator("#ctx-when").fill("besok jam 1-5 sore");
        await page.getByRole("button", { name: "Simpan konteks" }).click();
        await card.getByText("besok jam 1-5 sore").waitFor();
      });
      await t.step("their date, as a day, checked against booked jobs", async () => {
        const card = page.getByLabel("Prospek @tokokue");
        await card.getByText(/kosong, belum ada job/).waitFor();
        await card.getByRole("button", { name: "Lihat kalender" }).click();
        await card.getByRole("grid", { name: "Kalender job" }).getByRole("gridcell", { name: /tanggal yang diminta/ }).waitFor();
        await card.getByRole("button", { name: "Tutup kalender" }).click();
      });
      await t.step("an empty stage takes an example, filled in with their need", async () => {
        await page.getByRole("tablist", { name: "Tahap pesan" }).getByRole("tab", { name: /^4\. Penawaran/ }).click();
        const offer = page.getByRole("tabpanel", { name: /Tahap 4: Penawaran/ });
        await offer.getByRole("button", { name: "+ Pakai contoh" }).click();
        await offer.getByText(/dua pilihan paket buat foto katalog besok jam 1-5 sore/).waitFor();
      });
      await t.step("a new template shows its stage, the words it can use, and a preview", async () => {
        await page.getByRole("tablist", { name: "Tahap pesan" }).getByRole("tab", { name: /^1\. Intro, .*cocok sekarang/ }).click();
        await page.getByRole("button", { name: "+ Template" }).click();
        const dlg = page.getByRole("dialog", { name: "Template baru" });
        await dlg.getByRole("radio", { name: "1. Intro", checked: true }).waitFor();
        await page.locator("#tpl-body").fill("Halo {nama}! Butuh ");
        await dlg.getByRole("button", { name: /Sisipkan \{kebutuhan\}/ }).click();
        await dlg.getByText("Halo Toko Kue! Butuh foto katalog").waitFor();
        await dlg.getByRole("button", { name: "Batal", exact: true }).click();
      });
      // After the share's page load: a write still in flight when a page reloads is lost.
      await t.step("start a session: the bar shows over the page", async () => {
        await page.getByRole("button", { name: "Mulai hunting" }).click();
        await page.getByRole("region", { name: "Sesi hunting" }).getByText(/0 intro/).waitFor();
      });
      await t.step("Copy logs the intro at once; Batal takes it back", async () => {
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await expectText(page, "Tercatat: balasan di post ke @tokokue");
        // The undo bar sits pinned on screen, wherever the page is scrolled.
        const bar = page.locator(".sp-toast");
        const r = await bar.boundingBox();
        if (!r || r.y + r.height > page.viewportSize().height) throw new Error("the undo bar is off screen");
        await page.getByRole("button", { name: "Batal catat" }).click();
        await openLog(page);
        await expectText(page, "Belum ada DM.");
        await pane(page, "Journey");
        await row("Toko Kue (@tokokue)").getByText("Baru").waitFor();
      });
      await t.step("send it for real from the journey; the bar counts it", async () => {
        await row("Toko Kue (@tokokue)").click();
        await page.getByRole("button", { name: "✉ Kirim intro" }).click();
        await page.waitForFunction(() => document.querySelector("#hunt-target")?.value === "@tokokue");
        await page.getByRole("button", { name: "✓ Tersalin" }).waitFor({ state: "detached" });
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await page.getByRole("region", { name: "Sesi hunting" }).getByText(/1 intro/).waitFor();
      });
      await t.step("they answer: the reply goes in the history, then Tertarik", async () => {
        await pick("Nunggu");
        await row("Toko Kue (@tokokue)").getByText("Intro terkirim").waitFor();
        if ((await row("Toko Kue (@tokokue)").getAttribute("aria-expanded")) !== "true") await row("Toko Kue (@tokokue)").click();
        await page.getByRole("button", { name: "💬 Dibales" }).click();
        await page.getByLabel("Tempel balasannya (opsional)").fill("boleh kak, pricelist-nya berapa?");
        await page.getByRole("button", { name: "Simpan", exact: true }).click();
        await pick("Terhubung");
        await page.locator("#hpane-journey").getByText("boleh kak, pricelist-nya berapa?").first().waitFor();
        await page.getByRole("group", { name: /Hasil untuk/ }).getByRole("button", { name: "✅ Tertarik" }).click();
        await row("Toko Kue (@tokokue)").getByText("Tertarik").waitFor();
      });
      await t.step("Kasih data makes them ETB and a Hot lead", async () => {
        await page.getByRole("button", { name: "Kasih data →" }).click();
        await page.locator("#cv-phone").fill("081234567890");
        await page.getByRole("button", { name: "Simpan jadi Lead" }).click();
        await expectText(page, "masuk Leads sebagai Hot");
        await pick("ETB");
        await row("Toko Kue (@tokokue)").waitFor();
        await page.getByRole("region", { name: "Sesi hunting" }).getByText(/1 data/).waitFor();
      });
      await t.step("the DM log follows the journey", async () => {
        await openLog(page);
        await huntRow(page, "@tokokue").getByText("Tertarik").first().waitFor();
      });
      await t.step("percakapan: a person reads like a chat, and the next message goes from there", async () => {
        await pane(page, "Percakapan");
        await page.getByRole("button", { name: "Buka percakapan Toko Kue (@tokokue)" }).click();
        const th = page.getByRole("dialog", { name: "Toko Kue (@tokokue)" });
        const chat = th.getByRole("log", { name: "Percakapan dengan Toko Kue (@tokokue)" });
        await chat.getByText("ada yang open jasa foto katalog buat UMKM?").first().waitFor();
        await chat.getByText("boleh kak, pricelist-nya berapa?").waitFor();
        await th.getByRole("radiogroup", { name: "Tahap" }).getByRole("radio", { name: /Penawaran/ }).click();
        await th.locator("#th-text").fill("Halo kak, ini pricelist paket katalog ya");
        await th.getByRole("button", { name: "Copy", exact: true }).click();
        await th.getByText("Tercatat terkirim.").waitFor();
        await chat.getByText("Halo kak, ini pricelist paket katalog ya").waitFor();
        await th.getByRole("button", { name: "Tutup", exact: true }).last().click();
        await th.waitFor({ state: "detached" });
      });
      await t.step("the next person comes from a queue; a quiet one is dropped to Arsip and brought back", async () => {
        const uid = await uidOf(t.project, email);
        const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
        await seedDocs(t.project, [
          [`users/${uid}/prospects/Threads_kopibaru`, { platform: "Threads", handle: "@kopibaru", segment: "NTB", contact: "baru", attempts: 0, firstSeenAt: day(0), source: { kind: "manual" }, history: [], closed: false, createdAt: Date.now(), updatedAt: Date.now() }],
          [`users/${uid}/prospects/Threads_diamlama`, { platform: "Threads", handle: "@diamlama", segment: "NTB", contact: "intro", attempts: 1, firstSeenAt: day(25), firstSentAt: day(20), lastSentAt: day(20), source: { kind: "manual" },
            history: [{ at: Date.now() - 20 * 864e5, kind: "sent", channel: "dm", text: "Halo kak, aku Studio Contoh" }], closed: false, createdAt: Date.now() - 25 * 864e5, updatedAt: Date.now() - 20 * 864e5 }],
        ]);
        await pane(page, "Kirim");
        await page.getByRole("button", { name: "Ambil target dari antrian" }).click();
        const q = page.getByRole("dialog", { name: "Ambil dari antrian" });
        await q.getByRole("region", { name: "Baru, belum disapa" }).getByRole("button", { name: /^@kopibaru/ }).click();
        await page.waitForFunction(() => document.querySelector("#hunt-target")?.value === "@kopibaru", null, { timeout: 10000 });
        await page.getByText(/^Dari antrian/).waitFor();
        await page.getByRole("button", { name: "Berhenti ambil dari antrian" }).click();
        await pick("Siap dibuang");
        await row("@diamlama").waitFor();
        await page.getByRole("button", { name: "🗑 Buang semua (1)" }).click();
        await page.getByRole("dialog", { name: "Buang 1 prospek?" }).getByRole("button", { name: "Buang", exact: true }).click();
        await expectText(page, "1 prospek dibuang ke Arsip.");
        await pick("Arsip");
        await row("@diamlama").click();
        await page.getByRole("button", { name: "↩ Balikin" }).click();
        await expectText(page, "@diamlama dibalikin ke journey.");
      });
      await t.step("pasted from the bar; asking not to be contacted locks them", async () => {
        await page.evaluate(() => navigator.clipboard.writeText("https://www.threads.com/@rotikeju/post/XYZ9"));
        await page.getByRole("button", { name: "Tempel link dari clipboard" }).first().click();
        await page.waitForFunction(() => document.querySelector("#hunt-target")?.value === "@rotikeju");
        await page.getByLabel("Prospek @rotikeju").waitFor();
        await pick("Baru");
        await row("@rotikeju").click();
        await page.getByRole("button", { name: "🚫 Menolak dihubungi" }).click();
        await page.getByRole("button", { name: "Kunci" }).click();
        await row("@rotikeju").waitFor({ state: "detached" });
        await pane(page, "Kirim");
        await page.getByRole("alert").getByText("minta ga dihubungi").waitFor();
        if (!(await page.getByRole("button", { name: "Copy", exact: true }).first().isDisabled())) throw new Error("Copy still works for a DNC prospect");
        await pick("DNC");
        await row("@rotikeju").getByText("Jangan dihubungi").waitFor();
      });
      await t.step("find a journey by its ID, with its summary", async () => {
        await page.getByLabel("Cari prospek pakai ID atau @username").fill("Threads_tokokue");
        await expectText(page, "1 ketemu");
        if ((await row("Toko Kue (@tokokue)").getAttribute("aria-expanded")) !== "true") await row("Toko Kue (@tokokue)").click();
        await page.getByRole("region", { name: /Riwayat Toko Kue/ }).getByText(/ID Threads_tokokue · \d+ pesan/).waitFor();
        await page.getByLabel("Cari prospek pakai ID atau @username").fill("");
      });
      await t.step("ending the session leaves a summary", async () => {
        await page.getByRole("button", { name: "Akhiri sesi hunting" }).click();
        await page.getByRole("region", { name: "Sesi hunting" }).waitFor({ state: "detached" });
        await expectText(page, "Sesi terakhir:");
      });
      await t.step("performa hunter counts the conversion", async () => {
        await pane(page, "Performa");
        await page.getByRole("button", { name: /Performa hunter/ }).click();
        await page.getByText("Konversi NTB → ETB").waitFor();
      });
      await t.step("the Hot lead is in Leads", async () => { await go(page, "Jualan", "Leads"); await expectText(page, "Toko Kue"); });
      await t.step("log aktivitas: today on the heat map, that day's list, one kind", async () => {
        await go(page, "Tim", "Log aktivitas");
        const map = page.getByRole("region", { name: /Heat map aktivitas/ });
        await map.getByRole("button", { name: /: \d+ aktivitas$/ }).last().click();
        await page.getByRole("button", { name: /^Hapus filter/ }).waitFor();
        const todayList = page.getByRole("region", { name: "Hari ini" });
        await todayList.getByText("Simpan post Toko Kue (@tokokue)").waitFor();
        await todayList.getByText("Toko Kue (@tokokue) jadi lead (ETB)").waitFor();
        await todayList.getByText(/^Sesi hunting \d+ menit$/).first().waitFor();
        await map.getByRole("button", { name: /^Respon/ }).click();
        await todayList.getByText("Simpan post Toko Kue (@tokokue)").waitFor({ state: "detached" });
        await todayList.getByText("Toko Kue (@tokokue) jadi lead (ETB)").waitFor();
        await map.getByRole("button", { name: /^Semua/ }).click();
        await page.getByRole("button", { name: /^Hapus filter/ }).click();
        await page.getByRole("button", { name: /^Hapus filter/ }).waitFor({ state: "detached" });
      });
      await t.step("dashboard kamu: the month's numbers, trend and funnel", async () => {
        await go(page, "Tim", "Dashboard tim");
        await expectText(page, "Dashboard kamu");
        const tiles = page.getByRole("region", { name: "Angka utama" });
        await tiles.getByText("Jadi ETB").waitFor();
        await page.getByRole("img", { name: /^Aktivitas per hari: total \d+/ }).waitFor();
        await page.getByRole("region", { name: "Funnel periode ini" }).getByText("Closing").waitFor();
        await page.getByRole("radio", { name: "Bulan lalu" }).click();
        await page.getByRole("radio", { name: "Bulan lalu", checked: true }).waitFor();
      });
    },
  },
  {
    name: "beranda: three modes — jualan, report & closing, belajar",
    async run(t) {
      const { page } = t;
      const tab = (name) => page.getByRole("tablist", { name: "Mode Beranda" }).getByRole("tab", { name });
      await t.step("sign up: Beranda opens on Jualan", async () => {
        await signup(t);
        await tab("Jualan").and(page.locator('[aria-selected="true"]')).waitFor();
        await page.getByRole("region", { name: "Hunting hari ini" }).getByText(/DM hari ini/).waitFor();
      });
      await t.step("Report & closing: the month, both funnels, and the full reports", async () => {
        await tab("Report & closing").click();
        await page.getByRole("heading", { level: 1, name: /closing/ }).waitFor();
        await page.getByRole("region", { name: "Hunting, 30 hari" }).waitFor();
        await page.getByRole("region", { name: "Pipeline lead, sekarang" }).waitFor();
        await page.getByRole("button", { name: /^Report Klien →/ }).click();
        await page.locator(".sp-sub-btn.is-on", { hasText: "Report Klien" }).waitFor();
      });
      await t.step("Atur target: a sheet with Batal, a reason when empty, then saved", async () => {
        await go(page, "Beranda");
        await page.getByRole("button", { name: "Atur target closing" }).click();
        const sheet = page.getByRole("dialog", { name: /Target closing bulan ini/ });
        await sheet.getByRole("button", { name: "Batal" }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByRole("button", { name: "Atur target closing" }).click();
        await sheet.getByRole("button", { name: "Simpan target" }).click();
        await sheet.getByRole("alert").getByText(/minimal 1/).waitFor();
        await sheet.getByLabel("Jumlah deal").fill("8");
        await sheet.getByRole("button", { name: "Simpan target" }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByRole("heading", { level: 1, name: /dari target 8/ }).waitFor();
      });
      await t.step("the mode is remembered when coming back", async () => {
        await go(page, "Beranda");
        await tab("Report & closing").and(page.locator('[aria-selected="true"]')).waitFor();
      });
      await t.step("Belajar: what works, the no's, practice, tips per stage", async () => {
        await tab("Belajar").click();
        await page.getByRole("heading", { name: "Pesan yang paling dibales" }).waitFor();
        await page.getByRole("heading", { name: "Keberatan paling sering" }).waitFor();
        await page.getByRole("heading", { name: "Pesan yang pas per tahap" }).waitFor();
        await page.getByRole("button", { name: "Buka Simulator" }).click();
        await page.locator(".sp-sub-btn.is-on", { hasText: "Simulator" }).waitFor();
      });
      await t.step("the bell's popover closes with Escape and a tap outside", async () => {
        const pop = page.getByRole("dialog", { name: "Notifikasi" });
        await page.getByRole("button", { name: /^Notifikasi/ }).click();
        await pop.waitFor();
        await page.keyboard.press("Escape");
        await pop.waitFor({ state: "detached" });
        await page.getByRole("button", { name: /^Notifikasi/ }).click();
        await pop.waitFor();
        await page.mouse.click(10, (page.viewportSize()?.height || 800) - 160);
        await pop.waitFor({ state: "detached" });
      });
      await t.step("back to Jualan: start hunting from the strip", async () => {
        await go(page, "Beranda");
        await tab("Jualan").click();
        await page.getByRole("heading", { name: /^Perlu ditindak/ }).waitFor();
        await page.getByRole("region", { name: "Hunting hari ini" }).getByRole("button", { name: "Mulai hunting" }).click();
        await page.getByRole("region", { name: "Sesi hunting" }).waitFor();
        await expectText(page, "Hunting Mode");
      });
    },
  },
  {
    name: "guild: bring Pribadi data in under your name, and back",
    async run(t) {
      const { page } = t;
      await t.step("a lead and a client with a chat in Pribadi, then a new guild", async () => {
        await signup(t);
        await addLead(page, "Lead Pindah");
        await go(page, "Tim", "Report Klien");
        await page.getByRole("button", { name: "+ Tambah klien" }).click();
        await modal(page).locator("#cl-name").fill("Klien Pindah");
        await modal(page).getByRole("button", { name: "Simpan klien" }).click();
        await page.getByRole("button", { name: "+ Chat masuk" }).click();
        await modal(page).locator("#ch-name").fill("Bu Sari");
        await modal(page).getByRole("radio", { name: "TikTok" }).click();
        await modal(page).getByRole("button", { name: "Simpan chat" }).click();
        await expectText(page, "Bu Sari");
        await go(page, "Tim", "Guild");
        await page.getByRole("button", { name: "+ Bikin guild" }).click();
        await modal(page).locator("#gd-name").fill("Tim Pindah");
        await modal(page).getByRole("button", { name: "Bikin guild" }).click();
        await expectText(page, "Undang orang");
      });
      await t.step("with the workspace picker, the header still fits a 320px phone", async () => {
        const size = page.viewportSize();
        await page.setViewportSize({ width: 320, height: size.height });
        try {
          for (const name of ["Ruang kerja", /^Notifikasi/, "Profil dan pengaturan"]) {
            const el = name === "Ruang kerja" ? page.locator("#space-pick") : page.getByRole("button", { name });
            const box = await el.boundingBox();
            if (!box || box.x < 0 || box.x + box.width > 320) throw new Error(`${name} sits off screen: ${JSON.stringify(box)}`);
          }
        } finally { await page.setViewportSize(size); }
      });
      await t.step("in the guild, Leads says a lead is still in Pribadi", async () => {
        await page.locator("#space-pick").selectOption({ label: "🛡️ Tim Pindah" });
        await go(page, "Jualan", "Leads");
        await expectText(page, "di ruang Pribadi kamu");
        await page.getByRole("button", { name: "Bawa ke Tim Pindah →" }).click();
        await page.getByRole("region", { name: "Data pribadi kamu" }).getByText(/Masih di Pribadi: 1 lead & catatan, 1 klien/).waitFor();
      });
      await t.step("bring it in: it's in the guild and gone from Pribadi", async () => {
        await page.getByRole("region", { name: "Data pribadi kamu" }).getByRole("button", { name: "Bawa ke Tim Pindah" }).click();
        await page.getByRole("dialog", { name: "Bawa data ke Tim Pindah" }).getByRole("button", { name: "Pindahin" }).click();
        await expectText(page, "3 data pindah ke Tim Pindah, atas nama kamu.", 20000);
        await go(page, "Jualan", "Leads");
        await expectText(page, "Lead Pindah");
        await go(page, "Tim", "Report Klien");
        await expectText(page, "Bu Sari");
        await page.locator("#space-pick").selectOption({ label: "👤 Pribadi" });
        await go(page, "Jualan", "Leads");
        await expectText(page, "Belum ada lead");
      });
      await t.step("and back to Pribadi", async () => {
        await go(page, "Tim", "Guild");
        await page.getByRole("region", { name: "Data pribadi kamu" }).getByRole("button", { name: "Balikin ke Pribadi" }).click();
        await page.getByRole("dialog", { name: "Balikin ke Pribadi?" }).getByRole("button", { name: "Balikin", exact: true }).click();
        await expectText(page, "3 data balik ke Pribadi.", 20000);
        await go(page, "Jualan", "Leads");
        await expectText(page, "Lead Pindah");
        await go(page, "Tim", "Report Klien");
        await expectText(page, "Bu Sari");
      });
    },
  },
  {
    name: "website leads: member, then claim, become one lead",
    async run(t) {
      const { page, project } = t;
      const base = { v: 1, site: "visufavor", siteUrl: "https://visufavor.vercel.app/", status: "new" };
      const acct = { provider: "google.com", uid: `flow${Date.now()}`, project: "visufavor" };
      await t.step("a member signs up on the site", () => sendInbound(project, { ...base, contact: { name: "Rina Flow", email: "rina@contoh.id" }, attribution: { utm_source: "threads", utm_campaign: "flow" }, account: acct }));
      await t.step("the owner signs in", () => ownerLogin(t));
      await t.step("the member shows as a Cold lead", async () => { await go(page, "Jualan", "Leads"); await page.locator(".lead-row", { hasText: "Rina Flow" }).getByText("Cold").first().waitFor({ timeout: 15000 }); });
      await t.step("the same person claims the offer", () => sendInbound(project, { ...base, contact: { name: "Rina Flow", email: "rina@contoh.id", whatsapp: "0812 3456 789", business: "Kopi Rina Flow" }, offer: { code: "VISU10-FLOWX", kind: "discount", value: 10 }, answers: { need: "Menu photos", timing: "This month", budget: "Rp 300.000" }, account: acct }));
      await t.step("it becomes one Hot lead, not two", async () => {
        await page.locator(".lead-row", { hasText: "Kopi Rina Flow" }).getByText("Hot").first().waitFor({ timeout: 15000 });
        const n = await page.locator(".lead-row", { hasText: "Rina Flow" }).count();
        if (n !== 1) throw new Error(`${n} rows for one person`);
      });
      await t.step("Dari mana uangnya lists the campaign", async () => {
        await go(page, "Beranda");
        await page.getByRole("button", { name: "Kampanye" }).click();
        await expectText(page, "threads/flow");
      });
    },
  },
  {
    name: "access: invite-only, and who may spend the Google key",
    async run(t) {
      const { page, base, project } = t;
      const A = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
      const tokenOf = async (email) => (await (await fetch(`${A}/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "rahasia123", returnSecureToken: true }) })).json()).idToken;
      // The search with no words: past the guard it stops at the missing key (503)
      // or the empty query (400), so no test ever spends a real Google call.
      const places = async (email) => (await fetch(`${base}/api/places`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tokenOf(email)}` }, body: JSON.stringify({ query: "" }) })).status;
      const passed = (s) => s === 400 || s === 503;
      const stranger = `luar${Date.now()}@contoh.id`;
      let p2, link = "";
      await seedDocs(project, [["config/access", { open: false }]]);
      try {
        await t.step("someone who signs up on their own finds it closed", async () => {
          await page.goto(`${base}/login`);
          await page.getByRole("button", { name: "Daftar gratis" }).click();
          await page.locator('input[type="email"]').fill(stranger);
          await page.locator('input[type="password"]').fill("rahasia123");
          await page.locator('form button[type="submit"]').click();
          await page.getByRole("heading", { name: "SalesPal masih tertutup" }).waitFor({ timeout: 20000 });
          if (await page.getByRole("heading", { name: /^Perlu ditindak/ }).count()) throw new Error("the app opened for a stranger");
        });
        await t.step("and the server refuses them the Google key", async () => {
          const st = await places(stranger);
          if (st !== 403) throw new Error(`stranger got ${st}, not 403`);
          const scan = (await fetch(`${base}/api/scan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tokenOf(stranger)}` }, body: "{}" })).status;
          if (scan !== 403) throw new Error(`stranger's AI scan got ${scan}, not 403`);
        });
        await t.step("they ask an admin to let them in", async () => {
          await page.locator("#ask-note").fill("Sales freelance, mau coba buat follow-up klien");
          await page.getByRole("button", { name: "Minta akses" }).click();
          await page.getByText("Permintaan akses terkirim").waitFor();
        });
        await t.step("the owner comes in and may search", async () => {
          await page.getByRole("button", { name: "Keluar" }).click();
          await page.waitForURL("**/login");
          await ownerLogin(t);
          await page.getByRole("heading", { name: /^Perlu ditindak/ }).waitFor({ timeout: 20000 });
          const st = await places(OWNER_EMAIL);
          if (!passed(st)) throw new Error(`owner got ${st}`);
        });
        await t.step("the owner approves them for AI scan only, and makes them an admin", async () => {
          await page.getByRole("button", { name: "Profil dan pengaturan" }).click();
          await page.getByRole("button", { name: /^Akses & admin/ }).filter({ hasText: "1 orang minta akses" }).click();
          const sheet = page.getByRole("dialog", { name: "Akses & admin" });
          const req = sheet.getByRole("article", { name: `Permintaan ${stranger}` });
          await req.getByText("Sales freelance").waitFor();
          await req.getByRole("checkbox", { name: `Scan gambar (AI) buat ${stranger}` }).check();
          await req.getByRole("button", { name: `Setujui ${stranger}` }).click();
          await sheet.getByRole("heading", { name: "Udah disetujui (1)" }).waitFor();
          await sheet.getByText("Scan gambar (AI) · oleh").waitFor();
          await sheet.locator("#aa-email").fill(stranger);
          await sheet.getByRole("button", { name: "Jadikan admin" }).click();
          await sheet.getByRole("button", { name: `Cabut admin ${stranger}` }).waitFor();
          await sheet.getByRole("button", { name: "Tutup", exact: true }).last().click();
          await sheet.waitFor({ state: "detached" });
          await page.getByRole("dialog", { name: "Profil & Pengaturan" }).getByRole("button", { name: "Tutup", exact: true }).click();
          const scan = (await fetch(`${base}/api/scan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tokenOf(stranger)}` }, body: "{}" })).status;
          if (!passed(scan)) throw new Error(`approved scan got ${scan}`);
        });
        await t.step("the owner's guild lets the invited person in, Cari bisnis not yet", async () => {
          await go(page, "Tim", "Guild");
          if (await page.getByRole("button", { name: "+ Bikin guild" }).count()) {
            await page.getByRole("button", { name: "+ Bikin guild" }).click();
            await modal(page).locator("#gd-name").fill("Tim Akses");
            await modal(page).getByRole("button", { name: "Bikin guild" }).click();
          }
          await expectText(page, "Undang orang");
          await page.getByRole("radiogroup", { name: "Peran undangan" }).getByRole("radio", { name: /^Member/ }).click();
          await page.getByRole("button", { name: "Bikin link undangan" }).click();
          link = await page.locator("#inv-link").inputValue();
          const ctx2 = await page.context().browser().newContext(page.viewportSize() ? { viewport: page.viewportSize() } : {});
          p2 = await ctx2.newPage();
          await p2.goto(link);
          await p2.getByRole("link", { name: "Login buat gabung" }).click();
          await p2.locator('input[type="email"]').fill(stranger);
          await p2.locator('input[type="password"]').fill("rahasia123");
          await p2.locator('form button[type="submit"]').click();
          await p2.getByRole("button", { name: "Gabung guild" }).click({ timeout: 20000 });
          await p2.waitForURL("**/dashboard?guild", { timeout: 20000 });
          if (await p2.getByRole("heading", { name: "SalesPal masih tertutup" }).count()) throw new Error("still closed after joining");
          // An admin decides applications but can't name admins.
          await p2.getByRole("button", { name: "Profil dan pengaturan" }).click();
          await p2.getByRole("button", { name: /^Akses & admin/ }).click();
          await p2.getByRole("dialog", { name: "Akses & admin" }).getByRole("heading", { name: /^Permintaan masuk/ }).waitFor();
          if (await p2.getByRole("button", { name: "Jadikan admin" }).count()) throw new Error("an admin can name admins");
          await p2.getByRole("dialog", { name: "Akses & admin" }).getByRole("button", { name: "Tutup", exact: true }).last().click();
          await p2.getByRole("dialog", { name: "Profil & Pengaturan" }).getByRole("button", { name: "Tutup", exact: true }).click();
          const st = await places(stranger);
          if (st !== 403) throw new Error(`a member got ${st} before the Leader allowed it`);
        });
        await t.step("the Leader opens Cari bisnis to members, and the member may search", async () => {
          await page.getByRole("button", { name: "Atur lambang & nama guild" }).click();
          const sheet = modal(page);
          await sheet.getByRole("checkbox", { name: "Cari bisnis buat Member" }).check();
          await sheet.getByRole("button", { name: "Simpan" }).click();
          await sheet.waitFor({ state: "detached" });
          const st = await places(stranger);
          if (!passed(st)) throw new Error(`member got ${st} after the Leader allowed it`);
        });
      } finally {
        await seedDocs(project, [["config/access", { open: true }]]);
        await p2?.context().close().catch(() => {});
      }
    },
  },
  {
    name: "dialogs work from the keyboard",
    async run(t) {
      const { page } = t;
      await t.step("sign up", () => signup(t));
      await t.step("a lead opens with Enter", async () => {
        await addLead(page, "Keyboard Flow");
        await page.locator(".lead-row", { hasText: "Keyboard Flow" }).first().focus();
        await page.keyboard.press("Enter");
        if (isWide(page)) {
          // Desktop: Enter shows it in the panel; its full profile is the dialog.
          await page.getByRole("complementary", { name: "Detail lead" }).waitFor();
          await page.getByRole("button", { name: "Profil lengkap" }).focus();
          await page.keyboard.press("Enter");
        }
        await page.getByRole("dialog").waitFor();
      });
      await t.step("Escape closes it and focus returns to what opened it", async () => {
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim());
        const want = isWide(page) ? "Profil lengkap" : "Buka lead Keyboard Flow";
        if (back !== want) throw new Error(`focus went to "${back}"`);
      });
      await t.step("the add-lead dialog focuses its first field and keeps Tab inside", async () => {
        await page.getByRole("button", { name: /tambah lead/i }).click();
        const tag = await page.evaluate(() => document.activeElement?.tagName);
        if (tag !== "INPUT") throw new Error(`focus on ${tag}`);
        for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
        const inside = await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
        if (!inside) throw new Error("Tab left the dialog");
        await page.keyboard.press("Escape");
      });
    },
  },
  {
    name: "script library and quick pitch",
    async run(t) {
      const { page } = t;
      await t.step("sign up", () => signup(t));
      await t.step("Script Library shows 8, then more", async () => {
        await go(page, "Belajar", "Script Library");
        const before = await page.getByRole("button", { name: "Copy" }).count();
        await page.getByRole("button", { name: /Tampilkan \d+ lagi/ }).click();
        const after = await page.getByRole("button", { name: "Copy" }).count();
        if (!(before === 8 && after > before)) throw new Error(`copy buttons ${before} → ${after}`);
      });
      await t.step("no match says so and Reset saringan brings every script back", async () => {
        await page.getByRole("searchbox", { name: "Cari script" }).fill("zzzz");
        await expectText(page, "Ga ada script yang cocok");
        await page.getByRole("button", { name: "Reset saringan" }).click();
        await page.getByRole("button", { name: "Copy", exact: true }).first().waitFor();
        if (await page.getByRole("searchbox", { name: "Cari script" }).inputValue()) throw new Error("search not cleared");
      });
      await t.step("Simulator: pick a type and a scenario, copy a script, start over", async () => {
        await go(page, "Belajar", "Simulator");
        await page.getByRole("button", { name: /Burung Hantu/ }).first().click();
        await page.getByRole("button", { name: /Belum Yakin/ }).first().click();
        await page.getByRole("button", { name: "Ganti skenario (sekarang Belum Yakin)" }).waitFor();
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await page.getByRole("button", { name: "✓ Tersalin" }).waitFor();
        await page.getByRole("button", { name: /Simulasi baru/ }).click();
        await expectText(page, "Customer kamu lebih mirip yang mana?");
      });
      await t.step("Quick Pitch steps aside while scrolling down, and the page ends clear of it", async () => {
        if (isWide(page)) return;
        const fab = page.getByRole("button", { name: /Quick Pitch/ });
        await page.evaluate(() => window.scrollTo(0, 400));
        await page.waitForTimeout(150);
        await page.evaluate(() => window.scrollTo(0, 900));
        await page.waitForTimeout(400);
        const tucked = await fab.evaluate(b => b.classList.contains("is-tucked"));
        const atEnd = await page.evaluate(() => window.scrollY + innerHeight >= document.documentElement.scrollHeight - 8);
        if (!tucked && !atEnd) throw new Error("the button stays over the page while scrolling down");
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(400);
        const covered = await page.evaluate(() => {
          const f = document.querySelector(".sp-fab").getBoundingClientRect();
          return [...document.querySelectorAll(".sp-main button, .sp-main a")].filter(e => e.offsetParent).some(e => { const r = e.getBoundingClientRect(); return r.right > f.left && r.left < f.right && r.bottom > f.top && r.top < f.bottom; });
        });
        if (covered) throw new Error("the floating button covers the last buttons of the page");
      });
      await t.step("Quick Pitch opens from the floating button", async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.getByRole("button", { name: /Quick Pitch/ }).click();
        await expectText(page, "💬 Quick Pitch");
      });
    },
  },
  {
    name: "guild: found, invite, join by link, sell, team report with target",
    async run(t) {
      const { page, base } = t;
      const month = new Date().toISOString().slice(0, 7);
      const memberEmail = `anggota${Date.now()}@contoh.id`;
      const memberName = memberEmail.split("@")[0];
      let link = "";
      let p2;
      await t.step("leader signs up and founds a guild", async () => {
        await signup(t);
        await go(page, "Tim", "Guild");
        await page.getByRole("button", { name: "+ Bikin guild" }).click();
        await modal(page).locator("#gd-name").fill("Tim Uji");
        await modal(page).getByRole("button", { name: "Bikin guild" }).click();
        await expectText(page, "Undang orang");
      });
      await t.step("the crest: colour and symbol, then a PNG logo, from the banner", async () => {
        await page.getByRole("button", { name: "Atur lambang & nama guild" }).click();
        const sheet = page.getByRole("dialog", { name: "Atur guild" });
        await sheet.getByRole("radiogroup", { name: "Warna lambang" }).getByRole("radio").nth(2).click();
        await sheet.getByRole("radio", { name: "Simbol 🦁" }).click();
        await sheet.getByRole("button", { name: "Simpan" }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByRole("region", { name: "Guild Tim Uji" }).getByRole("img", { name: "Lambang Tim Uji" }).getByText("🦁").waitFor();
        await page.getByRole("button", { name: "Atur lambang & nama guild" }).click();
        await sheet.locator('input[type="file"]').setInputFiles(new URL("../../public/brand-logos/visufavor.png", import.meta.url).pathname);
        await sheet.getByRole("img", { name: "Logo Tim Uji" }).waitFor();
        await sheet.getByRole("button", { name: "Simpan" }).click();
        await sheet.waitFor({ state: "detached" });
        await page.getByRole("region", { name: "Guild Tim Uji" }).getByRole("img", { name: "Logo Tim Uji" }).waitFor();
      });
      await t.step("each member picks their own character", async () => {
        await page.getByRole("button", { name: "Ganti karakter kamu" }).click();
        const sheet = page.getByRole("dialog", { name: "Karakter kamu" });
        await sheet.getByRole("radio", { name: "Singa" }).click();
        await sheet.getByRole("button", { name: "Simpan karakter" }).click();
        await sheet.waitFor({ state: "detached" });
        await page.locator('.sp-member img[src*="animal-lion"]').first().waitFor();
        await page.getByRole("region", { name: "Guild Tim Uji" }).locator('img[src*="animal-lion"]').waitFor();
      });
      await t.step("leader makes a member invite link", async () => {
        await page.getByRole("radiogroup", { name: "Peran undangan" }).getByRole("radio", { name: /^Member/ }).click();
        await page.getByRole("button", { name: "Bikin link undangan" }).click();
        link = await page.locator("#inv-link").inputValue();
        if (!link.includes("/join?g=")) throw new Error(`link ${link}`);
      });
      await t.step("someone else opens the link, signs up, and joins", async () => {
        const ctx2 = await page.context().browser().newContext(page.viewportSize() ? { viewport: page.viewportSize() } : {});
        p2 = await ctx2.newPage();
        await p2.goto(link);
        await p2.getByRole("link", { name: "Login buat gabung" }).click();
        await p2.getByRole("button", { name: "Daftar gratis" }).click();
        await p2.locator('input[type="email"]').fill(memberEmail);
        await p2.locator('input[type="password"]').fill("rahasia123");
        await p2.locator('form button[type="submit"]').click();
        await p2.getByText("Tim Uji").first().waitFor({ timeout: 20000 });
        await p2.getByRole("button", { name: "Gabung guild" }).click();
        await p2.waitForURL("**/dashboard?guild", { timeout: 20000 });
        await p2.getByText("Deal milik kamu").waitFor({ timeout: 15000 });
      });
      await t.step("the member logs a chat and closes it", async () => {
        await p2.getByRole("button", { name: "+ Chat masuk" }).click();
        await p2.locator("#ch-name").fill("Pak Budi");
        await p2.getByRole("radio", { name: "TikTok" }).click();
        await p2.getByRole("button", { name: "Simpan chat" }).click();
        await p2.getByRole("button", { name: "Langsung lunas" }).click();
        await p2.locator("#mv-amt").fill("10.000.000");
        await p2.locator(".modal-overlay").last().getByRole("button", { name: "Simpan" }).click();
        await p2.getByRole("button", { name: "lunas", exact: true }).click();
        await p2.getByText("Lunas Rp 10 Jt").first().waitFor();
      });
      await t.step("the member sees only their own row in the team report", async () => {
        await p2.getByRole("tab", { name: "Report Tim" }).click();
        await p2.locator("#tr-month").selectOption(month);
        await p2.getByText(`${memberName} (kamu)`).waitFor();
        const rows = await p2.locator("tbody tr").count();
        if (rows !== 1) throw new Error(`member sees ${rows} rows`);
      });
      await t.step("the leader sees the member's deal in the team pipeline", async () => {
        await page.getByRole("tab", { name: "Pipeline" }).click();
        await page.getByRole("button", { name: "semua", exact: true }).click();
        await expectText(page, "Pak Budi");
        await expectText(page, memberName);
      });
      await t.step("the leader sets a target and sees progress", async () => {
        await page.getByRole("tab", { name: "Report Tim" }).click();
        await page.locator("#tr-month").selectOption(month);
        await page.getByRole("button", { name: `Atur target ${memberName}` }).click();
        await modal(page).locator("#tg-rev").fill("20.000.000");
        await modal(page).getByRole("button", { name: "Simpan target" }).click();
        await expectText(page, "50%");
      });
      await t.step("the leader freezes the team report", async () => {
        await page.getByRole("button", { name: "Bekukan report tim" }).click();
        await expectText(page, "Dibekukan");
      });
      await t.step("the leader saves the team report as a named PDF file", async () => {
        await page.getByRole("button", { name: "Cetak / PDF" }).click();
        await expectText(page, "REPORT SALES TIM");
        const [dl] = await Promise.all([page.waitForEvent("download"), modal(page).getByRole("button", { name: "Simpan / kirim PDF" }).click()]);
        if (dl.suggestedFilename() !== `Report_Tim_Uji_${month}.pdf`) throw new Error(`file ${dl.suggestedFilename()}`);
        await modal(page).getByRole("button", { name: "Tutup", exact: true }).click();
        await page.locator(".print-root").waitFor({ state: "detached" });
      });
      await t.step("reopening a frozen team report asks first", async () => {
        await page.getByRole("button", { name: "Buka lagi" }).click();
        const ask = page.getByRole("dialog", { name: "Buka lagi report ini?" });
        await ask.getByRole("button", { name: "Batal" }).click();
        await ask.waitFor({ state: "detached" });
        await expectText(page, "Dibekukan");
      });
      await t.step("the activity log shows who did what", async () => {
        await page.getByRole("tab", { name: "Aktivitas", exact: true }).click();
        await page.getByText("gabung guild").first().waitFor({ timeout: 10000 });
        await page.getByText("closing lunas").first().waitFor();
        await p2.getByRole("tab", { name: "Aktivitas", exact: true }).click();
        await p2.getByText("nyatet chat").first().waitFor({ timeout: 10000 });
        await p2.getByText("Yang kamu lakuin").waitFor();
      });
      await t.step("the leader hands the member's deal to themself", async () => {
        await page.getByRole("tab", { name: "Pipeline" }).click();
        await page.getByRole("button", { name: "semua", exact: true }).click();
        await page.getByRole("button", { name: "Pindah pemilik" }).first().click();
        const sel = modal(page).locator("#ra-to");
        const now = await sel.inputValue();
        const other = await sel.locator("option").evaluateAll((os, v) => os.map(o => o.value).find(x => x !== v), now);
        await sel.selectOption(other);
        await modal(page).getByRole("button", { name: "Pindahin" }).click();
        await page.getByRole("tab", { name: "Aktivitas", exact: true }).click();
        await page.getByText("pindah pemilik deal").first().waitFor({ timeout: 10000 });
      });
      await t.step("the guild as a workspace: a member's lead reaches the leader, not Pribadi", async () => {
        await p2.locator("#space-pick").selectOption({ label: "🛡️ Tim Uji" });
        await addLead(p2, "Warung Tim");
        await go(p2, "Jualan", "Paket");
        if (await p2.getByRole("button", { name: "+ Paket" }).count()) throw new Error("a member can edit the team's packages");
        await p2.locator("#space-pick").selectOption({ label: "👤 Pribadi" });
        await go(p2, "Jualan", "Leads");
        await p2.getByText("Belum ada lead").waitFor({ timeout: 8000 });
        await page.locator("#space-pick").selectOption({ label: "🛡️ Tim Uji" });
        await go(page, "Jualan", "Leads");
        await expectText(page, "Warung Tim");
        await expectText(page, `👤 ${memberName}`);
        await page.locator("#space-pick").selectOption({ label: "👤 Pribadi" });
        await go(page, "Tim", "Guild");
        await go(p2, "Tim", "Guild");
      });
      await t.step("dashboard tim: a member sees their own, the leader sees each seller and opens one", async () => {
        await p2.locator("#space-pick").selectOption({ label: "🛡️ Tim Uji" });
        await go(p2, "Tim", "Outreach");
        await p2.getByRole("button", { name: "+ Catat outreach" }).first().click();
        await p2.locator("#ou-name").fill("Kopi Tim");
        await modal(p2).getByRole("button", { name: "Simpan", exact: true }).click();
        await expectText(p2, "Kopi Tim");
        await go(p2, "Tim", "Dashboard tim");
        await expectText(p2, "Dashboard kamu");
        await p2.getByText("Log aktivitas kamu").waitFor();
        if (await p2.getByRole("heading", { name: "Per sales" }).count()) throw new Error("a member sees every seller");
        await page.locator("#space-pick").selectOption({ label: "🛡️ Tim Uji" });
        await go(page, "Tim", "Dashboard tim");
        await page.getByRole("heading", { name: "Per sales" }).waitFor();
        await page.getByRole("radio", { name: "30 hari" }).click();
        await page.getByRole("button", { name: new RegExp(`^${memberName}: 1 aktivitas`) }).click();
        await expectText(page, `Dashboard ${memberName}`);
        await page.getByText(`Log aktivitas ${memberName}`).waitFor();
        await page.getByText("Email ke Kopi Tim").first().waitFor();
        await page.locator("#space-pick").selectOption({ label: "👤 Pribadi" });
        await p2.locator("#space-pick").selectOption({ label: "👤 Pribadi" });
        await go(page, "Tim", "Guild");
        await go(p2, "Tim", "Guild");
      });
      await t.step("the leader promotes the member to officer", async () => {
        await page.getByRole("tab", { name: /^Anggota/ }).click();
        await page.locator("select[id^='role-']").first().selectOption("officer");
        await p2.getByRole("tab", { name: "Pipeline" }).click();
        await p2.getByText("Semua deal tim").waitFor({ timeout: 10000 });
        await p2.context().close();
      });
      await t.step("removing a member asks first, with Batal", async () => {
        await page.getByRole("button", { name: `Keluarkan ${memberName}` }).click();
        const ask = page.getByRole("dialog", { name: `Keluarkan ${memberName}?` });
        await ask.getByRole("button", { name: "Batal" }).click();
        await ask.waitFor({ state: "detached" });
        await expectText(page, memberEmail);
      });
    },
  },
  {
    name: "server: API needs sign-in, a new account starts empty",
    async run(t) {
      const { page, base } = t;
      const post = (path, token) => fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ image: "data:image/png;base64,AAAA" }),
      });
      await t.step("scan and Threads refuse a caller who isn't signed in", async () => {
        for (const path of ["/api/scan", "/api/threads/radar", "/api/threads/refresh", "/api/push"]) {
          const r = await post(path);
          if (r.status !== 401) throw new Error(`${path} answered ${r.status} without sign-in`);
        }
        const forged = await post("/api/scan", "not-a-real-token");
        if (forged.status !== 401) throw new Error(`forged token answered ${forged.status}`);
        const cron = await fetch(`${base}/api/cron/digest`, { headers: { Authorization: "Bearer guess" } });
        if (cron.status !== 401) throw new Error(`cron answered ${cron.status} to a stranger`);
      });
      await t.step("a signed-in caller gets past the gate", async () => {
        const A = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
        const { idToken } = await (await fetch(`${A}/accounts:signUp?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `api${Date.now()}@contoh.id`, password: "rahasia123", returnSecureToken: true }) })).json();
        const scan = await post("/api/scan", idToken);
        if (scan.status === 401) throw new Error("scan refused a signed-in user");
        const radar = await post("/api/threads/radar", idToken);
        if (radar.status !== 404) throw new Error(`radar with no stored connection answered ${radar.status}`);
      });
      await t.step("sign up: no example leads are written into the account", async () => {
        await signup(t);
        await go(page, "Jualan", "Leads");
        await expectText(page, "Belum ada lead");
        if (await page.getByText("PT Maju Jaya").count()) throw new Error("example lead found");
      });
    },
  },
  {
    name: "report klien: chat with source to lunas, content, frozen report",
    async run(t) {
      const { page } = t;
      const month = new Date().toISOString().slice(0, 7);
      await t.step("sign up", () => signup(t));
      await t.step("add a client", async () => {
        await go(page, "Tim", "Report Klien");
        await page.getByRole("button", { name: "+ Tambah klien" }).click();
        await modal(page).locator("#cl-name").fill("Toko Aksesoris Uji");
        await modal(page).getByRole("button", { name: "Simpan klien" }).click();
        await expectText(page, "Belum ada chat");
      });
      await t.step("log a chat from TikTok with what the customer said", async () => {
        await page.getByRole("button", { name: "+ Chat masuk" }).click();
        await modal(page).locator("#ch-name").fill("Pak Andri");
        await modal(page).getByRole("radio", { name: "TikTok" }).click();
        await modal(page).locator("#ch-heard").fill("liat video pasang lampu");
        await modal(page).getByRole("button", { name: "Simpan chat" }).click();
        await expectText(page, "Pak Andri");
      });
      await t.step("move it qualified → penawaran → won → lunas", async () => {
        await page.getByRole("button", { name: "→ Qualified" }).click();
        await modal(page).getByRole("button", { name: "Simpan" }).click();
        await page.getByRole("button", { name: "→ Kirim penawaran" }).click();
        await modal(page).locator("#mv-amt").fill("17.000.000");
        await modal(page).getByRole("button", { name: "Simpan" }).click();
        await page.getByRole("button", { name: "→ Won" }).click();
        await modal(page).getByRole("button", { name: "Simpan" }).click();
        await page.getByRole("button", { name: "→ Lunas" }).click();
        await modal(page).getByRole("button", { name: "Simpan" }).click();
        await page.getByRole("button", { name: "lunas", exact: true }).click();
        await expectText(page, "Lunas Rp 17 Jt");
      });
      await t.step("a lunas deal with an unknown source asks for it", async () => {
        await page.getByRole("button", { name: "aktif", exact: true }).click();
        await page.getByRole("button", { name: "+ Chat masuk" }).click();
        await modal(page).locator("#ch-name").fill("Bu Rina");
        await modal(page).getByRole("button", { name: "Simpan chat" }).click();
        await page.getByRole("button", { name: "Langsung lunas" }).click();
        await expectText(page, "Sumber customer ini belum ketahuan");
        await modal(page).locator("#mv-amt").fill("1.500.000");
        await modal(page).getByRole("button", { name: "Simpan" }).click();
      });
      await t.step("add this month's content numbers", async () => {
        await page.getByRole("tab", { name: "Konten", exact: true }).click();
        await page.getByRole("button", { name: "+ Post" }).click();
        await modal(page).locator("#po-pl").selectOption("TikTok");
        await modal(page).locator("#po-title").fill("Video pasang lampu");
        await modal(page).locator("#po-views").fill("2000");
        await modal(page).locator("#po-likes").fill("50");
        await modal(page).getByRole("button", { name: "Simpan post" }).click();
        await expectText(page, "Video pasang lampu");
      });
      await t.step("the report joins them: baseline month, source, unknown row", async () => {
        await page.getByRole("tab", { name: "Report", exact: true }).click();
        await page.locator("#rp-month").selectOption(month);
        await expectText(page, "Rp 18,5 Jt");
        await expectText(page, "— bulan dasar");
        await expectText(page, "Belum ketahuan sumbernya · 1 deal");
        const v = await page.locator("#rp-text").inputValue();
        if (!/Sumber omzet terbesar: TikTok/.test(v)) throw new Error(`narrative: ${v.slice(0, 160)}`);
      });
      await t.step("freeze it and get a WhatsApp link", async () => {
        await page.getByRole("button", { name: "Bekukan report" }).click();
        await expectText(page, "Dibekukan");
        const href = await page.getByRole("link", { name: "Kirim via WA" }).getAttribute("href");
        if (!href || !href.startsWith("https://wa.me/?text=")) throw new Error(`href ${href}`);
      });
      await t.step("the monthly report saves as a PDF named after it", async () => {
        await page.getByRole("button", { name: "Cetak / PDF" }).click();
        await expectText(page, "LAPORAN BULANAN");
        await expectText(page, "OMZET PER SUMBER");
        const [dl] = await Promise.all([page.waitForEvent("download"), modal(page).getByRole("button", { name: "Simpan / kirim PDF" }).click()]);
        if (dl.suggestedFilename() !== `Report_Toko_Aksesoris_Uji_${month}.pdf`) throw new Error(`file ${dl.suggestedFilename()}`);
        await modal(page).getByRole("button", { name: "Tutup", exact: true }).click();
        await page.locator(".print-root").waitFor({ state: "detached" });
      });
      await t.step("reopening a frozen report asks first", async () => {
        await page.getByRole("button", { name: "Buka lagi" }).click();
        await page.getByRole("dialog", { name: "Buka lagi report ini?" }).getByRole("button", { name: "Batal" }).click();
        await expectText(page, "Dibekukan");
      });
      await t.step("a typed-in chat asks before it's thrown away; a deal delete asks too", async () => {
        await page.getByRole("tab", { name: "Chat & Deal" }).click();
        await page.getByRole("button", { name: "+ Chat masuk" }).click();
        await modal(page).locator("#ch-name").fill("Bu Batal");
        await page.keyboard.press("Escape");
        const ask = page.getByRole("dialog", { name: "Buang perubahan?" });
        await ask.getByRole("button", { name: "Batal" }).click();
        if (await page.locator("#ch-name").inputValue() !== "Bu Batal") throw new Error("the form lost what was typed");
        await page.keyboard.press("Escape");
        await ask.getByRole("button", { name: "Buang" }).click();
        await page.locator("#ch-name").waitFor({ state: "detached" });
        await page.getByRole("button", { name: "semua", exact: true }).click();
        await page.getByRole("button", { name: "Hapus Bu Rina" }).click();
        await page.getByRole("dialog", { name: "Hapus Bu Rina?" }).getByRole("button", { name: "Hapus", exact: true }).click();
        await page.getByRole("button", { name: "Hapus Bu Rina" }).waitFor({ state: "detached" });
        await page.getByRole("button", { name: "aktif", exact: true }).click();
      });
      await t.step("a chat untouched for 10 days shows up in Perlu Ditindak", async () => {
        await page.getByRole("tab", { name: "Chat & Deal" }).click();
        await page.getByRole("button", { name: "+ Chat masuk" }).click();
        const d = new Date(Date.now() - 10 * 86400000);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        await modal(page).locator("#ch-name").fill("Bu Lama");
        await modal(page).locator("#ch-date").fill(ymd);
        await modal(page).getByRole("button", { name: "Simpan chat" }).click();
        await page.locator(".modal-overlay").waitFor({ state: "detached" });
        await go(page, "Beranda");
        await expectText(page, "Bu Lama");
        await expectText(page, "10 hari ga gerak");
      });
    },
  },
];
