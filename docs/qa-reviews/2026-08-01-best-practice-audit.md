# Best-Practice Audit & Fixes — 2026-08-01

- **Rubrik:** dimensi dari koleksi skill `/better` (Jakub Krehel) — interface, ui, typography, colors, accessibility, layout, writing.
- **Scope:** seluruh app (landing, login, dashboard/app, PWA).
- **Status:** ✅ diaudit → dicatat → diperbaiki (fixed di commit ini). Item yang ditunda ditandai ⏳.
- **Verifikasi:** `next build` sukses (TypeScript + lint pass, 6 route prerender).

Auth persistence & brand-blue unification (dari PRD-001) sekalian dikerjain di sini.

---

## ✅ Yang sudah diperbaiki

### 1. Auth / PWA (blocker)
- **Fix:** `lib/firebase.ts` sekarang pakai `initializeAuth` dengan persistence `[indexedDBLocalPersistence, browserLocalPersistence]` + `browserPopupRedirectResolver`.
- **Kenapa:** IndexedDB jauh lebih awet di iOS standalone PWA dibanding localStorage (yang di-isolate/di-evict). Sesi ke-restore tiap buka → **ga login ulang lagi**.

### 2. Colors (better-colors)
- **Brand unification:** semua `#1b6cf2` (periwinkle salah) → **`#005eb0`** (biru logo, di-sample dari `logo.png`). 39 titik, 0 sisa. Token brand ditambah di `:root` (`--brand-blue`, `-600`, `-700`, `--brand-ink`).
- **Kontras (WCAG):** neon `#00ff88` sebagai **teks/badge di atas putih** gagal kontras → diganti var `--ok` (`#00a862` light / `#00e07a` dark). Kena: pipeline value, hot-lead value, tabel value, lead score, "Replied" badge, tips.
- **Primary action = brand:** tombol utama (`btnPrimary`, "Simulasi Baru", step indicator simulator) dari gradient hijau → **brand blue** solid, teks putih. Hijau sekarang khusus semantik sukses (Closed, copied, skor tinggi).
- **Cold vs brand:** status "Cold" tadinya `#005eb0` (bentrok sama brand) → **slate `#64748b`** (dormant, jelas beda).

### 3. Accessibility (better-accessibility)
- **Focus visible:** global `:focus-visible` outline biru brand di semua elemen interaktif (termasuk yang inline-style).
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` matiin marquee, floating phones, pulse, spin — hormatin setting user.
- **ARIA / nama aksesibel:**
  - Input login dikasih `aria-label` + `autoComplete` yang bener (email / current-password / new-password).
  - Toggle tema: `aria-label` (bukan cuma `title`).
  - Tombol "Del" lead: `aria-label` "Hapus lead {nama}".
  - Dot carousel landing: `aria-label` + `aria-current`.
- **Hit area:** tombol kecil (toggle tema, Del) padding dinaikin ke arah target sentuh ≥40px.
- **Input focus:** border fokus dari neon hijau → biru brand.

---

## ⏳ Ditunda (catatan buat pass berikutnya)

Dimensi lain yang belum tuntas — bukan bug fungsional, tapi peningkatan best-practice:

### Typography (better-typography)
- ⏳ Skala tipografi belum ada sistem (ukuran ad-hoc: 9–26px inline). Rekomendasi: definisiin skala token (xs/sm/base/lg/xl) di CSS var.
- ⏳ Diskrepansi wordmark: logo pakai sans tebal-lebar, app pakai Bebas Neue (condensed). Keputusan buka (brand-identity.md §3).

### Layout (better-layout)
- ⏳ Spacing belum pakai skala konsisten (gap/padding ad-hoc 4–32px). Rekomendasi: skala 4/8/12/16/24/32.
- ⏳ Beberapa grid di modal (`1fr 1fr`) belum collapse ke 1 kolom di layar sempit — cek di HP kecil.
- ⏳ Tabel Leads `minWidth: 700` — horizontal scroll di HP; pertimbangkan card layout responsif.

### UI (better-ui)
- ⏳ Border-radius belum konsisten (6/8/10/12/14/16/20/28 campur). Rekomendasi: token radius (sm/md/lg/pill).
- ⏳ Shadow ad-hoc; belum ada elevation scale.
- ⏳ Hover state pakai JS `onMouseEnter/Leave` di beberapa tempat — bisa dipindah ke CSS (lebih ringan + konsisten).

### Writing (better-writing)
- ⏳ Empty state minim (mis. tabel Leads kosong ga ada pesan/CTA). Tambah empty state yang ngajak aksi.
- ⏳ Error message auth masih raw dari Firebase (`e.message`) — mapping ke pesan ramah bahasa Indonesia.
- ⏳ Campur casing tombol (UPPERCASE "SIMPAN" vs "Copy") — samain konvensi.

### Interface / brand konsistensi (better-interface)
- ⏳ Ikon header masih ⚡ (belum mark cakar dari logo). Footer 🐺 masih off-brand. Butuh aset mark cakar (SVG) — lihat brand-identity.md §5.
- ⏳ Emoji archetype "Singa" masih 🐯 (nama vs emoji ga cocok).

---

## Verifikasi

- `next build` → ✓ Compiled successfully, types & lint pass, 6/6 static pages.
- Manual QA (rekomendasi sebelum anggap tuntas): tes PWA iOS — login sekali, tutup/buka ≥3x, pastikan ga relogin.
