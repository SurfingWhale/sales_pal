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
| QA-2 | Brand identity | 🟠 Major | Identitas macan yang dibayangkan ga kepakai — nuansa utama malah biru + ⚡ |
| QA-3 | Brand konsistensi | 🟡 Minor | Maskot campur aduk: 🐯 di archetype "Singa", 🐺 wolf di footer, ⚡ di header |

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

## QA-2 — Identitas macan ga kepakai 🟠

**Ekspektasi user (brand vision):**
- Maskot / ikon = **macan (tiger)**
- Palet warna = **nuansa macan** (oranye/amber + hitam garis + krem) sebagai nuansa utama

**Actual saat ini:**
- Ikon utama = ⚡ (kotak biru), logo `logo.png` bukan macan
- Warna utama = biru `#1b6cf2` (hasil "blue unification" sebelumnya)
- Ga ada elemen macan di landing, header, login, maupun app icon

**Gap:** Arah brand yang dibayangkan (bold, garang, "macan closer") ga ke-deliver sama sekali. Warna biru berasa corporate-generic, bukan karakter macan.

**Dampak:** Brand recall lemah, ga ada diferensiasi. Ini yang bikin user ngerasa "beda banget dari yang gw bayangin".

---

## QA-3 — Maskot campur aduk 🟡

Ditemukan tiga hewan berbeda di produk yang sama tanpa sistem:
- Header app: **⚡** (petir)
- Archetype "Singa": pakai emoji **🐯 (macan)** — nama vs emoji ga cocok
- Footer landing: **🐺** ("Built for closers 🐺")

**Expected:** Satu sistem maskot yang konsisten. Kalau macan jadi brand utama, elemen lain harus tunduk ke situ (atau dibedain jelas: macan = brand, hewan archetype = fungsional).

**Dampak:** Persepsi produk jadi ga rapi / belum matang.

---

## Rekomendasi

Semua temuan diteruskan ke **PRD-001**. Prioritas eksekusi:
1. QA-1 (blocker) — auth persistence.
2. QA-2 (major) — rebrand ke identitas macan.
3. QA-3 (minor) — beresin sistem maskot bareng QA-2.
