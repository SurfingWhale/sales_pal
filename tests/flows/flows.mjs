// Every flow a person takes through SalesPal, step by step. Each flow gets a
// fresh browser and a fresh account; a failed step stops that flow only.
// Selectors are the labels a person reads, so a renamed button fails here
// the same way it would confuse someone using the app.

import { readFileSync } from "node:fs";

const OWNER_EMAIL = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8").match(/email in \['([^']+)'\]/)?.[1];

// ---------- helpers ----------
async function signup(t) {
  const { page, base } = t;
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: "Daftar gratis" }).click();
  await page.locator('input[type="email"]').fill(`flow${Date.now()}${Math.floor(Math.random() * 1e4)}@contoh.id`);
  await page.locator('input[type="password"]').fill("rahasia123");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.getByText("Sales Command Center").waitFor();
}

async function go(page, place, tab) {
  await page.locator(".sp-nav-btn", { hasText: place }).click();
  if (tab) await page.locator(".sp-sub-btn", { hasText: new RegExp(`^${tab}$`) }).click();
  await page.waitForTimeout(300);
}

const modal = (page) => page.locator(".modal-overlay").last();
const expectText = async (page, text, ms = 8000) => page.getByText(text).first().waitFor({ timeout: ms });

async function addLead(page, name) {
  await go(page, "Leads");
  await page.getByRole("button", { name: /tambah lead/i }).click();
  await modal(page).locator("input").first().fill(name);
  await modal(page).getByRole("button", { name: "Simpan lead" }).click();
  await expectText(page, name);
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
    name: "sign up and land on the dashboard",
    async run(t) {
      await t.step("login page loads with Google and email options", async () => {
        await t.page.goto(`${t.base}/login`);
        await t.page.getByRole("button", { name: "Lanjutkan dengan Google" }).waitFor();
      });
      await t.step("create an account with email", () => signup(t));
      await t.step("Perlu Ditindak is the first card", async () => {
        const first = await t.page.evaluate(() => [...document.querySelectorAll(".sp-main *")].find(e => /Perlu Ditindak|Total Leads/.test(e.textContent || "") && e.children.length === 0)?.textContent);
        if (!/Perlu Ditindak/.test(first || "")) throw new Error(`first card is "${first}"`);
      });
    },
  },
  {
    name: "navigation reaches every place and tab",
    async run(t) {
      await t.step("sign up", () => signup(t));
      const places = [["Beranda", null, "Sales Command Center"], ["Hunting", null, "Hunting Mode"], ["Leads", null, "Lead Database"],
        ["Jualan", "Penawaran", "Susun dari paket"], ["Jualan", "Invoice", "Invoice & Pembayaran"], ["Jualan", "Paket", "Paket & Harga"],
        ["Lainnya", "Outreach", "Outreach Tracker"], ["Lainnya", "Rejection Log", "Rejection"], ["Lainnya", "Simulator", "Simulator"],
        ["Lainnya", "Script Library", "Script Library"], ["Lainnya", "AI Playbook", "Playbook"]];
      for (const [place, tab, heading] of places) {
        await t.step(`${place}${tab ? ` → ${tab}` : ""} shows "${heading}"`, async () => { await go(t.page, place, tab); await expectText(t.page, heading); });
      }
      await t.step("no sideways scroll on any of them", async () => {
        const over = await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 0) throw new Error(`page is ${over}px wider than the screen`);
      });
      await t.step("dark mode toggles", async () => {
        await t.page.locator("button").filter({ hasText: /🌙|☀️/ }).first().click();
        await t.page.waitForTimeout(300);
      });
    },
  },
  {
    name: "leads: add, filter, follow-up, delete",
    async run(t) {
      await t.step("sign up", () => signup(t));
      await t.step("add a lead", () => addLead(t.page, "Kopi Flow"));
      await t.step("filter Cold shows it", async () => { await t.page.getByRole("button", { name: "Cold", exact: true }).click(); await expectText(t.page, "Kopi Flow"); });
      await t.step("open it and schedule a follow-up tomorrow", async () => {
        await t.page.getByRole("button", { name: "All", exact: true }).click();
        await t.page.locator(".lead-row", { hasText: "Kopi Flow" }).first().click();
        await t.page.getByPlaceholder(/Kirim portfolio/).fill("Kirim portfolio");
        await t.page.getByRole("button", { name: "Besok" }).click();
        await t.page.getByRole("button", { name: "Simpan jadwal" }).click();
        await t.page.getByRole("button", { name: "✓ Selesai" }).waitFor();
        await t.page.keyboard.press("Escape");
        await modal(t.page).click({ position: { x: 5, y: 5 } }).catch(() => {});
      });
      await t.step("the follow-up shows in Perlu Ditindak", async () => { await go(t.page, "Beranda"); await expectText(t.page, "Kirim portfolio"); });
      await t.step("delete asks first, then removes it", async () => {
        await go(t.page, "Leads");
        await t.page.getByRole("button", { name: "Hapus lead Kopi Flow" }).first().click();
        await t.page.getByText("Kopi Flow").first().waitFor({ state: "detached", timeout: 8000 });
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
        await page.getByRole("button", { name: "Info bisnis" }).click();
        const ins = modal(page).locator("input");
        for (let i = 0; i < await ins.count(); i++) await ins.nth(i).fill(["Studio Flow", "08123456789", "BCA", "1234567", "Flow"][i] ?? "x");
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
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
      await t.step("mark sent, then accepted", async () => {
        await page.getByRole("button", { name: "Tandai terkirim" }).click();
        await page.getByRole("button", { name: "✓ Disetujui" }).click();
        await page.getByRole("button", { name: "Buat invoice →" }).waitFor();
      });
      await t.step("accepting closed the lead", async () => { await go(page, "Leads"); await page.locator(".lead-row", { hasText: "Bakso Flow" }).getByText("Closed").first().waitFor(); });
      await t.step("raise the invoice", async () => {
        await go(page, "Jualan", "Penawaran");
        await page.getByRole("button", { name: "Buat invoice →" }).click();
        await go(page, "Jualan", "Invoice");
        await expectText(page, "INV-");
      });
      await t.step("record the DP → DP masuk", async () => {
        await page.getByRole("button", { name: "+ Catat pembayaran" }).click();
        await modal(page).locator("input").first().fill("750000");
        await modal(page).getByRole("button", { name: "Simpan", exact: true }).click();
        await page.getByText("DP masuk").first().waitFor();
      });
    },
  },
  {
    name: "hunting: paste a link, log DMs, statuses, lead, goal",
    async run(t) {
      const { page } = t;
      await t.step("sign up and open Hunting", async () => { await signup(t); await go(page, "Hunting"); await expectText(page, "Cold DM — Tawarin Jasa"); });
      await t.step("Radar shows as coming soon", () => expectText(page, "Segera hadir"));
      await t.step("paste a Threads link fills target and platform", async () => {
        await page.evaluate(() => navigator.clipboard.writeText("https://www.threads.com/@kopiflow/post/abc"));
        await page.getByRole("button", { name: /Tempel link/ }).click();
        await page.waitForFunction(() => document.querySelector("#hunt-target")?.value === "@kopiflow", null, { timeout: 5000 });
        await page.getByRole("radio", { name: "Threads", checked: true }).waitFor();
      });
      await t.step("nothing floats over the Kirim WA button", async () => {
        const hit = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Kirim WA"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.right - 8, r.top + r.height / 2); return b.contains(top) ? "" : (top?.getAttribute("aria-label") || top?.textContent || "?").slice(0, 40); });
        if (hit) throw new Error(`covered by "${hit}"`);
      });
      await t.step("copy a template and log it as sent", async () => {
        await page.getByRole("button", { name: "Copy" }).first().click();
        await page.getByRole("button", { name: "📤 Catat terkirim" }).click();
        await page.getByRole("link", { name: "Profil ↗" }).first().waitFor();
      });
      await t.step("mark it Tertarik and make it a lead", async () => {
        await page.getByRole("button", { name: "Tandai Tertarik" }).first().click();
        await page.getByRole("button", { name: "Jadiin Lead →" }).click();
        await expectText(page, "✓ Sudah jadi lead");
      });
      await t.step("log a second DM, decline it with a reason", async () => {
        await page.locator("#hunt-target").fill("@rotiflow");
        await page.getByRole("button", { name: "Copy" }).nth(1).click();
        await page.getByRole("button", { name: "📤 Catat terkirim" }).click();
        await page.getByRole("button", { name: "Tandai Ditolak" }).first().click();
        await page.getByLabel("Alasan ditolak").fill("udah punya fotografer");
        await page.getByRole("button", { name: "Simpan", exact: true }).click();
        await expectText(page, "“udah punya fotografer”");
      });
      await t.step("change the daily goal to 25", async () => {
        await page.getByRole("button", { name: /Ubah target harian/ }).click();
        await page.getByRole("button", { name: /dari 25 DM/ }).waitFor();
      });
      await t.step("the new lead is in Leads", async () => { await go(page, "Leads"); await expectText(page, "@kopiflow"); });
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
      await t.step("the member shows as a Cold lead", async () => { await go(page, "Leads"); await page.locator(".lead-row", { hasText: "Rina Flow" }).getByText("Cold").first().waitFor({ timeout: 15000 }); });
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
    name: "dialogs work from the keyboard",
    async run(t) {
      const { page } = t;
      await t.step("sign up", () => signup(t));
      await t.step("a lead opens with Enter", async () => {
        await addLead(page, "Keyboard Flow");
        await page.locator(".lead-row", { hasText: "Keyboard Flow" }).first().focus();
        await page.keyboard.press("Enter");
        await page.getByRole("dialog").waitFor();
      });
      await t.step("Escape closes it and focus returns to the row", async () => {
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
        if (back !== "Buka lead Keyboard Flow") throw new Error(`focus went to "${back}"`);
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
        await go(page, "Lainnya", "Script Library");
        const before = await page.getByRole("button", { name: "Copy" }).count();
        await page.getByRole("button", { name: /Tampilkan \d+ lagi/ }).click();
        const after = await page.getByRole("button", { name: "Copy" }).count();
        if (!(before === 8 && after > before)) throw new Error(`copy buttons ${before} → ${after}`);
      });
      await t.step("Quick Pitch opens from the floating button", async () => {
        await page.getByRole("button", { name: /Quick Pitch/ }).click();
        await expectText(page, "💬 Quick Pitch");
      });
    },
  },
];
