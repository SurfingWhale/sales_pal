"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Template {
  id: string;
  title: string;
  body: string;
}

// Minimal starter examples so the panel isn't empty on first use — fully editable/deletable.
const SEED: Omit<Template, "id">[] = [
  { title: "Cold DM — Tawarin Jasa", body: "Halo {nama}! Aku fotografer makanan freelance 📸 Foto menu yang aesthetic bisa naikin order online. Boleh aku kirim portfolio + paket harga?" },
  { title: "Follow-up", body: "Hai {nama}, mau follow up penawaran foto menu kemarin. Minggu ini ada slot promo kalau tertarik 😊" },
];

export default function QuickPitch({ uid, hideButton = false }: { uid: string; hideButton?: boolean }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [target, setTarget] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users", uid, "pitchTemplates"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
      setTemplates(docs);
      if (!seeded && docs.length === 0) {
        setSeeded(true);
        SEED.forEach((t, i) => setDoc(doc(db, "users", uid, "pitchTemplates", `seed_${Date.now()}_${i}`), t));
      }
    });
    return unsub;
  }, [uid, seeded]);

  function render(body: string) {
    return body.replace(/\{nama\}/gi, target.trim() || "kak");
  }
  function copyTpl(t: Template) {
    navigator.clipboard.writeText(render(t.body));
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1800);
  }
  function sendWA(t: Template) {
    window.open("https://wa.me/?text=" + encodeURIComponent(render(t.body)), "_blank");
  }
  async function save() {
    if (!editing || !editing.title.trim() || !editing.body.trim()) return;
    const id = editing.id || `tpl_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "pitchTemplates", id), { title: editing.title.trim(), body: editing.body.trim() });
    setEditing(null);
  }
  async function remove(id: string) {
    await deleteDoc(doc(db, "users", uid, "pitchTemplates", id));
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 8,
    color: "var(--app-text)", padding: "10px 12px", fontSize: 13, width: "100%",
    outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif",
  };
  const chipBtn: React.CSSProperties = {
    border: "1px solid var(--app-border)", background: "transparent", color: "var(--app-muted)",
    borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <>
      {/* Floating action button */}
      {!hideButton && <button
        onClick={() => setOpen(true)}
        className="sp-fab"
        aria-label="Quick Pitch — template pesan cepat"
        style={{
          position: "fixed", right: 18, bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
          width: 56, height: 56, borderRadius: "50%", background: "#005eb0", color: "#fff",
          border: "none", boxShadow: "0 6px 20px rgba(0,94,176,0.45)", fontSize: 24, cursor: "pointer",
          zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        💬
      </button>}

      {open && (
        <div className="modal-overlay" onClick={() => { setOpen(false); setEditing(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>💬 Quick Pitch</div>
              <button onClick={() => { setOpen(false); setEditing(null); }} aria-label="Tutup" style={{ background: "transparent", border: "none", color: "var(--app-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Template pesan lo — copy atau kirim langsung ke WhatsApp. Pakai <code style={{ background: "var(--app-inner)", padding: "1px 5px", borderRadius: 4 }}>{"{nama}"}</code> biar auto-ganti nama target.</div>

            {editing ? (
              /* Editor */
              <div>
                <label style={{ fontSize: 11, color: "var(--app-muted)", display: "block", marginBottom: 4 }}>Judul template</label>
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="mis. Cold DM Cafe" style={{ ...inputStyle, marginBottom: 12 }} />
                <label style={{ fontSize: 11, color: "var(--app-muted)", display: "block", marginBottom: 4 }}>Isi pesan</label>
                <textarea value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} placeholder="Halo {nama}! ..." style={{ ...inputStyle, height: 120, resize: "vertical", marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={save} disabled={!editing.title.trim() || !editing.body.trim()} style={{ background: "#005eb0", color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: (!editing.title.trim() || !editing.body.trim()) ? 0.5 : 1 }}>Simpan</button>
                  <button onClick={() => setEditing(null)} style={{ ...chipBtn, padding: "11px 20px", fontSize: 13 }}>Batal</button>
                </div>
              </div>
            ) : (
              <>
                {/* Target name */}
                <input value={target} onChange={e => setTarget(e.target.value)} placeholder="🎯 Nama target (buat {nama}) — opsional" style={{ ...inputStyle, marginBottom: 16 }} />

                {/* Templates */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {templates.map(t => (
                    <div key={t.id} style={{ background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`} style={chipBtn}>✎</button>
                          <button onClick={() => remove(t.id)} aria-label={`Hapus ${t.title}`} style={{ ...chipBtn, borderColor: "#ff444440", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>🗑</button>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{render(t.body)}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => copyTpl(t)} style={{ ...chipBtn, flex: 1, color: copiedId === t.id ? "var(--ok)" : "var(--app-text)", borderColor: copiedId === t.id ? "var(--ok)" : "var(--app-border)", padding: "8px" }}>
                          {copiedId === t.id ? "✓ Tersalin" : "Copy"}
                        </button>
                        <button onClick={() => sendWA(t)} style={{ flex: 1, background: "#25D366", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Kirim WA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => setEditing({ id: "", title: "", body: "" })} style={{ width: "100%", marginTop: 14, background: "transparent", color: "var(--brand-text)", border: "1px dashed #005eb0", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  + Template baru
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
