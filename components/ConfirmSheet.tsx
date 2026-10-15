"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";

// "Hapus …?" asked in the app instead of the browser's confirm(): a bottom
// sheet with Batal and the action, the way a lead's delete asks (LeadDetail).
// Escape, a tap outside and the phone's back close it (components/ModalA11y).
// Portaled to <body>, so its scrim click must not bubble on to what's behind.
export default function ConfirmSheet({ title, children, action = "Hapus", busyLabel = "Menghapus…", onConfirm, onClose }: {
  title: string;
  children: ReactNode;
  action?: string;
  busyLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const close = () => { if (!busy) onClose(); };
  async function go() {
    setBusy(true); setErr("");
    try { await onConfirm(); onClose(); } catch { setErr("Gagal. Cek koneksi, lalu coba lagi."); setBusy(false); }
  }
  if (typeof document === "undefined") return null;
  const btn = { minHeight: 50, borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid var(--app-border)" } as const;
  return createPortal(
    <div className="modal-overlay sp-sheet-overlay" onClick={e => { e.stopPropagation(); close(); }} style={{ alignItems: "flex-end", background: "var(--scrim)", zIndex: 170 }}>
      <section role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} className="sp-sheet"
        style={{ width: "100%", maxWidth: 440, overflowY: "auto", borderRadius: 28, padding: "10px 18px 20px", background: "var(--app-card)", color: "var(--app-text)", boxShadow: "0 -10px 40px rgba(0,0,0,0.18)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 999, background: "var(--app-border)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{title}</h2>
          <button type="button" onClick={close} aria-label="Tutup" style={{ width: 44, height: 44, marginRight: -8, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--app-text)" }}>
            <Icon name="close" size={16} stroke={2.2} />
          </button>
        </div>
        <div style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.5 }}>{children}</div>
        {err && <p role="alert" style={{ margin: "0 0 12px", fontSize: 13, color: "var(--hot)" }}>{err}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <button type="button" autoFocus onClick={close} disabled={busy} style={{ ...btn, background: "var(--app-card)", color: "var(--app-text)" }}>Batal</button>
          <button type="button" onClick={go} disabled={busy} style={{ ...btn, border: 0, background: "var(--hot)", color: "#fff", opacity: busy ? 0.7 : 1 }}>{busy ? busyLabel : action}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}

// The same sheet as a one-liner where a component used to call confirm():
// `const [ask, askSheet] = useConfirm();` then
// `ask("Hapus X?", "Penjelasan.", async () => { ... })` and render {askSheet}.
type Ask = { title: string; body: ReactNode; run: () => Promise<void> | void; action?: string; busyLabel?: string };
export function useConfirm() {
  const [q, setQ] = useState<Ask | null>(null);
  const ask = (title: string, body: ReactNode, run: Ask["run"], action?: string, busyLabel?: string) => setQ({ title, body, run, action, busyLabel });
  const sheet = q ? (
    <ConfirmSheet title={q.title} action={q.action} busyLabel={q.busyLabel} onConfirm={async () => { await q.run(); }} onClose={() => setQ(null)}>
      {q.body}
    </ConfirmSheet>
  ) : null;
  return [ask, sheet] as const;
}
