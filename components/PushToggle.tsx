"use client";

import { useEffect, useState } from "react";
import { PushState, disablePush, enablePush, pushState, testPush } from "@/lib/push";

// Profile panel row: the morning "Perlu ditindak" push on this device.
export default function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { pushState().then(setState).catch(() => setState("unsupported")); }, []);

  async function run(f: () => Promise<string | void>) {
    setBusy(true); setMsg("");
    try { const m = await f(); if (m) setMsg(m); } catch (e) { setMsg((e as Error).message); }
    setState(await pushState().catch(() => "unsupported" as PushState));
    setBusy(false);
  }

  const hint: Record<PushState, string> = {
    on: "Nyala di HP/browser ini. Tiap jam 08.00 WIB, kalau ada yang perlu ditindak.",
    off: "Ringkasan pagi: follow-up, penawaran nunggu, invoice telat, deal macet.",
    blocked: "Diblokir. Buka pengaturan notifikasi browser/HP buat SalesPal, izinin, terus balik sini.",
    "needs-install": "Di iPhone/iPad: Share → Add to Home Screen, buka SalesPal dari ikon itu (iOS 16.4+).",
    unsupported: "Browser ini belum dukung notifikasi.",
    "not-configured": "Belum disetel di server.",
  };

  return (
    <div style={{ background: "var(--app-inner)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>🔔 Notifikasi pagi</div>
          <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>{state ? hint[state] : "Cek…"}</div>
        </div>
        {(state === "off" || state === "on") && (
          <button
            onClick={() => run(state === "on" ? disablePush : enablePush)}
            disabled={busy}
            aria-pressed={state === "on"}
            style={{ flexShrink: 0, background: state === "on" ? "transparent" : "#005eb0", color: state === "on" ? "var(--brand-text)" : "#fff", border: "1px solid #005eb0", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "…" : state === "on" ? "Matikan" : "Nyalain"}
          </button>
        )}
      </div>
      {state === "on" && (
        <button onClick={() => run(async () => `Tes dikirim ke ${await testPush()} perangkat.`)} disabled={busy}
          style={{ marginTop: 10, background: "none", border: "none", padding: 0, color: "var(--brand-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Kirim tes
        </button>
      )}
      {msg && <div role="status" style={{ marginTop: 8, fontSize: 12, color: "var(--app-muted)" }}>{msg}</div>}
    </div>
  );
}
