"use client";

// Profil → Akses & admin (PRD-015 §2b): people who asked to come in, approved
// with the paid tools ticked for each; the owner also names the admins.
// Everything goes through /api/access/admin, which checks again.

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { PAID_TOOLS, TOOL_LABEL, type PaidTool } from "@/lib/tools";
import { btnMuted, btnPrimary, chip, font, inputStyle, modalBox } from "@/components/ui";

interface Req { uid: string; email: string; name: string; note: string; at: number; status: string; tools: PaidTool[]; decidedBy?: string; decidedAt?: number }
interface Adm { uid: string; email: string; by: string; at: number }

const ago = (ms: number) => {
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  return d <= 0 ? "hari ini" : d === 1 ? "kemarin" : `${d} hari lalu`;
};

export default function AccessAdmin({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<{ requests: Req[]; admins: Adm[] | null; owner: boolean; me: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [picked, setPicked] = useState<Record<string, PaidTool[]>>({});
  const [email, setEmail] = useState("");

  async function load() {
    try {
      const r = await authFetch("/api/access/admin");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal memuat.");
      setData(j); setErr("");
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function run(key: string, body: object) {
    setBusy(key); setErr("");
    try {
      const r = await authFetch("/api/access/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Gagal.");
      await load();
      return true;
    } catch (e) { setErr((e as Error).message); return false; }
    finally { setBusy(""); }
  }

  const pending = data?.requests.filter(r => r.status === "pending") || [];
  const approved = data?.requests.filter(r => r.status === "approved") || [];
  const h: React.CSSProperties = { fontSize: 14, fontWeight: 700, margin: "18px 0 8px" };
  const box: React.CSSProperties = { border: "1px solid var(--app-border)", borderRadius: 12, padding: 12, marginBottom: 8 };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="aa-h" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 520 }}>
        <div id="aa-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>Akses & admin</div>
        <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "4px 0 0", lineHeight: 1.5 }}>
          SalesPal masih tertutup. Yang daftar sendiri minta akses di sini. Centang alat berbayar yang boleh dipakai orang itu (kosong = cuma bisa masuk app).
        </p>
        {err && <div role="alert" style={{ fontSize: 13, color: "var(--hot)", marginTop: 10 }}>{err}</div>}
        {!data && !err && <div role="status" style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 14 }}>Memuat…</div>}

        {data && (
          <>
            <h2 style={h}>Permintaan masuk {pending.length ? `(${pending.length})` : ""}</h2>
            {!pending.length && <div style={{ fontSize: 13, color: "var(--app-muted)" }}>Belum ada yang minta.</div>}
            {pending.map(r => {
              const mine = r.uid === data.me && !data.owner;
              const tools = picked[r.uid] || [];
              return (
                <article key={r.uid} aria-label={`Permintaan ${r.email}`} style={box}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{r.email}</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)" }}>{[r.name, ago(r.at)].filter(Boolean).join(" · ")}</div>
                  {r.note && <p style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.note}</p>}
                  {mine ? <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 8 }}>Permintaan kamu sendiri diputusin admin lain atau owner.</div> : (
                    <>
                      <fieldset style={{ border: 0, padding: 0, margin: "8px 0 0" }}>
                        <legend style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 2 }}>Alat berbayar yang boleh</legend>
                        {PAID_TOOLS.map(t => (
                          <label key={t} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, fontSize: 14 }}>
                            <input type="checkbox" checked={tools.includes(t)} aria-label={`${TOOL_LABEL[t]} buat ${r.email}`}
                              onChange={() => setPicked({ ...picked, [r.uid]: tools.includes(t) ? tools.filter(x => x !== t) : [...tools, t] })}
                              style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
                            {TOOL_LABEL[t]}
                          </label>
                        ))}
                      </fieldset>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => run(r.uid, { op: "refuse", uid: r.uid })} disabled={!!busy} style={{ ...btnMuted, minHeight: 44 }}>Tolak</button>
                        <button onClick={() => run(r.uid, { op: "approve", uid: r.uid, tools })} disabled={!!busy} aria-label={`Setujui ${r.email}`} style={{ ...btnPrimary, minHeight: 44, flex: 1 }}>{busy === r.uid ? "Menyimpan…" : "Setujui"}</button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}

            <h2 style={h}>Udah disetujui {approved.length ? `(${approved.length})` : ""}</h2>
            {!approved.length && <div style={{ fontSize: 13, color: "var(--app-muted)" }}>Belum ada.</div>}
            {approved.map(r => (
              <div key={r.uid} style={{ ...box, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{r.email}</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)" }}>
                    {r.tools.length ? r.tools.map(t => TOOL_LABEL[t]).join(", ") : "Masuk app aja"} · oleh {r.decidedBy || "?"}
                  </div>
                </div>
                {(data.owner || r.uid !== data.me) && (
                  <button onClick={() => run(r.uid, { op: "revoke", uid: r.uid })} disabled={!!busy} aria-label={`Cabut akses ${r.email}`} style={{ ...chip, minHeight: 40, color: "color-mix(in srgb, #dc2626 55%, var(--app-text))" }}>Cabut</button>
                )}
              </div>
            ))}

            {data.owner && data.admins && (
              <>
                <h2 style={h}>Admin</h2>
                <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8, lineHeight: 1.5 }}>Admin bisa nyetujui & nolak permintaan. Cuma kamu yang bisa ngangkat atau nyabut admin.</div>
                {data.admins.map(a => (
                  <div key={a.uid} style={{ ...box, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{a.email}</div>
                    <button onClick={() => run(`adm_${a.uid}`, { op: "admin", email: a.email, on: false })} disabled={!!busy} aria-label={`Cabut admin ${a.email}`} style={{ ...chip, minHeight: 40 }}>Cabut admin</button>
                  </div>
                ))}
                <form onSubmit={async e => { e.preventDefault(); if (await run("adm_new", { op: "admin", email, on: true })) setEmail(""); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label htmlFor="aa-email" className="vh">Email admin baru</label>
                  <input id="aa-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email akun yang udah pernah login" style={{ ...inputStyle, flex: "1 1 220px", fontSize: 16 }} />
                  <button type="submit" disabled={!!busy || !email.trim()} style={{ ...btnPrimary, minHeight: 44 }}>{busy === "adm_new" ? "Menyimpan…" : "Jadikan admin"}</button>
                </form>
              </>
            )}
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnMuted, minHeight: 44 }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
