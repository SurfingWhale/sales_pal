"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { authFetch } from "@/lib/authFetch";
import { useSpace } from "@/lib/space";
import { waLink } from "@/lib/billing";
import { DEFAULT_OPENER, Place, TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE, TEMPLATE_GUIDE, Weakness, opener, snippet, weaknesses } from "@/lib/places";
import { btnMuted, btnPrimary, chip, font, inputStyle, label, modalBox, WA_INK } from "@/components/ui";

// Cari bisnis (PRD-012, owner: "kayak Mapileads"): search Google Maps for the
// kind of business you sell to, see each one's weak spots from its reviews,
// copy an opening message built from them, and keep the ones worth pitching
// as leads. A list made elsewhere comes in through the Excel template.

export interface Found extends Place { weak: Weakness[] }

const key = (name: string, phone: string) => `${name.trim().toLowerCase()}|${phone.replace(/\D/g, "").slice(-9)}`;

export function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const rows = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE], { header: [...TEMPLATE_COLUMNS] });
  rows["!cols"] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(14, c.length + 4) }));
  XLSX.utils.book_append_sheet(wb, rows, "Leads");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TEMPLATE_GUIDE), "Panduan");
  XLSX.writeFile(wb, "SalesPal-template-leads.xlsx");
}

export default function LeadFinder({ known, me, onSave, onImport, onClose }: {
  known: { name: string; phone: string }[];
  me: { name?: string; tagline?: string };
  onSave: (rows: Found[]) => Promise<number>;
  onImport: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [withEmail, setWithEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [next, setNext] = useState("");
  // Who may search, and what's left, from the server (PRD-015). The search
  // itself is checked again there.
  const space = useSpace();
  const guild = space.kind === "guild" ? space.id : "";
  const [denied, setDenied] = useState("");
  const [unguarded, setUnguarded] = useState(false);   // the owner is told when caps can't be counted
  const [left, setLeft] = useState<{ today?: number; month: number } | null>(null);
  const [asked, setAsked] = useState("");   // the search on screen: the same one isn't paid for twice
  useEffect(() => {
    let live = true;
    authFetch(`/api/access${guild ? `?guild=${encodeURIComponent(guild)}` : ""}`).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!live || !j) return;
      setDenied(j.tools?.places?.ok === false ? j.tools.places.why : "");
      setUnguarded(Boolean(j.owner) && j.enforced === false);
      if (j.left?.places) setLeft({ month: j.left.places.left });
    }, () => undefined);
    return () => { live = false; };
  }, [guild]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tpl, setTpl] = useState(DEFAULT_OPENER);
  const [copied, setCopied] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  useEffect(() => { try { const t = localStorage.getItem("sp-opener"); if (t) setTpl(t); } catch { /* private mode */ } }, []);
  useEffect(() => { try { localStorage.setItem("sp-opener", tpl); } catch { /* private mode */ } }, [tpl]);

  const have = useMemo(() => new Set(known.map(k => key(k.name, k.phone))), [known]);
  const isKnown = (p: Place) => have.has(key(p.name, p.phone));

  async function search(more = false) {
    if (!q.trim()) { setErr("Tulis dulu yang dicari, mis. \"coffee shop Jakarta Selatan\"."); return; }
    const ask = `${q.trim().toLowerCase()}|${withEmail}`;
    if (!more && found && ask === asked) { setErr(""); return; }
    setBusy(true); setErr(""); setSaved(null);
    try {
      const res = await authFetch("/api/places", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, withEmail, pageToken: more ? next : "", guild }) });
      const json = await res.json();
      if (res.status === 403) setDenied(json?.error || "");
      if (!res.ok) throw new Error(json?.error || "Pencarian gagal. Coba lagi.");
      if (json.left) setLeft(json.left);
      setAsked(ask);
      const rows: Found[] = (json.places as Place[]).map(p => ({ ...p, weak: weaknesses(p) }));
      setFound(cur => (more && cur ? [...cur, ...rows] : rows));
      setNext(json.nextPageToken || "");
      if (!more) setPicked(new Set(rows.filter(p => !isKnown(p) && p.weak.length).map(p => p.id)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(p: Found) {
    try { await navigator.clipboard.writeText(opener(tpl, p, p.weak, me)); setCopied(p.id); setTimeout(() => setCopied(""), 1800); }
    catch { setErr("Gagal nyalin. Tekan lama teksnya, lalu salin manual."); }
  }

  async function save() {
    if (!found) return;
    setBusy(true); setErr("");
    try { setSaved(await onSave(found.filter(p => picked.has(p.id)))); setPicked(new Set()); }
    catch { setErr("Gagal nyimpen lead. Cek koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }

  const toggle = (id: string) => setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="lf-h" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 640 }}>
        <div id="lf-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>Cari bisnis</div>
        <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "4px 0 16px" }}>
          Cari jenis bisnis yang mau kamu tawarin di Google Maps. Tiap hasil dikasih titik lemah dari ulasannya, plus pesan pembuka yang tinggal disalin.
        </p>

        <form onSubmit={e => { e.preventDefault(); search(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label htmlFor="lf-q" className="vh">Yang dicari</label>
          <input id="lf-q" value={q} onChange={e => setQ(e.target.value)} placeholder="mis. coffee shop Jakarta Selatan" style={{ ...inputStyle, flex: "1 1 240px" }} />
          <button type="submit" disabled={busy || Boolean(denied)} style={{ ...btnPrimary, minHeight: 48, opacity: busy || denied ? 0.6 : 1 }}>{busy && !found ? "Mencari…" : "Cari"}</button>
        </form>
        {denied && (
          <div role="note" style={{ fontSize: 13, lineHeight: 1.5, margin: "8px 0", padding: "10px 12px", borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
            🔒 {denied} Sementara itu, Import Excel di bawah tetap bisa.
          </div>
        )}
        {unguarded && (
          <div role="note" style={{ fontSize: 12, lineHeight: 1.5, margin: "8px 0", padding: "8px 10px", borderRadius: 10, background: "#b453090f", border: "1px solid #b4530940" }}>
            Buat kamu (owner): batas bulanan & pintu undangan belum jalan penuh. Isi <code>FIREBASE_SERVICE_ACCOUNT</code> di Vercel. Sampai itu, alat berbayar cuma bisa dipakai kamu.
          </div>
        )}
        {!denied && left && (
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>
            Sisa pencarian{typeof left.today === "number" ? `: ${left.today} hari ini ·` : ""} {left.month} bulan ini (jatah gratis semua akun)
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14 }}>
          <input type="checkbox" checked={withEmail} onChange={e => setWithEmail(e.target.checked)} style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
          Cari juga email di website-nya (lebih lama)
        </label>
        <div role="status" style={{ fontSize: 13, color: "var(--hot)", margin: err ? "6px 0" : 0 }}>{err}</div>

        {found && (
          <>
            <div style={{ fontSize: 13, color: "var(--app-muted)", margin: "12px 0 8px" }}>{found.length} bisnis · {picked.size} dipilih</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {found.map(p => {
                const dupe = isKnown(p);
                const worst = p.reviews.filter(r => r.rating <= 3 && r.text.trim()).sort((a, b) => a.rating - b.rating)[0];
                return (
                  <article key={p.id} aria-label={p.name} style={{ background: "var(--app-inner)", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* 22px box, 44px to the finger. */}
                      <label style={{ width: 44, height: 44, margin: "-11px -11px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: dupe ? "default" : "pointer" }}>
                        <input type="checkbox" aria-label={`Pilih ${p.name}`} checked={picked.has(p.id)} disabled={dupe} onChange={() => toggle(p.id)} style={{ width: 22, height: 22, margin: 0, accentColor: "#005eb0" }} />
                      </label>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 2 }}>
                          {[p.category, p.rating !== null ? `★ ${p.rating.toLocaleString("id-ID")} (${p.reviewCount})` : "Belum ada rating", dupe ? "udah ada di Leads" : ""].filter(Boolean).join(" · ")}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--app-sub)", marginTop: 2 }}>{p.address}</div>
                        <div style={{ fontSize: 13, marginTop: 6, display: "flex", gap: "0 16px", flexWrap: "wrap", alignItems: "center" }}>
                          {p.phone && <span>{p.phone}</span>}
                          {p.email && <span>{p.email}</span>}
                          {p.website ? <a href={p.website} target="_blank" rel="noreferrer" style={{ color: "var(--brand-text)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Website ↗</a> : null}
                          {p.mapsUrl && <a href={p.mapsUrl} target="_blank" rel="noreferrer" style={{ color: "var(--brand-text)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Maps ↗</a>}
                        </div>
                        {p.weak.length > 0 && (
                          <ul aria-label="Titik lemah" style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {p.weak.map(w => <li key={w.label} style={{ fontSize: 12.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "var(--app-card)", border: "1px solid var(--app-border)" }}>{w.label}</li>)}
                          </ul>
                        )}
                        {worst && <p style={{ fontSize: 13, color: "var(--app-sub)", margin: "8px 0 0" }}>“{snippet(worst.text)}” · {worst.rating}★</p>}
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <button onClick={() => copy(p)} style={{ ...chip, minHeight: 44, fontWeight: 700, color: copied === p.id ? "var(--ok)" : "var(--app-text)" }}>{copied === p.id ? "✓ Tersalin" : "Salin pesan"}</button>
                          {p.phone && <a href={waLink(p.phone, opener(tpl, p, p.weak, me))} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700, background: "#25D366", color: WA_INK, border: 0 }}>Kirim WA</a>}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {next && <button onClick={() => search(true)} disabled={busy} style={{ ...chip, width: "100%", minHeight: 44, marginTop: 8, fontWeight: 600, color: "var(--app-text)" }}>{busy ? "Memuat…" : "Muat 20 lagi"}</button>}
          </>
        )}

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontWeight: 700 }}>Template pesan pembuka</summary>
          <label htmlFor="lf-tpl" style={label}>Isi pesan</label>
          <textarea id="lf-tpl" value={tpl} onChange={e => setTpl(e.target.value)} style={{ ...inputStyle, height: 110, resize: "vertical", lineHeight: 1.5 }} />
          <p style={{ fontSize: 12, color: "var(--app-muted)", margin: "6px 0 0" }}>{"{nama} {kelemahan} {rating} {bisnis} {jasa}"} diisi otomatis; {"{bisnis}"} dan {"{jasa}"} dari Kop & logo.</p>
        </details>

        <section aria-label="Punya daftar sendiri" style={{ marginTop: 12, padding: 14, borderRadius: 14, background: "var(--app-inner)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Punya daftar sendiri?</div>
          <p style={{ fontSize: 13, color: "var(--app-sub)", margin: "4px 0 10px" }}>Isi template Excel (dari ekspor tool Google Maps, atau manual), lalu import. Kolomnya langsung kebaca.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={downloadTemplate} style={{ ...btnMuted, minHeight: 44 }}>Download template Excel</button>
            <button onClick={onImport} style={{ ...btnMuted, minHeight: 44 }}>Import Excel</button>
          </div>
        </section>

        {saved !== null && <div role="status" style={{ fontSize: 14, color: "var(--ok)", marginTop: 12, fontWeight: 600 }}>{saved} bisnis masuk Leads.</div>}
        <div className="sp-form-foot">
          <button onClick={onClose} disabled={busy} style={btnMuted}>Tutup</button>
          <button onClick={save} disabled={busy || !picked.size} style={{ ...btnPrimary, flex: 1, opacity: busy || !picked.size ? 0.6 : 1 }}>
            {picked.size ? `Simpan ${picked.size} jadi lead` : "Pilih bisnis dulu"}
          </button>
        </div>
      </div>
    </div>
  );
}
