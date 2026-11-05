"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { writeBatch } from "firebase/firestore";
import Icon from "@/components/Icon";
import { authFetch } from "@/lib/authFetch";
import { today } from "@/lib/billing";
import { db } from "@/lib/firebase";
import { downscaleImage } from "@/lib/image";
import { DupFields, RowDupe, dupRows } from "@/lib/leadDupes";
import { firstContact, parseRupiah } from "@/lib/leadEdit";
import { TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE, TEMPLATE_GUIDE } from "@/lib/places";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import { parseVCards } from "@/lib/vcard";
import { btnMuted, btnPrimary, inputStyle } from "@/components/ui";

// Excel, in Tambah lead (PRD-022 Q12): a file or a picture of a list, its
// columns mapped, then checked against Leads so a list you've half imported
// doesn't come in twice. What's dobel stays out unless you ask for it.

type Row = Record<string, unknown>;
type ColMap = Record<string, string>;

const IMPORT_FIELDS: { key: string; label: string; required?: boolean; keywords: string[] }[] = [
  { key: "name", label: "Nama Perusahaan", required: true, keywords: ["perusahaan", "nama", "company", "name", "client", "bisnis"] },
  { key: "contact", label: "Kontak", keywords: ["kontak", "contact", "pic", "person", "cp"] },
  { key: "email", label: "Email", keywords: ["email", "e-mail", "mail"] },
  { key: "phone", label: "No. HP", keywords: ["hp", "phone", "telp", "telepon", "wa", "whatsapp", "nomor", "no."] },
  { key: "category", label: "Kategori", keywords: ["kategori", "category", "industri", "industry", "segmen"] },
  { key: "source", label: "Source", keywords: ["source", "sumber", "channel", "asal"] },
  { key: "status", label: "Status", keywords: ["status", "stage", "tahap"] },
  { key: "value", label: "Value (Rp)", keywords: ["value", "nilai", "deal", "amount", "harga", "estimasi", "potensi"] },
  { key: "notes", label: "Notes", keywords: ["notes", "catatan", "note", "keterangan", "remark"] },
  // The Google Maps columns of the Excel template (lib/places.ts, PRD-012).
  { key: "address", label: "Alamat", keywords: ["alamat", "address"] },
  { key: "website", label: "Website", keywords: ["website", "situs", "web"] },
  { key: "rating", label: "Rating", keywords: ["rating", "bintang"] },
  { key: "reviewCount", label: "Jumlah ulasan", keywords: ["jumlah ulasan", "ulasan", "reviews", "review"] },
  { key: "mapsUrl", label: "Link Google Maps", keywords: ["google maps", "maps", "gmaps"] },
  { key: "weak", label: "Titik lemah", keywords: ["titik lemah", "kelemahan", "lemah", "weak"] },
];

const VALID_STATUS = ["Cold", "Warm", "Hot", "Closed"];
const SHOWN_DUPES = 5;
const NOT_READ = "File-nya ga kebaca, atau ga ada barisnya. Coba simpan ulang sebagai .xlsx atau .csv.";
const SCAN_FAILED = "Gambar ga kebaca. Coba foto yang lebih terang dan lurus, atau pakai Excel/CSV.";

function autoMap(headers: string[]): ColMap {
  const map: ColMap = {};
  for (const f of IMPORT_FIELDS) {
    const hit = headers.find(h => {
      const n = h.toLowerCase().trim();
      return f.keywords.some(k => n === k || n.includes(k));
    });
    if (hit) map[f.key] = hit;
  }
  return map;
}

// The Google Maps columns, typed, only when filled; weak spots also go to the
// lead profile's pain so pitches and the Simulator can use them.
function mapsFields(r: { address: string; website: string; rating: string; reviewCount: string; mapsUrl: string; weak: string }) {
  const out: Record<string, unknown> = {};
  if (r.address) out.address = r.address;
  if (r.website) out.website = r.website;
  const rating = parseFloat(r.rating.replace(",", "."));
  if (rating > 0 && rating <= 5) out.rating = rating;
  const n = parseInt(r.reviewCount.replace(/\D/g, ""), 10);
  if (n >= 0) out.reviewCount = n;
  if (r.mapsUrl) out.mapsUrl = r.mapsUrl;
  if (r.weak) out.profile = { pain: r.weak.split(/;|\n/).map(x => x.trim()).filter(Boolean).join("; ") };
  return out;
}

