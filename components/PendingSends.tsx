"use client";

// "Udah kekirim?" for sends whose screen is gone (AMB-06, lib/pendingSend).
// The seller switched tabs, closed the sheet, or iOS reloaded SalesPal while
// they were in WhatsApp: the question waits here instead of being lost, and is
// asked when they come back. Udah records it exactly as the screen would have.

import { useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { PendingSend, orphans, removePending, subscribe } from "@/lib/pendingSend";
import { btnMuted, btnPrimary } from "@/components/ui";
import { toast } from "@/lib/toast";

export default function PendingSends({ space, record }: {
  space: string;                                        // workspace key
  // false: can't record it here (e.g. lead gone); a function: the undo for what was recorded.
  record: (p: PendingSend) => Promise<boolean | (() => Promise<unknown>)>;
}) {
  const [list, setList] = useState<PendingSend[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    // A beat after a screen lets go, so one that is just re-mounting can take it back.
    let t: ReturnType<typeof setTimeout> | undefined;
    const sync = () => { clearTimeout(t); t = setTimeout(() => setList(orphans(space)), 400); };
    sync();
    const back = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", back);
    const off = subscribe(sync);
    return () => { clearTimeout(t); off(); document.removeEventListener("visibilitychange", back); };
  }, [space]);

  if (!list.length) return null;

  async function yes(p: PendingSend) {
    setBusy(p.id); setErr("");
    try {
      const r = await record(p);
      removePending(p.id);
      // The app's toast, with Batal: it stays when this sheet closes (DEC-004).
      if (r) toast({ text: `Tercatat: ${p.label.replace(/^Pesan ke /, "pesan ke ")}`, undo: typeof r === "function" ? r : undefined });
      else toast({ text: `${p.label} ga bisa dicatat: datanya udah ga ada.` });
    } catch {
      setErr("Belum kecatat. Cek koneksi lalu tap Udah lagi.");
    }
    setBusy(null);
  }
  const no = (p: PendingSend) => removePending(p.id);
  const close = () => { if (busy) return; list.forEach(p => removePending(p.id)); };
  return (
    <Sheet title={list.length > 1 ? `${list.length} pesan belum dikonfirmasi` : "Pesannya udah kekirim?"} onClose={close}>
      <p style={{ margin: "-4px 0 12px", fontSize: "var(--fs-meta)", color: "var(--app-muted)" }}>
        WhatsApp dan Instagram ga ngasih tahu kami, jadi yang kecatat cuma yang kamu tandai.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
        {list.map(p => (
          <li key={p.id} style={{ padding: "12px 0", borderTop: "1px solid var(--app-border)", display: "grid", gap: 8 }}>
            <span style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>{p.label}</span>
            {p.kind === "hunt" && <span style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.send.text}</span>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => no(p)} disabled={busy === p.id} style={{ ...btnMuted, flex: 1, minHeight: 44 }}>Belum</button>
              <button type="button" onClick={() => yes(p)} disabled={busy === p.id} style={{ ...btnPrimary, flex: 1, minHeight: 44 }}>{busy === p.id ? "Menyimpan…" : "Udah, catat"}</button>
            </div>
          </li>
        ))}
      </ul>
      {err && <p role="alert" style={{ margin: "8px 0 0", fontSize: "var(--fs-meta)", color: "var(--hot)" }}>{err}</p>}
    </Sheet>
  );
}
