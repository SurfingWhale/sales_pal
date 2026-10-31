// Flow tests: click through every SalesPal flow like a person would, and say
// exactly which step failed and where.
//
//   npm run test:flows            all flows, phone size (390×844)
//   npm run test:flows -- leads   only flows whose name contains "leads"
//   DESKTOP=1 npm run test:flows  at 1280×900
//   DEVICE=iphone12 …             WebKit with Playwright's iPhone 12 profile (touch, DPR 3)
//   DEVICE=safari …               WebKit as desktop Safari at 1440×900
//   PROD=1 …                      against `next build && next start` (real timings)
//   FLOW_PORT_OFFSET=100 …        every port +100 (app 3556, emulators 9199/8189, their
//                                 hub), so a second worktree can run while another does
//
// Every run also measures each flow like a person would feel it (docs/prd/PRD-010):
// taps, how long the page takes to answer a tap, any browser print/alert/
// confirm/prompt (none may remain), and the HIG audit at `t.audit()` points —
// 44px touch targets, 16px fields, no sideways scroll, axe (serious/critical).
//
// Runs against the Firebase emulators (Auth + Firestore, with this repo's
// firestore.rules) and a local `next dev`; nothing touches the live project.
// Needs Java for the emulators (`brew install openjdk@21`) and the Firebase CLI.
//
// Output: tests/flows/out/report.md, plus a screenshot of every failed step.

import { spawn, execSync } from "node:child_process";
import { connect, createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit, devices } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { flows } from "./flows.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const OUT = new URL("./out/", import.meta.url).pathname;
// FLOW_PORT_OFFSET=100 moves every port (app, emulators, their hub) so two
// runs from different worktrees can go at once. Flows read the hosts back
// from FLOW_AUTH_HOST / FLOW_FS_HOST.
const OFFSET = Number(process.env.FLOW_PORT_OFFSET || 0);
const PORT = 3456 + OFFSET;
const AUTH_PORT = 9099 + OFFSET, FS_PORT = 8089 + OFFSET;
process.env.FLOW_AUTH_HOST = `127.0.0.1:${AUTH_PORT}`;
process.env.FLOW_FS_HOST = `127.0.0.1:${FS_PORT}`;
const BASE = `http://localhost:${PORT}`;
const filter = process.argv[2] || "";
const DEVICE = process.env.DEVICE || "";
const desktop = Boolean(process.env.DESKTOP) || DEVICE === "safari";
const PROD = Boolean(process.env.PROD);
const engine = DEVICE ? webkit : chromium;
const contextFor = () =>
  DEVICE === "iphone12" ? { ...devices["iPhone 12"] }
  : DEVICE === "safari" ? { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } }
  : desktop ? { viewport: { width: 1280, height: 900 } }
  : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const sizeLabel = DEVICE === "iphone12" ? "iPhone 12 · WebKit" : DEVICE === "safari" ? "Desktop Safari · WebKit 1440×900" : desktop ? "1280×900" : "390×844 phone";

// In the page: count taps, time each tap to the next frame, and catch the
// browser's own dialogs (they stop an installed iPhone app cold).
function uxProbe() {
  const send = (k, v) => { try { window.__ux(k, v); } catch { /* binding not ready */ } };
  for (const k of ["print", "alert", "confirm", "prompt"]) {
    window[k] = function (...a) { send("native", k); return k === "confirm" ? true : k === "prompt" ? (a[1] ?? "") : undefined; };
  }
  document.addEventListener("click", () => {
    const t0 = performance.now();
    send("tap", 1);
    requestAnimationFrame(() => setTimeout(() => send("ms", Math.round(performance.now() - t0)), 0));
  }, true);
}

