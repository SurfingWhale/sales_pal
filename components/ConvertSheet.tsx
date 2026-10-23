"use client";

// Kasih data: a prospect who gave their number or email becomes a Hot lead and
// moves to ETB. One sheet for every place it can happen (the journey list and
// the conversation), so a person never turns into two leads (flow audit, 23 Okt).

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { today } from "@/lib/billing";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import { platformSource } from "@/lib/hunting";
import { Prospect, convertPatch } from "@/lib/prospects";
import { Counter, bump, clean, ctx, saveProspect, syncHunt } from "@/lib/prospectStore";
import { btnMuted, btnPrimary, font, inputStyle, label, modalBox } from "@/components/ui";

export default function ConvertSheet({ p, sessionId, onDone, onClose }: {
  p: Prospect; sessionId?: string;
  onDone: (msg: string) => void; onClose: () => void;
}) {
  const space = useSpace();
  const [f, setF] = useState({ business: p.name || "", phone: p.platform === "WA" ? p.handle : "", email: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const reachable = !!(f.phone.trim() || f.email.trim());

  async function save() {
    if (!reachable || busy) return;
    setBusy(true); setErr("");
    try {
      // Already a lead (from the DM log, or an earlier Kasih data): fill that one in, don't make another.
      const leadId = p.leadId || `lead_${Date.now()}`;
      const post = (p.history || []).find(e => e.kind === "post")?.text;
      const notes = [`Dari Hunting (${p.platform}) · ${p.handle}`, post ? `Post: "${post.slice(0, 160)}"` : "", f.note.trim()].filter(Boolean).join(" — ");
      await setDoc(spaceDoc(space, "leads", leadId), clean(stamp(space, {
        name: f.business.trim() || p.name || p.handle, contact: p.name || p.handle, source: platformSource[p.platform], status: "Hot", score: 85,
        email: f.email.trim(), phone: f.phone.trim(), category: "F&B", notes, lastContact: today(), value: 0,
      }, p)), { merge: true });
      const summary = ["Kasih data", f.business.trim(), f.phone.trim(), f.email.trim()].filter(Boolean).join(" · ");
      const patch = convertPatch(p, leadId, summary, ctx(sessionId));
      await saveProspect(space, p, patch);
      syncHunt(space, { ...p, ...patch } as Prospect);
      const counters: Counter[] = [...(p.contact === "terhubung" ? [] : ["replies" as Counter]), "converted"];
      counters.forEach(c => bump(space, sessionId, c));
      onDone(`${p.name || p.handle} masuk Leads sebagai Hot, sekarang ETB.`);
    } catch {
      setErr("Gagal nyimpen lead. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="convert-title" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 440 }}>
        <div id="convert-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Kasih data: {p.name || p.handle}</div>
        <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Jadi Lead Hot di Leads, prospek pindah ke ETB.</div>
        <label htmlFor="cv-business" style={label}>Nama bisnis</label>
        <input id="cv-business" value={f.business} onChange={e => setF({ ...f, business: e.target.value })} style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
        <label htmlFor="cv-phone" style={label}>WhatsApp</label>
        <input id="cv-phone" inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="08…" style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
        <label htmlFor="cv-email" style={label}>Email</label>
        <input id="cv-email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
        <label htmlFor="cv-note" style={label}>Catatan</label>
        <input id="cv-note" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="mis. butuh foto 20 menu, minggu depan" style={{ ...inputStyle, fontSize: 16, marginBottom: 16 }} />
        {err && <div role="alert" style={{ fontSize: 13, color: "var(--hot)", marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={{ ...btnMuted, flex: 1, minHeight: 44 }}>Batal</button>
          <button onClick={save} disabled={busy || !reachable} style={{ ...btnPrimary, flex: 1, minHeight: 44, opacity: reachable ? 1 : 0.5 }}>{busy ? "Menyimpan…" : "Simpan jadi Lead"}</button>
        </div>
        {!reachable && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 8 }}>Isi WhatsApp atau email — itu yang bikin dia dihitung konversi.</div>}
      </div>
    </div>
  );
}
