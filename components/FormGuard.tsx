"use client";

import { useState, type ReactNode } from "react";
import ConfirmSheet from "@/components/ConfirmSheet";

// Two things every small form in Tim wants (QA 15 Okt):
// - closing a form with typed-in changes asks "Buang perubahan?" first
//   (Escape, a tap outside, the phone's back and Batal all go through it)
// - saving shows "Menyimpan…" and an Indonesian error instead of failing silently

export function useDiscard(dirty: boolean, onClose: () => void, what: ReactNode = "Isian ini"): [() => void, ReactNode] {
  const [asking, setAsking] = useState(false);
  const tryClose = () => { if (dirty) setAsking(true); else onClose(); };
  const sheet = asking ? (
    <ConfirmSheet title="Buang perubahan?" action="Buang" busyLabel="Membuang…" onConfirm={async () => onClose()} onClose={() => setAsking(false)}>
      {what} belum disimpan. Kalau dibuang, hilang.
    </ConfirmSheet>
  ) : null;
  return [tryClose, sheet];
}

export function useSave() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setErr("");
    try { await fn(); return true; }
    catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); return false; }
    finally { setBusy(false); }
  }
  return { busy, err, run, reset: () => setErr("") };
}

// The line above Batal / Simpan: why Simpan is off, or what went wrong.
export function FormNote({ why, err }: { why?: string; err?: string }) {
  if (!why && !err) return null;
  return (
    <div role={err ? "alert" : "status"} style={{ fontSize: 13, marginTop: 14, color: err ? "color-mix(in srgb, #ff4444 55%, var(--app-text))" : "var(--app-muted)" }}>
      {err || why}
    </div>
  );
}
