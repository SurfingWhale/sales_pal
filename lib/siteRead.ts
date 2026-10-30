// A business's own website, read the way a link preview reads it (PRD-012
// email, PRD-018 paste). Server only: one page at a time, a few seconds each,
// at most one redirect, and only ever to a public address.

const UA = "SalesPal/1.0 (+lead finder)";
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const NOT_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|sentry|wixpress|@2x|domain\.com/i;
const CONTACT_PAGES = ["/kontak", "/contact", "/hubungi-kami"];

// Only a public web address: no IP literals, no local or internal hosts.
export function publicSite(site: string): boolean {
  try {
    const u = new URL(site);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return h.includes(".") && !/^[\d.]+$/.test(h) && !h.includes(":") && !/(^|\.)(localhost|local|internal|lan)$/.test(h);
  } catch { return false; }
}

// One HTML page, or "" when it can't be read.
async function page(url: string): Promise<string> {
  if (!publicSite(url)) return "";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const get = (u: string) => fetch(u, { signal: ctrl.signal, redirect: "manual", headers: { "User-Agent": UA, Accept: "text/html" } });
    let res = await get(url);
    // One redirect (http → https, www), and only to another public site.
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (next) { const to = new URL(next, url).toString(); if (!publicSite(to)) return ""; res = await get(to); }
    if (!res.ok || !(res.headers.get("content-type") || "").includes("text/html")) return "";
    return (await res.text()).slice(0, 400_000);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function emailIn(html: string, site: string): string {
  const found = (html.match(EMAIL) || []).map(e => e.toLowerCase()).filter(e => !NOT_EMAIL.test(e));
  const host = new URL(site).hostname.replace(/^www\./, "");
  return found.find(e => e.endsWith(`@${host}`)) || found[0] || "";
}

// A public email on the business's own site: its home page, then a contact page.
// `home`: the page already read, so it isn't fetched twice.
export async function emailOf(site: string, home?: string): Promise<string> {
  if (!publicSite(site)) return "";
  for (const path of ["/", ...CONTACT_PAGES]) {
    const html = path === "/" && home !== undefined ? home : await page(new URL(path, site).toString());
    const e = html && emailIn(html, site);
    if (e) return e;
  }
  return "";
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function meta(html: string, key: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase() !== key) continue;
    const c = tag.match(/\bcontent=(["'])([\s\S]*?)\1/i);
    if (c) return decode(c[2]).replace(/\s+/g, " ").trim();
  }
  return "";
}

export interface SiteRead { url: string; title: string; name: string; description: string; email: string; phone: string; instagram: string }

// What the page says about the business: its name, what it does, and how to reach it.
export async function readSite(raw: string): Promise<SiteRead | null> {
  if (!publicSite(raw)) return null;
  const html = await page(raw);
  if (!html) return null;
  const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
  const name = meta(html, "og:site_name") || title.split(/\s+[|–—-]\s+/)[0] || "";
  const tel = html.match(/href=["']tel:([+\d\s().-]{8,20})["']/i)?.[1]
    || html.match(/wa\.me\/(\d{9,15})/i)?.[1]
    || html.match(/api\.whatsapp\.com\/send\/?\?phone=(\d{9,15})/i)?.[1] || "";
  const ig = html.match(/instagram\.com\/([A-Za-z0-9._]{2,30})\/?["'?]/i)?.[1] || "";
  const site = new URL(raw).origin;
  return {
    url: raw, title: title.slice(0, 160), name: name.slice(0, 120),
    description: (meta(html, "og:description") || meta(html, "description")).slice(0, 300),
    email: await emailOf(site, html), phone: tel.trim(),
    instagram: ig && !["p", "reel", "explore", "accounts"].includes(ig.toLowerCase()) ? `@${ig}` : "",
  };
}
