"use client";

import { type ReactNode, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AVATARS } from "@/lib/guild";
import { PushState, disablePush, enablePush, pushState, testPush } from "@/lib/push";
import Icon from "@/components/Icon";
import { btnMuted, btnPrimary, font } from "@/components/ui";
import { authFetch } from "@/lib/authFetch";
import AccessAdmin from "@/components/AccessAdmin";

// Profil & Pengaturan as a settings list (QA 16 Okt: "belum halus"): one
// avatar you can change, then grouped rows of one height — an icon tile, a
// label, a value or switch at the trailing edge — like the phone's own
// Settings. Logout sits alone at the bottom.

const ANIMALS = ["owl", "lion", "dolphin", "rabbit"];
const LABEL: Record<string, string> = { leader: "Bos bermahkota", officer: "Supervisor", member: "Sales", viewer: "Pengamat", owl: "Burung Hantu", lion: "Singa", dolphin: "Lumba-lumba", rabbit: "Kelinci" };
export const avatarUrl = (a?: string) => !a || !(AVATARS as readonly string[]).includes(a) ? "" : ANIMALS.includes(a) ? `/archetypes/animal-${a}.png` : `/guild/char-${a}.png`;

// users/{uid}/settings/profile.avatar: the character on your header button and here.
export function useMyAvatar(uid: string): string {
  const [a, setA] = useState("");
  useEffect(() => onSnapshot(doc(db, "users", uid, "settings", "profile"), s => setA((s.data()?.avatar as string) || ""), () => setA("")), [uid]);
  return a;
}

export function MeAvatar({ avatar, name, size }: { avatar: string; name: string; size: number }) {
  const src = avatarUrl(avatar);
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", display: "inline-flex", alignItems: src ? "flex-end" : "center", justifyContent: "center",
      background: src ? "color-mix(in srgb, #005eb0 14%, var(--app-card))" : "#005eb0", color: "#fff", fontSize: size * 0.4, fontWeight: 700 }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.12) translateY(6%)" }} />
        : (name || "U").charAt(0).toUpperCase()}
    </span>
  );
}

const group: React.CSSProperties = { background: "var(--app-inner)", borderRadius: 14, overflow: "hidden", marginBottom: 20 };
const caption: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--app-muted)", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 4px 8px" };

function Row({ icon, tint, label, hint, trailing, onClick, pressed, danger, last, busy }: {
  icon?: Parameters<typeof Icon>[0]["name"]; tint?: string; label: string; hint?: ReactNode; trailing?: ReactNode;
  onClick?: () => void; pressed?: boolean; danger?: boolean; last?: boolean; busy?: boolean;
}) {
  const body = (
    <>
      {icon && (
        <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: tint || "#005eb0", color: "#fff" }}>
          <Icon name={icon} size={17} stroke={1.8} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, textAlign: danger ? "center" : "start" }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 500, color: danger ? "var(--hot)" : "var(--app-text)" }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 13, color: "var(--app-muted)", marginTop: 2, lineHeight: 1.4 }}>{hint}</span>}
      </span>
      {trailing}
    </>
  );
  const style: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "10px 14px", border: 0, background: "transparent",
    fontFamily: "inherit", color: "inherit", cursor: onClick ? "pointer" : "default", opacity: busy ? 0.6 : 1,
    boxShadow: last ? "none" : "inset 0 -1px 0 var(--app-border)", justifyContent: danger ? "center" : undefined,
  };
  return onClick
    ? <button type="button" onClick={onClick} disabled={busy} aria-pressed={pressed} style={style}>{body}</button>
    : <div style={style}>{body}</div>;
}

// A real switch: the track says on/off without reading the label.
const Switch = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" style={{ width: 46, height: 28, borderRadius: 14, flexShrink: 0, position: "relative", background: on ? "#087347" : "var(--app-line-strong, #c7cbd1)", transition: "background-color .15s ease-out" }}>
    <span style={{ position: "absolute", top: 3, insetInlineStart: on ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "inset-inline-start .15s ease-out" }} />
  </span>
);

