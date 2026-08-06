# SalesPal — Brand Identity

- **Tanggal:** 2026-08-01
- **Sumber kebenaran:** `public/logo.png`
- **Status:** Baseline (diambil dari logo yang ada)

Dokumen ini nyatuin identitas visual SalesPal biar semua halaman seragam sama logo. Sebelum ini ga ada catetan brand di repo — ini yang pertama.

---

## 1. Logo

- **Mark:** cakar/paw hewan (macan) warna biru, dengan siluet muka hewan di bantalan telapak.
- **Wordmark:** `SALESPAL` — huruf kapital, sans-serif tebal & lebar, warna near-black.
- **Layout:** mark di atas, wordmark di bawah (stacked). Untuk header bisa horizontal (mark kiri + wordmark kanan).
- **File:** `public/logo.png`.

**Jangan:** ganti warna cakar jadi selain biru brand, ganti proporsi, atau kasih efek gradient ke mark.

---

## 2. Warna

### Primary (dari logo)

| Token | Hex | Catatan |
|-------|-----|---------|
| `--brand-blue` | `#005eb0` | **Biru cakar** — di-sample langsung dari logo. Warna brand utama. |
| `--brand-blue-600` | `#004a8c` | Hover / pressed |
| `--brand-blue-700` | `#003c72` | Deep / active |
| `--brand-ink` | `#141414` | Warna wordmark `SALESPAL` |

### Glow / tint (turunan)

- `rgba(0, 94, 176, 0.12)` — background badge/pill
- `rgba(0, 94, 176, 0.30)` — glow halus
- `rgba(0, 94, 176, 0.45)` — shadow tombol

> ⚠️ **Diskrepansi saat ini:** app dipakein `#1b6cf2` (periwinkle) di mana-mana — itu **BUKAN** biru logo. Harus di-swap ke `#005eb0`. Detail di PRD-001.

### Warna fungsional (bukan brand — jangan diseragamin)

Status lead tetap: Hot `#ff4444`, Warm `#ff9900`, Cold, Closed `#00cc66`. "Cold" saat ini biru — pas eksekusi, bedain dari brand blue biar ga rancu (mis. Cold pakai biru terang `#3b9dff` atau abu, sementara brand blue `#005eb0` khusus aksen brand).

---

## 3. Tipografi

- **Body:** Plus Jakarta Sans.
- **Display / heading app:** saat ini Bebas Neue (condensed).
- ⚠️ **Diskrepansi:** wordmark di logo itu **sans tebal & lebar** (bukan condensed kayak Bebas Neue). Keputusan yang perlu diambil (PRD):
  - **Opsi 1:** biarin Bebas Neue sebagai display font app, logo tetap punya wordmark sendiri (dua-duanya coexist).
  - **Opsi 2:** ganti display font ke heavy wide grotesque (mis. Archivo Black / Inter Black) biar match wordmark logo.

---

## 4. Prinsip Penerapan

1. Semua aksen brand (logo text accent, CTA, tab aktif, link, glow) = `--brand-blue #005eb0`.
2. Warna fungsional/status ga ikut brand blue.
3. Logo mark selalu biru brand di background terang; di background gelap boleh versi putih/monokrom (belum ada asetnya — follow-up).
4. Wordmark = ink `#141414` di light mode, `#f2f3f6` di dark mode.

---

## 5. Aset yang Masih Kurang (follow-up)

- Versi logo monokrom putih (buat dark bg).
- Favicon/app-icon versi cakar biru (sekarang PWA pakai `logo.png` full).
- Logo SVG (sekarang cuma PNG raster).
