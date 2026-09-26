// Flow tests: click through every SalesPal flow like a person would, and say
// exactly which step failed and where.
//
//   npm run test:flows            all flows, phone size (390×844)
//   npm run test:flows -- leads   only flows whose name contains "leads"
//   DESKTOP=1 npm run test:flows  at 1280×900
//
// Runs against the Firebase emulators (Auth + Firestore, with this repo's
// firestore.rules) and a local `next dev`; nothing touches the live project.
// Needs Java for the emulators (`brew install openjdk@21`) and the Firebase CLI.
//
// Output: tests/flows/out/report.md, plus a screenshot of every failed step.

import { spawn, execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { flows } from "./flows.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const OUT = new URL("./out/", import.meta.url).pathname;
const PORT = 3456;
const BASE = `http://localhost:${PORT}`;
const filter = process.argv[2] || "";
const desktop = Boolean(process.env.DESKTOP);

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

async function main() {
  if (!checkJava()) process.exit(2);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const project = projectId();
  const procs = [];
  const stop = () => procs.forEach(p => { try { process.kill(-p.pid); } catch { /* gone */ } });
  process.on("exit", stop);
  process.on("SIGINT", () => { stop(); process.exit(130); });

  console.log("… starting emulators and next dev");
  procs.push(spawn("firebase", ["emulators:start", "--only", "auth,firestore", "--project", project], { cwd: ROOT, detached: true, stdio: "ignore" }));
  procs.push(spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: ROOT, detached: true, stdio: "ignore",
    env: { ...process.env, NEXT_PUBLIC_FIREBASE_EMULATORS: "1" },
  }));
  const up = (await waitFor("http://127.0.0.1:8089/", 90000)) && (await waitFor("http://127.0.0.1:9099/", 30000)) && (await waitFor(`${BASE}/login`, 120000));
  if (!up) { console.error("✗ emulators or next dev did not start"); stop(); process.exit(2); }

  const browser = await chromium.launch();
  const results = [];
  for (const f of flows.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()))) {
    const ctx = await browser.newContext(desktop
      ? { viewport: { width: 1280, height: 900 } }
      : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("dialog", d => d.type() === "prompt" ? d.accept(d.defaultValue() === "20" ? "25" : d.defaultValue()) : d.accept());
    const res = { name: f.name, steps: [], errors };
    let n = 0;
    const t = {
      page, base: BASE, project,
      async step(label, fn) {
        n++;
        if (res.failed) return;
        const started = Date.now();
        try {
          await fn();
          res.steps.push({ label, ok: true, ms: Date.now() - started });
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
    `${passed}/${results.length} flows passed · ${desktop ? "1280×900" : "390×844 phone"} · emulators (project \`${project}\`)`,
    "",
  ];
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
  process.exit(passed === results.length ? 0 : 1);
}

main();
