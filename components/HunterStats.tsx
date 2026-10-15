"use client";

import { useEffect, useState } from "react";
import { addDays, rupiah, today } from "@/lib/billing";
import { canEditCatalog, useSpace } from "@/lib/space";
import { HuntSession, Prospect, SMALL, journey, rate, sessionMinutes } from "@/lib/prospects";
import { COST_CATEGORIES, CostItem, loadClosed, saveCosts, useCosts } from "@/lib/prospectStore";
import { btnPrimary, card, chip, font, inputStyle, label } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmSheet";

// How the hunter is doing (docs/prd/PRD-009 §8): reached, answered, converted,
// and what each conversion cost. Under ten, a rate is written "X dari Y".

function Tile({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div style={{ background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</div>
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{k}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function HunterStats({ prospects, sessions }: { prospects: Prospect[]; sessions: HuntSession[] }) {
  const [ask, askSheet] = useConfirm();
  const space = useSpace();
  const canEdit = canEditCatalog(space);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<"30" | "all">("30");
  const [closed, setClosed] = useState<Prospect[]>([]);
  const [item, setItem] = useState({ name: "", category: COST_CATEGORIES[0] as string, amount: "" });
  const on = today();
  const month = on.slice(0, 7);
  const costs = useCosts(space, month);

  useEffect(() => { if (open) loadClosed(space).then(setClosed).catch(() => setClosed([])); }, [open, space]);

  const all = [...prospects, ...closed];
  const j = journey(all, range === "30" ? addDays(on, -29) : undefined);
  const spent = costs.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const monthIn = all.filter(p => p.firstSeenAt?.startsWith(month)).length;
  const monthData = all.filter(p => p.convertedAt?.startsWith(month)).length;
  const monthSessions = sessions.filter(s => new Date(s.startedAt).toISOString().slice(0, 7) === month);
  const now = Date.now();
  const minutes = monthSessions.reduce((a, s) => a + sessionMinutes(s, now), 0);
  const intros = monthSessions.reduce((a, s) => a + (s.counts?.intros || 0), 0);

  const [costMsg, setCostMsg] = useState("");
  const amountIn = Number(item.amount.replace(/\D/g, ""));
  const costReady = Boolean(item.name.trim() && amountIn);
  async function addCost() {
    if (!costReady) return;
    setCostMsg("");
    try {
      await saveCosts(space, month, [...costs, { id: `c_${Date.now()}`, name: item.name.trim(), category: item.category, amount: amountIn } as CostItem]);
      setItem({ name: "", category: COST_CATEGORIES[0], amount: "" });
    } catch {
      setCostMsg("Gagal nyimpen biaya. Cek koneksi lalu coba lagi.");
    }
  }
  function removeCost(c: CostItem) {
    ask("Hapus biaya?", `${c.name} (${rupiah(c.amount)}) dihapus dari biaya bulan ini.`, () => saveCosts(space, month, costs.filter(x => x.id !== c.id)));
  }

  return (
    <div style={{ ...card, padding: 20, marginBottom: 20 }}>
      {askSheet}
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 36, background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontFamily: font }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Performa hunter</span>
        <span aria-hidden="true" style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-text)" }}>{open ? "Tutup ▴" : "Lihat ▾"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div role="radiogroup" aria-label="Rentang" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {([["30", "30 hari"], ["all", "Semua"]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={range === k} onClick={() => setRange(k)}
                style={{ ...chip, minHeight: 34, fontWeight: 700, ...(range === k ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{l}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            <Tile k="Prospek masuk" v={String(j.masuk)} sub={`post ${j.source.post.masuk} · radar ${j.source.radar.masuk} · manual ${j.source.manual.masuk}`} />
            <Tile k="Contact rate" v={rate(j.terhubung, j.intro)} sub={`dijawab ÷ di-intro (${j.intro} di-intro)`} />
            <Tile k="Minat" v={rate(j.minat, j.terhubung)} sub="Tertarik + Kasih data ÷ dijawab" />
            <Tile k="Konversi NTB → ETB" v={rate(j.data, j.intro)} sub={`${j.data} kasih data ÷ di-intro`} />
            <Tile k="Minta ga dihubungi" v={rate(j.dnc, j.terhubung)} sub="÷ dijawab · naik = pesan kemaksa" />
            <Tile k="Percobaan sampai respon" v={j.attemptsToReply === null ? "—" : String(j.attemptsToReply)} sub="median" />
            <Tile k="Hari sampai respon" v={j.daysToReply === null ? "—" : String(j.daysToReply)} sub="median, dari intro pertama" />
            <Tile k="Balas di post" v={rate(j.channel.post.terhubung, j.channel.post.intro)} sub={`dijawab · ${j.channel.post.intro} intro`} />
            <Tile k="DM" v={rate(j.channel.dm.terhubung, j.channel.dm.intro)} sub={`dijawab · ${j.channel.dm.intro} intro`} />
          </div>
          {j.remarks.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Alasan tidak tertarik teratas</div>
              {j.remarks.map(r => <div key={r.label} style={{ fontSize: 12, color: "var(--app-sub)", padding: "2px 0" }}>{r.label} · {r.n}</div>)}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, margin: "18px 0 8px" }}>Bulan ini</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            <Tile k="Jam hunting" v={(minutes / 60).toFixed(1)} sub={`${monthSessions.length} sesi`} />
            <Tile k="Intro per jam" v={minutes >= 10 ? (intros / (minutes / 60)).toFixed(1) : "—"} sub={`${intros} intro dalam sesi`} />
            <Tile k="Biaya tercatat" v={rupiah(spent)} sub={spent ? `${costs.length} pos` : "Rp0 tercatat — waktu tetap biaya"} />
            <Tile k="Biaya per prospek" v={spent && monthIn ? rupiah(Math.round(spent / monthIn)) : "—"} sub={`${monthIn} masuk bulan ini`} />
            <Tile k="Biaya per konversi" v={spent && monthData ? rupiah(Math.round(spent / monthData)) : "—"} sub={`${monthData} kasih data bulan ini`} />
          </div>

          <div style={{ marginTop: 12 }}>
            {costs.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 0", borderTop: "1px solid var(--app-inner)" }}>
                <span>{c.name} <span style={{ color: "var(--app-muted)" }}>· {c.category}</span></span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b style={{ fontVariantNumeric: "tabular-nums" }}>{rupiah(c.amount)}</b>
                  {canEdit && <button onClick={() => removeCost(c)} aria-label={`Hapus biaya ${c.name}`} title="Hapus biaya" className="sp-icon-btn" style={{ ...chip, minWidth: 32, minHeight: 32, padding: "2px 8px" }}>🗑</button>}
                </span>
              </div>
            ))}
            {canEdit && (
              <form onSubmit={e => { e.preventDefault(); addCost(); }} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Catat biaya bulan ini</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  <div><label htmlFor="cost-name" style={label}>Nama biaya</label>
                    <input id="cost-name" value={item.name} onChange={e => setItem({ ...item, name: e.target.value })} placeholder="mis. Langganan hosting" style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} /></div>
                  <div><label htmlFor="cost-cat" style={label}>Kategori</label>
                    <select id="cost-cat" value={item.category} onChange={e => setItem({ ...item, category: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44 }}>
                      {COST_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select></div>
                  <div><label htmlFor="cost-amount" style={label}>Jumlah (Rp)</label>
                    <input id="cost-amount" inputMode="numeric" value={item.amount} onChange={e => setItem({ ...item, amount: e.target.value })} placeholder="mis. 150000" style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} /></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="submit" disabled={!costReady} style={{ ...btnPrimary, minHeight: 44, opacity: costReady ? 1 : 0.5 }}>+ Catat biaya</button>
                  {!costReady && <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Isi nama dan jumlahnya dulu.</span>}
                </div>
                <div role="status" style={{ fontSize: 12, color: "var(--hot)", marginTop: costMsg ? 6 : 0 }}>{costMsg}</div>
              </form>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 12 }}>Di bawah {SMALL}, angka ditulis &quot;X dari Y&quot; — persennya belum bisa dipercaya.</div>
        </div>
      )}
    </div>
  );
}
