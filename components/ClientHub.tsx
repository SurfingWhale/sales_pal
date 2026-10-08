"use client";

// Report Klien (docs/prd/PRD-005): one place per SMB client where each chat is
// logged with its source, each deal is moved stage by stage to lunas, the
// month's content numbers go in, and the monthly report comes out — frozen,
// edited, and sent over WhatsApp from the phone.

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { today } from "@/lib/billing";
import {
  CHANNELS, Channel, Client, Deal, FirstTouch, MonthNumbers, Baseline, PLATFORMS, Platform, Post, STAGE_LABEL, Stage,
  UNKNOWN, advance, baseline, computeMonth, delta, juta, monthName, monthOf, narrative, postsFromRows, shareText, shiftMonth, wilson,
} from "@/lib/funnel";
import { badge, btnGhost, btnMuted, btnPrimary, btnWA, card, chip, font, heading, ink, inputStyle, label, modalBox, subheading } from "@/components/ui";

type View = "pipeline" | "konten" | "report";
interface Frozen { month: string; numbers: MonthNumbers; base: Baseline; narrative: string; frozenAt: number }

const STAGE_COLOR: Record<Stage, string> = {
  lead: "#64748b", qualified: "#0e7490", quoted: "#b45309", won: "#7c3aed", paid: "#00a862", lost: "#dc2626",
};
const NEXT: Partial<Record<Stage, Stage>> = { lead: "qualified", qualified: "quoted", quoted: "won", won: "paid" };
const NEXT_LABEL: Partial<Record<Stage, string>> = { lead: "Qualified", qualified: "Kirim penawaran", quoted: "Won", won: "Lunas" };
const FORMATS = ["video", "reel", "static", "carousel", "story", "total"];

