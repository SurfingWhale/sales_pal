// Every flow a person takes through SalesPal, step by step. Each flow gets a
// fresh browser and a fresh account; a failed step stops that flow only.
// Selectors are the labels a person reads, so a renamed button fails here
// the same way it would confuse someone using the app.

import { readFileSync } from "node:fs";

const OWNER_EMAIL = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8").match(/email in \['([^']+)'\]/)?.[1];

// ---------- helpers ----------
// One DM in Hunting's log: the row that holds this target and its delete button.
const huntRow = (page, target) => page.locator("div").filter({ has: page.getByText(target, { exact: true }) }).filter({ has: page.getByRole("button", { name: /^Hapus DM/ }) }).last();

async function signup(t) {
  const { page, base } = t;
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: "Daftar gratis" }).click();
  await page.locator('input[type="email"]').fill(`flow${Date.now()}${Math.floor(Math.random() * 1e4)}@contoh.id`);
  await page.locator('input[type="password"]').fill("rahasia123");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.getByRole("heading", { name: /^Perlu ditindak/ }).waitFor();
}

async function go(page, place, tab) {
  await page.locator(".sp-nav-btn", { hasText: place }).click();
  if (tab) await page.locator(".sp-sub-btn", { hasText: new RegExp(`^${tab}$`) }).click();
  await page.waitForTimeout(300);
}

const modal = (page) => page.locator(".modal-overlay").last();

