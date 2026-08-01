# PRD-001 — Brand Unification (Logo Blue) & PWA Auth Persistence

- **Status:** Draft → menunggu approval buat eksekusi
- **Tanggal:** 2026-08-01
- **Sumber:** `docs/qa-reviews/2026-08-01-brand-and-auth.md` (QA-1, QA-2, QA-3), `docs/brand-identity.md`
- **Owner:** —
- **Target build:** `salespal-alpha.vercel.app`

> **Koreksi:** draft awal PRD ini salah — mengira mau rebrand jadi macan oranye. Identitas sebenarnya = **logo cakar biru yang sudah ada**. Birunya bener; masalahnya app pakai shade biru yang salah (`#1b6cf2`) bukan biru logo (`#005eb0`). Scope brand di bawah sudah dikoreksi.

---

## 1. Latar Belakang

Dua masalah menghambat produk: (a) PWA minta login ulang tiap dibuka — blocker adoption; (b) warna app ga match logo — logo = cakar biru `#005eb0`, tapi seluruh UI diseragamin ke `#1b6cf2` (periwinkle) yang beda. PRD ini nyatuin perbaikan keduanya: bikin sesi persist + seragamin warna app ke biru logo.

---

## 2. Tujuan & Non-Tujuan

**Tujuan**
- G1: Sesi login persist di PWA (iOS/Android) — user ga login ulang tiap buka.
- G2: Seragamin semua warna brand app ke biru logo `#005eb0`.
- G3: Pakai mark cakar (logo) konsisten di header/footer; buang ikon off-brand (⚡, 🐺).

**Non-Tujuan**
- Ganti provider auth (tetap Firebase).
- Rombak fitur CRM/Simulator/Script Library — cuma layer brand + auth.
- Redesign logo (logo cakar biru dipertahankan apa adanya).
- Ganti warna fungsional/status lead (di luar scope, lihat §4).

---

## 3. Requirements

### 3.1 Auth Persistence (QA-1) 🔴

- **R1.1** Set persistence eksplisit ke `indexedDBLocalPersistence` dengan fallback `browserLocalPersistence` (lalu `inMemory`) saat inisialisasi auth.
- **R1.2** Dashboard/AuthGuard nampilin loading state selama sesi lagi di-restore — JANGAN redirect ke `/login` sampai status auth benar-benar resolved (bedain "lagi loading" vs "beneran logout").
- **R1.3** Pertimbangkan `manifest.start_url` → `/` (atau route netral yang nge-route berdasar status auth), biar cold-start PWA ga langsung nabrak halaman auth-guarded sebelum sesi ke-restore.
- **R1.4** Verifikasi di iOS standalone PWA: login sekali, tutup, buka lagi ≥3x, dan setelah idle >1 hari — tetap login.

**Acceptance:**
- Login sekali → tutup/buka PWA berkali-kali → tetap di dashboard, ga ada layar login.
- Cold-start ga pernah nampilin `/login` flash buat user yang udah login.

### 3.2 Brand Unification ke Biru Logo (QA-2) 🟠

Semua aksen brand app di-swap dari `#1b6cf2` (periwinkle salah) → `#005eb0` (biru logo, di-sample dari `public/logo.png`). Detail palet di `docs/brand-identity.md`.

**Token target:**

| Token | Hex | Pakai buat |
|-------|-----|-----------|
| `--brand-blue` | `#005eb0` | aksen utama, CTA, tab aktif, link, `PAL` accent |
| `--brand-blue-600` | `#004a8c` | hover / pressed |
| `--brand-blue-700` | `#003c72` | active / deep |
| `--brand-ink` | `#141414` | wordmark `SALESPAL` |

- **R2.1** Ganti semua `#1b6cf2` (dan turunan glow `rgba(27,108,242,x)`) di `app/globals.css`, `app/page.tsx`, `app/login/page.tsx`, `components/SalesTracker.tsx` → `#005eb0` + `rgba(0,94,176,x)`.
- **R2.2** Header app: ganti ikon ⚡ jadi mark cakar (pakai `logo.png` / versi mark). Aksen `SALESPAL` = `#005eb0`.
- **R2.3** Landing: headline gradient biru, badge, tombol, glow, hero line-2 → `#005eb0`. `background: #0c1a3a` di wrapper logo diselaraskan.
- **R2.4** Login page: logo, heading accent, tombol submit → `#005eb0`.
- **R2.5** `theme_color` / `background_color` manifest + `<meta name="theme-color">` diselaraskan (light bg + aksen biru logo).
- **R2.6** (Opsional, lihat §6-D2) tipografi wordmark: samain display font ke logo atau biarin Bebas Neue.

**Acceptance:**
- Warna biru di app = biru logo `#005eb0` di semua permukaan brand.
- Ga ada `#1b6cf2` nyisa (kecuali status functional, §4).
- Header/footer pakai mark cakar, bukan ⚡ / 🐺.

### 3.3 Ikon Brand Konsisten (QA-3) 🟡

- **R3.1** Brand mark = cakar (dari logo). Header & footer pakai mark ini, bukan ⚡ / 🐺.
- **R3.2** Archetype (owl/lion/dolphin/rabbit) = sistem **fungsional** terpisah dari brand — dibedain jelas. Beresin emoji "Singa" yang saat ini 🐯 (rename jadi konsisten atau ganti 🦁).
- **R3.3** Footer 🐺 wolf → ganti mark cakar atau dibuang.

**Acceptance:** Header/footer konsisten pakai mark cakar; brand vs archetype kebedain jelas.

---

## 4. Warna Status (dikecualikan dari rebrand)

Warna functional lead tetap: Hot `#ff4444`, Warm `#ff9900`, Cold (saat ini biru `#1b6cf2`), Closed `#00cc66`. Saat eksekusi, tentuin apakah "Cold" tetap biru (kontras enak) atau diganti biar ga bentrok sama keputusan buang-biru. **Decision di execution.**

---

## 5. Rencana Eksekusi (fase)

1. **Fase A — Auth (R1.x):** paling blocker, ship duluan & standalone.
2. **Fase B — Brand tokens:** definisiin CSS vars tiger di `globals.css`.
3. **Fase C — Apply brand:** header, landing, login, manifest, icon.
4. **Fase D — Maskot cleanup:** archetype + footer.
5. **QA pass:** ulang walkthrough `docs/qa-reviews/`, konfirmasi acceptance.

---

## 6. Risiko & Keputusan Terbuka

- **D1:** Nilai kanonik biru — pakai hasil sample `#005eb0`, atau lo mau angka biru spesifik lain?
- **D2:** Tipografi wordmark — biarin Bebas Neue sebagai display font, atau samain ke heavy-wide sans kayak wordmark logo? (lihat `docs/brand-identity.md` §3)
- **D3:** "Cold" lead saat ini biru — biarin, atau ganti biar ga rancu sama brand blue? (lihat §4)
- **R-risk:** Ganti `start_url` bisa ngefek deep-link/bookmark lama — tes.

---

## 7. Referensi

- QA source: `docs/qa-reviews/2026-08-01-brand-and-auth.md`
- File kena dampak: `lib/firebase.ts`, `components/AuthGuard.tsx`, `app/dashboard/page.tsx`, `app/globals.css`, `app/page.tsx`, `app/login/page.tsx`, `components/SalesTracker.tsx`, `public/manifest.json`, `app/layout.tsx`, `lib/salespal-data.ts`