const n0 = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;
const fmtN = (n: number) => Math.round(n).toLocaleString("id-ID");
const pct = (r: number) => `${(r * 100).toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
// Firestore refuses undefined fields.
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function rememberClient(id: string) { try { localStorage.setItem("sp-client", id); } catch { /* private mode */ } }
function recalledClient(): string { try { return localStorage.getItem("sp-client") || ""; } catch { return ""; } }

export default function ClientHub({ uid }: { uid: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [view, setView] = useState<View>("pipeline");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Frozen[]>([]);
  const [editClient, setEditClient] = useState<{ id: string; name: string; threshold: string } | null>(null);

  useEffect(() => onSnapshot(collection(db, "users", uid, "clients"), s => {
    const rows = s.docs.map(d => ({ id: d.id, ...d.data() } as Client)).sort((a, b) => a.name.localeCompare(b.name));
    setClients(rows);
    setClientId(cur => cur && rows.some(r => r.id === cur) ? cur : (rows.find(r => r.id === recalledClient())?.id || rows[0]?.id || ""));
  }), [uid]);

  useEffect(() => {
    if (!clientId) { setDeals([]); setPosts([]); setReports([]); return; }
    const base = ["users", uid, "clients", clientId] as const;
    const u1 = onSnapshot(collection(db, ...base, "deals"), s => setDeals(s.docs.map(d => ({ id: d.id, ...d.data() } as Deal))));
    const u2 = onSnapshot(collection(db, ...base, "posts"), s => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as Post))));
    const u3 = onSnapshot(collection(db, ...base, "reports"), s => setReports(s.docs.map(d => d.data() as Frozen)));
    return () => { u1(); u2(); u3(); };
  }, [uid, clientId]);

  const client = clients.find(c => c.id === clientId);

  async function saveClient() {
    if (!editClient || !editClient.name.trim()) return;
    const id = editClient.id || `cl_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "clients", id), {
      name: editClient.name.trim(),
      segmentThreshold: n0(editClient.threshold) || 5_000_000,
      ...(editClient.id ? {} : { createdAt: Date.now() }),
    }, { merge: true });
    setClientId(id); rememberClient(id);
    setEditClient(null);
  }

  return (
    // Room at the bottom so the floating Quick Pitch button never covers the last line.
    <div style={{ paddingBottom: 72 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={heading}>Report Klien</div>
          <div style={subheading}>Catat chat + sumbernya, geser deal sampai lunas, terus report bulanan jadi sendiri.</div>
        </div>
        <button onClick={() => setEditClient({ id: "", name: "", threshold: "5.000.000" })} style={btnGhost}>+ Klien</button>
      </div>

      {!client ? (
        <div style={{ ...card, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🧾</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada klien</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 18, maxWidth: 420, marginInline: "auto" }}>
            Tambah klien yang lo pegang sosmednya (mis. toko aksesoris). Chat, deal, angka konten, dan report-nya disimpan per klien.
          </div>
          <button onClick={() => setEditClient({ id: "", name: "", threshold: "5.000.000" })} style={btnPrimary}>+ Tambah klien</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <label htmlFor="client-pick" style={{ position: "absolute", left: -9999 }}>Pilih klien</label>
            <select id="client-pick" value={clientId} onChange={e => { setClientId(e.target.value); rememberClient(e.target.value); }} style={{ ...inputStyle, width: "auto", minWidth: 160, fontWeight: 700 }}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setEditClient({ id: client.id, name: client.name, threshold: fmtN(client.segmentThreshold || 5_000_000) })} style={chip}>Atur klien</button>
          </div>
          <div role="tablist" aria-label="Bagian" style={{ display: "flex", gap: 4, background: "var(--app-inner)", padding: 4, borderRadius: 10, marginBottom: 18 }}>
            {([["pipeline", "Chat & Deal"], ["konten", "Konten"], ["report", "Report"]] as const).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: font,
                  background: view === v ? "var(--app-card)" : "transparent", color: view === v ? "#005eb0" : "var(--app-muted)",
                  boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {l}
              </button>
            ))}
          </div>
          {view === "pipeline" && <Pipeline uid={uid} clientId={client.id} deals={deals} />}
          {view === "konten" && <Content uid={uid} clientId={client.id} posts={posts} />}
          {view === "report" && <Report uid={uid} client={client} deals={deals} posts={posts} reports={reports} />}
        </>
      )}

      {editClient && (
        <div className="modal-overlay" onClick={() => setEditClient(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>{editClient.id ? "Atur klien" : "Klien baru"}</div>
            <label htmlFor="cl-name" style={label}>Nama klien</label>
            <input id="cl-name" value={editClient.name} onChange={e => setEditClient({ ...editClient, name: e.target.value })} placeholder="mis. Toko Aksesoris Jaya" style={{ ...inputStyle, marginBottom: 12 }} />
            <label htmlFor="cl-th" style={label}>Batas deal besar (Rp)</label>
            <input id="cl-th" inputMode="numeric" value={editClient.threshold} onChange={e => setEditClient({ ...editClient, threshold: e.target.value })} style={inputStyle} />
            <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 6 }}>Report misahin deal besar vs kecil, biar ketauan kalau omzet turun karena ukuran deal, bukan jumlahnya.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveClient} style={btnPrimary}>Simpan klien</button>
              <button onClick={() => setEditClient(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================= Chat & Deal =======================

function SourcePicker({ value, onChange, id }: { value: Channel; onChange: (c: Channel) => void; id: string }) {
  return (
    <div role="radiogroup" aria-labelledby={id} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {CHANNELS.map(c => (
        <button key={c} type="button" role="radio" aria-checked={value === c} onClick={() => onChange(c)}
          style={{ ...chip, fontSize: 12, padding: "7px 11px", fontWeight: 600,
            background: value === c ? "#005eb0" : "transparent", color: value === c ? "#fff" : "var(--app-muted)", borderColor: value === c ? "#005eb0" : "var(--app-border)" }}>
          {c}
        </button>
      ))}
    </div>
  );
}

interface ChatDraft { name: string; phone: string; channel: Channel; code: string; heardFrom: string; date: string; note: string; paidNow: boolean; amount: string; paidDate: string }
const blankChat = (): ChatDraft => ({ name: "", phone: "", channel: UNKNOWN, code: "", heardFrom: "", date: today(), note: "", paidNow: false, amount: "", paidDate: today() });

function Pipeline({ uid, clientId, deals }: { uid: string; clientId: string; deals: Deal[] }) {
  const [draft, setDraft] = useState<ChatDraft | null>(null);
  const [move, setMove] = useState<{ deal: Deal; to: Stage; amount: string; date: string; reason: string; channel: Channel } | null>(null);
  const [filter, setFilter] = useState<"aktif" | "lunas" | "gugur" | "semua">("aktif");
  const col = (...p: string[]) => doc(db, "users", uid, "clients", clientId, "deals", ...(p as [string]));

  const shown = deals
    .filter(d => filter === "semua" || (filter === "lunas" ? d.stage === "paid" : filter === "gugur" ? d.stage === "lost" : d.stage !== "paid" && d.stage !== "lost"))
    .sort((a, b) => (b.paidAt || b.leadAt).localeCompare(a.paidAt || a.leadAt));
  const thisMonth = monthOf(today());
  const paidThisMonth = deals.filter(d => monthOf(d.paidAt) === thisMonth);
  const open = (s: Stage) => deals.filter(d => d.stage === s).length;

  async function saveChat() {
    if (!draft || !draft.name.trim()) return;
    const code = draft.code.trim().toUpperCase();
    const ft: FirstTouch = clean({
      channel: draft.channel,
      method: draft.channel === UNKNOWN ? "unknown" : code ? "link_code" : draft.heardFrom.trim() ? "self_report" : "seller_guess",
      code: code || undefined,
      heardFrom: draft.heardFrom.trim() || undefined,
      at: draft.date,
    });
    const phone = draft.phone.replace(/[^\d+]/g, "");
    const repeat = phone.length >= 8 && deals.some(d => d.phone && d.phone.replace(/\D/g, "").endsWith(phone.replace(/\D/g, "").slice(-9)));
    let deal: Omit<Deal, "id"> = clean({
      contactName: draft.name.trim(), phone, firstTouch: ft, stage: "lead" as Stage, leadAt: draft.date,
      isRepeat: repeat || undefined, note: draft.note.trim() || undefined,
    });
    if (draft.paidNow && n0(draft.amount)) {
      deal = { ...deal, ...advance({ id: "", ...deal }, "paid", draft.paidDate, n0(draft.amount)) };
    }
    await setDoc(col(`deal_${Date.now()}`), clean(deal));
    setDraft(null);
  }

  function startMove(deal: Deal, to: Stage) {
    setMove({ deal, to, amount: to === "paid" ? fmtN(deal.quoteValue || 0).replace(/^0$/, "") : "", date: today(), reason: "", channel: deal.firstTouch?.channel || UNKNOWN });
  }

  async function doMove() {
    if (!move) return;
    const { deal, to } = move;
    if (to === "lost") {
      await updateDoc(col(deal.id), clean({ ...advance(deal, "lost", move.date), lostReason: move.reason.trim() || undefined }));
    } else {
      const amount = to === "quoted" || to === "paid" ? n0(move.amount) : undefined;
      const upd: Partial<Deal> = advance(deal, to, move.date, amount);
      // Soft gate: a source may be filled in at lunas, but only while it was unknown.
      if (to === "paid" && (deal.firstTouch?.channel || UNKNOWN) === UNKNOWN && move.channel !== UNKNOWN) {
        upd.firstTouch = { ...deal.firstTouch, channel: move.channel, method: "seller_guess" };
      }
      await updateDoc(col(deal.id), clean(upd));
    }
    setMove(null);
  }

  async function remove(d: Deal) {
    if (!confirm(`Hapus ${d.contactName}? Angkanya ikut hilang dari report.`)) return;
    await deleteDoc(col(d.id));
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8, marginBottom: 14 }}>
        {(["lead", "qualified", "quoted", "won"] as Stage[]).map(s => (
          <div key={s} style={{ ...card, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: ink(STAGE_COLOR[s]) }}>{open(s)}</div>
            <div style={{ fontSize: 11, color: "var(--app-muted)", fontWeight: 600 }}>{STAGE_LABEL[s]}</div>
          </div>
        ))}
        <div style={{ ...card, padding: "10px 12px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ok)" }}>{juta(paidThisMonth.reduce((a, d) => a + (d.paidAmount || 0), 0))}</div>
          <div style={{ fontSize: 11, color: "var(--app-muted)", fontWeight: 600 }}>Lunas bulan ini · {paidThisMonth.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["aktif", "lunas", "gugur", "semua"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              style={{ ...chip, textTransform: "capitalize", fontWeight: 600, background: filter === f ? "var(--app-inner)" : "transparent", color: filter === f ? "var(--app-text)" : "var(--app-muted)" }}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setDraft(blankChat())} style={btnPrimary}>+ Chat masuk</button>
      </div>

      {shown.length === 0 ? (
        <div style={{ ...card, padding: "36px 20px", textAlign: "center", fontSize: 12.5, color: "var(--app-muted)" }}>
          {deals.length === 0
            ? <>Belum ada chat. Tiap ada chat WA masuk, tap <b>+ Chat masuk</b> dan pilih sumbernya. Transaksi lama bisa diisi juga (centang &quot;Udah lunas&quot;).</>
            : "Ga ada deal di filter ini."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map(d => {
            const src = d.firstTouch?.channel || UNKNOWN;
            const nx = NEXT[d.stage];
            return (
              <div key={d.id} style={{ ...card, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.contactName}{d.isRepeat && <span style={{ fontSize: 11, color: "var(--app-muted)", fontWeight: 600 }}> · repeat</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--app-muted)", marginTop: 2 }}>
                      Chat {d.leadAt}{d.firstTouch?.code ? ` · kode ${d.firstTouch.code}` : ""}{d.firstTouch?.heardFrom ? ` · "${d.firstTouch.heardFrom}"` : ""}
                    </div>
                  </div>
                  <span style={badge(STAGE_COLOR[d.stage])}>{STAGE_LABEL[d.stage]}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                  <span style={src === UNKNOWN ? badge("#b45309") : badge("#005eb0")}>{src === UNKNOWN ? "Sumber belum tau" : src}</span>
                  {d.quoteValue ? <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Penawaran {juta(d.quoteValue)}</span> : null}
                  {d.paidAmount ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ok)" }}>Lunas {juta(d.paidAmount)} · {d.paidAt}</span> : null}
                  {d.stage === "lost" && <span style={{ fontSize: 12, color: "var(--app-muted)" }}>{d.lostReason || "tanpa alasan"}</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {nx && <button onClick={() => startMove(d, nx)} style={{ ...btnPrimary, padding: "8px 14px", fontSize: 12 }}>→ {NEXT_LABEL[d.stage]}</button>}
                  {d.stage !== "paid" && d.stage !== "won" && d.stage !== "lost" && <button onClick={() => startMove(d, "paid")} style={{ ...chip, fontSize: 12 }}>Langsung lunas</button>}
                  {d.stage !== "paid" && d.stage !== "lost" && <button onClick={() => startMove(d, "lost")} style={{ ...chip, fontSize: 12 }}>Gugur</button>}
                  <button onClick={() => remove(d)} aria-label={`Hapus ${d.contactName}`} style={{ ...chip, fontSize: 12, marginLeft: "auto", color: "#dc2626", borderColor: "#dc262640" }}>Hapus</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => setDraft(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>Chat masuk</div>
            <label htmlFor="ch-name" style={label}>Nama customer</label>
            <input id="ch-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="mis. Pak Andri" style={{ ...inputStyle, marginBottom: 12 }} />
            <label htmlFor="ch-phone" style={label}>No. WhatsApp (opsional)</label>
            <input id="ch-phone" type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="08…" style={{ ...inputStyle, marginBottom: 12 }} />
            <div id="ch-src" style={label}>Dari mana dia datang?</div>
            <SourcePicker id="ch-src" value={draft.channel} onChange={c => setDraft({ ...draft, channel: c })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <div>
                <label htmlFor="ch-code" style={label}>Kode post / promo</label>
                <input id="ch-code" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="REEL12" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="ch-date" style={label}>Tanggal chat</label>
                <input id="ch-date" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value, paidDate: e.target.value > draft.paidDate ? e.target.value : draft.paidDate })} style={inputStyle} />
              </div>
            </div>
            <label htmlFor="ch-heard" style={{ ...label, marginTop: 12 }}>&quot;Dari mana tahu kami?&quot; (jawaban customer, opsional)</label>
            <input id="ch-heard" value={draft.heardFrom} onChange={e => setDraft({ ...draft, heardFrom: e.target.value })} placeholder="mis. liat video pasang lampu di TikTok" style={{ ...inputStyle, marginBottom: 12 }} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.paidNow} onChange={e => setDraft({ ...draft, paidNow: e.target.checked })} />
              Udah lunas (buat ngisi transaksi lama)
            </label>
            {draft.paidNow && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label htmlFor="ch-amt" style={label}>Nominal lunas (Rp)</label>
                  <input id="ch-amt" inputMode="numeric" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="17.000.000" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="ch-pd" style={label}>Tanggal lunas</label>
                  <input id="ch-pd" type="date" value={draft.paidDate} onChange={e => setDraft({ ...draft, paidDate: e.target.value })} style={inputStyle} />
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 10 }}>Sumber dikunci setelah disimpan. Kalau sekarang &quot;Ga tau&quot;, masih bisa diisi sekali pas deal lunas.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={saveChat} disabled={!draft.name.trim() || (draft.paidNow && !n0(draft.amount))} style={{ ...btnPrimary, opacity: !draft.name.trim() || (draft.paidNow && !n0(draft.amount)) ? 0.5 : 1 }}>Simpan chat</button>
              <button onClick={() => setDraft(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {move && (
        <div className="modal-overlay" onClick={() => setMove(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>{move.deal.contactName} → {STAGE_LABEL[move.to]}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Tanggalnya kesimpen buat ngitung funnel dan lama closing.</div>
            {(move.to === "quoted" || move.to === "paid") && (
              <>
                <label htmlFor="mv-amt" style={label}>{move.to === "paid" ? "Nominal lunas (Rp)" : "Nilai penawaran (Rp)"}</label>
                <input id="mv-amt" inputMode="numeric" value={move.amount} onChange={e => setMove({ ...move, amount: e.target.value })} placeholder="15.000.000" style={{ ...inputStyle, marginBottom: 12 }} />
              </>
            )}
            {move.to === "lost" && (
              <>
                <label htmlFor="mv-reason" style={label}>Alasan gugur</label>
                <input id="mv-reason" value={move.reason} onChange={e => setMove({ ...move, reason: e.target.value })} placeholder="mis. harga, ga bales, beli di tempat lain" style={{ ...inputStyle, marginBottom: 12 }} />
              </>
            )}
            <label htmlFor="mv-date" style={label}>Tanggal</label>
            <input id="mv-date" type="date" value={move.date} onChange={e => setMove({ ...move, date: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} />
            {move.to === "paid" && (move.deal.firstTouch?.channel || UNKNOWN) === UNKNOWN && (
              <div style={{ background: "#b453090f", border: "1px solid #b4530940", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div id="mv-src" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: ink("#b45309") }}>Sumber customer ini belum ketahuan. Inget dia dateng dari mana?</div>
                <SourcePicker id="mv-src" value={move.channel} onChange={c => setMove({ ...move, channel: c })} />
                <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 8 }}>Boleh tetap &quot;Ga tau&quot; — tapi kehitung di baris &quot;belum ketahuan&quot; di report.</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={doMove} disabled={move.to === "paid" && !n0(move.amount)} style={{ ...btnPrimary, opacity: move.to === "paid" && !n0(move.amount) ? 0.5 : 1 }}>Simpan</button>
              <button onClick={() => setMove(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================= Konten =======================

const monthOptions = (center: string, back = 12) => Array.from({ length: back + 1 }, (_, i) => shiftMonth(center, -i));

interface PostDraft { platform: Platform; title: string; format: string; views: string; likes: string; comments: string; shares: string; saves: string }
const blankPost = (): PostDraft => ({ platform: "Instagram", title: "", format: "video", views: "", likes: "", comments: "", shares: "", saves: "" });

function Content({ uid, clientId, posts }: { uid: string; clientId: string; posts: Post[] }) {
  const [month, setMonth] = useState(monthOf(today()));
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [imp, setImp] = useState<{ rows: Omit<Post, "id">[]; file: string; platform: Platform; raw: Record<string, unknown>[] } | null>(null);
  const ref = (id: string) => doc(db, "users", uid, "clients", clientId, "posts", id);

  const m = useMemo(() => computeMonth(month, [], posts), [month, posts]);
  const list = posts.filter(p => p.month === month).sort((a, b) => b.views - a.views);

  async function savePost() {
    if (!draft || !draft.title.trim()) return;
    await setDoc(ref(`post_${Date.now()}`), {
      month, platform: draft.platform, title: draft.title.trim(), format: draft.format,
      views: n0(draft.views), likes: n0(draft.likes), comments: n0(draft.comments), shares: n0(draft.shares), saves: n0(draft.saves),
    });
    setDraft(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file.arrayBuffer().then(buf => {
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      setImp({ raw, file: file.name, platform: "Instagram", rows: postsFromRows(raw, month, "Instagram") });
    }).catch(() => alert("File ga kebaca. Pakai export .xlsx atau .csv dari Meta Business Suite / TikTok Studio."));
  }

  async function runImport() {
    if (!imp) return;
    const stamp = Date.now();
    await Promise.all(imp.rows.map((r, i) => setDoc(ref(`post_${stamp}_${i}`), r)));
    setImp(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <label htmlFor="ct-month" style={{ position: "absolute", left: -9999 }}>Bulan</label>
        <select id="ct-month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, width: "auto", fontWeight: 700 }}>
          {monthOptions(monthOf(today())).map(mm => <option key={mm} value={mm}>{monthName(mm)}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ ...btnGhost, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
            ⬆ Import export
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: "none" }} />
          </label>
          <button onClick={() => setDraft(blankPost())} style={btnPrimary}>+ Post</button>
        </div>
      </div>

      {m.platforms.length > 0 && (
        <div style={{ ...card, padding: 0, overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 460 }}>
            <thead>
              <tr style={{ background: "var(--app-inner)", textAlign: "left" }}>
                {["Platform", "Post", "Views", "ER (eng ÷ views)", "Save/view", "Share/view"].map(h => <th key={h} style={{ padding: "9px 12px", fontSize: 11, color: "var(--app-muted)", fontWeight: 700 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {m.platforms.map(p => (
                <tr key={p.platform} style={{ borderTop: "1px solid var(--app-border)", fontVariantNumeric: "tabular-nums" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 700 }}>{p.platform}</td>
                  <td style={{ padding: "9px 12px" }}>{p.posts}</td>
                  <td style={{ padding: "9px 12px" }}>{fmtN(p.views)}</td>
                  <td style={{ padding: "9px 12px" }}>{pct(p.erViews)}</td>
                  <td style={{ padding: "9px 12px" }}>{pct(p.savesPerView)}</td>
                  <td style={{ padding: "9px 12px" }}>{pct(p.sharesPerView)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ ...card, padding: "32px 20px", textAlign: "center", fontSize: 12.5, color: "var(--app-muted)" }}>
          Belum ada angka konten buat {monthName(month)}. Import file export dari Meta Business Suite / TikTok Studio, atau tambah per post. Kalau cuma punya total bulanan, tambah satu baris dengan format &quot;total&quot;.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(p => (
            <div key={p.id} style={{ ...card, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--app-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {p.platform}{p.format ? ` · ${p.format}` : ""} · {fmtN(p.views)} views · {fmtN(p.likes)} like · {fmtN(p.comments)} komen · {fmtN(p.shares)} share · {fmtN(p.saves)} save
                </div>
              </div>
              <button onClick={() => deleteDoc(ref(p.id))} aria-label={`Hapus ${p.title}`} style={{ ...chip, color: "#dc2626", borderColor: "#dc262640" }}>Hapus</button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => setDraft(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 460 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>Post {monthName(month)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label htmlFor="po-pl" style={label}>Platform</label>
                <select id="po-pl" value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value as Platform })} style={inputStyle}>
                  {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="po-fm" style={label}>Format</label>
                <select id="po-fm" value={draft.format} onChange={e => setDraft({ ...draft, format: e.target.value })} style={inputStyle}>
                  {FORMATS.map(f => <option key={f} value={f}>{f === "total" ? "total bulan" : f}</option>)}
                </select>
              </div>
            </div>
            <label htmlFor="po-title" style={label}>Judul / isi konten</label>
            <input id="po-title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="mis. Video pasang karpet iCAR" style={{ ...inputStyle, marginBottom: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}>
              {(["views", "likes", "comments", "shares", "saves"] as const).map(k => (
                <div key={k}>
                  <label htmlFor={`po-${k}`} style={label}>{{ views: "Views", likes: "Like", comments: "Komen", shares: "Share", saves: "Save" }[k]}</label>
                  <input id={`po-${k}`} inputMode="numeric" value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 8 }}>Reach sengaja ga dicatat: dijumlah antar post hasilnya selalu salah.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={savePost} disabled={!draft.title.trim()} style={{ ...btnPrimary, opacity: draft.title.trim() ? 1 : 0.5 }}>Simpan post</button>
              <button onClick={() => setDraft(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {imp && (
        <div className="modal-overlay" onClick={() => setImp(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Import {imp.file}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 14 }}>
              {imp.rows.length} post kebaca. Baris tanpa tanggal masuk ke {monthName(month)}; kolom platform dipakai kalau ada.
            </div>
            <label htmlFor="im-pl" style={label}>Platform kalau file ga nyebut</label>
            <select id="im-pl" value={imp.platform} onChange={e => { const p = e.target.value as Platform; setImp({ ...imp, platform: p, rows: postsFromRows(imp.raw, month, p) }); }} style={{ ...inputStyle, marginBottom: 12 }}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
            <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--app-border)", borderRadius: 8 }}>
              {imp.rows.slice(0, 20).map((r, i) => (
                <div key={i} style={{ padding: "7px 10px", fontSize: 12, borderTop: i ? "1px solid var(--app-border)" : "none" }}>
                  <b>{r.platform}</b> · {r.month} · {r.title.slice(0, 40)} · {fmtN(r.views)} views
                </div>
              ))}
              {imp.rows.length === 0 && <div style={{ padding: 12, fontSize: 12, color: "var(--app-muted)" }}>Ga ada baris yang punya angka views/like/komen/share/save.</div>}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={runImport} disabled={!imp.rows.length} style={{ ...btnPrimary, opacity: imp.rows.length ? 1 : 0.5 }}>Import {imp.rows.length} post</button>
              <button onClick={() => setImp(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================= Report =======================

function Tile({ k, v, d }: { k: string; v: string; d: { text: string; tone: string } }) {
  const color = d.tone === "up" ? "var(--ok)" : d.tone === "down" ? ink("#dc2626") : "var(--app-muted)";
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "var(--app-muted)", fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{v}</div>
      <div style={{ fontSize: 11.5, color, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{d.text}</div>
    </div>
  );
}

function Bar({ label: l, value, of, note }: { label: string; value: number; of: number; note?: string }) {
  const w = of ? Math.max(value ? 1.5 : 0, (value / of) * 100) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "84px 1fr auto", gap: 8, alignItems: "center", fontSize: 12 }}>
      <span style={{ color: "var(--app-muted)", fontWeight: 600 }}>{l}</span>
      <div style={{ height: 10, borderRadius: 4, background: "var(--app-inner)", overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: "#005eb0", borderRadius: 4 }} />
      </div>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmtN(value)}{note ? <span style={{ fontWeight: 500, color: "var(--app-muted)" }}> {note}</span> : null}</span>
    </div>
  );
}

function conv(k: number, n: number): string {
  if (!n) return "";
  const [lo, hi] = wilson(k, n);
  return n < 10 ? `(${k}/${n})` : `${Math.round((k / n) * 100)}% (±${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`;
}

function Report({ uid, client, deals, posts, reports }: { uid: string; client: Client; deals: Deal[]; posts: Post[]; reports: Frozen[] }) {
  const now = monthOf(today());
  const [month, setMonth] = useState(new Date().getDate() <= 7 ? shiftMonth(now, -1) : now);
  const frozen = reports.find(r => r.month === month);
  const threshold = client.segmentThreshold || 5_000_000;
  const live = useMemo(() => computeMonth(month, deals, posts, threshold), [month, deals, posts, threshold]);
  const liveBase = useMemo(() => baseline(month, deals, posts, threshold), [month, deals, posts, threshold]);
  const m = frozen?.numbers || live;
  const b = frozen?.base || liveBase;
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setText(frozen?.narrative || narrative(live, liveBase, client.name)); },
    // re-seed the narrative when the month, client or frozen state changes, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, client.id, frozen?.frozenAt, deals.length, posts.length]);
  const ref = doc(db, "users", uid, "clients", client.id, "reports", month);

  async function freeze() {
    await setDoc(ref, JSON.parse(JSON.stringify({ month, numbers: live, base: liveBase, narrative: text, frozenAt: Date.now() })));
  }
  async function unfreeze() {
    if (!confirm("Buka lagi report ini? Angkanya dihitung ulang dari data sekarang.")) return;
    await deleteDoc(ref);
  }
  const share = shareText(m, text);
  async function copy() {
    try { await navigator.clipboard.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* user can select the text */ }
  }

  const unknown = m.bySource.find(s => s.channel === "Ga tau");
  const funnelTop = Math.max(m.leads, 1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label htmlFor="rp-month" style={{ position: "absolute", left: -9999 }}>Bulan report</label>
        <select id="rp-month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, width: "auto", fontWeight: 700 }}>
          {monthOptions(now).map(mm => <option key={mm} value={mm}>{monthName(mm)}{reports.some(r => r.month === mm) ? " · beku" : ""}</option>)}
        </select>
        <span style={badge(frozen ? "#00a862" : "#b45309")}>{frozen ? `Dibekukan ${new Date(frozen.frozenAt).toLocaleDateString("id-ID")}` : "Draft · angka masih bisa berubah"}</span>
      </div>

      {!m.hasData ? (
        <div style={{ ...card, padding: "36px 20px", textAlign: "center", fontSize: 12.5, color: "var(--app-muted)" }}>
          Belum ada chat, deal lunas, atau angka konten di {monthName(month)}. Isi lewat tab Chat & Deal dan Konten dulu.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Tile k="Omzet lunas" v={juta(m.revenue)} d={delta(m.revenue, b.revenue, "money")} />
            <Tile k="Deal lunas" v={fmtN(m.paidCount)} d={delta(m.paidCount, b.paidCount, "count")} />
            <Tile k="Chat masuk" v={fmtN(m.leads)} d={delta(m.leads, b.leads, "count")} />
            <Tile k="Chat per 1.000 views" v={m.leadsPer1kViews == null ? "—" : m.leadsPer1kViews.toLocaleString("id-ID", { maximumFractionDigits: 1 })} d={m.leadsPer1kViews == null ? { text: "isi angka konten dulu", tone: "none" } : delta(m.leadsPer1kViews, b.leadsPer1kViews, "ratio")} />
            <Tile k="ER (engagement ÷ views)" v={m.views ? pct(m.erViews) : "—"} d={m.views ? delta(m.erViews, b.erViews, "rate") : { text: "isi angka konten dulu", tone: "none" }} />
          </div>

          {m.paidCount > 0 && (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Omzet = jumlah deal × ukuran deal</div>
              <div style={{ fontSize: 12.5, color: "var(--app-muted)", lineHeight: 1.7, fontVariantNumeric: "tabular-nums" }}>
                {m.paidCount} deal × rata-rata {juta(m.avgDeal)} (median {juta(m.medianDeal)})
                {b.avgDeal != null && <> · 3 bulan sebelumnya rata-rata {juta(b.avgDeal)} per deal</>}
                <br />Deal ≥ {juta(threshold)}: {m.bigCount} deal, {juta(m.bigRevenue)} · di bawahnya: {m.smallCount} deal, {juta(m.smallRevenue)}
              </div>
            </div>
          )}

          <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Funnel {monthName(month)}</div>
            {m.views > 0 && <>
              <Bar label="Views" value={m.views} of={m.views} />
              <Bar label="Engagement" value={m.engagement} of={m.views} />
              <div style={{ fontSize: 11, color: "var(--app-muted)", textAlign: "center", borderTop: "1px dashed var(--app-border)", borderBottom: "1px dashed var(--app-border)", padding: "3px 0", margin: "2px 0" }}>
                ↓ konten → orang (satuannya beda)
              </div>
            </>}
            <Bar label="Chat/lead" value={m.leads} of={funnelTop} />
            <Bar label="Qualified" value={m.qualified} of={funnelTop} note={conv(m.qualified, m.leads)} />
            <Bar label="Penawaran" value={m.quoted} of={funnelTop} note={conv(m.quoted, m.leads)} />
            <Bar label="Won" value={m.won} of={funnelTop} note={conv(m.won, m.leads)} />
            <Bar label="Lunas" value={m.paidFromCohort} of={funnelTop} note={conv(m.paidFromCohort, m.leads)} />
            <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 4 }}>
              Dihitung dari chat yang masuk bulan ini.{!m.cohortMature && " Masih berjalan: sebagian chat bulan ini belum sempat closing."} {m.lost > 0 && `${m.lost} gugur.`}
            </div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Omzet per sumber pertama</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {m.bySource.filter(s => s.count || s.channel === "Ga tau").map(s => (
                <div key={s.channel} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: s.channel === "Ga tau" ? ink("#b45309") : undefined, fontVariantNumeric: "tabular-nums" }}>
                  <span>{s.channel === "Ga tau" ? "Belum ketahuan sumbernya" : s.channel} · {s.count} deal</span>
                  <b>{juta(s.revenue)}</b>
                </div>
              ))}
            </div>
            {unknown && m.paidCount > 0 && (
              <div style={{ fontSize: 11.5, color: "var(--app-muted)", marginTop: 10 }}>
                {Math.round(m.unknownPaidShare * 100)}% deal lunas belum ketahuan sumbernya. Makin kecil angka ini, makin bisa dipercaya report-nya.
              </div>
            )}
          </div>

          {m.platforms.length > 0 && (
            <div style={{ ...card, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
                <thead>
                  <tr style={{ background: "var(--app-inner)", textAlign: "left" }}>
                    {["Platform", "Post", "Views", "ER", "Chat", "Omzet"].map(h => <th key={h} style={{ padding: "9px 12px", fontSize: 11, color: "var(--app-muted)", fontWeight: 700 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {m.platforms.map(p => (
                    <tr key={p.platform} style={{ borderTop: "1px solid var(--app-border)", fontVariantNumeric: "tabular-nums" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 700 }}>{p.platform}</td>
                      <td style={{ padding: "9px 12px" }}>{p.posts}</td>
                      <td style={{ padding: "9px 12px" }}>{fmtN(p.views)}</td>
                      <td style={{ padding: "9px 12px" }}>{p.views ? pct(p.erViews) : "—"}</td>
                      <td style={{ padding: "9px 12px" }}>{p.leads}</td>
                      <td style={{ padding: "9px 12px" }}>{juta(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {m.top.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              {([["Konten terbaik", m.top], ["Konten terlemah", m.bottom]] as const).filter(([, l]) => l.length).map(([t, l]) => (
                <div key={t} style={{ ...card, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t}</div>
                  {l.map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "4px 0" }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title} <span style={{ color: "var(--app-muted)" }}>· {p.platform}</span></span>
                      <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmtN(p.views)}</b>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div style={{ ...card, padding: 16 }}>
            <label htmlFor="rp-text" style={{ fontSize: 13.5, fontWeight: 700, display: "block", marginBottom: 8 }}>Ringkasan buat klien</label>
            <textarea id="rp-text" value={text} onChange={e => setText(e.target.value)} readOnly={Boolean(frozen)} rows={9}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55, fontSize: 13, opacity: frozen ? 0.9 : 1 }} />
            <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 6 }}>
              Ditulisin dari angka di atas. Rapiin kalimatnya, terus bekukan biar angka bulan ini ga berubah lagi.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {!frozen
                ? <button onClick={freeze} style={btnPrimary}>Bekukan report</button>
                : <button onClick={unfreeze} style={btnMuted}>Buka lagi</button>}
              <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" style={{ ...btnWA, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Kirim via WA</a>
              <button onClick={copy} style={btnGhost}>{copied ? "✓ Tersalin" : "Salin teks"}</button>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--app-muted)", lineHeight: 1.6 }}>
            Pembanding = rata-rata 3 bulan sebelumnya yang ada datanya. Bulan pertama ditulis &quot;bulan dasar&quot;. Angka di bawah 10 ga dikasih persen. ER = (like + komen + share + save) ÷ views. Omzet dihitung dari tanggal lunas; funnel dari tanggal chat masuk. Reach ga dijumlah.
          </div>
        </div>
      )}
    </div>
  );
}
