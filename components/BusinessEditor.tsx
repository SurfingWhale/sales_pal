"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { spaceDoc, useSpace } from "@/lib/space";
import { Business, EMPTY_BUSINESS } from "@/lib/billing";
import { logoImage } from "@/lib/image";
import { btnMuted, btnPrimary, chip, font, inputStyle, label, modalBox } from "@/components/ui";

// The letterhead on every quote and invoice: logo, name, what you do,
// contacts, where to transfer, and the terms (QA 11 Okt: "embed logo as
// trusted dan kirim TNC").
export default function BusinessEditor({ business, onClose }: { business: Business; onClose: () => void }) {
  const space = useSpace();
  const [b, setB] = useState<Business>({ ...EMPTY_BUSINESS, ...business });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setMsg("");
    try { setB({ ...b, logo: await logoImage(file) }); } catch (e) { setMsg((e as Error).message); }
  }

  async function save() {
    setBusy(true);
    try {
      await setDoc(spaceDoc(space, "settings", "business"), b);
      onClose();
    } catch {
      setMsg("Gagal nyimpen. Cek koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof Business, l: string, ph: string, col = "auto") => (
    <div style={{ gridColumn: col }}>
      <label htmlFor={`biz-${k}`} style={label}>{l}</label>
      <input id={`biz-${k}`} value={(b[k] as string) || ""} onChange={e => setB({ ...b, [k]: e.target.value })} style={inputStyle} placeholder={ph} />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 160 }}>
      <div onClick={e => e.stopPropagation()} aria-label="Kop invoice & penawaran" style={{ ...modalBox, maxWidth: 520 }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Kop invoice & penawaran</div>
        <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>Muncul di atas tiap PDF dan di akhir pesan WA. Isi sekali, kepakai terus.</div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: 12, background: "#fff", border: "1px solid var(--app-border)", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.logo ? <img src={b.logo} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 12, color: "#57606a" }}>Logo</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", cursor: "pointer", fontWeight: 700 }}>
              {b.logo ? "Ganti logo" : "+ Logo (PNG)"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => pickLogo(e.target.files?.[0])} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
            </label>
            {b.logo && <button onClick={() => setB({ ...b, logo: "" })} style={{ ...chip, minHeight: 36 }}>Hapus</button>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {field("name", "Nama brand / bisnis", "mis. beUntamed Studio", "1/-1")}
          {field("tagline", "Jasa apa", "mis. Fotografi & video event", "1/-1")}
          {field("phone", "WhatsApp", "0812…")}
          {field("email", "Email", "halo@…")}
          {field("address", "Alamat / kota", "mis. Jakarta Selatan", "1/-1")}
          {field("bank", "Bank", "BCA")}
          {field("accountNo", "No. rekening", "123…")}
          {field("accountName", "Atas nama", "Nama di rekening", "1/-1")}
          <div style={{ gridColumn: "1/-1" }}>
            <label htmlFor="biz-footer" style={label}>Syarat & ketentuan</label>
            <textarea id="biz-footer" value={b.footer} onChange={e => setB({ ...b, footer: e.target.value })} style={{ ...inputStyle, resize: "vertical", height: 96 }}
              placeholder={"DP 50% mengunci jadwal dan tidak dapat dikembalikan.\nFile dikirim maks. 7 hari setelah acara.\n1x revisi minor."} />
          </div>
        </div>
        <div role="status" style={{ fontSize: 12, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", marginTop: msg ? 10 : 0 }}>{msg}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={save} disabled={busy} style={btnPrimary}>Simpan kop</button>
          <button onClick={onClose} style={btnMuted}>Batal</button>
        </div>
      </div>
    </div>
  );
}
