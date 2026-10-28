"use client";

import { useEffect, useState } from "react";
import { FieldPath, addDoc, increment, updateDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import { authFetch } from "@/lib/authFetch";
import { MARGIN_TARGET, PriceChange, SITES, Service, SiteId, SitePrice, rupiah, sitePrice } from "@/lib/billing";
import { Space, spaceCol, spaceDoc } from "@/lib/space";
import { btnMuted, btnPrimary, card, chip, font, inputStyle, label, modalBox } from "@/components/ui";

// What each package shows on the studio's sites (PRD-017 §3a, §6): a
// "mulai dari" per site, linked to the SalesPal price or standing on its own,
// with a sync icon that says which and by how much the two differ. The sites
// read it from /api/pricelist; their admins can change it too. The owner's only.

const pathOf = (s: Space) => `${s.kind === "me" ? "users" : "guilds"}/${s.id}`;
const num = (v: string) => parseInt(v.replace(/\D/g, ""), 10) || 0;
const siteName = (id: string) => SITES.find(x => x.id === id)?.name || (id === "salespal" ? "SalesPal" : id);
const when = (ms: number) => new Date(ms).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Edit = { s: Service; site: SiteId; shown: boolean; linked: boolean; from: string };

export default function SitePricing({ services, history, space }: { services: Service[]; history: PriceChange[]; space: Space }) {
  const [owner, setOwner] = useState(false);
  const [source, setSource] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState<Edit | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    authFetch("/api/access").then(r => (r.ok ? r.json() : null)).then(j => {
      if (!live || !j?.owner) return;
      setOwner(true);
      authFetch("/api/pricelist/source").then(r => (r.ok ? r.json() : null)).then(k => { if (live) setSource(k?.space ?? null); }).catch(() => { if (live) setSource(null); });
    }).catch(() => { /* not signed in yet, or offline: nothing to show */ });
    return () => { live = false; };
  }, []);
  if (!owner) return null;

  const here = source === pathOf(space);

  async function useHere() {
    setBusy(true); setErr("");
    try {
      const r = await authFetch("/api/pricelist/source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space: pathOf(space) }) });
      if (!r.ok) throw new Error();
      setSource(pathOf(space));
    } catch { setErr("Gagal. Cek koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }

  // One write for the package: its price on that site, maybe the SalesPal price,
  // a new version (a site's admin holding an older copy gets told), and the log.
  async function put(s: Service, site: SiteId, next: SitePrice, price?: number) {
    const was = s.sites?.[site]?.shown ? sitePrice(s, site) : null;
    const pairs: unknown[] = [new FieldPath("sites", site), next, "version", increment(1), "updatedAt", Date.now(), "updatedFrom", "salespal"];
    if (typeof price === "number") pairs.push("price", price);
    await (updateDoc as (...a: unknown[]) => Promise<void>)(spaceDoc(space, "services", s.id), ...pairs);
    const finalPrice = typeof price === "number" ? price : s.price;
    const now = next.shown ? (next.linked ? finalPrice : next.from) : null;
    const low = typeof s.cost === "number" && finalPrice > 0 && ((finalPrice - s.cost) / finalPrice) * 100 < MARGIN_TARGET;
    const log = (field: string, old: number | null, nu: number | null) =>
      addDoc(spaceCol(space, "pricelistHistory"), { serviceId: s.id, name: s.name, field, from: "salespal", by: space.me.name || "SalesPal", old, new: nu, at: Date.now(), ...(low ? { belowTarget: true } : {}) });
    if (was !== now) await log(`site:${site}`, was, now);
    if (typeof price === "number" && price !== s.price) await log("price", s.price, price);
  }

  async function save() {
    if (!editing) return;
    setBusy(true); setErr("");
    try {
      const prev = editing.s.sites?.[editing.site];
      await put(editing.s, editing.site, { ...(prev || {}), shown: editing.shown, linked: editing.linked, from: editing.linked ? editing.s.price : num(editing.from) });
      setEditing(null);
    } catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }
  // The two one-tap syncs for a price that stands on its own.
  async function sync(e: Edit, to: "site" | "salespal") {
    setBusy(true); setErr("");
    try {
      const prev = e.s.sites?.[e.site] || { shown: true, linked: false, from: e.s.price };
      if (to === "site") await put(e.s, e.site, { ...prev, from: e.s.price });
      else await put(e.s, e.site, { ...prev, from: num(e.from) }, num(e.from));
      setEditing(null);
    } catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }

  const recent = history.slice().sort((a, b) => b.at - a.at);
  const warn = recent.find(h => h.belowTarget && h.from !== "salespal" && Date.now() - h.at < 7 * 864e5);

  return (
    <section aria-labelledby="site-h" style={{ marginTop: 32 }}>
      <h2 id="site-h" style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: font }}>Harga di situs</h2>
      <p style={{ margin: "2px 0 12px", fontSize: 12, color: "var(--app-muted)", lineHeight: 1.5 }}>
        Tiap situs nampilin &quot;mulai dari&quot;. <Icon name="link" size={12} /> Terikat = selalu sama dengan harga SalesPal. <Icon name="unlink" size={12} /> Lepas = harga sendiri. Admin situs juga bisa ngubah dari situsnya.
      </p>

      {source !== undefined && !here && (
        <div style={{ ...card, padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 220px", fontSize: 13, lineHeight: 1.5 }}>
            {source ? "Situs sekarang membaca paket dari ruang kerja lain." : "Belum ada ruang kerja yang dibaca situs."} Paket di ruang kerja ini ({space.name}) belum tampil di situs.
          </span>
          <button onClick={useHere} disabled={busy} style={btnPrimary}>{busy ? "Menyimpan…" : "Pakai ruang kerja ini buat situs"}</button>
        </div>
      )}
      {err && !editing && <p role="alert" style={{ margin: "0 0 12px", fontSize: 12, color: "var(--hot)" }}>{err}</p>}

      {here && (
        <>
          <p role="status" style={{ margin: "0 0 12px", fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>
            ✓ Situs membaca paket dari ruang kerja ini. {SITES.map((x, i) => <span key={x.id}>{i ? " · " : ""}<a href={`/api/pricelist?site=${x.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--brand-text)" }}>{x.name}</a></span>)}
          </p>
          {warn && (
            <p role="alert" style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, fontSize: 13, background: "color-mix(in srgb, var(--warm) 14%, transparent)" }}>
              Harga <b>{warn.name}</b> diubah dari {siteName(warn.from)} dan marginnya jadi di bawah {MARGIN_TARGET}%.
            </p>
          )}
          {services.length === 0 ? (
            <div style={{ ...card, padding: "20px", fontSize: 13, color: "var(--app-muted)" }}>Belum ada paket. Tambah paket dulu di atas.</div>
          ) : (
            <ul aria-label="Harga paket di situs" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 10 }}>
              {services.slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                <li key={s.id} style={{ ...card, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <b style={{ fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</b>
                    <span className="tabnum" style={{ fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap" }}>SalesPal <b style={{ color: "var(--app-text)" }}>{rupiah(s.price)}</b></span>
                  </div>
                  {typeof s.cost !== "number" && s.updatedFrom && s.updatedFrom !== "salespal" && <div style={{ fontSize: 12, color: "var(--warm)", marginTop: 2 }}>Dari {siteName(s.updatedFrom)} · belum ada biaya modal</div>}
                  <ul aria-label={`Situs untuk ${s.name}`} style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
                    {SITES.map(x => {
                      const sp = s.sites?.[x.id];
                      const p = sp?.shown ? sitePrice(s, x.id) : null;
                      const diff = p !== null && sp && !sp.linked ? p - s.price : 0;
                      const open = () => { setErr(""); setEditing({ s, site: x.id, shown: true, linked: sp ? sp.linked : true, from: String(sp?.from ?? s.price) }); };
                      return (
                        <li key={x.id} className="tabnum" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 4px 0 10px", borderRadius: 10, background: "var(--app-inner)", fontSize: 13 }}>
                          <span style={{ flex: "0 0 96px", color: "var(--app-muted)" }}>{x.name}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>{p === null ? <span style={{ color: "var(--app-muted)" }}>Ga tampil</span> : <b>{rupiah(p)}</b>}</span>
                          {p === null ? (
                            <button onClick={open} aria-label={`Tampilkan ${s.name} di ${x.name}`} style={{ ...chip, fontSize: 12, fontWeight: 700, color: "var(--brand-text)" }}>Tampilkan</button>
                          ) : (
                            <button onClick={open} aria-label={`${sp?.linked ? "Terikat" : "Lepas"}, atur harga ${s.name} di ${x.name}`}
                              style={{ ...chip, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: sp?.linked ? "var(--ok)" : diff ? "var(--warm)" : "var(--app-text)" }}>
                              <Icon name={sp?.linked ? "link" : "unlink"} size={14} />
                              {sp?.linked ? "ikut SalesPal" : diff ? `beda ${rupiah(Math.abs(diff))}` : "sama"}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {recent.length > 0 && (
            <section aria-labelledby="hist-h" style={{ marginTop: 16 }}>
              <h3 id="hist-h" style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Riwayat harga</h3>
              <ul aria-label="Riwayat harga" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                {(all ? recent : recent.slice(0, 6)).map(h => (
                  <li key={h.id} className="tabnum" style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.5 }}>
                    {when(h.at)} · <b style={{ color: "var(--app-text)" }}>{h.name}</b> · {h.field === "price" ? "harga SalesPal" : siteName(h.field.replace("site:", ""))}: {h.old === null ? "ga tampil" : rupiah(h.old)} → {h.new === null ? "ga tampil" : rupiah(h.new)} · dari {siteName(h.from)}
                    {h.belowTarget && <b style={{ color: "var(--warm)" }}> · margin di bawah {MARGIN_TARGET}%</b>}
                  </li>
                ))}
              </ul>
              {recent.length > 6 && <button onClick={() => setAll(!all)} style={{ ...chip, marginTop: 8, fontSize: 12 }}>{all ? "Lebih sedikit" : `Lihat semua (${recent.length})`}</button>}
            </section>
          )}
        </>
      )}

      {editing && (() => {
        const e = editing;
        const site = siteName(e.site);
        const from = num(e.from);
        return (
          <div className="modal-overlay" onClick={() => { if (!busy) setEditing(null); }}>
            <div onClick={ev => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Harga ${e.s.name} di ${site}`} style={{ ...modalBox, maxWidth: 440 }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font }}>{e.s.name}</div>
              <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 16 }}>Harga di {site} · harga SalesPal {rupiah(e.s.price)}</div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={e.shown} onChange={ev => setEditing({ ...e, shown: ev.target.checked })} style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
                Tampil di {site}
              </label>
              {e.shown && (
                <fieldset style={{ border: 0, margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
                  <legend style={{ ...label, marginBottom: 6 }}>Harga &quot;mulai dari&quot; di {site}</legend>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="site-link" checked={e.linked} onChange={() => setEditing({ ...e, linked: true })} style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
                    <Icon name="link" size={16} /> Ikut harga SalesPal ({rupiah(e.s.price)})
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="site-link" checked={!e.linked} onChange={() => setEditing({ ...e, linked: false })} style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
                    <Icon name="unlink" size={16} /> Harga sendiri
                  </label>
                  {!e.linked && (
                    <>
                      <label htmlFor="site-from" style={label}>Mulai dari (Rp)</label>
                      <input id="site-from" inputMode="numeric" value={from ? from.toLocaleString("id-ID") : ""} onChange={ev => setEditing({ ...e, from: ev.target.value })} style={inputStyle} />
                      {from !== e.s.price && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                          <span className="tabnum" style={{ width: "100%", fontSize: 12, color: "var(--warm)", fontWeight: 600 }}>Beda {rupiah(Math.abs(from - e.s.price))} dari harga SalesPal.</span>
                          <button onClick={() => sync(e, "site")} disabled={busy} style={{ ...chip, fontSize: 12, fontWeight: 700 }}>Pakai harga SalesPal di situs</button>
                          <button onClick={() => sync(e, "salespal")} disabled={busy || !from} style={{ ...chip, fontSize: 12, fontWeight: 700 }}>Pakai harga situs di SalesPal</button>
                        </div>
                      )}
                    </>
                  )}
                </fieldset>
              )}
              {err && <p role="alert" style={{ margin: "12px 0 0", fontSize: 12, color: "var(--hot)" }}>{err}</p>}
              <div className="sp-form-foot">
                <button onClick={() => setEditing(null)} disabled={busy} style={btnMuted}>Batal</button>
                <button onClick={save} disabled={busy || (e.shown && !e.linked && !from)} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