// The HIG audit of what's on screen now.
async function audit(page, touch) {
  if (!/^https?:/.test(page.url())) return [];
  // Judge the screen at rest: a dialog fading in reads as low contrast.
  await page.evaluate(() => Promise.race([
    // Scroll-linked animations never "finish"; only wait for time-based ones.
    Promise.all(document.getAnimations().filter(a => !a.timeline || a.timeline === document.timeline).map(a => a.finished.catch(() => undefined))),
    new Promise(r => setTimeout(r, 1500)),
  ])).catch(() => undefined);
  const found = await page.evaluate((touch) => {
    const out = [];
    const vw = innerWidth, vh = innerHeight;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px > ${vw}px)`);
    const name = (e) => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || e.id || e.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const shown = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && !e.closest("[aria-hidden=true]"); };
    if (touch) {
      const small = [];
      for (const e of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=radio], [role=checkbox], summary")) {
        if (!shown(e) || e.disabled) continue;
        if (e.matches("a") && e.closest("p, li") && !e.matches("[role=button]")) continue; // a link inside a sentence
        if (e.matches(".sp-heat")) continue; // heat map days: a dense grid by design (globals.css); the day list under it is the full-size way in
        // Its size at rest: a block rising into view on scroll (sp-rise in
        // SalesTracker, a scroll-linked animation that never "finishes") is
        // still scaled to .98 near the screen's edge.
        const b = e.getBoundingClientRect();
        const r = { width: e.offsetWidth ?? b.width, height: e.offsetHeight ?? b.height };
        if (r.width <= 2 || r.height <= 2) continue; // visually hidden (e.g. a file input behind its label)
        if (parseFloat(getComputedStyle(e).opacity) < 0.99) continue; // fading in or out, or an invisible overlay on its visible label
        if (Math.min(r.width, r.height) < 43.5 && !(e.matches("input[type=checkbox], input[type=radio]") && e.closest("label"))) small.push(`${name(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      small.forEach(x => out.push(`tap target under 44px: ${x}`));
      [...document.querySelectorAll("input, select, textarea")].filter(e => shown(e) && parseFloat(getComputedStyle(e).fontSize) < 16).forEach(e => out.push(`field under 16px (iOS zooms in): ${name(e)}`));
    }
    return out;
  }, touch);
  try {
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    for (const v of axe.violations.filter(v => v.impact === "serious" || v.impact === "critical")) {
      for (const n of v.nodes) found.push(`axe ${v.id} (${v.impact}): ${n.target.join(" ")} — “${(n.html || "").replace(/<[^>]+>/g, "").trim().slice(0, 30)}”`);
    }
  } catch (e) { found.push(`axe could not run: ${String(e.message || e).slice(0, 80)}`); }
  return found;
}

const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function projectId() {
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const env = existsSync(`${ROOT}.env.local`) ? readFileSync(`${ROOT}.env.local`, "utf8") : "";
  return env.match(/^NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)$/m)?.[1].trim().replace(/"/g, "") || "demo-salespal";
}

function checkJava() {
  try { execSync("java -version", { stdio: "ignore" }); return true; }
  catch { console.error("✗ Java not found. The Firebase emulators need it: brew install openjdk@21 (then follow brew's PATH note)."); return false; }
}

async function waitFor(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

// A run started right after another can find the last one's emulators still
// shutting down on these ports, attach to them, and lose its data when they
// finally exit. Wait until the ports are free instead. A server on "::" (next
// dev) doesn't stop a listen on 127.0.0.1 on macOS, so first see whether
// anything answers on either loopback.
const answers = (port, host) => new Promise(ok => {
  const c = connect({ port, host });
  c.setTimeout(500, () => { c.destroy(); ok(false); });
  c.once("connect", () => { c.destroy(); ok(true); }).once("error", () => ok(false));
});
const portFree = async (port) => {
  if ((await answers(port, "127.0.0.1")) || (await answers(port, "::1"))) return false;
  return new Promise(ok => {
    const s = createServer().once("error", () => ok(false)).once("listening", () => s.close(() => ok(true)));
    s.listen(port, "127.0.0.1");
  });
};

async function waitPortsFree(ports, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const busy = [];
    for (const p of ports) if (!(await portFree(p))) busy.push(p);
    if (!busy.length) return [];
    await new Promise(r => setTimeout(r, 1000));
    if (Date.now() >= until) return busy;
  }
  return ports;
}

