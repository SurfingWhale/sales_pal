"use client";

import { createPortal } from "react-dom";
import Icon from "@/components/Icon";

// Escape, focus and Tab for every .modal-overlay come from components/ModalA11y.
// A bottom sheet opened from a page or a dialog: portaled to <body> but still
// inside its opener in React's tree, so its own scrim click must not bubble on
// and close what is behind it (Escape and the phone's back click that scrim too).
// It sits above the home indicator and scrolls when tall (.sp-sheet).
export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay sp-sheet-overlay" onClick={e => { e.stopPropagation(); onClose(); }} style={{ alignItems: "flex-end", background: "var(--scrim)", zIndex: 130 }}>
      <section role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} className="sp-sheet sp-leads"
        style={{ width: "100%", maxWidth: 480, overflowY: "auto", borderRadius: 32, padding: "10px 18px 22px", background: "var(--app-card)", color: "var(--app-text)", boxShadow: "0 -10px 40px rgba(0,0,0,0.18)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 999, background: "var(--app-line-strong)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h2>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, marginRight: -8, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--app-ink-2)" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--glass-btn)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={13} stroke={2.4} /></span>
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}

