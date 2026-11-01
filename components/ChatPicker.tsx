"use client";

import { useEffect, useRef, useState } from "react";
import type { PitchTemplate } from "@/lib/hunting";
import { useBusiness, useSpaceCollection, waLink } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import { STAGES, Stage, brandOf, fillTemplate, stageOf, workflowOf } from "@/lib/templates";
import { rankScripts } from "@/lib/scriptPick";
import { SITES } from "@/lib/sites";
import Icon from "@/components/Icon";
import { ink } from "@/components/ui";

// The next message to a lead, from your own scripts (owner, 29 Okt: "masa gw
// gabisa milih intro dll"; QA-4 Chat): the stage that fits where they are is
// picked, and within it the script that fits their type of business and what
// they need (lib/scriptPick), already filled in. Scripts written for a DM stay
// out. Any other can be picked and what you send can be edited. WhatsApp can't
// tell us a message went out, so it counts once you say it did.

export interface ChatLead {
  name: string; contact: string; phone: string; email?: string; status: string; lastContact: string;
  quoted?: boolean;                  // a live offer is out
  category: string | null;           // their type of business, read from the lead (lib/scriptPick categoryOf)
  need?: string; pain?: string;
}

// Where a lead is, as a stage of the conversation.
export function leadStage(l: ChatLead): Stage {
  if (l.status === "Closed") return "etb";
  if (l.quoted) return "closing";
  if (l.status === "Hot") return "offering";
  if (l.status === "Warm") return "gali";
  return l.lastContact ? "followup" : "intro";
}

const BRAND_KEY = "sp-script-brand";
const savedBrand = () => { try { return localStorage.getItem(BRAND_KEY) || ""; } catch { return ""; } };

function useScripts(lead: ChatLead, stage: Stage, brand: string) {
  const space = useSpace();
  const all = useSpaceCollection<PitchTemplate>(space, "pitchTemplates");
  const business = useBusiness(space);
  const usable = all.filter(t => !t.archived && workflowOf(t) !== "hunting" && (!brand || !brandOf(t) || brandOf(t) === brand));
  const ranked = rankScripts(usable.filter(t => stageOf(t) === stage), lead).filter(r => !r.out)
    .sort((a, b) => Number(!!b.t.isDefault) - Number(!!a.t.isDefault));
  const fill = (t: PitchTemplate) => fillTemplate(t.body, { nama: lead.contact || lead.name, bisnis: business.name, kebutuhan: lead.need });
  return { all, usable, ranked, fill, businessName: business.name };
}

