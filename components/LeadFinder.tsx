"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { useSpace } from "@/lib/space";
import { waLink } from "@/lib/billing";
import { DupFields, DupHit, dupIndex } from "@/lib/leadDupes";
import { DEFAULT_OPENER, Place, Weakness, opener, placeLeadId, snippet, weaknesses } from "@/lib/places";
import { btnMuted, btnPrimary, chip, inputStyle, label, WA_INK } from "@/components/ui";

// Cari di Maps (PRD-012, PRD-022 Q13; owner: "kayak Mapileads"): search Google
// Maps for the kind of business you sell to, see each one's weak spots from its
// reviews, copy an opening message built from them, and keep the ones worth
// pitching as leads. Nothing is ticked for you: Pilih semua takes everything not
// in Leads yet, and what's already there sits apart below it.

export interface Found extends Place { weak: Weakness[] }
export type KnownLead = DupFields & { id: string };

interface Row { p: Found; apart: boolean; locked: boolean; note: string }

// Where one result stands against the list. Saving writes the place's own lead
// id, so the same place, number, email or @handle can't be picked: that would
// overwrite the lead, or chat the same person twice. The same name alone may be
// another branch, so it sits apart and stays the seller's call.
function standing(p: Found, ids: Set<string>, find: (c: DupFields) => DupHit<KnownLead> | null): Row {
  if (ids.has(placeLeadId(p.id))) return { p, apart: true, locked: true, note: "udah ada di Leads" };
  const hit = find({ name: p.name, phone: p.phone, email: p.email });
  if (!hit) return { p, apart: false, locked: false, note: "" };
  if (hit.why === "nama") return { p, apart: true, locked: false, note: `nama sama dengan ${hit.lead.name || "lead lain"} di Leads. Cabang lain? Pilih sendiri` };
  return { p, apart: true, locked: true, note: `udah ada di Leads: ${hit.lead.name || "tanpa nama"} (${hit.why} sama)` };
}

