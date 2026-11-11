"use client";

// The app's one toast (lib/toast.ts): what just happened, Batal while it can be
// taken back, Coba lagi when it failed. Mounted once by SalesTracker, so it
// stays while the seller moves between tabs.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Toast, dismissToast, subscribeToast, toast, toastError } from "@/lib/toast";

const btn = { minHeight: 44, padding: "0 14px", border: 0, borderRadius: 12, background: "rgba(255,255,255,.14)", color: "#fff", font: "600 var(--fs-meta) 'Plus Jakarta Sans', sans-serif", cursor: "pointer", flexShrink: 0 } as const;

export default function AppToast() {
  const [t, setT] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeToast(setT), []);
  if (!t) return null;

  async function doUndo(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); toast({ text: "Dibatalin" }); }
    catch { toastError("Gagal batalin. Cek koneksi lalu coba lagi.", async () => { await fn(); toast({ text: "Dibatalin" }); }); }
    setBusy(false);
  }
  async function doRetry(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); } catch { /* the retried action reports its own failure */ }
    setBusy(false);
  }
  const undo = t.undo;
  const retry = t.retry;

  return (
    <div className="sp-toast" role={t.error ? "alert" : "status"} data-tone={t.error ? "error" : undefined} style={{ zIndex: 150 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-meta)", lineHeight: 1.4 }}>{t.error ? t.text : `✓ ${t.text}`}</span>
      {undo && (
        <button type="button" disabled={busy} onClick={() => doUndo(undo)} style={btn}>{busy ? "…" : "Batal"}</button>
      )}
      {retry && <button type="button" disabled={busy} onClick={() => doRetry(retry)} style={btn}>{busy ? "…" : "Coba lagi"}</button>}
      <button type="button" onClick={() => dismissToast(t.id)} aria-label="Tutup" style={{ minHeight: 44, minWidth: 44, border: 0, background: "transparent", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name="close" size={13} stroke={2.4} />
      </button>
    </div>
  );
}