const Chevron = () => <span aria-hidden="true" style={{ color: "var(--app-muted)", fontSize: 18, lineHeight: 1 }}>›</span>;

export default function ProfileSheet({ uid, name, email, version, isDark, onTheme, onCheckUpdate, checking, update, onRefresh, refreshing, onLogout, onClose }: {
  uid: string; name: string; email: string; version: string; isDark: boolean; onTheme: () => void;
  onCheckUpdate: () => void; checking: boolean; update: { latest?: string; hasUpdate?: boolean; error?: boolean } | null;
  onRefresh: () => void; refreshing: boolean; onLogout: () => void; onClose: () => void;
}) {
  const avatar = useMyAvatar(uid);
  const [picking, setPicking] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { pushState().then(setPush).catch(() => setPush("unsupported")); }, []);
  // Admins and the owner decide who may come in (PRD-015 §2b).
  const [admin, setAdmin] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [admining, setAdmining] = useState(false);
  useEffect(() => {
    let live = true;
    authFetch("/api/access").then(r => (r.ok ? r.json() : null)).then(async j => {
      if (!live || !j?.admin) return;
      setAdmin(true);
      const a = await authFetch("/api/access/admin").then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (live && a?.requests) setWaiting(a.requests.filter((r: { status: string }) => r.status === "pending").length);
    }, () => undefined);
    return () => { live = false; };
  }, [admining]);

  async function runPush(f: () => Promise<string | void>) {
    setPushBusy(true); setMsg("");
    try { const m = await f(); if (m) setMsg(m); } catch (e) { setMsg((e as Error).message); }
    setPush(await pushState().catch(() => "unsupported" as PushState));
    setPushBusy(false);
  }
  const pushHint: Record<PushState, string> = {
    on: "Tiap 08.00 WIB, kalau ada yang perlu ditindak.",
    off: "Ringkasan pagi: follow-up, penawaran, invoice telat.",
    blocked: "Diblokir. Izinin notifikasi SalesPal di pengaturan HP/browser.",
    "needs-install": "Di iPhone: Share → Add to Home Screen, buka dari ikon itu.",
    unsupported: "Browser ini belum dukung notifikasi.",
    "not-configured": "Belum disetel di server.",
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="prof-h" onClick={e => e.stopPropagation()}
        style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div id="prof-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>Profil & Pengaturan</div>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, margin: "-10px -10px -10px 0", borderRadius: "50%", background: "transparent", border: "none", color: "var(--app-ink-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} stroke={2} /></button>
        </div>

        {/* You: the avatar is the button that changes it. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
          <button type="button" onClick={() => setPicking(true)} aria-label="Ganti foto profil" style={{ position: "relative", padding: 0, border: 0, background: "none", borderRadius: "50%", cursor: "pointer" }}>
            <MeAvatar avatar={avatar} name={name || email} size={88} />
            <span aria-hidden="true" style={{ position: "absolute", insetInlineEnd: 0, bottom: 0, width: 28, height: 28, borderRadius: "50%", background: "var(--app-card)", border: "1px solid var(--app-border)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✎</span>
          </button>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || email.split("@")[0]}</div>
          <div style={{ fontSize: 13, color: "var(--app-muted)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
        </div>

        <div style={caption}>Akun</div>
        <div style={group}>
          <Row icon="person" label="Foto profil" trailing={<><span style={{ fontSize: 14, color: "var(--app-muted)" }}>{avatar ? LABEL[avatar] : "Inisial"}</span><Chevron /></>} onClick={() => setPicking(true)} last={!admin} />
          {admin && <Row icon="shield" tint="#7c3aed" label="Akses & admin" hint={waiting ? `${waiting} orang minta akses` : "Siapa yang boleh masuk & pakai alat berbayar"}
            trailing={<>{waiting > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{waiting}</span>}<Chevron /></>}
            onClick={() => setAdmining(true)} last />}
        </div>

        <div style={caption}>Aplikasi</div>
        <div style={group}>
          <Row icon={isDark ? "moon" : "sun"} tint="#5b5bd6" label="Tampilan" hint={isDark ? "Gelap" : "Terang"} trailing={<Switch on={isDark} />} onClick={onTheme} pressed={isDark} />
          <Row icon="bell" tint="#c2410c" label="Notifikasi pagi" hint={push ? pushHint[push] : "Cek…"}
            trailing={push === "on" || push === "off" ? <Switch on={push === "on"} /> : undefined}
            onClick={push === "on" || push === "off" ? () => runPush(push === "on" ? disablePush : enablePush) : undefined} pressed={push === "on"} busy={pushBusy} last={push !== "on"} />
          {push === "on" && <Row icon="bolt" tint="#c2410c" label="Kirim notifikasi tes" trailing={<Chevron />} onClick={() => runPush(async () => `Tes dikirim ke ${await testPush()} perangkat.`)} busy={pushBusy} last />}
        </div>
        <div role="status" style={{ fontSize: 13, color: "var(--app-muted)", margin: msg ? "-12px 4px 16px" : 0 }}>{msg}</div>

        <div style={caption}>Versi & data</div>
        <div style={group}>
          <Row icon="refresh" tint="#087347" label="Versi aplikasi"
            hint={update ? (update.error ? "Gagal cek. Coba lagi." : update.hasUpdate ? `Ada versi baru (${update.latest})` : "Udah versi terbaru") : <span style={{ fontFamily: "ui-monospace, monospace" }}>{version}</span>}
            trailing={<span style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-text)" }}>{checking ? "Mengecek…" : update?.hasUpdate ? "Update" : "Cek"}</span>}
            onClick={update?.hasUpdate ? onRefresh : onCheckUpdate} busy={checking || refreshing} />
          <Row icon="trash" tint="#64748b" label={refreshing ? "Membersihkan…" : "Bersihkan cache & muat ulang"} hint="Login kamu tetap aman." trailing={<Chevron />} onClick={onRefresh} busy={refreshing} last />
        </div>

        <div style={{ ...group, marginBottom: 0 }}>
          <Row label="Logout" danger onClick={onLogout} last />
        </div>
      </div>
      {/* Rendered inside Profil's backdrop: their own backdrop tap (and Escape, Back)
          closes only them, not Profil under them. */}
      <div style={{ display: "contents" }} onClick={e => e.stopPropagation()}>
        {picking && <AvatarPicker uid={uid} current={avatar} name={name || email} onClose={() => setPicking(false)} />}
        {admining && <AccessAdmin onClose={() => setAdmining(false)} />}
      </div>
    </div>
  );
}

