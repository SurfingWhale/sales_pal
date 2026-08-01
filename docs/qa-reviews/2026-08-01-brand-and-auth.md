# QA Review — Brand Identity & PWA Auth

- **Tanggal:** 2026-08-01
- **Reviewer:** QA (user-perspective walkthrough)
- **Build:** `main` @ commit terkini (light mode + blue unification + PWA)
- **Device fokus:** iOS (PWA / Add to Home Screen), mobile web
- **Status:** Findings logged → diteruskan ke PRD-001

Flow QA ini nge-walk aplikasi dari sisi user beneran (install PWA → buka → login → pakai), bukan dari sisi kode. Tiap temuan punya: repro, expected vs actual, severity.

---

## Ringkasan

| # | Area | Severity | Judul |
|---|------|----------|-------|
| QA-1 | Auth / PWA | 🔴 Blocker | Tiap buka PWA harus login ulang |
| QA-2 | Brand identity | 🟠 Major | Warna app (`#1b6cf2`) ga match warna logo (cakar biru `#005eb0`) |
| QA-3 | Brand konsistensi | 🟡 Minor | Ikon/maskot campur: ⚡ di header, 🐺 di footer — logo (cakar) ga dipakai konsisten |

> **Koreksi (2026-08-01):** revisi awal QA ini salah mengira brand mau di-rebrand jadi macan oranye. Identitas sebenarnya = **logo cakar biru** yang udah ada; birunya bener, cuma app-nya pakai shade biru yang salah. Lihat `docs/brand-identity.md`.

---

## QA-1 — Tiap buka PWA harus login ulang 🔴

**Repro:**
1. Buka `salespal-alpha.vercel.app` di Safari iOS
2. Login (Google / email) → masuk dashboard
3. Add to Home Screen
4. Tutup, buka lagi PWA dari home screen

**Expected:** Sesi masih aktif, langsung masuk dashboard.
**Actual:** Balik ke halaman `/login`, harus login dari nol tiap kali buka.

**Dugaan root cause (dari audit kode):**
- `lib/firebase.ts` ga pernah set persistence eksplisit. Default Firebase Auth = `browserLocalPersistence` (localStorage).
- Di iOS standalone PWA, localStorage context sering ke-evict / ke-isolate dari Safari, dan kena ITP 7-day eviction. IndexedDB jauh lebih awet.
- `public/manifest.json` `start_url` = `/dashboard` (auth-guarded). Pas PWA cold-start, halaman ke-render sebelum Firebase sempet rehydrate sesi → `onAuthStateChanged` muncul `null` sekejap → `router.replace("/login")` nembak duluan.

**Dampak:** Blocker adoption. Sales ga akan pakai app yang minta login tiap buka.

---

## QA-2 — Warna app ga match logo 🟠

**Identitas sebenarnya:** logo = **cakar (paw) macan biru** + wordmark `SALESPAL` hitam tebal (`public/logo.png`). Birunya, di-sample dari logo, = **`#005eb0`** (azure dalam).

**Actual saat ini:**
- Seluruh app diseragamin ke **`#1b6cf2`** (periwinkle, lebih terang & keunguan) — ini BUKAN biru logo.
- Header pakai ikon **⚡**, bukan mark cakar dari logo.

**Gap:** App dan logo keliatan beda warna biru. Yang bener: seragamin semua aksen brand ke biru logo `#005eb0`.

**Dampak:** Brand keliatan ga konsisten — logo satu biru, UI biru lain.

---

## QA-3 — Ikon brand ga konsisten 🟡

Brand mark = cakar biru (dari logo), tapi di produk muncul ikon lain:
- Header app: **⚡** (petir) — harusnya mark cakar / logo.
- Footer landing: **🐺** wolf — off-brand.
- Archetype "Singa" pakai emoji **🐯** — ini sistem fungsional terpisah (bukan brand), tapi nama vs emoji ga cocok; beresin sekalian.

**Expected:** Header & footer pakai mark cakar dari logo. Emoji archetype = sistem fungsional, dibedain jelas dari brand.

**Dampak:** Produk keliatan belum matang / ga rapi.

---

## Rekomendasi

Semua temuan diteruskan ke **PRD-001**. Prioritas eksekusi:
1. QA-1 (blocker) — auth persistence.
2. QA-2 (major) — seragamin warna app ke biru logo `#005eb0`.
3. QA-3 (minor) — pakai mark cakar konsisten, beresin ikon off-brand.