function FoundCard({ row, on, copied, tpl, me, onToggle, onCopy }: {
  row: Row;
  on: boolean;
  copied: boolean;
  tpl: string;
  me: { name?: string; tagline?: string };
  onToggle: (id: string) => void;
  onCopy: (p: Found) => void;
}) {
  const { p, apart, locked, note } = row;
  const worst = p.reviews.filter(r => r.rating <= 3 && r.text.trim()).sort((a, b) => a.rating - b.rating)[0];
  return (
    <article aria-label={p.name} style={{ background: apart ? "transparent" : "var(--app-inner)", border: apart ? "1px solid var(--app-border)" : 0, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* 22px box, 44px to the finger. */}
        <label style={{ width: 44, height: 44, margin: "-11px -11px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: locked ? "default" : "pointer" }}>
          <input type="checkbox" aria-label={`Pilih ${p.name}`} checked={on} disabled={locked} onChange={() => onToggle(p.id)} style={{ width: 22, height: 22, margin: 0, accentColor: "#005eb0" }} />
        </label>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
          <div style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 2 }}>
            {[p.category, p.rating !== null ? `★ ${p.rating.toLocaleString("id-ID")} (${p.reviewCount})` : "Belum ada rating"].filter(Boolean).join(" · ")}
          </div>
          {note && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{note}</div>}
          <div style={{ fontSize: 13, color: "var(--app-sub)", marginTop: 2 }}>{p.address}</div>
          <div style={{ fontSize: 13, marginTop: 6, display: "flex", gap: "0 16px", flexWrap: "wrap", alignItems: "center" }}>
            {p.phone && <span>{p.phone}</span>}
            {p.email && <span>{p.email}</span>}
            {p.website ? <a href={p.website} target="_blank" rel="noreferrer" style={{ color: "var(--brand-text)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Website ↗</a> : null}
            {p.mapsUrl && <a href={p.mapsUrl} target="_blank" rel="noreferrer" style={{ color: "var(--brand-text)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Maps ↗</a>}
          </div>
          {p.weak.length > 0 && (
            <ul aria-label="Titik lemah" style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {p.weak.map(w => <li key={w.label} style={{ fontSize: 13, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "var(--app-card)", border: "1px solid var(--app-border)" }}>{w.label}</li>)}
            </ul>
          )}
          {worst && <p style={{ fontSize: 13, color: "var(--app-sub)", margin: "8px 0 0" }}>“{snippet(worst.text)}” · {worst.rating}★</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => onCopy(p)} style={{ ...chip, minHeight: 44, fontWeight: 700, color: copied ? "var(--ok)" : "var(--app-text)" }}>{copied ? "✓ Tersalin" : "Salin pesan"}</button>
            {p.phone && <a href={waLink(p.phone, opener(tpl, p, p.weak, me))} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700, background: "#25D366", color: WA_INK, border: 0 }}>Kirim WA</a>}
          </div>
        </div>
      </div>
    </article>
  );
}

function withAll(s: Set<string>, ids: string[]): Set<string> {
  const n = new Set(s);
  for (const id of ids) n.add(id);
  return n;
}

function flip(s: Set<string>, id: string): Set<string> {
  const n = new Set(s);
  if (n.has(id)) n.delete(id); else n.add(id);
  return n;
}

export default function LeadFinder({ leads, me, onSave, onBusy, onClose }: {
  leads: KnownLead[];
  me: { name?: string; tagline?: string };
  onSave: (rows: Found[]) => Promise<number>;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [withEmail, setWithEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saveErr, setSaveErr] = useState("");
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
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);

  const rows = useMemo(() => {
    const find = dupIndex(leads);
    const ids = new Set(leads.map(l => l.id));
    return (found || []).map(p => standing(p, ids, find));
  }, [found, leads]);
  const fresh = rows.filter(r => !r.apart);
  const apart = rows.filter(r => r.apart);
  const chosen = rows.filter(r => !r.locked && picked.has(r.p.id)).map(r => r.p);
  const allOn = fresh.length > 0 && fresh.every(r => picked.has(r.p.id));

  async function search(more = false) {
    if (!q.trim()) { setErr("Tulis dulu yang dicari, mis. \"coffee shop Jakarta Selatan\"."); return; }
    const ask = `${q.trim().toLowerCase()}|${withEmail}`;
    if (!more && found && ask === asked) { setErr(""); return; }
    setBusy(true); setErr(""); setSaveErr(""); setSaved(null);
    try {
      const res = await authFetch("/api/places", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, withEmail, pageToken: more ? next : "", guild }) });
      const json = await res.json();
      if (res.status === 403) setDenied(json?.error || "");
      if (!res.ok) throw new Error(json?.error || "Pencarian gagal. Coba lagi.");
      if (json.left) setLeft(json.left);
      setAsked(ask);
      const got: Found[] = (json.places as Place[]).map(p => ({ ...p, weak: weaknesses(p) }));
      setFound(cur => (more && cur ? [...cur, ...got] : got));
      setNext(json.nextPageToken || "");
      if (!more) setPicked(new Set());
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
    if (!chosen.length) return;
    setBusy(true); setSaveErr("");
    try { setSaved(await onSave(chosen)); setPicked(new Set()); }
    catch { setSaveErr("Gagal nyimpen lead. Cek koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }

  function toggle(id: string) { setPicked(s => flip(s, id)); }
  // Anything picked by hand from below stays picked.
  function pickAll() {
    if (allOn) setPicked(new Set());
    else setPicked(s => withAll(s, fresh.map(r => r.p.id)));
  }

  return (
    <>
      <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "0 0 16px" }}>
        Cari jenis bisnis yang mau kamu tawarin di Google Maps. Tiap hasil dikasih titik lemah dari ulasannya, plus pesan pembuka yang tinggal disalin.
      </p>

      <form onSubmit={e => { e.preventDefault(); search(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="lf-q" className="vh">Yang dicari</label>
        <input id="lf-q" value={q} onChange={e => setQ(e.target.value)} placeholder="mis. coffee shop Jakarta Selatan" style={{ ...inputStyle, fontSize: 16, flex: "1 1 240px" }} />
        <button type="submit" disabled={busy || Boolean(denied)} style={{ ...btnPrimary, minHeight: 48, opacity: busy || denied ? 0.6 : 1 }}>{busy && !found ? "Mencari…" : "Cari"}</button>
      </form>
      {denied && (
        <div role="note" style={{ fontSize: 13, lineHeight: 1.5, margin: "8px 0", padding: "10px 12px", borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
          🔒 {denied} Sementara itu, Tempel, Manual, dan Excel tetap bisa.
        </div>
      )}
      {unguarded && (
        <div role="note" style={{ fontSize: 13, lineHeight: 1.5, margin: "8px 0", padding: "8px 10px", borderRadius: 10, background: "#b453090f", border: "1px solid #b4530940" }}>
          Buat kamu (owner): batas bulanan & pintu undangan belum jalan penuh. Isi <code>FIREBASE_SERVICE_ACCOUNT</code> di Vercel. Sampai itu, alat berbayar cuma bisa dipakai kamu.
        </div>
      )}
      {!denied && left && (
        <div style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 6 }}>
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
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "12px 0 8px" }}>
            <span style={{ fontSize: 13, color: "var(--app-muted)" }}>{found.length} bisnis · {chosen.length} dipilih</span>
            {fresh.length > 0 && (
              <button type="button" onClick={pickAll} aria-pressed={allOn} style={{ ...chip, minHeight: 44, padding: "6px 14px", fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>
                {allOn ? "Batal pilih semua" : `Pilih semua yang belum ada (${fresh.length})`}
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fresh.map(r => <FoundCard key={r.p.id} row={r} on={picked.has(r.p.id)} copied={copied === r.p.id} tpl={tpl} me={me} onToggle={toggle} onCopy={copy} />)}
          </div>
          {apart.length > 0 && (
            <section aria-label="Udah ada di Leads" style={{ marginTop: fresh.length ? 24 : 0 }}>
              <h3 style={{ margin: "0 0 8px", paddingTop: fresh.length ? 12 : 0, borderTop: fresh.length ? "1px solid var(--app-border)" : 0, fontSize: 15, fontWeight: 600 }}>Udah ada di Leads · {apart.length}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {apart.map(r => <FoundCard key={r.p.id} row={r} on={!r.locked && picked.has(r.p.id)} copied={copied === r.p.id} tpl={tpl} me={me} onToggle={toggle} onCopy={copy} />)}
              </div>
            </section>
          )}
          {next && <button type="button" onClick={() => search(true)} disabled={busy} style={{ ...chip, width: "100%", minHeight: 44, marginTop: 8, fontWeight: 600, color: "var(--app-text)" }}>{busy ? "Memuat…" : "Muat 20 lagi"}</button>}
        </>
      )}

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontWeight: 700 }}>Template pesan pembuka</summary>
        <label htmlFor="lf-tpl" style={label}>Isi pesan</label>
        <textarea id="lf-tpl" value={tpl} onChange={e => setTpl(e.target.value)} style={{ ...inputStyle, fontSize: 16, height: 110, resize: "vertical", lineHeight: 1.5 }} />
        <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "6px 0 0" }}>{"{nama} {kelemahan} {rating} {bisnis} {jasa}"} diisi otomatis; {"{bisnis}"} dan {"{jasa}"} dari Kop & logo.</p>
      </details>

      {/* In the foot, not under the list: twenty results on a phone would put it off screen. */}
      <div className="sp-form-foot" style={{ flexWrap: "wrap" }}>
        {saved !== null && <div role="status" style={{ flex: "1 1 100%", fontSize: 14, color: "var(--ok)", fontWeight: 600 }}>{saved} bisnis masuk Leads.</div>}
        {saveErr && <div role="alert" style={{ flex: "1 1 100%", fontSize: 13, color: "var(--hot)" }}>{saveErr}</div>}
        <button type="button" onClick={onClose} disabled={busy} style={btnMuted}>Tutup</button>
        <button type="button" onClick={save} disabled={busy || !chosen.length} style={{ ...btnPrimary, flex: 1, opacity: busy || !chosen.length ? 0.6 : 1 }}>
          {chosen.length ? `Simpan ${chosen.length} jadi lead` : "Pilih bisnis dulu"}
        </button>
      </div>
    </>
  );
}
