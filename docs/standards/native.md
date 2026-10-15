# Standar native — SalesPal

Berlaku buat **semua perubahan UI**. Asal-usul dan angka sebelum/sesudahnya ada di
[PRD-010](../prd/PRD-010-standar-native.md). Versi umum lintas project: skill
`native-standard` di `SurfingWhale/claude-config`.

Target: kerasa kayak app native di **iPhone 12 (PWA terpasang, WebKit, sentuh)** dan
**Mac (Safari/Chrome, mouse + keyboard)**. Bukan dirasa — diukur.

## Aturan (wajib lulus sebelum PR)

| # | Aturan | Diukur oleh |
|---|---|---|
| K1 | Tiap kontrol yang bisa ditap ≥ **44pt** di HP | audit tiap langkah (`run.mjs`) |
| K2 | Kolom isian ≥ **16px** (iOS ga nge-zoom) | audit |
| K3 | Ga ada geser ke samping di 390 & 320 | audit + flow `navigation` |
| K4 | **Ga ada** `window.print/alert/confirm/prompt` | probe; flow gagal |
| K5 | Tiap dialog/lembar/editor punya Batal/Tutup; Escape (Mac) & back (iPhone) cuma nutup yang paling atas | flow `dialogs` + flow per area |
| K6 | axe WCAG 2 AA: nol *serious/critical* (kontras, ARIA) | audit |
| K7 | Tap → frame berikutnya: p75 < 100 ms, maks < 200 ms (build produksi) | probe, tabel "How it feels" |
| K8 | Akun ukuran produksi tetap lulus K1–K7, tiap tempat kebuka < 8 dtk | flow `akun besar` |
| K9 | Gerak secukupnya; mati di *Reduce Motion* | CSS |
| K10 | Lapangan: INP HP < 200 ms, nol error runtime 7 hari | Vercel Speed Insights + runtime errors |

## Pola yang dipakai (jangan bikin versi baru)

| Butuh | Pakai |
|---|---|
| Konfirmasi hapus / aksi berbahaya | `components/ConfirmSheet.tsx` (`useConfirm()`), selalu ada **Batal** |
| Nutup form yang udah diisi | `components/FormGuard.tsx` → `useDiscard` ("Buang perubahan?"), `useSave` ("Menyimpan…" + error Indonesia), `FormNote` (kenapa Simpan mati) |
| Dialog | `.modal-overlay` > satu box; `components/ModalA11y.tsx` kasih role, fokus, Escape, back HP, × |
| Form panjang (penawaran/invoice) | `components/DocEditor.tsx`: header nempel (judul + ×), bagian = kartu, footer nempel (total + **Batal** lalu **Simpan**) |
| Lembar cetak | `components/ReportShell.tsx` / `PrintSheet.tsx`: **Simpan / kirim PDF** (jsPDF, share sheet di HP) + Cetak cuma di mouse |
| Teks berwarna | token `--ok`, `--warn-text`, `--violet-text`, `--brand-text`, atau `ink(color)` dari `components/ui.ts`. **Jangan** warna mentah (#ff9900, #a78bfa) buat teks, **jangan** `opacity` buat redupin teks |
| Target sentuh | udah dijamin CSS "native standard" di `app/globals.css` (≤ 767px). Elemen baru di luar `.sp-top/.sp-main/.sp-nav/.modal-overlay` harus ikut aturan ini sendiri |
| Gerak | keyframes `sp-sheet-in` / `sp-pop-in` di `app/globals.css`; durasi ≤ 220 ms |
| Teks UI | Bahasa Indonesia, "kamu" (bukan lo/gw), contoh & placeholder **netral** (Kopi Senja, Dina, Studio Contoh, 0812…). Repo ini publik: **ga ada nama klien, nomor, email, atau rekening beneran** di kode, tes, atau dokumen |

## Cara ngetes

```
npm run test:flows                         # Chromium HP 390×844 — audit tiap langkah
DESKTOP=1 npm run test:flows               # Chromium 1280×900
PROD=1 DEVICE=iphone12 npm run test:flows  # WebKit iPhone 12 (npx playwright install webkit dulu)
PROD=1 DEVICE=safari npm run test:flows    # WebKit Safari 1440×900
```

- Laporan: `tests/flows/out/report.md` — bagian **How it feels** (tap, waktu respons) dan **HIG audit findings** harus kosong.
- CI: workflow `native` (`.github/workflows/native.yml`) jalanin keempatnya di tiap push; merah = jangan merge.
- Fitur baru = langkah baru di `tests/flows/flows.mjs`; audit otomatis ikut ngecek layar yang ditinggalin tiap langkah.
- Abis deploy: UAT manual `salespal-uat` (claude-config), baris smoke **S1–S7** di iPhone beneran.

## Library & "design skill" dari luar

Dinilai pakai K1–K10, bukan kesan. Ambil **prinsip** (taste, jarak, tipografi) dan **pola**
(gerak) lalu tulis ulang pakai stack sendiri; tolak efek WebGL/shader/kursor dan library
yang bawa runtime baru cuma buat hiasan. Daftar yang udah dinilai: PRD-010 §5.