async function main() {
  if (!checkJava()) process.exit(2);
  const busy = await waitPortsFree([FS_PORT, AUTH_PORT, PORT], 60000);
  if (busy.length) { console.error(`✗ ports still in use: ${busy.join(", ")} — another test run or emulator is up`); process.exit(2); }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const project = projectId();
  const procs = [];
  const stop = () => procs.forEach(p => { try { process.kill(-p.pid); } catch { /* gone */ } });
  process.on("exit", stop);
  process.on("SIGINT", () => { stop(); process.exit(130); });

  console.log("… starting emulators and next dev");
  // With an offset, a config of its own: every emulator port moved, rules the same.
  let config = [];
  if (OFFSET) {
    const base = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8"));
    base.emulators = { auth: { port: AUTH_PORT }, firestore: { port: FS_PORT, websocketPort: 9150 + OFFSET }, hub: { port: 20000 + OFFSET * 2 }, logging: { port: 20001 + OFFSET * 2 }, ui: { enabled: false } };
    const path = new URL(`../../.firebase-flows-${OFFSET}.json`, import.meta.url);
    writeFileSync(path, JSON.stringify(base, null, 2));
    config = ["--config", fileURLToPath(path)];
  }
  procs.push(spawn("firebase", ["emulators:start", "--only", "auth,firestore", "--project", project, ...config], { cwd: ROOT, detached: true, stdio: "ignore" }));
  // Open to every signed-in test account; the access flow closes it itself (config/access).
  const appEnv = { ...process.env, NEXT_PUBLIC_FIREBASE_EMULATORS: "1", ACCESS_OPEN: "1", NEXT_PUBLIC_EMU_AUTH_PORT: String(AUTH_PORT), NEXT_PUBLIC_EMU_FS_PORT: String(FS_PORT) };
  if (PROD) {
    console.log("… next build (PROD=1)");
    execSync("npx next build", { cwd: ROOT, env: appEnv, stdio: "ignore" });
  }
  procs.push(spawn("npx", ["next", PROD ? "start" : "dev", "-p", String(PORT)], { cwd: ROOT, detached: true, stdio: "ignore", env: appEnv }));
  const up = (await waitFor(`http://127.0.0.1:${FS_PORT}/`, 90000)) && (await waitFor(`http://127.0.0.1:${AUTH_PORT}/`, 30000)) && (await waitFor(`${BASE}/login`, 120000));
  if (!up) { console.error("✗ emulators or next dev did not start"); stop(); process.exit(2); }

  const browser = await engine.launch();
  const results = [];
  for (const f of flows.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()))) {
    // WebKit sends a page's fetches through its service worker, out of reach of
    // page.route mocks; only the flow that tests the worker keeps it.
    const opts = { ...contextFor(), ...(DEVICE && !f.serviceWorker ? { serviceWorkers: "block" } : {}) };
    const ctx = await browser.newContext(opts);
    // Chromium knows the clipboard permissions; WebKit rejects them when the page opens.
    if (!DEVICE) await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const ux = { taps: 0, ms: [], native: [], audits: [] };
    await ctx.exposeBinding("__ux", (_src, k, v) => { if (k === "tap") ux.taps++; else if (k === "ms") ux.ms.push(v); else if (k === "native") ux.native.push(v); });
    await ctx.addInitScript(uxProbe);
    // Headless WebKit refuses clipboard access without a real user; give it an
    // in-memory clipboard so Copy / Tempel are still exercised. The real
    // clipboard is checked on a device (salespal-uat S1–S7).
    if (DEVICE) await ctx.addInitScript(() => {
      let buf = "";
      try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { buf = String(t); }, readText: async () => buf } }); } catch { /* keep the real one */ }
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("dialog", d => d.type() === "prompt" ? d.accept(d.defaultValue() === "20" ? "25" : d.defaultValue()) : d.accept());
    const res = { name: f.name, steps: [], errors, ux };
    let n = 0;
    const t = {
      page, base: BASE, project, device: DEVICE, touch: Boolean(opts.hasTouch),
      // A HIG checkpoint: recorded, never stops the flow, fails the run at the end.
      async audit(label) {
        // SHOTS=1 keeps a picture of every audited screen, for a look by eye.
        if (process.env.SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}shot-${label.replace(/\W+/g, "-")}.png` }).catch(() => {}); }
        if (res.failed) return;
        const found = await audit(page, Boolean(opts.hasTouch)).catch(e => [`audit crashed: ${e.message}`]);
        ux.audits.push({ label, found });
      },
      async step(label, fn) {
        n++;
        if (res.failed) return;
        const started = Date.now();
        try {
          await fn();
          res.steps.push({ label, ok: true, ms: Date.now() - started });
          // Every screen a step leaves behind gets the HIG audit.
          if (!process.env.NO_AUDIT) ux.audits.push({ label, found: await audit(page, Boolean(opts.hasTouch)).catch(e => [`audit crashed: ${String(e.message).slice(0, 60)}`]) });
        } catch (e) {
          const shot = `${f.name.replace(/\W+/g, "-")}-${n}.png`;
          await page.screenshot({ path: OUT + shot, fullPage: false }).catch(() => {});
          res.steps.push({ label, ok: false, error: String(e.message || e).split("\n")[0], shot, url: page.url().replace(BASE, "") });
          res.failed = true;
        }
      },
    };
    process.stdout.write(`▶ ${f.name} `);
    try { await f.run(t); } catch (e) { res.steps.push({ label: "(flow crashed)", ok: false, error: String(e.message || e).split("\n")[0] }); res.failed = true; }
    if (ux.native.length) { res.steps.push({ label: "no browser print/alert/confirm/prompt", ok: false, error: `used: ${[...new Set(ux.native)].join(", ")}` }); res.failed = true; }
    console.log(res.failed ? "✗" : "✓");
    results.push(res);
    await ctx.close();
  }
  await browser.close();
  stop();

  const passed = results.filter(r => !r.failed).length;
  const lines = [
    `# Flow test report — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    "",
    `${passed}/${results.length} flows passed · ${sizeLabel}${PROD ? " · production build" : ""} · emulators (project \`${project}\`)`,
    "",
  ];
  const allMs = results.flatMap(r => r.ux.ms);
  const auditIssues = results.flatMap(r => r.ux.audits.filter(a => a.found.length).map(a => ({ flow: r.name, ...a })));
  lines.push(
    "## How it feels",
    "",
    "| Flow | Taps | Tap → next frame p75 / max | HIG audit |",
    "|---|---:|---|---|",
    ...results.map(r => `| ${r.name} | ${r.ux.taps} | ${pct(r.ux.ms, 0.75)} / ${Math.max(0, ...r.ux.ms)} ms | ${r.ux.audits.length ? `${r.ux.audits.filter(a => !a.found.length).length}/${r.ux.audits.length} clean` : "—"} |`),
    "",
    `All taps: ${allMs.length}, p75 ${pct(allMs, 0.75)} ms, p95 ${pct(allMs, 0.95)} ms, max ${Math.max(0, ...allMs)} ms.`,
    "",
  );
  // The same element seen on many screens is one finding: listed once, with where it was first seen.
  const unique = new Map();
  for (const a of auditIssues) for (const f of a.found) {
    const key = f.replace(/\d+×\d+/, "").replace(/:nth-child\(\d+\)/g, "");
    if (!unique.has(key)) unique.set(key, { f, where: `${a.flow} → ${a.label}`, n: 0 });
    unique.get(key).n++;
  }
  if (unique.size) {
    lines.push(`## HIG audit findings (${unique.size} unique)`, "");
    for (const u of [...unique.values()].sort((a, b) => a.f.localeCompare(b.f))) lines.push(`- ${u.f} — first at *${u.where}*${u.n > 1 ? ` (seen ${u.n}×)` : ""}`);
    lines.push("");
  }
  writeFileSync(OUT + "ux.json", JSON.stringify({ device: sizeLabel, prod: PROD, results: results.map(r => ({ name: r.name, failed: !!r.failed, taps: r.ux.taps, p75: pct(r.ux.ms, 0.75), max: Math.max(0, ...r.ux.ms), audits: r.ux.audits })) }, null, 1));
  for (const r of results) {
    lines.push(`## ${r.failed ? "✗" : "✓"} ${r.name}`, "");
    for (const s of r.steps) {
      lines.push(s.ok ? `- ✓ ${s.label} (${s.ms}ms)` : `- **✗ ${s.label}** — ${s.error}${s.url ? ` · at \`${s.url}\`` : ""}${s.shot ? ` · screenshot \`out/${s.shot}\`` : ""}`);
    }
    if (r.errors.length) lines.push("", `Page errors: ${r.errors.slice(0, 3).map(e => `\`${e.slice(0, 120)}\``).join("; ")}`);
    lines.push("");
  }
  writeFileSync(OUT + "report.md", lines.join("\n"));
  console.log(`\n${passed}/${results.length} flows passed — tests/flows/out/report.md`);
  console.log(`${sizeLabel}: ${allMs.length} taps · tap → next frame p75 ${pct(allMs, 0.75)} ms, p95 ${pct(allMs, 0.95)} ms, max ${Math.max(0, ...allMs)} ms · HIG audit: ${unique.size} finding(s)`);
  if (unique.size) {
    console.log(`✗ HIG audit: ${unique.size} unique finding(s):`);
    for (const u of [...unique.values()].slice(0, 120)) console.log(`  - ${u.f} — first at ${u.where}${u.n > 1 ? ` (${u.n}×)` : ""}`);
  }
  for (const r of results.filter(r => r.failed)) console.log(`✗ ${r.name}: ${r.steps.filter(s => !s.ok).map(s => `${s.label} — ${s.error}`).join("; ")}`);
  process.exit(passed === results.length && !unique.size ? 0 : 1);
}

main();
