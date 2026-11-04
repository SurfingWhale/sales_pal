"use client";

import { useEffect, useState } from "react";
import { setDoc, writeBatch } from "firebase/firestore";
import ExcelImport from "@/components/ExcelImport";
import Icon from "@/components/Icon";
import LeadFinder, { Found } from "@/components/LeadFinder";
import PasteFill, { DupNotice, PastePlace } from "@/components/PasteFill";
import { btnMuted, btnPrimary, inputStyle, modalBox } from "@/components/ui";
import { rupiah, today } from "@/lib/billing";
import { db } from "@/lib/firebase";
import { DupFields } from "@/lib/leadDupes";
import { CATEGORIES, SOURCES, firstContact, parseRupiah } from "@/lib/leadEdit";
import { fillEmpty } from "@/lib/paste";
import { placeLeadId, snippet } from "@/lib/places";
import { Space, spaceDoc, stamp, useSpace } from "@/lib/space";

// Tambah lead (PRD-022 Q12): one door, four ways in. Every button that adds a
// lead opens this, on the way it asked for. A search costs quota and a file
// takes a while to map, so each way keeps what it has while you look at
// another, until the door closes. What's typed into the form stays even then.

export type AddWay = "tempel" | "manual" | "excel" | "maps";

const WAYS: [AddWay, string][] = [["tempel", "Tempel"], ["manual", "Manual"], ["excel", "Excel"], ["maps", "Cari di Maps"]];
const PANEL: Record<AddWay, string> = { tempel: "way-form", manual: "way-form", excel: "way-excel", maps: "way-maps" };

const BLANK = { name: "", contact: "", source: "GMaps", status: "Cold", email: "", phone: "", category: "F&B", notes: "", value: "" };
type Draft = typeof BLANK;

const FIELD_LABEL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--app-sub)", display: "block", marginBottom: 6 };

function isStarted(d: Draft, place: PastePlace): boolean {
  return Boolean(place.address || place.geo) || (Object.keys(BLANK) as (keyof Draft)[]).some(k => d[k] !== BLANK[k]);
}

// One lead per Google Maps place: the id is the place's, so finding it again
// never makes a second lead (PRD-012).
async function saveFound(space: Space, rows: Found[]): Promise<number> {
  const batch = writeBatch(db);
  const on = today();
  rows.forEach(p => {
    const worst = p.reviews.filter(r => r.rating <= 3 && r.text.trim()).sort((a, b) => a.rating - b.rating)[0];
    batch.set(spaceDoc(space, "leads", placeLeadId(p.id)), stamp(space, {
      name: p.name, contact: "", email: p.email || "", phone: p.phone, category: p.category || "Lainnya",
      source: "Google Maps", status: "Cold", value: 0, lastContact: firstContact("Cold", on),
      notes: [p.weak.length ? `Titik lemah: ${p.weak.map(w => w.label).join("; ")}` : "", worst ? `Ulasan ${worst.rating}★: "${snippet(worst.text, 200)}"` : ""].filter(Boolean).join("\n"),
      ...(p.address ? { address: p.address } : {}), ...(p.website ? { website: p.website } : {}),
      ...(p.rating !== null ? { rating: p.rating } : {}), reviewCount: p.reviewCount, ...(p.mapsUrl ? { mapsUrl: p.mapsUrl } : {}), placeId: p.id,
      ...(typeof p.lat === "number" && typeof p.lng === "number" ? { geo: { lat: p.lat, lng: p.lng, by: "maps" } } : {}),
      ...(p.weak.length ? { profile: { pain: p.weak.map(w => w.label).join("; ") } } : {}),
    }));
  });
  await batch.commit();
  return rows.length;
}

