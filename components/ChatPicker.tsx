"use client";

import { useEffect, useRef, useState } from "react";
import type { PitchTemplate } from "@/lib/hunting";
import { useBusiness, useSpaceCollection, waLink } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import { STAGES, Stage, fillTemplate, stageOf } from "@/lib/templates";
import { rankScripts } from "@/lib/scriptPick";
import Icon from "@/components/Icon";

// The next message to a lead, from your own scripts (owner, 29 Okt: "masa gw
// gabisa milih intro dll"): the stage that fits where they are is picked, and
// within it the script that fits their type of business and what they need
// (lib/scriptPick), already filled in. Any other can be picked, what you send
// can still be edited, and sending opens WhatsApp and counts as today's contact.

export interface ChatLead {
  name: string; contact: string; phone: string; status: string; lastContact: string;
  category: string | null;           // their type of business, read from the lead (lib/scriptPick categoryOf)
  need?: string; pain?: string;
}

// Where a lead is, as a stage of the conversation.
export function leadStage(l: ChatLead): Stage {
  if (l.status === "Closed") return "etb";
  if (l.status === "Hot") return "offering";
  if (l.status === "Warm") return "gali";
  return l.lastContact ? "followup" : "intro";
}

export default function ChatPicker({ lead, onSend }: {
  lead: ChatLead;
  onSend: (what: string) => void;   // after WhatsApp opens: log it, close
}) {
  const space = useSpace();
  const templates = useSpaceCollection<PitchTemplate>(space, "pitchTemplates");
  const business = useBusiness(space);
  const name = lead.contact || lead.name;
  const fits = leadStage(lead);
  const [stage, setStage] = useState<Stage>(fits);
  const [tpl, setTpl] = useState<PitchTemplate | null>(null);
  const [auto, setAuto] = useState<string[] | null>(null);   // why the shown script was picked for you
  const [text, setText] = useState(`Halo ${name}, `);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const ranked = rankScripts(templates.filter(t => stageOf(t) === stage), lead);
  const forStage = ranked.filter(r => !r.out);
  const fill = (t: PitchTemplate) => fillTemplate(t.body, { nama: name, bisnis: business.name, kebutuhan: lead.need });
  const choose = (t: PitchTemplate, why: string[] | null) => { setTpl(t); setText(fill(t)); setAuto(why); };
  // The best fit is put in for you, on opening and on each stage you look at,
  // until you write or pick yourself.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) return;
    const best = forStage[0];
    if (best) choose(best.t, best.why.length ? best.why : ["satu-satunya buat tahap ini"]);
    else { setTpl(null); setAuto(null); setText(`Halo ${name}, `); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, templates.length, business.name]);
  const ready = text.trim().length > 0;

  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 44, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${on ? "#005eb0" : "var(--app-line-strong)"}`, background: on ? "#005eb0" : "transparent", color: on ? "#fff" : "var(--app-text)",
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div role="radiogroup" aria-label="Tahap" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STAGES.map(s => (
          <button key={s.id} type="button" role="radio" aria-checked={stage === s.id} onClick={() => { touched.current = false; setStage(s.id); }} style={chip(stage === s.id)}>
            {s.id === fits ? "● " : ""}{s.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Script" style={{ display: "grid", gap: 6 }}>
        {forStage.length ? forStage.map(({ t, score }, i) => (
          <button key={t.id} type="button" aria-pressed={tpl?.id === t.id} onClick={() => { touched.current = true; choose(t, null); }}
            style={{ display: "grid", gap: 2, width: "100%", minHeight: 52, padding: "8px 12px", borderRadius: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)",
              border: `1px solid ${tpl?.id === t.id ? "#005eb0" : "var(--app-border)"}`, background: tpl?.id === t.id ? "color-mix(in srgb, #005eb0 8%, var(--app-card))" : "var(--app-card)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
              <span style={{ minWidth: 0 }}>{t.title}</span>
              {i === 0 && score > 0 && <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "color-mix(in srgb, var(--ok) 16%, transparent)", color: "var(--ok)" }}>Paling cocok</span>}
            </span>
            <span style={{ fontSize: 12, color: "var(--app-muted)", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fill(t)}</span>
          </button>
        )) : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--app-muted)" }}>
            Belum ada script buat tahap {STAGES.find(s => s.id === stage)?.label}. Tulis langsung di bawah, atau bikin di Hunting → + → Kelola template.
          </p>
        )}
      </div>

      {auto && tpl && (
        <p role="status" aria-label="Dipilih otomatis" style={{ margin: 0, fontSize: 12, color: "var(--app-muted)" }}>
          Dipilih otomatis{lead.category ? ` buat ${lead.category}` : ""}: {auto.join(" · ")}.
        </p>
      )}
      <label htmlFor="cp-text" className="vh">Pesan</label>
      <textarea id="cp-text" value={text} onChange={e => { touched.current = true; setAuto(null); setText(e.target.value); }} rows={4}
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 14, border: "1px solid var(--app-line-strong)", background: "var(--app-card)", color: "var(--app-text)", fontSize: 16, lineHeight: 1.45, fontFamily: "inherit", resize: "vertical" }} />

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!ready} onClick={async () => { let ok = true; try { await navigator.clipboard.writeText(text); } catch { ok = false; } setCopied(ok ? "ok" : "fail"); setTimeout(() => setCopied(""), 2000); }}
          style={{ minHeight: 48, padding: "0 18px", borderRadius: 999, border: "1px solid var(--app-line-strong)", background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: ready ? 1 : 0.5 }}>
          {copied === "ok" ? "✓ Tersalin" : copied === "fail" ? "Gagal copy" : "Copy"}
        </button>
        {ready ? (
          <a href={waLink(lead.phone, text)} target="_blank" rel="noreferrer" onClick={() => onSend(tpl ? tpl.title : "Chat WhatsApp")}
            style={{ flex: 1, minHeight: 48, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}>
            <Icon name="chat" size={18} stroke={1.8} />Kirim di WhatsApp
          </a>
        ) : (
          <button type="button" disabled style={{ flex: 1, minHeight: 48, border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 15, fontWeight: 600, opacity: 0.5, fontFamily: "inherit" }}>Kirim di WhatsApp</button>
        )}
      </div>
    </div>
  );
}
