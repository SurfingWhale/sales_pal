"use client";

// Outreach and Rejection Log (Tim): what was sent to whom, and who said no,
// why, and when to try again. Each list has its own "catat" form.

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import { FormNote, useDiscard, useSave } from "@/components/FormGuard";
import { badge, btnMuted, btnPrimary, card, font, heading, ink, inputStyle, label, modalBox, subheading } from "@/components/ui";

export interface Outreach {
  id: string; leadName: string; type: string; date: string; subject: string;
  status: string; opens: number; clicks: number;
}
export interface Rejection {
  id: string; leadName: string; date: string; reason: string; channel: string;
  followUpDate: string; lesson: string;
}

const CHANNELS = ["Email", "DM Instagram", "WhatsApp", "LinkedIn", "Telepon"];
// Stored in English (older rows too); shown in Indonesian.
const STATUS: [string, string, string][] = [
  ["Sent", "Terkirim", "#005eb0"], ["Seen", "Dilihat", "#b45309"], ["Replied", "Dibalas", "#00a862"],
  ["No Response", "Tanpa respon", "#64748b"], ["Rejected", "Ditolak", "#dc2626"],
];
const statusOf = (s: string) => STATUS.find(x => x[0] === s) || [s, s, "#64748b"];
const icon = (type: string) => (type === "Email" ? "📧" : type === "DM Instagram" ? "📸" : type === "Telepon" ? "📞" : "💬");
const day = () => new Date().toISOString().split("T")[0];

function Header({ title, sub, action, onAdd }: { title: string; sub: string; action: string; onAdd: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      <div style={{ minWidth: 0, flex: "1 1 200px" }}>
        <div style={heading}>{title}</div>
        <div style={subheading}>{sub}</div>
      </div>
      <button onClick={onAdd} style={btnPrimary}>{action}</button>
    </div>
  );
}

function Empty({ emoji, title, body, action, onAdd }: { emoji: string; title: string; body: string; action: string; onAdd: () => void }) {
  return (
    <div style={{ ...card, padding: "40px 22px", textAlign: "center" }}>
      <div style={{ fontSize: 34, marginBottom: 12 }} aria-hidden="true">{emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 20, maxWidth: 420, marginInline: "auto", lineHeight: 1.55 }}>{body}</div>
      <button onClick={onAdd} style={btnPrimary}>{action}</button>
    </div>
  );
}

// ---------------- Outreach ----------------

const blankOut = () => ({ leadName: "", type: "Email", subject: "", status: "Sent" });

