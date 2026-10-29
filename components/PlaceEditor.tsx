"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Icon from "@/components/Icon";
import { authFetch } from "@/lib/authFetch";
import { GeoHit, LeadGeo, readPlace } from "@/lib/geo";

const GeoPicker = dynamic(() => import("@/components/GeoMap").then(m => m.GeoPicker), { ssr: false, loading: () => <p role="status" style={{ margin: 0, padding: 24, fontSize: 14, color: "var(--app-muted)" }}>Memuat peta…</p> });

const pill = (primary: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 18px", borderRadius: 999,
  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap",
  border: primary ? 0 : "1px solid var(--app-line-strong)", background: primary ? "#005eb0" : "transparent", color: primary ? "#fff" : "var(--app-text)",
});
const field: React.CSSProperties = { width: "100%", background: "var(--app-card)", border: "1px solid var(--app-line-strong)", borderRadius: 12, color: "var(--app-text)", padding: "10px 12px", fontSize: 16, fontFamily: "inherit", resize: "vertical" };

// Where something is (PRD-013): a lead on Peta 3D, or where a job happens on a
// quote, SPK and invoice. An address search, a pasted map link or coordinates,
// the phone's own position, or a pin moved by hand.
export default function PlaceEditor({ start, address, onSave, onDone, what = "lokasi" }: {
  start?: LeadGeo;
  address?: string;
  onSave: (geo: LeadGeo | null, address?: string) => Promise<void> | void;
  onDone: () => void;
  what?: string;
}) {
  const [addr, setAddr] = useState(address || "");
  const [hits, setHits] = useState<GeoHit[] | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const save = async (geo: LeadGeo | null, address?: string) => {
    setBusy("save"); setErr("");
    try { await onSave(geo, address); onDone(); } catch { setErr("Gagal menyimpan. Cek koneksi, lalu coba lagi."); setBusy(""); }
  };
  // Words, a map link or coordinates. A point in the text is read right here;
  // a short share link and plain words go to the server.
  async function lookup(text: string) {
    if (!text.trim()) { setErr("Tulis alamat atau nama tempat, atau tempel link Google Maps."); return; }
    setErr(""); setHits(null);
    const pasted = readPlace(text);
    if (pasted.point) {
      setSource("link");
      setHits([{ ...pasted.point, label: pasted.name, address: pasted.note || pasted.query }]);
      return;
    }
    setBusy("search");
    try {
      const res = await authFetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: text }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.error || "Pencarian gagal. Coba lagi.");
      else if (!j.hits?.length) setErr("Alamatnya ga ketemu. Coba tulis lebih lengkap, tempel link dari Google Maps, atau geser peta di bawah.");
      else { setSource(j.source || ""); setHits(j.hits); }
    } catch { setErr("Pencarian gagal. Cek koneksi, lalu coba lagi."); }
    setBusy("");
  }
  // A pasted map link is looked up straight away; other text pastes as usual.
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const pasted = readPlace(text);
    if (!pasted.point && !pasted.short) return;
    e.preventDefault();
    setAddr(text.replace(/\s+/g, " ").trim());
    lookup(text);
  }
  async function pasteClipboard() {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { /* not allowed here: the field above still takes a paste */ }
    if (!text.trim()) { setErr("Clipboard ga kebaca. Tekan lama kolom di atas → Tempel."); input.current?.focus(); return; }
    setAddr(text.replace(/\s+/g, " ").trim());
    lookup(text);
  }
  function here() {
    if (!navigator.geolocation) { setErr("HP ini ga ngasih akses lokasi. Geser peta di bawah aja."); return; }
    setBusy("gps"); setErr("");
    navigator.geolocation.getCurrentPosition(
      p => save({ lat: p.coords.latitude, lng: p.coords.longitude, by: "gps" }, addr.trim() || undefined),
      () => { setBusy(""); setErr("Izin lokasi ditolak atau sinyal GPS lemah. Geser peta di bawah aja."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <label htmlFor="geo-addr" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--app-sub)", marginBottom: 6 }}>Alamat, nama tempat, atau link Google Maps</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="geo-addr" ref={input} value={addr} onChange={e => setAddr(e.target.value)} onPaste={onPaste} onKeyDown={e => { if (e.key === "Enter") lookup(addr); }} placeholder="mis. Kopi Senja, Jl. Contoh No. 1, Bandung" aria-describedby="geo-addr-hint" style={{ ...field, flex: 1, minWidth: 0 }} />
          <button onClick={() => lookup(addr)} disabled={!!busy} style={{ ...pill(true), padding: "0 16px" }}>{busy === "search" ? "Mencari…" : "Cari"}</button>
        </div>
        <p id="geo-addr-hint" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--app-muted)" }}>Paling tepat: di Google Maps buka tempatnya → Bagikan → Salin link, lalu tempel di sini.</p>
      </div>
      {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--hot)" }}>{err}</p>}
      {hits && (
        <ul aria-label="Hasil alamat" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {hits.map((h, i) => (
            <li key={i}>
              <button onClick={() => save({ lat: h.lat, lng: h.lng, by: source === "link" ? "link" : "alamat" }, h.address || h.label || (source === "link" ? undefined : addr.trim()))} disabled={!!busy}
                style={{ width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--app-border)", borderRadius: 14, background: "var(--app-card)", color: "var(--app-text)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <Icon name="map" size={16} style={{ color: "var(--brand-text)", flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{h.label || h.address || "Titik dari link"}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--app-muted)" }}>{(h.label && h.address) || `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}`}</span>
                </span>
              </button>
            </li>
          ))}
          {source === "osm" && <li style={{ fontSize: 12, color: "var(--app-muted)" }}>Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>OpenStreetMap</a>. Ga ada yang pas? Tempel link dari Google Maps.</li>}
        </ul>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={pasteClipboard} disabled={!!busy} style={{ ...pill(false), flex: "1 1 200px" }}><Icon name="clipboard" size={16} />Tempel link Maps</button>
        <button onClick={here} disabled={!!busy} style={{ ...pill(false), flex: "1 1 200px" }}><Icon name="target" size={16} />{busy === "gps" ? "Mencari lokasi…" : "Pakai lokasi saya sekarang"}</button>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Atau geser peta sampai pin merah tepat di tempatnya:</p>
      <GeoPicker start={start} onPick={(lat, lng) => save({ lat, lng, by: "pin" }, addr.trim() || undefined)} />
      {start && <button onClick={() => save(null)} disabled={!!busy} style={{ ...pill(false), border: 0, color: "var(--hot)" }}>Hapus {what}</button>}
    </div>
  );
}