function normStatus(v: unknown): string {
  const s = String(v ?? "").toLowerCase();
  if (/gugur|lost/.test(s)) return "Lost";
  const hit = VALID_STATUS.find(st => s.includes(st.toLowerCase()));
  return hit || "Cold";
}

function cell(r: Row, map: ColMap, k: string): string {
  return map[k] ? String(r[map[k]] ?? "").trim() : "";
}

function preview(r: Row, map: ColMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of IMPORT_FIELDS) out[f.key] = map[f.key] ? String(r[map[f.key]] ?? "") : "";
  return out;
}

function dupFieldsOf(r: Row, map: ColMap): DupFields {
  return { name: cell(r, map, "name"), phone: cell(r, map, "phone"), email: cell(r, map, "email"), contact: cell(r, map, "contact"), notes: cell(r, map, "notes") };
}

function toLead(r: Row, map: ColMap, on: string) {
  const status = normStatus(map.status ? r[map.status] : "");
  return {
    name: cell(r, map, "name"),
    contact: cell(r, map, "contact"),
    email: cell(r, map, "email"),
    phone: cell(r, map, "phone"),
    category: cell(r, map, "category") || "F&B",
    source: cell(r, map, "source") || "Import",
    status,
    value: parseRupiah(map.value ? r[map.value] : ""),
    notes: cell(r, map, "notes"),
    lastContact: firstContact(status, on),
    ...mapsFields({ address: cell(r, map, "address"), website: cell(r, map, "website"), rating: cell(r, map, "rating"), reviewCount: cell(r, map, "reviewCount"), mapsUrl: cell(r, map, "mapsUrl"), weak: cell(r, map, "weak") }),
  };
}

function dupeLine(name: string, d: RowDupe): string {
  return d.inFile ? `${name}: muncul lagi di file ini (${d.why} sama)` : `${name}: udah ada di Leads sebagai ${d.of} (${d.why} sama)`;
}

export function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const rows = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE], { header: [...TEMPLATE_COLUMNS] });
  rows["!cols"] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(14, c.length + 4) }));
  XLSX.utils.book_append_sheet(wb, rows, "Leads");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TEMPLATE_GUIDE), "Panduan");
  XLSX.writeFile(wb, "SalesPal-template-leads.xlsx");
}