export function OutreachTab({ outreach }: { outreach: Outreach[] }) {
  const space = useSpace();
  const [draft, setDraft] = useState<ReturnType<typeof blankOut> | null>(null);
  const save = useSave();
  const [close, ask] = useDiscard(!!draft && !!(draft.leadName.trim() || draft.subject.trim()), () => setDraft(null), "Outreach ini");
  const open = () => { save.reset(); setDraft(blankOut()); };

  async function add() {
    if (!draft || !draft.leadName.trim()) return;
    const d = { ...draft, leadName: draft.leadName.trim(), subject: draft.subject.trim() };
    const ok = await save.run(() => setDoc(spaceDoc(space, "outreach", `out_${Date.now()}`), stamp(space, { ...d, date: day(), opens: 0, clicks: 0 })));
    if (ok) setDraft(null);
  }

  const rows = outreach.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <div className="sp-team" style={{ paddingBottom: 72 }}>
      <Header title="Outreach Tracker" sub="Catat tiap DM, email, dan WA yang kamu kirim, plus balasannya." action="+ Catat outreach" onAdd={open} />
      <div className="sp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: 10, marginBottom: 20 }}>
        {[["Total", outreach.length, "#005eb0"] as const, ...STATUS.filter(s => s[0] !== "Sent").map(([k, l, c]) => [l, outreach.filter(o => o.status === k).length, c] as const)].map(([l, v, c]) => (
          <div key={l} style={{ ...card, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: ink(c), fontFamily: font }}>{v}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2, fontWeight: 600 }}>{l}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty emoji="📭" title="Belum ada outreach" body="Catat email, DM, atau WA pertama kamu biar ketahuan siapa yang udah dihubungi dan siapa yang bales." action="+ Catat outreach" onAdd={open} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(o => {
            const [, word, color] = statusOf(o.status);
            return (
              <div key={o.id} style={{ ...card, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 20, lineHeight: "24px" }} aria-hidden="true">{icon(o.type)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{o.leadName}</div>
                    <span style={badge(color)}>{word}</span>
                  </div>
                  {o.subject && <div style={{ fontSize: 13, color: "var(--app-sub)", marginTop: 4, overflowWrap: "anywhere" }}>{o.subject}</div>}
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>
                    {o.type} · {o.date}{o.opens || o.clicks ? ` · dibuka ${o.opens} · diklik ${o.clicks}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => { if (!save.busy) close(); }}>
          <form onSubmit={e => { e.preventDefault(); add(); }} onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>Catat outreach</div>
            <label htmlFor="ou-name" style={label}>Nama lead / bisnis</label>
            <input id="ou-name" value={draft.leadName} onChange={e => setDraft({ ...draft, leadName: e.target.value })} placeholder="mis. Kopi Senja" style={{ ...inputStyle, marginBottom: 12 }} />
            <label htmlFor="ou-subject" style={label}>Subject / pesan pembuka</label>
            <input id="ou-subject" value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} placeholder="mis. Halo kak, mau nawarin foto menu" style={{ ...inputStyle, marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="ou-type" style={label}>Lewat</label>
                <select id="ou-type" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} style={inputStyle}>
                  {CHANNELS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="ou-status" style={label}>Status</label>
                <select id="ou-status" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} style={inputStyle}>
                  {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <FormNote why={draft.leadName.trim() ? "" : "Isi nama lead dulu."} err={save.err} />
            <div className="sp-form-foot">
              <button type="button" onClick={close} disabled={save.busy} style={btnMuted}>Batal</button>
              <button type="submit" disabled={!draft.leadName.trim() || save.busy} style={{ ...btnPrimary, opacity: draft.leadName.trim() && !save.busy ? 1 : 0.5 }}>{save.busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
          {ask}
        </div>
      )}
    </div>
  );
}

// ---------------- Rejection Log ----------------

const blankRej = () => ({ leadName: "", reason: "", channel: "Email", followUpDate: "", lesson: "" });

export function RejectionTab({ rejections }: { rejections: Rejection[] }) {
  const space = useSpace();
  const [draft, setDraft] = useState<ReturnType<typeof blankRej> | null>(null);
  const save = useSave();
  const [close, ask] = useDiscard(!!draft && !!(draft.leadName.trim() || draft.reason.trim() || draft.lesson.trim() || draft.followUpDate), () => setDraft(null), "Catatan ini");
  const open = () => { save.reset(); setDraft(blankRej()); };

  async function add() {
    if (!draft || !draft.leadName.trim()) return;
    const d = { ...draft, leadName: draft.leadName.trim(), reason: draft.reason.trim(), lesson: draft.lesson.trim() };
    const ok = await save.run(() => setDoc(spaceDoc(space, "rejections", `rej_${Date.now()}`), stamp(space, { ...d, date: day() })));
    if (ok) setDraft(null);
  }

  const rows = rejections.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const box = { background: "var(--app-inner)", borderRadius: 8, padding: "10px 12px", minWidth: 0 } as const;
  const cap = { fontSize: 12, color: "var(--app-muted)", fontWeight: 700, marginBottom: 4 } as const;
  return (
    <div className="sp-team" style={{ paddingBottom: 72 }}>
      <Header title="Rejection Log" sub="Catat alasannya biar bisa dipelajari, lalu jadwalin coba lagi." action="+ Catat penolakan" onAdd={open} />
      <div style={{ ...card, padding: "12px 14px", marginBottom: 20, fontSize: 13, lineHeight: 1.55, color: "var(--app-sub)" }}>
        <b style={{ color: "var(--app-text)" }}>💡 Penolakan itu data.</b> Tiap &quot;tidak&quot; ngasih tau apa yang perlu dibenerin buat closing berikutnya. Isi jadwal follow-up, nanti muncul di Beranda.
      </div>
      {rows.length === 0 ? (
        <Empty emoji="🗂️" title="Belum ada penolakan dicatat" body="Tiap ada yang nolak, catat alasannya dan kapan coba lagi biar bisa dipelajari dan di-follow up." action="+ Catat penolakan" onAdd={open} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map(r => (
            <div key={r.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{r.leadName}</div>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{r.channel} · {r.date}</div>
                </div>
                <span style={badge("#dc2626")}>Ditolak</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 10 }}>
                <div style={box}>
                  <div style={cap}>Alasan</div>
                  <div style={{ fontSize: 13, overflowWrap: "anywhere" }}>{r.reason || "—"}</div>
                </div>
                <div style={box}>
                  <div style={cap}>Follow-up</div>
                  <div style={{ fontSize: 13, color: r.followUpDate ? ink("#b45309") : "var(--app-muted)" }}>{r.followUpDate || "Belum dijadwal"}</div>
                </div>
              </div>
              {r.lesson && (
                <div style={{ ...box, marginTop: 10, background: "color-mix(in srgb, #00a862 10%, var(--app-card))" }}>
                  <div style={{ ...cap, color: ink("#00a862") }}>Pelajaran</div>
                  <div style={{ fontSize: 13, overflowWrap: "anywhere" }}>{r.lesson}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => { if (!save.busy) close(); }}>
          <form onSubmit={e => { e.preventDefault(); add(); }} onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>Catat penolakan</div>
            <label htmlFor="rj-name" style={label}>Nama lead / bisnis</label>
            <input id="rj-name" value={draft.leadName} onChange={e => setDraft({ ...draft, leadName: e.target.value })} placeholder="mis. Roti Pagi" style={{ ...inputStyle, marginBottom: 12 }} />
            <label htmlFor="rj-reason" style={label}>Alasan nolak</label>
            <input id="rj-reason" value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder="mis. Budget belum ada bulan ini" style={{ ...inputStyle, marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="rj-channel" style={label}>Lewat</label>
                <select id="rj-channel" value={draft.channel} onChange={e => setDraft({ ...draft, channel: e.target.value })} style={inputStyle}>
                  {CHANNELS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="rj-follow" style={label}>Coba lagi tanggal</label>
                <input id="rj-follow" type="date" value={draft.followUpDate} onChange={e => setDraft({ ...draft, followUpDate: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label htmlFor="rj-lesson" style={label}>Pelajaran (opsional)</label>
            <textarea id="rj-lesson" value={draft.lesson} onChange={e => setDraft({ ...draft, lesson: e.target.value })} placeholder="mis. Tawarin paket kecil dulu" style={{ ...inputStyle, resize: "vertical", height: 80 }} />
            <FormNote why={draft.leadName.trim() ? "" : "Isi nama lead dulu."} err={save.err} />
            <div className="sp-form-foot">
              <button type="button" onClick={close} disabled={save.busy} style={btnMuted}>Batal</button>
              <button type="submit" disabled={!draft.leadName.trim() || save.busy} style={{ ...btnPrimary, opacity: draft.leadName.trim() && !save.busy ? 1 : 0.5 }}>{save.busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
          {ask}
        </div>
      )}
    </div>
  );
}
