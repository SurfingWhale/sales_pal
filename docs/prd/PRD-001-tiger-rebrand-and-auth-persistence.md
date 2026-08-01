# PRD-001 — Tiger Rebrand & PWA Auth Persistence

- **Status:** Draft → menunggu approval buat eksekusi
- **Tanggal:** 2026-08-01
- **Sumber:** `docs/qa-reviews/2026-08-01-brand-and-auth.md` (QA-1, QA-2, QA-3)
- **Owner:** —
- **Target build:** `salespal-alpha.vercel.app`

---

## 1. Latar Belakang

Dua masalah menghambat produk: (a) PWA minta login ulang tiap dibuka — blocker adoption; (b) identitas brand ga sesuai visi — user membayangkan maskot **macan** dan nuansa warnanya jadi tema utama, tapi produk keluar biru + ⚡ tanpa elemen macan. PRD ini nyatuin perbaikan keduanya.

---

## 2. Tujuan & Non-Tujuan

**Tujuan**
- G1: Sesi login persist di PWA (iOS/Android) — user ga login ulang tiap buka.
- G2: Identitas macan jadi nuansa utama (ikon, palet, app icon, landing/header/login).
- G3: Sistem maskot konsisten satu arah.

**Non-Tujuan**
- Ganti provider auth (tetap Firebase).
- Rombak fitur CRM/Simulator/Script Library — cuma layer brand + auth.
- Bikin ilustrasi macan custom dari nol (fase awal boleh pakai mark/emoji sederhana; ilustrasi detail = follow-up).

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

### 3.2 Tiger Rebrand (QA-2) 🟠

Macan = nuansa utama. Biru `#1b6cf2` diturunin jadi aksen sekunder (atau dibuang) — **keputusan ini nge-override sebagian "blue unification" sebelumnya**; dicatat di bagian 6.

**Palet usulan (tinggal di-tweak):**

| Token | Hex | Pakai buat |
|-------|-----|-----------|
| `--tiger-500` (primary) | `#f97316` | CTA, aksen utama, logo accent |
| `--tiger-600` | `#ea580c` | hover/pressed |
| `--tiger-amber` | `#fbbf24` | highlight, garis, badge |
| `--stripe-900` (ink) | `#1a1206` | teks gelap / "garis macan" |
| `--cream-50` | `#fff7ed` | background hangat (light mode) |

- **R2.1** App icon (`logo.png` / PWA icon) diganti jadi mark bernuansa macan (oranye + garis). Ganti juga `background: #0c1a3a` biru tua di wrapper logo.
- **R2.2** Header app: ganti ⚡ jadi mark macan; aksen `SALESPAL` pakai tiger-orange, bukan biru.
- **R2.3** Landing (`app/globals.css`, `app/page.tsx`): headline gradient, badge, tombol, glow → basis tiger. Line-color hero diselaraskan.
- **R2.4** Login page: logo, heading, tombol submit → tiger.
- **R2.5** `theme_color` / `background_color` manifest + `<meta name="theme-color">` diselaraskan ke nuansa macan.

**Acceptance:**
- User yang lihat app langsung nangkep "ini brand macan" (ikon + warna).
- Ga ada biru `#1b6cf2` yang nyisa sebagai warna brand utama (kecuali status functional kayak Cold lead, lihat 3.3).

### 3.3 Sistem Maskot (QA-3) 🟡

- **R3.1** Macan = maskot brand (identitas perusahaan). Hewan archetype (owl/lion/dolphin/rabbit) = sistem **fungsional** yang terpisah — dijelasin jelas bedanya.
- **R3.2** Beresin inkonsistensi: emoji archetype "Singa" saat ini pakai 🐯 — pilih satu (rename jadi "Macan" ATAU ganti emoji ke 🦁). Rekomendasi: karena macan dipakai buat brand, archetype 🐯 di-rename/re-emoji biar ga bentrok.
- **R3.3** Footer 🐺 wolf → selaraskan ke macan atau dibuang.

**Acceptance:** Ga ada maskot nyasar; brand (macan) vs archetype (fungsional) kebedain jelas.

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

- **D1:** Tiger nge-override blue unification — konfirmasi biru dibuang total atau disisain sebagai aksen sekunder.
- **D2:** App icon macan — pakai emoji/mark sederhana dulu, atau tunggu ilustrasi custom? (Nyaranin: mark sederhana dulu biar ga ngeblok.)
- **D3:** "Cold" lead tetap biru atau ganti? (lihat §4)
- **R-risk:** Ganti `start_url` bisa ngefek deep-link/bookmark lama — tes.

---

## 7. Referensi

- QA source: `docs/qa-reviews/2026-08-01-brand-and-auth.md`
- File kena dampak: `lib/firebase.ts`, `components/AuthGuard.tsx`, `app/dashboard/page.tsx`, `app/globals.css`, `app/page.tsx`, `app/login/page.tsx`, `components/SalesTracker.tsx`, `public/manifest.json`, `app/layout.tsx`, `lib/salespal-data.ts`
