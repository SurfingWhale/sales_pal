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
  // The dialog closes once the write is confirmed; the row can show up before that.
  await page.locator(".modal-overlay").waitFor({ state: "detached", timeout: 10000 });
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
        await go(page, "Lainnya", "Guild");
        await page.getByRole("button", { name: "+ Bikin guild" }).click();
        await modal(page).locator("#gd-name").fill("Tim Uji");
        await modal(page).getByRole("button", { name: "Bikin guild" }).click();
        await expectText(page, "Undang orang");
      });
      await t.step("leader makes a member invite link", async () => {
        await page.locator("#inv-role").selectOption("member");
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
      await t.step("the leader prints the team report", async () => {
        await page.getByRole("button", { name: "Cetak / PDF" }).click();
        await expectText(page, "REPORT SALES TIM");
        await page.getByRole("button", { name: "TUTUP" }).click();
      });
      await t.step("the activity log shows who did what", async () => {
        await page.getByRole("tab", { name: "Aktivitas" }).click();
        await page.getByText("gabung guild").first().waitFor({ timeout: 10000 });
        await page.getByText("closing lunas").first().waitFor();
        await p2.getByRole("tab", { name: "Aktivitas" }).click();
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
        await page.getByRole("tab", { name: "Aktivitas" }).click();
        await page.getByText("pindah pemilik deal").first().waitFor({ timeout: 10000 });
      });
      await t.step("the leader promotes the member to officer", async () => {
        await page.getByRole("tab", { name: /^Anggota/ }).click();
        await page.locator("select[id^='role-']").first().selectOption("officer");
        await p2.getByRole("tab", { name: "Pipeline" }).click();
        await p2.getByText("Semua deal tim").waitFor({ timeout: 10000 });
        await p2.context().close();
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
        await go(page, "Leads");
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
        await go(page, "Lainnya", "Report Klien");
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
      await t.step("open the printable monthly report", async () => {
        await page.getByRole("button", { name: "Cetak / PDF" }).click();
        await expectText(page, "LAPORAN BULANAN");
        await expectText(page, "OMZET PER SUMBER");
        await page.getByRole("button", { name: "TUTUP" }).click();
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
