# PRD-004 — Interface audit (better-interface, full)

- **Tanggal:** 2026-09-26
- **Status:** Temuan diperbaiki di PR ini; diverifikasi dengan `npm run test:flows` (8/8, 390×844 dan 1280×900).
- **Cara audit:** skill `better-interface` (mode `full`) dengan enam skill domain: accessibility, layout, writing, typography, colors, ui.

## Scope and coverage

Mode `full`. Scope: seluruh app yang login — `components/SalesTracker.tsx` (Beranda, Leads, Outreach, Rejection Log, AI Playbook, modal), `Hunting.tsx`, `ThreadsRadar.tsx`, `Quotes.tsx`, `Invoices.tsx`, `Services.tsx`, `LeadSources.tsx`, `ScriptLibrary.tsx`, `SalesSimulator.tsx`, `QuickPitch.tsx`, `app/login/page.tsx`, `app/globals.css`. Next.js 14, inline style objects + tokens di `globals.css` (`--app-*`, `--ok`, `--brand-*`), tema terang/gelap lewat `data-theme`. Phone-first (390px), terang dan gelap; desktop 1280px lewat flow tests.

Batas: halaman cetak (`PrintSheet`), import Excel/scan gambar, dan screen reader asli (VoiceOver) **tidak** diperiksa; aksesibilitas dicek lewat role/nama/fokus di DOM.

| Domain | Evidence inspected | Result |
|---|---|---|
| Accessibility | 14 `.modal-overlay`, baris lead (`div`/`tr` onClick), focus ring global, label login | 2 findings |
| Layout | 11 tab di 390px (sudah dibenahi di PR #19), tombol melayang vs konten | 1 finding |
| Writing | label tombol di 7 komponen, judul halaman | 1 finding |
| Typography | ukuran font input di `ui.ts`, `SalesTracker.tsx`, `ScriptLibrary.tsx`, `QuickPitch.tsx` | 1 finding |
| Colors | pasangan teks/latar status & aksen, terang dan gelap (WCAG, diukur) | 2 findings |
| UI | transisi, radius, tekan | 1 finding |

## Findings

| # | Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | HIGH | Accessibility | 14 modal: `SalesTracker.tsx` (tambah lead, detail lead, outreach, import…), `Services.tsx`, `Quotes.tsx`, `Invoices.tsx`, `Hunting.tsx`, `QuickPitch.tsx` | `div.modal-overlay` tanpa `role="dialog"`, tanpa Escape, fokus tetap di halaman belakang | `components/ModalA11y.tsx` sekali pasang: `role="dialog" aria-modal`, nama dari baris pertama, fokus masuk ke field pertama dan kembali ke pemicu, Tab terkunci di dalam, Escape menutup, `overscroll-behavior: contain` | Pengguna keyboard/screen reader tidak tahu dialog terbuka dan tidak bisa menutupnya |
| 2 | HIGH | Accessibility | `SalesTracker.tsx:773` (kartu HP), `:810` (baris tabel) | `<div className="lead-row" onClick>` | `role="button"` (kartu), `tabIndex={0}`, Enter/Space membuka, `aria-label="Buka lead …"` | Detail lead (follow-up, buat penawaran) tidak bisa dibuka tanpa mouse |
| 3 | HIGH | Colors | `ui.ts` `badge()`, `statusColor` teks di `SalesTracker.tsx`, teks hex inline di 10 file | Oranye `#ff9900` 2.14:1, amber `#f59e0b` 2.15:1, ungu `#a78bfa` 2.72:1, merah `#ff4444` 3.41:1, hijau `--ok #00a862` 3.10:1 di kartu terang | `ink(color)` = `color-mix(in srgb, <warna> 55%, var(--app-text))` untuk semua warna status sebagai teks; `--ok` terang `#0a8052` | Status (Warm/Hot, nilai Rp, badge) di bawah 4.5:1; dengan campuran: 4.7–5.7:1 terang, 7–12:1 gelap |
| 4 | MEDIUM | Colors | teks `#005eb0` di mode gelap (tab aktif bawah, "Tampilkan lagi", link) | 2.91:1 di `#0d1117` | token `--brand-text`: `#005eb0` terang, `#58a6ff` gelap | Biru brand sebagai teks tidak terbaca di gelap |
| 5 | MEDIUM | Typography | `ui.ts:9`, `SalesTracker.tsx:115`, `ScriptLibrary.tsx:59`, `QuickPitch.tsx:60` | input `fontSize: 13` | `globals.css`: di ≤767px `input, select, textarea { font-size: 16px }` | iOS Safari zoom ke tiap field di bawah 16px |
| 6 | MEDIUM | Layout | `QuickPitch.tsx` tombol melayang di tab Hunting | Menutupi tombol "Kirim WA" di HP | Tombol disembunyikan di Hunting (template sudah ada di halaman); komponen tetap terpasang karena dia yang mengisi template awal | Tombol utama tertutup |
| 7 | MEDIUM | Writing | 7 komponen | `+ ADD LEAD`, `IMPORT`, `SIMPAN LEAD`, `SIMPAN`/`BATAL`, `+ LOG OUTREACH`, `INFO BISNIS`, `+ PAKET`, `+ PENAWARAN`, `BUAT PENAWARAN` | `+ Tambah lead`, `Impor`, `Simpan lead`, `Simpan`/`Batal`, `+ Catat outreach`, `Info bisnis`, `+ Paket`, `+ Penawaran`, `Buat penawaran` | Campur Inggris/Indonesia dan huruf kapital diketik; bagian baru (Hunting, Radar) sudah kalimat biasa |
| 8 | LOW | UI | `ScriptLibrary.tsx:111`, `SalesSimulator.tsx:86` | `transition: "all 0.15s"` | `background-color, color, border-color` | Jangan `transition: all` |

## Considered but rejected

| Location | Candidate | Rejected because |
|---|---|---|
| Judul "Sales Command Center", "Lead Database", "Hunting Mode" | Terjemahkan | Kosakata owner sendiri memang campur (Leads, Hunting, closing); tidak ambigu |
| Ikon emoji di navigasi bawah | Ganti SVG satu stroke | Konvensi proyek sejak awal; selalu berpasangan dengan label teks |
| `confirm()` sebelum hapus lead | Dialog custom | Dialog native sudah bisa keyboard & screen reader |
| Label navigasi bawah 11px | Perbesar | Selalu berpasangan dengan ikon 19px; area sentuh 56px |
| Badge "Segera hadir" 10px | Perbesar | Label dekoratif; teks penjelas di bawahnya 12px |

## Verification

- `npm run test:flows` → **8/8** di 390×844 dan **8/8** di 1280×900, termasuk flow baru *dialogs work from the keyboard* (Enter membuka lead → dialog; Escape menutup dan fokus kembali ke baris; dialog tambah lead fokus ke input pertama; 25× Tab tetap di dalam dialog).
- Kontras dihitung (WCAG 2) untuk tiap warna campuran pada `#ffffff`, `#f6f8fa`, dan `#0d1117`.
- `tsc` lulus.
- **Not verified:** VoiceOver di iPhone; mode forced-colors; browser di bawah Safari 16.2 (`color-mix`).

## Verdict

`Approve` untuk scope di atas setelah perbaikan; sisa yang belum diverifikasi tercantum di atas.
