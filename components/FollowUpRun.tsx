"use client";

import { useState } from "react";
import { addDays, daysBetween, longDate, today, waLink, waNumber } from "@/lib/billing";
import type { QueryLead } from "@/lib/leadQuery";
import { btnMuted, btnPrimary, chip, font } from "@/components/ui";

// Follow-up, one lead after another (QA 15 Okt: "harus maju mundur buat follow
// up"). Each lead shows why it's due and how to reach them; every answer saves
// and moves to the next, so the list never has to be reopened.

type Outcome = "dibales" | "selesai" | "tunda" | "lewati";

export default function FollowUpRun<T extends QueryLead>({ queue, live, onReplied, onDone, onSchedule, onOpen, onClose }: {
  queue: T[];                                   // fixed when the run starts
  live: (id: string) => T | undefined;          // the latest copy, as it saves
  onReplied: (id: string) => Promise<void>;
  onDone: (id: string) => Promise<void>;
  onSchedule: (id: string, action: string, date: string) => Promise<void>;
  onOpen: (id: string) => void;                 // the full lead, when one line isn't enough
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [log, setLog] = useState<Outcome[]>([]);
  const on = today();
  const done = i >= queue.length;
  const l = done ? undefined : live(queue[i].id) || queue[i];

  async function act(o: Outcome, run?: () => Promise<void>) {
    if (!l) return;
    setBusy(true); setErr("");
    try {
      if (run) await run();
      setLog(x => [...x, o]);
      setI(i + 1);
    } catch {
      setErr("Gagal nyimpen. Cek koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  const later = (days: number, label: string) => (
    <button disabled={busy} onClick={() => act("tunda", () => onSchedule(l!.id, l!.nextAction || "Follow-up", addDays(on, days)))}
      style={{ ...chip, flex: "1 1 0", minHeight: 44, fontSize: 14, fontWeight: 600, color: "var(--app-text)" }}>{label}</button>
  );

  const late = l?.nextActionDate && l.nextActionDate < on ? daysBetween(l.nextActionDate, on) : 0;
  const hasPhone = !!l && waNumber(l.phone || "").length >= 10;
  const greet = l ? `Halo ${l.contact || l.name}, ` : "";
  const count = (o: Outcome) => log.filter(x => x === o).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} aria-label="Follow-up beruntun" data-own-layout=""
        style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "min(88vh, calc(100dvh - 48px))", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 20px", borderBottom: "1px solid var(--app-border)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>Follow-up beruntun</div>
            <div className="tabnum" style={{ fontSize: 13, color: "var(--app-muted)" }}>{done ? `${queue.length} lead diproses` : `${i + 1} dari ${queue.length}`}</div>
          </div>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--app-border)", background: "var(--app-card)", color: "var(--app-text)", fontSize: 22, cursor: "pointer", fontFamily: "inherit" }}>×</button>
        </div>
        <div role="progressbar" aria-label="Kemajuan follow-up" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={i} style={{ height: 3, background: "var(--app-inner)" }}>
          <div style={{ height: "100%", width: `${queue.length ? (Math.min(i, queue.length) / queue.length) * 100 : 100}%`, background: "#005eb0", transition: "width .2s" }} />
        </div>

        <div style={{ padding: 20, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {done ? (
            <div role="status" style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Beres 🎉</div>
              <p style={{ fontSize: 14, color: "var(--app-sub)", margin: "8px 0 0" }}>
                {count("dibales")} dibales · {count("selesai")} selesai · {count("tunda")} ditunda · {count("lewati")} dilewati
              </p>
            </div>
          ) : l && (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>{l.name}</div>
              <div style={{ fontSize: 14, color: "var(--app-sub)", marginTop: 4 }}>
                {[l.contact, l.status, l.value ? `Rp ${(l.value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : ""].filter(Boolean).join(" · ")}
              </div>
              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "var(--app-inner)", fontSize: 14, lineHeight: 1.5 }}>
                <b>{l.nextAction || "Follow-up"}</b>
                <span style={{ color: late ? "var(--hot)" : "var(--app-sub)" }}> · {late ? `telat ${late} hari (${longDate(l.nextActionDate!)})` : "hari ini"}</span>
                {l.lastContact && <div style={{ color: "var(--app-sub)", marginTop: 2 }}>Kontak terakhir {longDate(l.lastContact)}{l.lastReplyAt ? ` · terakhir dibales ${longDate(l.lastReplyAt)}` : ""}</div>}
                {(l.profile?.need || l.notes) && <div style={{ color: "var(--app-sub)", marginTop: 6 }}>{l.profile?.need ? `Butuh: ${l.profile.need}` : l.notes.slice(0, 160)}</div>}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {hasPhone
                  ? <a href={waLink(l.phone, greet)} target="_blank" rel="noreferrer" style={{ ...btnPrimary, flex: 1, minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", background: "#25D366", color: "#0b141a" }}>Chat WhatsApp</a>
                  : <button onClick={() => onOpen(l.id)} style={{ ...btnMuted, flex: 1, minHeight: 48 }}>Belum ada nomor · buka lead</button>}
                {hasPhone && <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} style={{ ...btnMuted, minHeight: 48, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Telepon</a>}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--app-sub)", margin: "20px 0 8px" }}>Hasilnya?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={busy} onClick={() => act("dibales", async () => { await onReplied(l.id); await onDone(l.id); })} style={{ ...btnPrimary, flex: 1, minHeight: 48 }}>💬 Dibales</button>
                <button disabled={busy} onClick={() => act("selesai", () => onDone(l.id))} style={{ ...btnMuted, flex: 1, minHeight: 48 }}>✓ Udah, selesai</button>
              </div>
              <div style={{ fontSize: 13, color: "var(--app-muted)", margin: "12px 0 6px" }}>Belum dibales? Tunda ke</div>
              <div style={{ display: "flex", gap: 8 }}>
                {later(1, "Besok")}{later(3, "3 hari")}{later(7, "Minggu depan")}
              </div>
              <div role="status" style={{ fontSize: 13, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", marginTop: err ? 10 : 0 }}>{err}</div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: "1px solid var(--app-border)" }}>
          {done
            ? <button onClick={onClose} style={{ ...btnPrimary, flex: 1, minHeight: 48 }}>Tutup</button>
            : <>
                <button onClick={() => l && onOpen(l.id)} style={{ ...btnMuted, minHeight: 48 }}>Buka lead</button>
                <button disabled={busy} onClick={() => act("lewati")} style={{ ...btnMuted, flex: 1, minHeight: 48 }}>Lewati →</button>
              </>}
        </div>
      </div>
    </div>
  );
}