export default function ChatPicker({ lead, wide, draft, next, onSend, onManage }: {
  lead: ChatLead;
  wide: boolean;
  draft?: { text: string; what: string } | null;    // a message already written for them, in place of a script
  next?: { name: string; go: () => void } | null;   // who comes after this one
  onSend: (what: string) => void;                    // they said it went out: log it, close
  onManage?: () => void;                             // Script Management
}) {
  const name = lead.contact || lead.name;
  const fits = leadStage(lead);
  const [stage, setStage] = useState<Stage>(fits);
  const [brand, setBrand] = useState(savedBrand);
  const { ranked: forStage, fill, businessName, usable } = useScripts(lead, stage, brand);
  const [tpl, setTpl] = useState<PitchTemplate | null>(null);
  const [auto, setAuto] = useState<string[] | null>(null);   // why the shown script was picked for you
  const [text, setText] = useState(draft?.text ?? `Halo ${name}, `);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  // A phone opens on the message: the script is already in, one tap sends it.
  const [step, setStep] = useState<"pick" | "write" | "sent">("write");
  const [find, setFind] = useState("");
  const choose = (t: PitchTemplate, why: string[] | null) => { setTpl(t); setText(fill(t)); setAuto(why); };
  const take = (t: PitchTemplate) => { touched.current = true; choose(t, null); setStep("write"); };
  // The best fit is put in for you, on opening and on each stage you look at,
  // until you write or pick yourself.
  const touched = useRef(!!draft);
  useEffect(() => {
    if (touched.current) return;
    const best = forStage[0];
    if (best) choose(best.t, best.why.length ? best.why : [best.t.isDefault ? "script default tahap ini" : forStage.length > 1 ? "paling atas di tahap ini" : "satu-satunya buat tahap ini"]);
    else { setTpl(null); setAuto(null); setText(`Halo ${name}, `); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, brand, usable.length, businessName]);
  const ready = text.trim().length > 0;
  const needle = find.trim().toLowerCase();
  const listed = needle ? forStage.filter(r => `${r.t.title} ${r.t.body}`.toLowerCase().includes(needle)) : forStage;
  const what = tpl ? tpl.title : draft?.what || "Chat WhatsApp";
  const label = STAGES.find(s => s.id === stage)?.label;
  const pickBrand = (v: string) => {
    touched.current = false; setBrand(v);
    try { localStorage.setItem(BRAND_KEY, v); } catch { /* it just isn't remembered */ }
  };

  const chip = (on: boolean): React.CSSProperties => ({
    flexShrink: 0, minHeight: 44, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${on ? "#005eb0" : "var(--app-line-strong)"}`, background: on ? "#005eb0" : "transparent", color: on ? "#fff" : "var(--app-text)",
  });
  const big: React.CSSProperties = { flex: 1, minHeight: 48, borderRadius: 999, background: "#005eb0", color: "#fff", border: 0, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", fontFamily: "inherit", cursor: "pointer" };
  const soft: React.CSSProperties = { minHeight: 48, padding: "0 18px", borderRadius: 999, border: "1px solid var(--app-line-strong)", background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

  if (step === "sent") {
    return (
      <div style={{ display: "grid", gap: 12, maxWidth: 520, margin: "0 auto" }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Pesannya udah kekirim?</p>
        <p style={{ margin: 0, fontSize: 14, color: "var(--app-muted)" }}>WhatsApp ga ngasih tahu kami, jadi yang kecatat cuma yang kamu tandai.</p>
        <button type="button" onClick={() => { onSend(what); next?.go(); }} style={big}>{next ? `Udah, lanjut ke ${next.name}` : "Udah, catat"}</button>
        {next && <button type="button" onClick={() => onSend(what)} style={soft}>Udah, selesai dulu</button>}
        <button type="button" onClick={() => setStep("write")} style={soft}>Belum, balik ke pesan</button>
      </div>
    );
  }

  const showPick = wide || step === "pick";
  const showWrite = wide || step === "write";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {auto && tpl && (
        <p role="status" aria-label="Dipilih otomatis" style={{ margin: 0, fontSize: 12, color: "var(--app-muted)" }}>
          Dipilih otomatis{lead.category ? ` buat ${lead.category}` : ""}: {auto.join(" · ")}.
        </p>
      )}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: wide ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)", alignItems: "start" }}>
        <div style={{ display: showPick ? "grid" : "none", gap: 12, minWidth: 0 }}>
          <div role="radiogroup" aria-label="Tahap" className="sp-chiprow" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STAGES.map(s => (
              <button key={s.id} type="button" role="radio" aria-checked={stage === s.id} onClick={() => { touched.current = false; setStage(s.id); }} style={chip(stage === s.id)}>
                {s.id === fits ? "● " : ""}{s.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="cp-brand" className="vh">Brand</label>
            <select id="cp-brand" value={brand} onChange={e => pickBrand(e.target.value)} style={{ flex: 1, minWidth: 0, minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid var(--app-line-strong)", background: "var(--app-card)", color: "var(--app-text)", fontSize: 16, fontFamily: "inherit" }}>
              <option value="">Semua brand</option>
              {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {onManage && <button type="button" onClick={onManage} style={{ ...soft, minHeight: 44 }}>Kelola</button>}
          </div>
          {forStage.length > 3 && <>
            <label htmlFor="cp-find" className="vh">Cari script</label>
            <input id="cp-find" type="search" value={find} onChange={e => setFind(e.target.value)} placeholder="Cari script" style={{ width: "100%", boxSizing: "border-box", minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid var(--app-line-strong)", background: "var(--app-card)", color: "var(--app-text)", fontSize: 16, fontFamily: "inherit" }} />
          </>}
          <div role="group" aria-label="Script" style={{ display: "grid", gap: 6 }}>
            {listed.length ? listed.map(({ t, score }, i) => (
              <button key={t.id} type="button" aria-pressed={tpl?.id === t.id} onClick={() => take(t)}
                style={{ display: "grid", gap: 2, width: "100%", minHeight: 52, padding: "8px 12px", borderRadius: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)",
                  border: `1px solid ${tpl?.id === t.id ? "#005eb0" : "var(--app-border)"}`, background: tpl?.id === t.id ? "color-mix(in srgb, #005eb0 8%, var(--app-card))" : "var(--app-card)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                  <span style={{ minWidth: 0 }}>{t.title}</span>
                  {i === 0 && score > 0 && <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "color-mix(in srgb, var(--ok) 14%, transparent)", color: ink("var(--ok)") }}>Paling cocok</span>}
                </span>
                <span style={{ fontSize: 12, color: "var(--app-muted)", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fill(t)}</span>
              </button>
            )) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--app-muted)" }}>{needle ? "Ga ada script yang cocok." : `Belum ada script ${label} buat Leads.`} {needle ? "" : onManage ? "Buat lewat Kelola, atau tulis langsung." : "Tulis langsung di kolom pesan."}</p>
            )}
          </div>
          {!wide && <button type="button" onClick={() => setStep("write")} style={big}>Lanjut</button>}
        </div>

        <div style={{ display: showWrite ? "grid" : "none", gap: 12, minWidth: 0 }}>
          {!wide && <button type="button" onClick={() => setStep("pick")} style={{ ...soft, minHeight: 44, justifySelf: "start" }}>Ganti script</button>}
          <label htmlFor="cp-text" style={{ fontSize: 13, fontWeight: 600, color: "var(--app-muted)" }}>Isi pesan, bisa diedit</label>
          <textarea id="cp-text" autoFocus={wide} value={text} onChange={e => { touched.current = true; setAuto(null); setText(e.target.value); }} rows={wide ? 10 : 8}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 14, border: "1px solid var(--app-line-strong)", background: "var(--app-card)", color: "var(--app-text)", fontSize: 16, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" disabled={!ready} onClick={async () => { let ok = true; try { await navigator.clipboard.writeText(text); } catch { ok = false; } setCopied(ok ? "ok" : "fail"); setTimeout(() => setCopied(""), 2000); if (ok && !lead.phone) setStep("sent"); }} style={soft}>
              {copied === "ok" ? "✓ Tersalin" : copied === "fail" ? "Gagal copy" : "Copy"}
            </button>
            {lead.phone ? (
              ready
                ? <a href={waLink(lead.phone, text)} target="_blank" rel="noreferrer" onClick={() => setStep("sent")} style={big}><Icon name="chat" size={18} stroke={1.8} />Kirim di WhatsApp</a>
                : <button type="button" disabled style={{ ...big, opacity: 0.5 }}>Kirim di WhatsApp</button>
            ) : lead.email ? (
              <a href={`mailto:${lead.email}?body=${encodeURIComponent(text)}`} onClick={() => setStep("sent")} style={big}>Kirim lewat email</a>
            ) : (
              <p style={{ flex: 1, minWidth: 160, margin: 0, fontSize: 13, color: "var(--app-muted)" }}>Belum ada nomor: copy, lalu kirim lewat DM.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// On a lead's page: the script that fits where they are, so the next message
// is one look away. Picking and sending stay in ChatPicker.
export function NextMessage({ lead, onOpen }: { lead: ChatLead; onOpen: () => void }) {
  const stage = leadStage(lead);
  const label = STAGES.find(s => s.id === stage)?.label || "";
  const { ranked, fill } = useScripts(lead, stage, savedBrand());
  const best = ranked[0]?.t;
  return (
    <section aria-labelledby="next-h" style={{ marginTop: 20, padding: 16, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20 }}>
      <h2 id="next-h" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--app-muted)" }}>Pesan berikutnya: {label}</h2>
      {best ? (
        <>
          <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 600 }}>{best.title}</p>
          <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--app-ink-2)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fill(best)}</p>
        </>
      ) : <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--app-muted)" }}>Belum ada script {label} buat Leads. Tulis langsung, atau bikin di Kelola.</p>}
      <button type="button" onClick={onOpen} style={{ marginTop: 12, width: "100%", minHeight: 48, border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Tulis pesan</button>
    </section>
  );
}
