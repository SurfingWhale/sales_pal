"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Icon from "@/components/Icon";
import { animalSrc } from "@/components/AnimalArt";
import { HOME, LeadGeo, routeUrl } from "@/lib/geo";
import { waLink } from "@/lib/billing";
import { archetypes } from "@/lib/salespal-data";

// The street map of leads (PRD-013): a tilted 3D city, one pin per lead that
// has a location, and a card when a pin is tapped. A lead whose customer type
// is known (from its WhatsApp chat or its profile) wears that type's character;
// the rest show their initials. MapLibre with OpenFreeMap's open tiles, so
// there is no key and no bill. The same map, without pins, is the picker that
// sets a lead's point.

export interface GeoLead {
  id: string; name: string; score: number; value: number; phone?: string;
  category?: string; address?: string; status?: string; archetype?: string; hot: boolean; geo: LeadGeo;
}

const typeOf = (id?: string) => (id ? archetypes.find(a => a.id === id) : undefined);

export const MAP_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE || "https://tiles.openfreemap.org/styles/liberty";

const initials = (n: string) => n.replace(/[^A-Za-z0-9À-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const jt = (n: number) => `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;

const css = `
.sp-geo { position: absolute; inset: 0; }
.sp-geo .maplibregl-canvas { outline: none; }
/* Dark theme: the light tiles turned to night, like the reference. */
[data-theme="dark"] .sp-geo .maplibregl-canvas { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92); }
/* A pin: a round face on a short tail whose tip is the lead's point. A typed
   lead's character stands in the face with its head above the rim. */
.sp-pin { width: 44px; height: 50px; padding: 0; border: 0; background: none; cursor: pointer; display: block; font-family: inherit; }
.sp-pin-tail { position: absolute; left: 16px; top: 33px; width: 12px; height: 12px; border-radius: 2px; background: #fff; transform: rotate(45deg); box-shadow: 2px 2px 4px rgba(0,0,0,0.22); }
.sp-pin-face { position: absolute; left: 2px; top: 2px; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; background: #5b636c; box-shadow: 0 0 0 2.5px #fff, 0 6px 14px rgba(0,0,0,0.3); transform-origin: 50% 120%; transition: transform .18s cubic-bezier(.2,0,0,1), box-shadow .18s ease; }
.sp-pin.hot .sp-pin-face { background: linear-gradient(145deg, #2f86d6, #004a8c); }
.sp-pin.typed .sp-pin-face { background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--pin) 18%, #fff), color-mix(in srgb, var(--pin) 60%, #fff)); }
.sp-pin.hot .sp-pin-face, .sp-pin.hot.typed .sp-pin-face { box-shadow: 0 0 0 2.5px #fff, 0 0 0 5px #005eb0, 0 6px 14px rgba(0,0,0,0.3); }
.sp-pin-face img { position: absolute; left: -5px; bottom: 0; width: 50px; height: 50px; object-fit: contain; object-position: bottom; clip-path: inset(0 5px 0 5px round 0 0 20px 20px); pointer-events: none; }
.sp-pin-score { position: absolute; right: -8px; top: -5px; min-width: 22px; height: 18px; padding: 0 5px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font: 700 10px/1 'Plus Jakarta Sans', sans-serif; font-variant-numeric: tabular-nums; color: #14181d; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.25); }
.sp-pin.hot .sp-pin-score { color: #fff; background: #005eb0; }
.sp-pin-tag { position: absolute; left: 46px; top: 6px; display: grid; width: max-content; max-width: 132px; padding: 3px 9px 4px; border-radius: 10px; text-align: left; color: #14181d; background: rgba(255,255,255,0.94); box-shadow: 0 2px 8px rgba(0,0,0,0.18); pointer-events: none; }
.sp-pin-tag b, .sp-pin-tag small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-pin-tag b { font-size: 11px; font-weight: 700; }
.sp-pin-tag small { font-size: 10px; font-weight: 500; color: #4a525b; }
/* Zoomed out, names would cover each other: only the chosen pin keeps its. */
.sp-far .sp-pin-tag { display: none; }
.sp-far .sp-pin[aria-pressed="true"] .sp-pin-tag { display: grid; }
.sp-pin[aria-pressed="true"] { z-index: 3; }
.sp-pin[aria-pressed="true"] .sp-pin-face { transform: scale(1.15); box-shadow: 0 0 0 3px #005eb0, 0 8px 18px rgba(0,0,0,0.35); }
.sp-geo-card { position: absolute; z-index: 4; left: 12px; right: 12px; bottom: 12px; max-width: 360px; border-radius: 20px; padding: 14px 14px 12px; background: var(--glass-strong); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); box-shadow: inset 0 0 0 0.5px var(--app-line-strong), 0 12px 32px rgba(0,0,0,0.22); animation: sp-geo-in .22s cubic-bezier(.2,0,0,1) both; }
@keyframes sp-geo-in { from { opacity: 0; transform: translateY(12px) scale(.98); } }
@media (prefers-reduced-motion: reduce) { .sp-geo-card { animation: none; } .sp-pin-face { transition: none; } }
.sp-geo-face { position: relative; flex-shrink: 0; width: 56px; height: 56px; border-radius: 16px; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #fff; background: #5b636c; }
.sp-geo-face.hot { background: linear-gradient(145deg, #2f86d6, #004a8c); }
.sp-geo-face.typed { background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--pin) 18%, #fff), color-mix(in srgb, var(--pin) 60%, #fff)); }
.sp-geo-face img { position: absolute; left: 0; bottom: 0; width: 56px; height: 56px; object-fit: contain; object-position: bottom; }
.sp-geo-type { display: flex; align-items: flex-start; gap: 8px; margin: 12px 0 0; padding: 8px 10px; border-radius: 12px; font-size: 13px; line-height: 1.4; background: color-mix(in srgb, var(--pin, #7d93ad) 14%, transparent); }
.sp-geo-type::before { content: ""; flex-shrink: 0; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: var(--pin, #7d93ad); }
.sp-geo-score { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 13px; color: var(--app-muted); }
.sp-geo-score b { color: var(--app-text); }
.sp-geo-bar { flex: 1; height: 6px; border-radius: 3px; overflow: hidden; background: var(--app-inner); }
.sp-geo-bar > span { display: block; height: 100%; border-radius: 3px; background: #7d93ad; }
.sp-geo-bar.hot > span { background: #005eb0; }
.sp-geo-acts { display: flex; gap: 8px; margin-top: 12px; }
.sp-geo-acts > * { flex: 1; height: 40px; min-height: 44px; border: 0; border-block: 2px solid transparent; background-clip: padding-box; border-radius: 14px; font: 600 13px 'Plus Jakarta Sans', sans-serif; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; cursor: pointer; }
.sp-geo-credit { position: absolute; z-index: 2; right: 8px; bottom: 4px; margin: 0; font-size: 10px; color: #3d444c; background: rgba(255,255,255,0.75); padding: 1px 6px; border-radius: 6px; }
.sp-geo-credit a { color: inherit; }
.sp-geo-cross { position: absolute; z-index: 3; left: 50%; top: 50%; transform: translate(-50%, -100%); pointer-events: none; color: #c62828; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35)); }
`;

// Load the library only when a map is on screen: it is big and needs WebGL.
async function makeMap(el: HTMLElement, center: [number, number], zoom: number, tilt: boolean) {
  const ml = await import("maplibre-gl");
  const map = new ml.Map({
    container: el, style: MAP_STYLE, center, zoom,
    pitch: tilt ? 55 : 0, bearing: tilt ? -17 : 0, maxPitch: 70,
    attributionControl: false, dragRotate: tilt, cooperativeGestures: false,
  });
  return { ml, map };
}

export default function GeoMap({ leads, onOpen, tilt = true }: { leads: GeoLead[]; onOpen: (id: string) => void; tilt?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef<MlMarker[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const selRef = useRef(setSel);

  // One map for the component's life.
  useEffect(() => {
    let gone = false;
    (async () => {
      if (!box.current) return;
      try {
        const first = leads[0]?.geo;
        const { map } = await makeMap(box.current, first ? [first.lng, first.lat] : HOME, first ? 13 : 11, tilt);
        if (gone) { map.remove(); return; }
        mapRef.current = map;
        map.on("click", () => selRef.current(null));
        const far = () => box.current?.classList.toggle("sp-far", map.getZoom() < 14.5);
        map.on("zoomend", far);
        far();
      } catch { if (!gone) setFailed(true); }
    })();
    return () => { gone = true; markers.current.forEach(m => m.remove()); mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins follow the data; the view fits them once they arrive.
  useEffect(() => {
    let live = true;
    const wait = setInterval(async () => {
      const map = mapRef.current;
      if (!map || !live) return;
      clearInterval(wait);
      const ml = await import("maplibre-gl");
      markers.current.forEach(m => m.remove());
      markers.current = leads.map(l => {
        const type = typeOf(l.archetype);
        const el = document.createElement("button");
        el.type = "button";
        el.className = `sp-pin${l.hot ? " hot" : ""}${type ? " typed" : ""}`;
        if (type) el.style.setProperty("--pin", type.color);
        el.dataset.id = l.id;
        el.setAttribute("aria-label", `${l.name}${l.category ? `, ${l.category}` : ""}${type ? `, tipe ${type.name}` : ""}, skor ${l.score}. Lihat di peta`);
        el.setAttribute("aria-pressed", "false");
        const part = (tag: string, cls: string, parent: HTMLElement = el) => {
          const n = document.createElement(tag);
          if (cls) n.className = cls;
          if (parent === el) n.setAttribute("aria-hidden", "true");
          return parent.appendChild(n);
        };
        part("span", "sp-pin-tail");
        const face = part("span", "sp-pin-face");
        if (type) { const img = part("img", "", face) as HTMLImageElement; img.src = animalSrc(type.id); img.alt = ""; img.draggable = false; }
        else face.textContent = initials(l.name);
        part("span", "sp-pin-score").textContent = String(l.score);
        const tag = part("span", "sp-pin-tag");
        part("b", "", tag).textContent = l.name;
        if (l.category) part("small", "", tag).textContent = l.category;
        el.addEventListener("click", e => { e.stopPropagation(); selRef.current(l.id); });
        return new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([l.geo.lng, l.geo.lat]).addTo(map);
      });
      if (leads.length > 1) {
        const b = new ml.LngLatBounds();
        leads.forEach(l => b.extend([l.geo.lng, l.geo.lat]));
        map.fitBounds(b, { padding: 64, maxZoom: 15, duration: 0, pitch: tilt ? 55 : 0, bearing: tilt ? -17 : 0 });
      } else if (leads.length === 1) {
        map.jumpTo({ center: [leads[0].geo.lng, leads[0].geo.lat], zoom: 15 });
      }
    }, 60);
    return () => { live = false; clearInterval(wait); };
  }, [leads, tilt]);

  // The tapped pin stands out and the map eases to it.
  useEffect(() => {
    markers.current.forEach(m => { const el = m.getElement(); el.setAttribute("aria-pressed", String(el.dataset.id === sel)); });
    const l = leads.find(x => x.id === sel);
    if (l && mapRef.current) mapRef.current.easeTo({ center: [l.geo.lng, l.geo.lat], offset: [0, -60], duration: 450 });
  }, [sel, leads]);

  const s = leads.find(l => l.id === sel);
  const sType = typeOf(s?.archetype);
  const pin = (sType ? { "--pin": sType.color } : {}) as React.CSSProperties;

  return (
    <div className="sp-geo" role="group" aria-label="Peta lokasi lead">
      <style>{css}</style>
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      {failed && (
        <p role="status" style={{ position: "absolute", inset: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontSize: 14, color: "var(--app-muted)" }}>
          Peta 3D butuh WebGL, dan browser ini belum bisa. Pakai mode Potensi dulu.
        </p>
      )}
      <p className="sp-geo-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a></p>
      {s && (
        <div className="sp-geo-card" role="region" aria-label={`Lead ${s.name}`} style={pin}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span aria-hidden="true" className={`sp-geo-face${s.hot ? " hot" : ""}${sType ? " typed" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {sType ? <img src={animalSrc(sType.id)} alt="" /> : initials(s.name)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: s.hot ? "var(--brand-text)" : "var(--app-muted)" }}>{[s.category, s.status].filter(Boolean).join(" · ") || "Lead"}</p>
              <h3 style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</h3>
              {s.address && <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--app-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.address}</p>}
            </div>
            <button onClick={() => setSel(null)} aria-label="Tutup kartu lead" style={{ flexShrink: 0, width: 44, height: 44, margin: "-10px -8px 0 0", border: 0, padding: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--app-ink-2)" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--glass-btn)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={12} stroke={2.4} /></span>
            </button>
          </div>
          <p className="sp-geo-type">
            {sType
              ? <span><b>{sType.name}</b> · {sType.comStyle}</span>
              : <span style={{ color: "var(--app-muted)" }}>Tipe customer belum ketahuan. Impor chat WA-nya di lead biar tahu cara ngobrolnya.</span>}
          </p>
          <div className="sp-geo-score tabnum">
            <span>Skor <b>{s.score}</b></span>
            <span className={`sp-geo-bar${s.hot ? " hot" : ""}`} aria-hidden="true"><span style={{ width: `${Math.max(4, Math.min(100, s.score))}%` }} /></span>
            <b>{jt(s.value || 0)}</b>
          </div>
          <div className="sp-geo-acts">
            <button onClick={() => onOpen(s.id)} style={{ background: "#005eb0", color: "#fff" }}>Buka lead</button>
            <a href={routeUrl(s.geo)} target="_blank" rel="noreferrer" style={{ background: "var(--glass-btn)", color: "var(--app-text)" }}><Icon name="map" size={15} />Rute</a>
            {s.phone && <a href={waLink(s.phone, "")} target="_blank" rel="noreferrer" style={{ background: "var(--glass-btn)", color: "var(--app-text)" }}><Icon name="chat" size={15} />Chat</a>}
          </div>
        </div>
      )}
    </div>
  );
}

// Setting a lead's point: the map moves under a fixed pin, like the Maps apps.
export function GeoPicker({ start, onPick }: { start?: { lat: number; lng: number }; onPick: (lat: number, lng: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    (async () => {
      if (!box.current) return;
      try {
        const { map } = await makeMap(box.current, start ? [start.lng, start.lat] : HOME, start ? 16 : 11, false);
        if (gone) { map.remove(); return; }
        mapRef.current = map;
      } catch { if (!gone) setFailed(true); }
    })();
    return () => { gone = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: "relative", height: 300, borderRadius: 16, overflow: "hidden", background: "var(--map-bg)", border: "1px solid var(--app-border)" }}>
      <style>{css}</style>
      <div className="sp-geo"><div ref={box} style={{ position: "absolute", inset: 0 }} /></div>
      <span className="sp-geo-cross" aria-hidden="true">
        <svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43c-1.5-6-15-16-15-26a15 15 0 0 1 30 0c0 10-13.5 20-15 26z" fill="currentColor" stroke="#fff" strokeWidth="2.5" /><circle cx="17" cy="17" r="5.5" fill="#fff" /></svg>
      </span>
      {failed && <p role="status" style={{ position: "absolute", inset: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontSize: 14, color: "var(--app-muted)" }}>Peta butuh WebGL. Pakai cari alamat atau lokasi kamu sekarang.</p>}
      <p className="sp-geo-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a></p>
      <button onClick={() => { const c = mapRef.current?.getCenter(); if (c) onPick(c.lat, c.lng); }} disabled={failed}
        style={{ position: "absolute", zIndex: 4, left: "50%", bottom: 12, transform: "translateX(-50%)", height: 44, padding: "0 18px", border: 0, borderRadius: 14, background: "#005eb0", color: "#fff", font: "600 14px 'Plus Jakarta Sans', sans-serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(0,0,0,0.25)" }}>
        Pakai titik ini
      </button>
    </div>
  );
}
