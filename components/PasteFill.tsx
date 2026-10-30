"use client";

import { useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { authFetch } from "@/lib/authFetch";
import type { LeadGeo } from "@/lib/geo";
import { DupFields, dupIndex } from "@/lib/leadDupes";
import { LeadText, PASTE_LABEL, PASTE_SOURCE, PasteKind, localPhone, nothingIn, readPaste } from "@/lib/paste";
import { unfurl } from "@/lib/prospectStore";

const pill = (primary: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 16px", borderRadius: 999,
  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  border: primary ? 0 : "1px solid var(--app-line-strong)", background: primary ? "#005eb0" : "transparent", color: primary ? "#fff" : "var(--app-text)",
});
const field: React.CSSProperties = { width: "100%", background: "var(--app-card)", border: "1px solid var(--app-line-strong)", borderRadius: 12, color: "var(--app-text)", padding: "10px 12px", fontSize: 16, fontFamily: "inherit", resize: "vertical" };

export interface PastePlace { address?: string; geo?: LeadGeo }
type Found = Record<"name" | "contact" | "phone" | "email" | "place", boolean>;
const FOUND_WORD: [keyof Found, string][] = [["name", "Nama"], ["contact", "Kontak"], ["phone", "No HP"], ["email", "Email"], ["place", "Lokasi"]];

