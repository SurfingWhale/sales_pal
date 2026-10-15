"use client";

import { useState } from "react";
import { canEditCatalog, useSpace } from "@/lib/space";
import { saveFillDefaults } from "@/lib/prospectStore";
import { FillDefaults } from "@/lib/templates";
import { btnMuted, btnPrimary, font, inputStyle, label } from "@/components/ui";

// What a template says when a post didn't tell (QA 15 Okt). Empty here means
// the bracketed part of a template just drops out.
export default function DefaultsSheet({ value, tagline, onClose }: { value: FillDefaults; tagline?: string; onClose: () => void }) {
  const space = useSpace();
  const canEdit = canEditCatalog(space);
  const [d, setD] = useState<FillDefaults>({ kebutuhan: value.kebutuhan || "", waktu: value.waktu || "", lokasi: value.lokasi || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true); setErr("");
    try { await saveFillDefaults(space, { kebutuhan: d.kebutuhan?.trim(), waktu: d.waktu?.trim(), lokasi: d.lokasi?.trim() }); onClose(); }
    catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); setBusy(false); }
  }

  const field = (k: keyof FillDefaults, l: string, ph: string, hint: string) => (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={`def-${k}`} style={label}>{l}</label>
      <input id={`def-${k}`} value={d[k] || ""} onChange={e => setD({ ...d, [k]: e.target.value })} placeholder={ph} disabled={!canEdit} style={inputStyle} />
      <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>{hint}</div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} aria-label="Default kalau kosong" style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460 }}>
        <div style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>Default kalau kosong</div>
        <p style={{ fontSize: 13, color: "var(--app-sub)", margin: "4px 0 18px", lineHeight: 1.5 }}>
          Dipakai di pesan kalau post orangnya ga nyebut. Dikosongin = bagian kalimatnya dilewati.
        </p>
        {field("kebutuhan", "Kebutuhan {kebutuhan}", tagline ? tagline.toLowerCase() : "mis. foto & video acaranya", tagline ? `Kosong = pakai "Jasa apa" di Kop: ${tagline.toLowerCase()}.` : "mis. dokumentasi acaranya")}
        {field("waktu", "Kapan {waktu}", "mis. acaranya nanti", "Kosong = \"buat {waktu}\" ga ditulis.")}
        {field("lokasi", "Di mana {lokasi}", "mis. Jabodetabek", "Kosong = \"di {lokasi}\" ga ditulis.")}
        {!canEdit && <div style={{ fontSize: 13, color: "var(--app-sub)", marginBottom: 12 }}>Default tim diatur Leader atau Officer guild.</div>}
        <div role="status" style={{ fontSize: 13, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", marginBottom: err ? 10 : 0 }}>{err}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...btnMuted, minHeight: 48 }}>Batal</button>
          {canEdit && <button onClick={save} disabled={busy} style={{ ...btnPrimary, flex: 1, minHeight: 48 }}>{busy ? "Menyimpan…" : "Simpan default"}</button>}
        </div>
      </div>
    </div>
  );
}
