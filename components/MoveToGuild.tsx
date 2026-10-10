"use client";

import { useEffect, useState } from "react";
import { Role, isManager } from "@/lib/guild";
import { MOVE_GROUPS, MoveGroup, countMoved, countPersonal, moveToGuild, restoreFromGuild, setMainGuild } from "@/lib/moveToGuild";
import { btnMuted, btnPrimary, card, chip, font, modalBox } from "@/components/ui";

// "Data pribadi kamu" on the Guild page (docs/prd/PRD-007 §2.7): what's still
// in Pribadi, one tap to bring it in under your name, and the way back.

export default function MoveToGuild({ me, guild, role, onUseGuild }: {
  me: { uid: string; name: string }; guild: { id: string; name: string }; role: Role; onUseGuild: () => void;
}) {
  const [counts, setCounts] = useState<Record<MoveGroup, number> | null>(null);
  const [moved, setMoved] = useState(0);
  const [picking, setPicking] = useState<{ groups: MoveGroup[]; catalogs: boolean; main: boolean } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const manager = isManager(role);

  useEffect(() => {
    let live = true;
    countPersonal(me.uid).then(c => live && setCounts(c)).catch(() => live && setCounts(null));
    countMoved(me.uid, guild.id).then(n => live && setMoved(n)).catch(() => undefined);
    return () => { live = false; };
  }, [me.uid, guild.id, tick]);

  const total = counts ? Object.values(counts).reduce((a, n) => a + n, 0) : 0;
  const summary = counts ? MOVE_GROUPS.filter(g => counts[g.id]).map(g => `${counts[g.id]} ${g.noun}`).join(", ") : "";

  async function go() {
    if (!picking || !picking.groups.length) return;
    setBusy(0); setMsg("");
    try {
      const n = await moveToGuild(me, guild.id, picking.groups, manager && picking.catalogs, setBusy);
      if (picking.main) { await setMainGuild(me.uid, guild.id); onUseGuild(); }
      setMsg(`${n} data pindah ke ${guild.name}, atas nama kamu.`);
      setPicking(null);
    } catch {
      setMsg("Ada yang gagal dipindah. Yang udah pindah aman; coba lagi buat sisanya.");
    } finally {
      setBusy(null); setTick(t => t + 1);
    }
  }

  async function back() {
    if (!confirm(`Balikin ${moved} data dari ${guild.name} ke Pribadi? Versi terakhir di guild yang dibawa pulang, lalu dihapus dari guild.`)) return;
    setBusy(0); setMsg("");
    try {
      const n = await restoreFromGuild(me.uid, guild.id);
      await setMainGuild(me.uid, null);
      setMsg(`${n} data balik ke Pribadi.`);
    } catch {
      setMsg("Gagal balikin sebagian. Coba lagi.");
    } finally {
      setBusy(null); setTick(t => t + 1);
    }
  }

  if (!counts && !moved && !msg) return null;
  return (
    <section aria-label="Data pribadi kamu" style={{ ...card, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Data pribadi kamu</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>
            {total ? `Masih di Pribadi: ${summary}.` : "Ga ada data yang tersisa di Pribadi."}
            {moved ? ` ${moved} data udah dipindah ke sini.` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {total > 0 && (
            <button disabled={busy !== null} onClick={() => setPicking({ groups: MOVE_GROUPS.filter(g => counts![g.id]).map(g => g.id), catalogs: manager, main: true })}
              style={{ ...btnPrimary, padding: "9px 16px" }}>Bawa ke {guild.name}</button>
          )}
          {moved > 0 && <button disabled={busy !== null} onClick={back} style={{ ...btnMuted, padding: "9px 16px" }}>Balikin ke Pribadi</button>}
        </div>
      </div>
      <div role="status" style={{ fontSize: 12, color: "var(--app-sub)", marginTop: msg || busy !== null ? 10 : 0 }}>
        {busy !== null ? `Memindahkan… ${busy}%` : msg}
      </div>

      {picking && (
        <div className="modal-overlay" onClick={() => busy === null && setPicking(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="mv-title" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 440 }}>
            <div id="mv-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Bawa data ke {guild.name}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Dicatat atas nama kamu. Leader & Officer bisa lihat, member lain ga. Di Pribadi disembunyiin, dan bisa dibalikin kapan aja dari sini.
            </div>
            <div role="group" aria-label="Yang dibawa" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {MOVE_GROUPS.map(g => {
                const on = picking.groups.includes(g.id);
                const n = counts?.[g.id] || 0;
                return (
                  <button key={g.id} aria-pressed={on} disabled={!n} onClick={() => setPicking({ ...picking, groups: on ? picking.groups.filter(x => x !== g.id) : [...picking.groups, g.id] })}
                    style={{ ...chip, minHeight: 38, textAlign: "left", fontSize: 13, opacity: n ? 1 : 0.5, ...(on ? { color: "var(--app-text)", border: "1px solid #005eb0", background: "#005eb014" } : {}) }}>
                    {on ? "☑" : "☐"} {g.label} · {n}
                  </button>
                );
              })}
            </div>
            {manager && (
              <button aria-pressed={picking.catalogs} onClick={() => setPicking({ ...picking, catalogs: !picking.catalogs })}
                style={{ ...chip, minHeight: 38, width: "100%", textAlign: "left", fontSize: 13, marginBottom: 6, ...(picking.catalogs ? { color: "var(--app-text)", border: "1px solid #005eb0", background: "#005eb014" } : {}) }}>
                {picking.catalogs ? "☑" : "☐"} Salin Paket, template pesan, kampanye & info bisnis (yang belum ada di guild)
              </button>
            )}
            <button aria-pressed={picking.main} onClick={() => setPicking({ ...picking, main: !picking.main })}
              style={{ ...chip, minHeight: 38, width: "100%", textAlign: "left", fontSize: 13, marginBottom: 16, ...(picking.main ? { color: "var(--app-text)", border: "1px solid #005eb0", background: "#005eb014" } : {}) }}>
              {picking.main ? "☑" : "☐"} Jadiin {guild.name} ruang kerja utama — data baru & lead website masuk sini
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={go} disabled={busy !== null || !picking.groups.length} style={{ ...btnPrimary, opacity: picking.groups.length ? 1 : 0.5 }}>
                {busy !== null ? `Memindahkan… ${busy}%` : "Pindahin"}
              </button>
              <button onClick={() => setPicking(null)} disabled={busy !== null} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