// Tempel apa saja → kolom terisi (PRD-018 §2). Patterns fill what they can at
// once (lib/paste.ts); a Threads post, a short Maps link or a website is then
// read on the server, free. Only empty fields are filled, so nothing typed is lost.
export default function PasteFill({ place, onFill, onPlace }: {
  place: PastePlace;
  onFill: (patch: Partial<LeadText>) => void;
  onPlace: (p: PastePlace) => void;
}) {
  const [text, setText] = useState("");
  const [read, setRead] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [found, setFound] = useState<{ kind: PasteKind; f: Found } | null>(null);
  const run = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);

  async function readText(raw: string) {
    const text = raw.trim();
    if (!text) { setErr("Tempel dulu link atau teksnya."); input.current?.focus(); return; }
    const me = ++run.current;
    const live = () => me === run.current;
    setRead(raw); setErr(""); setBusy("");
    const r = readPaste(text);
    if (nothingIn(r)) {
      setFound(null);
      setErr("Ga ada yang kebaca. Tempel link Google Maps, Threads, Instagram, website, atau teks yang ada no HP / email.");
      return;
    }
    const f: Found = { name: !!r.name, contact: !!r.handle, phone: !!r.phone, email: !!r.email, place: !!(r.place.point || r.address) };
    onFill({
      name: r.name, contact: r.handle, phone: r.phone, email: r.email, source: PASTE_SOURCE[r.kind],
      notes: r.url ? `Dari tempelan ${PASTE_LABEL[r.kind]}: ${r.url}` : undefined,
    });
    if (r.place.point) onPlace({ geo: { ...r.place.point, by: "link" }, address: r.address || place.address });
    else if (r.address) onPlace({ ...place, address: r.address });
    setFound({ kind: r.kind, f: { ...f } });

    if (r.kind === "threads") {
      setBusy("Membaca post Threads…");
      const u = await unfurl(r.url);
      if (!live()) return;
      if ("error" in u) setErr(u.error);
      else {
        onFill({ name: u.name || u.handle, contact: u.handle, notes: u.text ? `“${u.text}”` : undefined });
        f.name = true; f.contact = true;
      }
    } else if (r.kind === "maps" && r.place.short && !r.place.point) {
      setBusy("Membuka link Maps…");
      try {
        const res = await authFetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: text }) });
        const j = await res.json().catch(() => ({}));
        if (!live()) return;
        const hit = res.ok ? j.hits?.[0] : null;
        if (hit) {
          onPlace({ geo: { lat: hit.lat, lng: hit.lng, by: "link" }, address: hit.address || r.address || undefined });
          if (hit.label) onFill({ name: hit.label });
          f.place = true; f.name ||= !!hit.label;
        } else setErr(`Titik petanya belum ketemu${j.error ? `: ${j.error}` : "."} Atur lokasinya nanti dari halaman lead.`);
      } catch { if (live()) setErr("Link Maps ga kebuka. Cek koneksi, atau atur lokasinya nanti dari halaman lead."); }
    } else if (r.kind === "site" || r.kind === "instagram") {
      setBusy(r.kind === "site" ? "Membaca website…" : "Membaca profil Instagram…");
      try {
        const res = await authFetch("/api/site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: r.url }) });
        const s = await res.json().catch(() => ({}));
        if (!live()) return;
        if (!res.ok) setErr(r.kind === "instagram" ? "Instagram minta login, jadi cuma @handle-nya yang kebaca." : s.error || "Website-nya ga kebuka. Isi manual aja.");
        else if (r.kind === "instagram") {
          // "Kopi Senja (@kopisenja) • Instagram photos and videos"; a login page says only "Instagram".
          const m = String(s.title || "").match(/^(.*?)\s*\(@([A-Za-z0-9._]+)\)/);
          if (m?.[1]) { onFill({ name: m[1].trim(), contact: `@${m[2]}` }); f.name = true; f.contact = true; }
          else setErr("Instagram minta login, jadi cuma @handle-nya yang kebaca.");
        } else {
          const phone = localPhone(String(s.phone || ""));
          onFill({ name: s.name, email: s.email, phone, contact: s.instagram, notes: s.description || undefined });
          f.name ||= !!s.name; f.email ||= !!s.email; f.phone ||= !!phone; f.contact ||= !!s.instagram;
        }
      } catch { if (live()) setErr("Website-nya ga kebuka. Cek koneksi, atau isi manual."); }
    }
    if (!live()) return;
    setBusy("");
    setFound({ kind: r.kind, f });
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const t = e.clipboardData.getData("text");
    if (!t.trim()) return;
    e.preventDefault();
    setText(t);
    readText(t);
  }
  async function pasteClipboard() {
    let t = "";
    try { t = await navigator.clipboard.readText(); } catch { /* not allowed here: the field still takes a paste */ }
    if (!t.trim()) { setErr("Clipboard ga kebaca. Tekan lama kolom di atas → Tempel."); input.current?.focus(); return; }
    setText(t);
    readText(t);
  }

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 16, padding: 12, borderRadius: 14, background: "var(--app-inner)" }}>
      <label htmlFor="nl-paste" style={{ fontSize: 13, fontWeight: 600, color: "var(--app-sub)" }}>Tempel link atau teks, kolomnya keisi sendiri</label>
      <textarea id="nl-paste" ref={input} rows={2} value={text} onChange={e => setText(e.target.value)} onPaste={onPaste}
        placeholder="Link Google Maps, Threads, Instagram, website, atau teks yang ada no HP / email" aria-describedby="nl-paste-found" style={{ ...field, minHeight: 64 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={pasteClipboard} disabled={!!busy} style={{ ...pill(false), flex: "1 1 180px" }}><Icon name="clipboard" size={16} />Tempel dari clipboard</button>
        {text.trim() && text !== read && <button type="button" onClick={() => readText(text)} disabled={!!busy} style={{ ...pill(true), flex: "1 1 120px" }}>Baca</button>}
      </div>
      <p id="nl-paste-found" role="status" style={{ margin: 0, fontSize: 13, color: "var(--app-sub)" }}>
        {busy || (found && <>
          Dari {PASTE_LABEL[found.kind]}:{" "}
          {FOUND_WORD.map(([k, w], i) => <span key={k}>{i ? " · " : ""}{w} <span style={{ color: found.f[k] ? "var(--ok)" : "var(--app-muted)", fontWeight: 700 }}>{found.f[k] ? "✓" : "—"}</span></span>)}
        </>)}
      </p>
      {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--hot)" }}>{err}</p>}
      {(place.geo || place.address) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="map" size={16} style={{ color: "var(--brand-text)", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            {place.address || "Titik dari link"}{place.geo && <span style={{ color: "var(--app-muted)" }}> · titik peta ✓</span>}
          </span>
          <button type="button" onClick={() => onPlace({})} style={{ ...pill(false), border: 0, color: "var(--hot)", padding: "0 10px" }}>Hapus lokasi</button>
        </div>
      )}
    </div>
  );
}

// Before a lead is saved: is it already here? Same WhatsApp number, email,
// @handle or name. A notice, not a block: two branches can share a name.
export function DupNotice<T extends DupFields & { id: string; name: string }>({ leads, draft, onOpen }: {
  leads: T[];
  draft: DupFields;
  onOpen: (lead: T) => void;
}) {
  const find = useMemo(() => dupIndex(leads), [leads]);
  const hit = find(draft);
  return (
    <div role="status">
      {hit && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--warm)", background: "color-mix(in srgb, var(--warm) 10%, transparent)" }}>
          <span style={{ flex: "1 1 200px", fontSize: 14 }}>Mirip lead yang udah ada: <b>{hit.lead.name}</b> ({hit.why} sama).</span>
          <button type="button" onClick={() => onOpen(hit.lead)} style={pill(false)}>Buka yang udah ada</button>
        </div>
      )}
    </div>
  );
}