export default function ExcelImport({ leads, onBusy, onClose }: {
  leads: DupFields[];
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const space = useSpace();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [colMap, setColMap] = useState<ColMap>({});
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ written: number; skipped: number } | null>(null);
  const [mode, setMode] = useState<"file" | "scan">("file");
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState("");
  const [withDupes, setWithDupes] = useState(false);
  useEffect(() => { onBusy(importing || scanning); }, [importing, scanning, onBusy]);

  function clearRows() { setHeaders([]); setRows([]); setColMap({}); setWithDupes(false); }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(null); setErr("");
    // Phone contacts exported as vCard (iPhone Contacts / iCloud.com).
    if (/\.vcf$/i.test(file.name) || file.type === "text/vcard" || file.type === "text/x-vcard") {
      file.text().then((text) => {
        const got = parseVCards(text) as unknown as Row[];
        if (!got.length) { clearRows(); setErr(NOT_READ); return; }
        const keys = IMPORT_FIELDS.map(f => f.key).filter(k => got.some(r => String(r[k] ?? "").trim()));
        const map: ColMap = {};
        keys.forEach(k => { map[k] = k; });
        setHeaders(keys);
        setRows(got);
        setColMap(map);
      }).catch(() => { clearRows(); setErr(NOT_READ); });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const got = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
        if (!got.length) { clearRows(); setErr(NOT_READ); return; }
        const keys = Object.keys(got[0]);
        setHeaders(keys);
        setRows(got);
        setColMap(autoMap(keys));
      } catch {
        clearRows(); setErr(NOT_READ);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErr(""); setDone(null); setScanning(true);
    clearRows();
    try {
      const dataUrl = await downscaleImage(file);
      const res = await authFetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || SCAN_FAILED);
      const scanned: Row[] = Array.isArray(json?.rows) ? json.rows : [];
      const got = scanned.map(l => {
        const o: Row = {};
        IMPORT_FIELDS.forEach(f => { o[f.key] = l[f.key] ?? ""; });
        return o;
      });
      const withData = got.filter(r => String(r.name ?? "").trim() || String(r.contact ?? "").trim());
      if (!withData.length) { setErr("Ga ada lead yang kebaca dari gambar ini. Coba gambar yang lebih jelas."); return; }
      setRows(withData);
      const keys = IMPORT_FIELDS.map(f => f.key).filter(k => withData.some(r => String(r[k] ?? "").trim()));
      setHeaders(keys);
      const map: ColMap = {};
      IMPORT_FIELDS.forEach(f => { if (keys.includes(f.key)) map[f.key] = f.key; });
      setColMap(map);
    } catch (e) {
      setErr(e instanceof Error ? e.message : SCAN_FAILED);
    } finally {
      setScanning(false);
    }
  }

  // Only rows with a name come in; each is checked the way it's mapped now.
  const named = useMemo(() => (colMap.name ? rows.filter(r => String(r[colMap.name] ?? "").trim()) : []), [rows, colMap]);
  const checks = useMemo(() => dupRows(named.map(r => dupFieldsOf(r, colMap)), leads), [named, colMap, leads]);
  const dupes = named.flatMap((r, i) => { const d = checks[i]; return d ? [dupeLine(cell(r, colMap, "name"), d)] : []; });
  const going = withDupes ? named : named.filter((_, i) => !checks[i]);

  async function runImport() {
    if (!going.length) return;
    setImporting(true); setErr("");
    const on = today();
    const skipped = named.length - going.length;
    let written = 0;
    try {
      for (let i = 0; i < going.length; i += 400) {
        const batch = writeBatch(db);
        const slice = going.slice(i, i + 400);
        slice.forEach((r, j) => { batch.set(spaceDoc(space, "leads", `imp_${Date.now()}_${i + j}`), stamp(space, toLead(r, colMap, on))); });
        await batch.commit();
        written += slice.length;
      }
    } catch {
      setImporting(false);
      // What already went in now reads as dobel, so trying again doesn't repeat it.
      setErr(`Gagal di tengah jalan: ${written} lead udah masuk. Cek koneksi, lalu coba lagi.`);
      return;
    }
    setImporting(false);
    setDone({ written, skipped });
    clearRows();
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "32px 16px" }}>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{done.written} lead masuk</div>
        <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 20 }}>Lead-nya udah ada di Leads.{done.skipped ? ` ${done.skipped} baris dobel dilewati.` : ""}</div>
        <button type="button" onClick={onClose} style={{ ...btnPrimary, minHeight: 44 }}>Selesai</button>
      </div>
    );
  }

  return (
    <>
      <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "0 0 16px" }}>Upload Excel/CSV, atau scan gambar (screenshot/foto data) pakai AI. Kolomnya kebaca sendiri, dan bisa diubah sebelum disimpan.</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "var(--app-inner)", padding: 4, borderRadius: 10 }}>
        {([["file", "Excel / CSV / Kontak"], ["scan", "Scan Gambar"]] as const).map(([m, name]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); clearRows(); setFileName(""); setErr(""); }}
            style={{ flex: 1, minHeight: 40, padding: "9px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              background: mode === m ? "var(--app-card)" : "transparent",
              color: mode === m ? "var(--brand-text)" : "var(--app-muted)",
              boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            {name}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <label className="sp-tap" style={{ display: "block", border: "1.5px dashed var(--app-border)", borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer", marginBottom: 16, background: "var(--app-inner)" }}>
          <input type="file" className="vh" accept=".xlsx,.xls,.csv,.vcf,text/vcard" onChange={handleFile} />
          <span style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "var(--app-muted)" }}><Icon name="doc" size={24} /></span>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{fileName || "Pilih file"}</span>
          <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--app-muted)", marginTop: 4 }}>.xlsx, .xls, .csv, atau kontak HP (.vcf)</span>
        </label>
      ) : (
        <label className="sp-tap" style={{ display: "block", border: "1.5px dashed var(--app-border)", borderRadius: 12, padding: 24, textAlign: "center", cursor: scanning ? "wait" : "pointer", marginBottom: 12, background: "var(--app-inner)", opacity: scanning ? 0.7 : 1 }}>
          <input type="file" className="vh" accept="image/*" onChange={handleScan} disabled={scanning} />
          <span style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "var(--app-muted)" }}><Icon name="screenshot" size={24} /></span>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{scanning ? "Membaca gambar dengan AI..." : (fileName || "Pilih gambar atau foto data")}</span>
          <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--app-muted)", marginTop: 4 }}>Screenshot chat, tabel, atau kartu nama · JPG/PNG</span>
        </label>
      )}
      {err && <p role="alert" style={{ margin: "0 0 16px", fontSize: 13, color: "var(--hot)" }}>{err}</p>}

      {mode === "file" && !headers.length && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ flex: "1 1 220px", fontSize: 13, color: "var(--app-sub)" }}>Belum punya daftarnya? Isi template Excel (dari ekspor tool Google Maps, atau manual). Kolomnya langsung kebaca.</span>
          <button type="button" onClick={downloadTemplate} style={{ ...btnMuted, minHeight: 44 }}>Download template Excel</button>
        </div>
      )}

      {headers.length > 0 && (
        <>
          {/* First: on a phone the column pickers below fill several screens. */}
          {dupes.length > 0 && (
            <section aria-label="Baris dobel" style={{ marginBottom: 20, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--warm)", background: "color-mix(in srgb, var(--warm) 10%, transparent)" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{dupes.length} dari {named.length} baris dobel{withDupes ? "" : ", jadi dilewati"}.</div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                {dupes.slice(0, SHOWN_DUPES).map((d, i) => <li key={i}>{d}</li>)}
                {dupes.length > SHOWN_DUPES && <li>dan {dupes.length - SHOWN_DUPES} lainnya</li>}
              </ul>
              <label className="sp-tap" style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
                <input type="checkbox" checked={withDupes} onChange={e => setWithDupes(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: "#005eb0" }} />
                Import juga yang dobel
              </label>
            </section>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Petakan kolom · {rows.length} baris ditemukan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 20 }}>
            {IMPORT_FIELDS.map(f => (
              <div key={f.key}>
                <label htmlFor={`imp-${f.key}`} style={{ fontSize: 13, color: "var(--app-muted)", display: "block", marginBottom: 4 }}>
                  {f.label}{f.required && <span style={{ color: "var(--hot)" }}> *</span>}
                </label>
                <select id={`imp-${f.key}`} value={colMap[f.key] || ""} onChange={e => setColMap({ ...colMap, [f.key]: e.target.value })} style={{ ...inputStyle, fontSize: 16 }} aria-label={`Kolom untuk ${f.label}`}>
                  <option value="">— lewati —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Preview (3 baris pertama)</div>
          <div role="region" aria-label="Preview 3 baris pertama" tabIndex={0} style={{ overflowX: "auto", border: "1px solid var(--app-border)", borderRadius: 8, marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ background: "var(--app-inner)" }}>
                  {IMPORT_FIELDS.filter(f => colMap[f.key]).map(f => (
                    <th key={f.key} style={{ padding: "8px 10px", textAlign: "left", color: "var(--app-muted)", whiteSpace: "nowrap" }}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((r, i) => {
                  const m = preview(r, colMap);
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--app-inner)" }}>
                      {IMPORT_FIELDS.filter(f => colMap[f.key]).map(f => (
                        <td key={f.key} style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{m[f.key] || "—"}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!colMap.name && <p role="alert" style={{ margin: "0 0 12px", fontSize: 13, color: "var(--hot)" }}>Kolom &quot;Nama Perusahaan&quot; wajib dipetakan.</p>}

          <div className="sp-form-foot">
            <button type="button" onClick={onClose} disabled={importing} style={btnMuted}>Batal</button>
            <button type="button" onClick={runImport} disabled={!going.length || importing} style={{ ...btnPrimary, opacity: !going.length || importing ? 0.5 : 1, cursor: !going.length || importing ? "not-allowed" : "pointer" }}>
              {importing ? "Mengimport..." : `Import ${going.length} lead`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