export default function AddLead<T extends DupFields & { id: string; name: string }>({ way, onWay, leads, me, onOpenLead, onClose }: {
  way: AddWay | null;   // null: shut, the draft kept
  onWay: (w: AddWay) => void;
  leads: T[];
  me: { name?: string; tagline?: string };
  onOpenLead: (lead: T) => void;
  onClose: () => void;
}) {
  const space = useSpace();
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [place, setPlace] = useState<PastePlace>({});   // from a pasted Maps link (PRD-018)
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [mapsBusy, setMapsBusy] = useState(false);
  // Maps asks the server who may search, so it isn't set up until someone goes there.
  const [mapsOn, setMapsOn] = useState(false);
  useEffect(() => { if (way === "maps") setMapsOn(true); else if (!way) setMapsOn(false); }, [way]);
  useEffect(() => { if (way === "manual") document.getElementById("nl-name")?.focus({ preventScroll: true }); }, [way]);

  if (!way) return null;
  const busy = saving || excelBusy || mapsBusy;
  function close() { if (!busy) { onClose(); setFormErr(""); } }

  async function save() {
    if (!draft.name.trim()) {
      setFormErr("Isi nama bisnisnya dulu.");
      document.getElementById("nl-name")?.focus();
      return;
    }
    setSaving(true); setFormErr("");
    try {
      await setDoc(spaceDoc(space, "leads", `lead_${Date.now()}`), stamp(space, {
        ...draft, name: draft.name.trim(), lastContact: firstContact(draft.status, today()),
        value: parseRupiah(draft.value),
        ...(place.address ? { address: place.address } : {}),
        ...(place.geo ? { geo: place.geo } : {}),
      }));
      setDraft(BLANK);
      setPlace({});
      onClose();
    } catch {
      setFormErr("Gagal menyimpan. Cek koneksi, lalu coba lagi.");
    }
    setSaving(false);
  }

  // Tempel shows the form once there's something in it to check.
  const showForm = way === "manual" || (way === "tempel" && isStarted(draft, place));

  return (
    <div className="modal-overlay" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="nl-h" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 id="nl-h" style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Tambah lead</h2>
          <button type="button" onClick={close} disabled={busy} aria-label="Tutup" style={{ flexShrink: 0, width: 44, height: 44, margin: "-10px -10px -10px 0", borderRadius: "50%", background: "transparent", border: "none", color: "var(--app-ink-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} stroke={2} /></button>
        </div>
        <div role="tablist" aria-label="Cara nambah lead" className="sp-seg" style={{ maxWidth: "none", gridAutoColumns: "auto", marginBottom: 16 }}>
          {WAYS.map(([w, name]) => (
            <button key={w} type="button" role="tab" id={`way-tab-${w}`} className="sp-seg-btn" aria-selected={way === w} aria-controls={PANEL[w]} onClick={() => onWay(w)}><span>{name}</span></button>
          ))}
        </div>

        {/* Tempel and Manual fill the same form. */}
        <div id="way-form" role="tabpanel" aria-labelledby={`way-tab-${way === "manual" ? "manual" : "tempel"}`} hidden={way !== "tempel" && way !== "manual"}>
          <div hidden={way !== "tempel"}>
            <PasteFill place={place} onFill={p => setDraft(prev => fillEmpty(prev, p))} onPlace={setPlace} />
          </div>
          {showForm && (
            <form noValidate onSubmit={e => { e.preventDefault(); save(); }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {([["name", "Nama bisnis", "mis. Kopi Senja", "text", "organization"], ["contact", "Nama kontak", "mis. Dina", "text", "off"], ["email", "Email", "nama@contoh.id", "email", "off"], ["phone", "No. WhatsApp", "mis. 0812 3456 7890", "tel", "off"], ["value", "Nilai deal (Rp)", "mis. 5jt atau 5.000.000", "text", "off"]] as [keyof Draft, string, string, string, string][]).map(([k, label, ph, type, ac]) => (
                  <div key={k} style={{ gridColumn: k === "name" ? "1/-1" : "auto" }}>
                    <label htmlFor={`nl-${k}`} style={FIELD_LABEL}>{label}{k === "name" && <span aria-hidden="true" style={{ color: "var(--hot)" }}> *</span>}</label>
                    <input id={`nl-${k}`} type={type} autoComplete={ac} inputMode={k === "phone" ? "tel" : undefined} required={k === "name"}
                      aria-invalid={k === "name" && Boolean(formErr) && !draft.name.trim()} aria-describedby={k === "name" && formErr ? "nl-err" : k === "value" ? "nl-value-is" : undefined}
                      value={draft[k]} onChange={e => { setDraft({ ...draft, [k]: e.target.value }); if (k === "name") setFormErr(""); }} style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} placeholder={ph} />
                    {k === "name" && formErr && !draft.name.trim() && <p id="nl-err" role="alert" style={{ margin: "6px 0 0", fontSize: 13, color: "var(--hot)" }}>{formErr}</p>}
                    {k === "value" && <p id="nl-value-is" style={{ margin: "6px 0 0", fontSize: 13, color: "var(--app-muted)" }}>{parseRupiah(draft.value) ? `= ${rupiah(parseRupiah(draft.value))}` : "Kosong = belum ada nilai"}</p>}
                  </div>
                ))}
                {([["source", "Sumber", SOURCES], ["status", "Status", ["Cold", "Warm", "Hot", "Closed"]], ["category", "Kategori", CATEGORIES]] as [keyof Draft, string, string[]][]).map(([k, label, opts]) => (
                  <div key={k} style={{ gridColumn: k === "category" ? "1/-1" : "auto" }}>
                    <label htmlFor={`nl-${k}`} style={FIELD_LABEL}>{label}</label>
                    <select id={`nl-${k}`} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44 }}>
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ gridColumn: "1/-1" }}>
                  <label htmlFor="nl-notes" style={FIELD_LABEL}>Catatan</label>
                  <textarea id="nl-notes" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} style={{ ...inputStyle, fontSize: 16, resize: "vertical", minHeight: 80 }} placeholder="mis. ketemu di GMaps, buka cabang baru bulan depan" />
                </div>
              </div>
              <DupNotice leads={leads} draft={draft} onOpen={onOpenLead} />
              {formErr && draft.name.trim() && <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--hot)" }}>{formErr}</p>}
              <div className="sp-form-foot">
                <button type="button" onClick={close} disabled={saving} style={{ ...btnMuted, flex: 1 }}>Batal</button>
                <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>{saving ? "Menyimpan…" : "Simpan lead"}</button>
              </div>
            </form>
          )}
        </div>

        <div id="way-excel" role="tabpanel" aria-labelledby="way-tab-excel" hidden={way !== "excel"}>
          <ExcelImport leads={leads} onBusy={setExcelBusy} onClose={close} />
        </div>

        <div id="way-maps" role="tabpanel" aria-labelledby="way-tab-maps" hidden={way !== "maps"}>
          {(mapsOn || way === "maps") && <LeadFinder leads={leads} me={me} onSave={rows => saveFound(space, rows)} onBusy={setMapsBusy} onClose={close} />}
        </div>
      </div>
    </div>
  );
}