// The server opens Threads links (/api/hunt/unfurl); flows answer for it, so
// nothing here reaches threads.com.
async function mockUnfurl(page) {
  const known = {
    AbC123: { handle: "@tokokue", name: "Toko Kue", text: "ada yang open jasa foto katalog buat UMKM?", postUrl: "https://www.threads.com/@tokokue/post/AbC123", postId: "AbC123" },
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
    name: "sign up and land on the dashboard",
    async run(t) {
      await t.step("login page loads with Google and email options", async () => {
        await t.page.goto(`${t.base}/login`);
        await t.page.getByRole("button", { name: "Lanjutkan dengan Google" }).waitFor();
      });
      await t.step("create an account with email", () => signup(t));
      await t.step("Beranda says what to do before the lead map", async () => {
        await t.page.getByRole("heading", { level: 1, name: /perlu ditindak hari ini|mendesak hari ini/ }).waitFor();
        const order = await t.page.evaluate(() => [...document.querySelectorAll(".sp-main h2")].map(h => (h.textContent || "").trim()));
        const todo = order.findIndex(x => /^Perlu ditindak/.test(x)), map = order.findIndex(x => /^Peta lead/.test(x));
        if (todo < 0 || map < 0 || todo > map) throw new Error(`headings: ${order.join(" | ")}`);
      });
    },
  },
  {
    name: "navigation reaches every place and tab",
    async run(t) {
      await t.step("sign up", () => signup(t));
      const places = [["Beranda", null, "Perlu ditindak"], ["Hunting", null, "Hunting Mode"],
        ["Jualan", "Leads", "Belum ada lead"], ["Jualan", "Penawaran", "Susun dari paket"], ["Jualan", "Invoice", "Invoice & Pembayaran"], ["Jualan", "Paket", "Paket & Harga"],
        ["Tim", "Guild", "Belum ikut guild"], ["Tim", "Report Klien", "Report Klien"], ["Tim", "Outreach", "Outreach Tracker"], ["Tim", "Rejection Log", "Rejection"],
        ["Belajar", "Script Library", "Script Library"], ["Belajar", "Simulator", "Simulator"], ["Belajar", "AI Playbook", "Playbook"]];
      for (const [place, tab, heading] of places) {
        await t.step(`${place}${tab ? ` → ${tab}` : ""} shows "${heading}"`, async () => { await go(t.page, place, tab); await expectText(t.page, heading); });
      }
      await t.step("each tab says in one line what it's for", async () => {
        await go(t.page, "Tim", "Guild");
        await expectText(t.page, "Tim kamu: anggota, peran");
        await go(t.page, "Belajar", "Simulator");
        await expectText(t.page, "Latihan jawab customer sebelum ketemu beneran.");
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
        await t.page.keyboard.press("Escape");
        await modal(t.page).click({ position: { x: 5, y: 5 } }).catch(() => {});
      });
    },
  },
  {
    name: "leads: add, filter, follow-up, delete",
    async run(t) {
      await t.step("sign up", () => signup(t));
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
        await t.page.getByRole("button", { name: "✓ Selesai" }).waitFor();
        await expectText(t.page, "Kenapa 75");
        await expectText(t.page, "Potensi tinggi");
        await closeAll(t.page);
      });
      await t.step("the Tinggi filter finds it", async () => {
        await go(t.page, "Jualan", "Leads");
        await t.page.getByRole("button", { name: /^Tinggi/ }).click();
        await expectText(t.page, "Kopi Flow");
        await t.page.getByRole("button", { name: /^Semua/ }).click();
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
        await t.page.getByRole("button", { name: "🦁 Singa" }).click();
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
      await t.step("delete asks first, then removes it", async () => {
        await openLeadRow(t.page, "Kopi Flow");
        await t.page.getByRole("button", { name: "Menu lead" }).first().click();
        await t.page.getByRole("menuitem", { name: "Hapus lead Kopi Flow" }).click();
        await t.page.locator(".lead-row", { hasText: "Kopi Flow" }).first().waitFor({ state: "detached", timeout: 8000 });
      });
    },
  },
  {
    name: "whatsapp: a chat shared from Android becomes a new lead's profile",
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
      await t.step("accepting closed the lead", async () => { await go(page, "Jualan", "Leads"); await page.locator(".lead-row", { hasText: "Bakso Flow" }).getByText("Closed").first().waitFor(); });
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
      await t.step("sign up and open Hunting", async () => { await mockUnfurl(page); await signup(t); await go(page, "Hunting"); await expectText(page, "Cold DM — Tawarin Jasa"); });
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
      await t.step("copy a template: it is logged at once", async () => {
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await page.getByRole("link", { name: "Profil ↗" }).first().waitFor();
        await page.getByRole("button", { name: "Batal catat" }).waitFor();
      });
      await t.step("mark it Tertarik and make it a lead", async () => {
        await page.getByRole("button", { name: "Tandai Tertarik" }).first().click();
        await page.getByRole("button", { name: "Jadiin Lead →" }).click();
        await expectText(page, "✓ Sudah jadi lead");
      });
      await t.step("log a second DM, decline it with a reason", async () => {
        await page.locator("#hunt-target").fill("@rotiflow");
        await page.getByRole("button", { name: "Copy", exact: true }).nth(1).click();
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
        await huntRow(page, "@rotiflow").getByRole("button", { name: "Tandai Terkirim" }).click();
        await page.getByRole("region", { name: /Saran balasan/ }).waitFor({ state: "detached" });
      });
      await t.step("change the daily goal to 25", async () => {
        await page.getByRole("button", { name: /Ubah target harian/ }).click();
        await page.getByRole("button", { name: /dari 25 DM/ }).waitFor();
      });
      await t.step("the new lead is in Leads", async () => { await go(page, "Jualan", "Leads"); await expectText(page, "@kopiflow"); });
    },
  },
  {
    name: "journey: shared post, intro, answer, data to ETB, DNC, session bar",
    async run(t) {
      const { page, base } = t;
      const row = (who) => page.getByRole("button", { name: `Journey ${who}`, exact: true });
      const pick = async (f) => { await page.getByRole("group", { name: "Saring prospek" }).getByRole("button", { name: new RegExp(`^${f}`) }).click(); };
      await t.step("sign up and open Hunting", async () => { await mockUnfurl(page); await signup(t); await go(page, "Hunting"); await expectText(page, "Journey prospek"); });
      await t.step("a post shared from Threads opens as a prospect with its words", async () => {
        await page.goto(`${base}/share?text=${encodeURIComponent("liat deh https://www.threads.com/share/AbC123/")}`);
        await page.waitForURL("**/dashboard**");
        await page.waitForFunction(() => document.querySelector("#hunt-target")?.value === "@tokokue", null, { timeout: 10000 });
        await page.getByLabel("Prospek @tokokue").getByText("ada yang open jasa foto katalog buat UMKM?").waitFor();
        await page.getByRole("radio", { name: "Balas di post", checked: true }).waitFor();
      });
      await t.step("before the message: the post's context and the stage that fits", async () => {
        const card = page.getByLabel("Prospek @tokokue");
        await card.getByText("foto katalog", { exact: true }).waitFor();
        await card.getByText("Saran tahap:").waitFor();
        await page.getByRole("listitem", { name: "Tahap 1: Intro, cocok sekarang" }).waitFor();
        await card.getByRole("button", { name: "✎ Ubah konteks" }).click();
        await page.locator("#ctx-when").fill("besok jam 1-5 sore");
        await page.getByRole("button", { name: "Simpan konteks" }).click();
        await card.getByText("besok jam 1-5 sore").waitFor();
      });
      await t.step("an empty stage takes an example, filled in with their need", async () => {
        const offer = page.getByRole("listitem", { name: /Tahap 4: Penawaran/ });
        await offer.getByRole("button", { name: "+ Pakai contoh" }).click();
        await offer.getByText(/dua pilihan paket buat foto katalog besok jam 1-5 sore/).waitFor();
      });
      await t.step("a new template shows its stage, the words it can use, and a preview", async () => {
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
        await page.getByRole("button", { name: "▶ Mulai hunting" }).click();
        await page.getByRole("region", { name: "Sesi hunting" }).getByText(/0 intro/).waitFor();
      });
      await t.step("Copy logs the intro at once; Batal takes it back", async () => {
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await expectText(page, "Tercatat: balasan di post ke @tokokue");
        await page.getByRole("button", { name: "Batal catat" }).click();
        await expectText(page, "Belum ada DM.");
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
        await page.getByText("boleh kak, pricelist-nya berapa?").waitFor();
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
        await huntRow(page, "@tokokue").getByText("Tertarik").first().waitFor();
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
        await page.getByRole("alert").getByText("minta ga dihubungi").waitFor();
        if (!(await page.getByRole("button", { name: "Copy", exact: true }).first().isDisabled())) throw new Error("Copy still works for a DNC prospect");
        await pick("DNC");
        await row("@rotikeju").getByText("Jangan dihubungi").waitFor();
      });
      await t.step("ending the session leaves a summary", async () => {
        await page.getByRole("button", { name: "Akhiri sesi hunting" }).click();
        await page.getByRole("region", { name: "Sesi hunting" }).waitFor({ state: "detached" });
        await expectText(page, "Sesi terakhir:");
      });
      await t.step("performa hunter counts the conversion", async () => {
        await page.getByRole("button", { name: /Performa hunter/ }).click();
        await page.getByText("Konversi NTB → ETB").waitFor();
      });
      await t.step("the Hot lead is in Leads", async () => { await go(page, "Jualan", "Leads"); await expectText(page, "Toko Kue"); });
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
      await t.step("back to Jualan: start hunting from the strip", async () => {
        await go(page, "Beranda");
        await tab("Jualan").click();
        await page.getByRole("heading", { name: /^Perlu ditindak/ }).waitFor();
        await page.getByRole("region", { name: "Hunting hari ini" }).getByRole("button", { name: "▶ Mulai hunting" }).click();
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
        await go(page, "Tim", "Guild");
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
        await modal(page).getByRole("button", { name: "Tutup", exact: true }).click();
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
      await t.step("open the printable monthly report", async () => {
        await page.getByRole("button", { name: "Cetak / PDF" }).click();
        await expectText(page, "LAPORAN BULANAN");
        await expectText(page, "OMZET PER SUMBER");
        await modal(page).getByRole("button", { name: "Tutup", exact: true }).click();
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
