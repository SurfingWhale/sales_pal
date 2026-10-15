"use client";

import { useEffect, useState } from "react";
import { onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import { canEditCatalog, spaceCol, spaceDoc, useSpace } from "@/lib/space";
import { WA_INK } from "@/components/ui";
import { fillTemplate } from "@/lib/templates";
import { useConfirm } from "@/components/ConfirmSheet";

interface Template {
  id: string;
  title: string;
  body: string;
  stage?: string;   // Hunting's stage column (lib/templates.ts); kept when edited here
}

// Minimal starter examples so the panel isn't empty on first use — fully editable/deletable.
const SEED: Omit<Template, "id">[] = [
  { stage: "intro", title: "Cold DM — Tawarin Jasa", body: "Halo {nama}! Aku fotografer makanan freelance 📸 Foto menu yang aesthetic bisa naikin order online. Boleh aku kirim portfolio + paket harga?" },
  { stage: "followup", title: "Follow-up", body: "Hai {nama}, mau follow up penawaran foto menu kemarin. Minggu ini ada slot promo kalau tertarik 😊" },
];

export default function QuickPitch({ hideButton = false }: { hideButton?: boolean }) {
  const [ask, askSheet] = useConfirm();
  const space = useSpace();
  const canEdit = canEditCatalog(space);
  const spaceKey = `${space.kind}:${space.id}`;
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [target, setTarget] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [copyFail, setCopyFail] = useState<string | null>(null);
  // On a phone the button steps aside while you scroll down through a page
  // and comes back when you scroll up or stop near the end.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    if (hideButton) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 8;
      if (Math.abs(y - last) < 6 && !atEnd) return;
      setTucked(y > last && y > 80 && !atEnd);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideButton]);

  useEffect(() => {
    const unsub = onSnapshot(spaceCol(space, "pitchTemplates"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
      setTemplates(docs);
      // Starters only in the user's own space; a guild's set is its leaders' call.
      if (!seeded && docs.length === 0 && space.kind === "me") {
        setSeeded(true);
        SEED.forEach((t, i) => setDoc(spaceDoc(space, "pitchTemplates", `seed_${Date.now()}_${i}`), t));
      }
    }, () => setTemplates([]));
    return unsub;
  }, [spaceKey, seeded]); // eslint-disable-line react-hooks/exhaustive-deps

  // No person behind a quick pitch: {nama} is who you typed, the rest says nothing.
  function render(body: string) {
    return fillTemplate(body, { nama: target.trim().replace(/^@/, "") });
  }
  function copyTpl(t: Template) {
    setCopyFail(null);
    (navigator.clipboard ? navigator.clipboard.writeText(render(t.body)) : Promise.reject()).then(() => {
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(c => (c === t.id ? null : c)), 1800);
    }, () => setCopyFail(t.id));
  }
  function sendWA(t: Template) {
    window.open("https://wa.me/?text=" + encodeURIComponent(render(t.body)), "_blank");
  }
  async function save() {
    if (!editing || !editing.title.trim() || !editing.body.trim() || !canEdit) return;
    const id = editing.id || `tpl_${Date.now()}`;
    await setDoc(spaceDoc(space, "pitchTemplates", id), { title: editing.title.trim(), body: editing.body.trim(), ...(editing.stage ? { stage: editing.stage } : {}) });
    setEditing(null);
  }
  function remove(t: Template) {
    ask(`Hapus template ${t.title}?`, "Angka DM yang udah kecatat tetap ada.", () => deleteDoc(spaceDoc(space, "pitchTemplates", t.id)));
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 8,
    color: "var(--app-text)", padding: "10px 12px", fontSize: 16, minHeight: 44, width: "100%", fontFamily: "'Plus Jakarta Sans', sans-serif",
  };
  const chipBtn: React.CSSProperties = {
    border: "1px solid var(--app-border)", background: "transparent", color: "var(--app-muted)",
    borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 36, minWidth: 36,
  };

  return (
    <>
      {askSheet}
      {/* Floating action button */}
      {!hideButton && <style>{`
        /* The page ends clear of the floating button, above the bottom nav. */
        @media (max-width: 767px) { .sp-main { padding-bottom: calc(176px + env(safe-area-inset-bottom, 0px)) !important; } }
        .sp-fab { transition: transform .2s ease, opacity .2s ease; }
        .sp-fab.is-tucked { transform: translateY(24px) scale(.6); opacity: 0; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .sp-fab { transition: none; } }
      `}</style>}
      {!hideButton && <button
        onClick={() => setOpen(true)}
        className={`sp-fab${tucked ? " is-tucked" : ""}`}
        aria-label="Quick Pitch — template pesan cepat"
        title="Quick Pitch"
        style={{
          position: "fixed", right: 18, bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
          width: 56, height: 56, borderRadius: "50%", background: "#005eb0", color: "#fff",
          border: "none", boxShadow: "0 1px 2px rgba(0,94,176,0.2), 0 10px 26px rgba(0,94,176,0.35)", fontSize: 24, cursor: "pointer",
          zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon name="chatLines" size={24} />
      </button>}

      {open && (
        <div className="modal-overlay" onClick={() => { setOpen(false); setEditing(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>💬 Quick Pitch</div>
              <button onClick={() => { setOpen(false); setEditing(null); }} aria-label="Tutup" style={{ flexShrink: 0, width: 44, height: 44, margin: "-10px -10px -10px 0", borderRadius: "50%", background: "transparent", border: "none", color: "var(--app-text)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Template pesan kamu — copy atau kirim langsung ke WhatsApp. Pakai <code style={{ background: "var(--app-inner)", padding: "1px 5px", borderRadius: 4 }}>{"{nama}"}</code> biar auto-ganti nama target.</div>

            {editing ? (
              /* Editor */
              <div>
                <label htmlFor="qp-title" style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 4 }}>Judul template</label>
                <input id="qp-title" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="mis. Cold DM Cafe" style={{ ...inputStyle, marginBottom: 12 }} />
                <label htmlFor="qp-body" style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 4 }}>Isi pesan</label>
                <textarea id="qp-body" value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} placeholder="Halo {nama}! ..." style={{ ...inputStyle, height: 120, resize: "vertical", marginBottom: 16 }} />
                {(!editing.title.trim() || !editing.body.trim()) && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>Isi judul dan isi pesan dulu buat nyimpen.</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setEditing(null)} style={{ ...chipBtn, flex: 1, minHeight: 44, padding: "11px 20px", fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>Batal</button>
                  <button onClick={save} disabled={!editing.title.trim() || !editing.body.trim()} style={{ flex: 1, minHeight: 44, background: "#005eb0", color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: (!editing.title.trim() || !editing.body.trim()) ? 0.5 : 1 }}>Simpan</button>
                </div>
              </div>
            ) : (
              <>
                {/* Target name */}
                <label htmlFor="qp-target" style={{ fontSize: 12, color: "var(--app-muted)", display: "block", marginBottom: 4 }}>Nama target (opsional, buat {"{nama}"})</label>
                <input id="qp-target" value={target} onChange={e => setTarget(e.target.value)} placeholder="mis. Kopi Senja" style={{ ...inputStyle, marginBottom: 16 }} />

                {/* Templates */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {templates.map(t => (
                    <div key={t.id} style={{ background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {canEdit && <button onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`} style={chipBtn}>✎</button>}
                          {canEdit && <button onClick={() => remove(t)} aria-label={`Hapus ${t.title}`} style={{ ...chipBtn, borderColor: "#ff444440", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>🗑</button>}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{render(t.body)}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => copyTpl(t)} style={{ ...chipBtn, flex: 1, minHeight: 44, fontWeight: 700, color: copiedId === t.id ? "var(--ok)" : "var(--app-text)", borderColor: copiedId === t.id ? "var(--ok)" : "var(--app-border)", padding: "8px" }}>
                          {copiedId === t.id ? "✓ Tersalin" : "Copy"}
                        </button>
                        <button onClick={() => sendWA(t)} style={{ flex: 1, minHeight: 44, background: "#25D366", color: WA_INK, border: "none", borderRadius: 6, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Kirim WA
                        </button>
                      </div>
                      {copyFail === t.id && <div role="status" style={{ fontSize: 12, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginTop: 8 }}>Gagal menyalin. Pilih teks di atas, lalu salin manual.</div>}
                    </div>
                  ))}
                  {templates.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>{canEdit ? "Belum ada template. Tap + Template baru buat bikin yang pertama." : "Belum ada template. Leader atau Officer guild yang bikin template."}</div>}
                </div>

                {canEdit && <button onClick={() => setEditing({ id: "", title: "", body: "" })} style={{ width: "100%", marginTop: 14, background: "transparent", color: "var(--brand-text)", border: "1px dashed #005eb0", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  + Template baru
                </button>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