function AvatarPicker({ uid, current, name, onClose }: { uid: string; current: string; name: string; onClose: () => void }) {
  const [pick, setPick] = useState(current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true); setErr("");
    try { await setDoc(doc(db, "users", uid, "settings", "profile"), { avatar: pick }, { merge: true }); onClose(); }
    catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); setBusy(false); }
  }
  const option = (id: string, l: string) => (
    <button key={id || "init"} type="button" role="radio" aria-checked={pick === id} onClick={() => setPick(id)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 10, minHeight: 44, borderRadius: 14, cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)",
        background: pick === id ? "color-mix(in srgb, #005eb0 10%, var(--app-card))" : "var(--app-card)", border: `${pick === id ? 2 : 1}px solid ${pick === id ? "#005eb0" : "var(--app-border)"}` }}>
      <MeAvatar avatar={id} name={name} size={64} />
      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, textAlign: "center" }}>{l}</span>
    </button>
  );
  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="pick-h" onClick={e => e.stopPropagation()}
        style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 480 }}>
        <div id="pick-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Foto profil</div>
        <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 16 }}>Keliatan di pojok kanan atas dan di profil kamu.</div>
        <div role="radiogroup" aria-label="Pilih foto profil" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
          {option("", "Inisial")}
          {AVATARS.map(a => option(a, LABEL[a]))}
        </div>
        {err && <div role="alert" style={{ fontSize: 13, color: "var(--hot)", marginTop: 12 }}>{err}</div>}
        <div className="sp-form-foot">
          <button type="button" onClick={onClose} disabled={busy} style={btnMuted}>Batal</button>
          <button type="button" onClick={save} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
