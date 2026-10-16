# PRD-010 — Standar "native": iPhone 12 (PWA) & Mac

- **Status:** Dibangun 2026-10-15 — kriteria, harness WebKit + audit HIG di tiap langkah, CI GitHub Actions, akun ukuran produksi, perbaikan sampai audit nol temuan. CI WebKit (iPhone 12 + Safari) hijau sejak run #7. Belum: data lapangan (Speed Insights perlu dinyalain di Vercel) dan uji owner di iPhone beneran (UAT S1–S7).
- **Tanggal:** 2026-10-15
- **Konteks:** Owner nguji PWA terpasang di iPhone 12 dan Mac: ga ada tombol Batal, dialog ga bisa ditutup, form sempit, tombol rebutan tempat, ukuran huruf ga nyaman, `Cetak / PDF` ga ngapa-ngapain. Enam putaran perbaikan per area (#52) nutup banyak hal, tapi semua dites di **Chromium pakai mouse** — padahal iPhone jalan di **WebKit**, sentuh, keyboard di layar. PRD ini bikin "native" jadi sesuatu yang **diukur**, bukan dirasa.
- **Standar yang berlaku:** [`docs/standards/native.md`](../standards/native.md) (ringkas, dipakai tiap perubahan UI); skill `native-standard` di claude-config buat project lain.
- **Terkait:** PRD-004 (audit antarmuka pertama), PRD-008 (desain & audit `better-*`), PRD-009 §15 (masukan QA 11–15 Okt), skill `salespal-uat` di claude-config.

---

## 1. Kriteria lulus (diturunkan dari Apple Human Interface Guidelines)

| # | Kriteria | Cara ngecek |
|---|---|---|
| K1 | Target sentuh ≥ 44pt di HP | audit tiap langkah (`tap target under 44px`) |
| K2 | Kolom isian ≥ 16px (iOS ga nge-zoom) | audit (`field under 16px`) |
| K3 | Ga ada geser ke samping di 390 & 320 | audit (`page scrolls sideways`), flow `navigation` di 320 |
| K4 | Ga ada `print` / `alert` / `confirm` / `prompt` bawaan browser | probe di halaman; flow gagal kalau kepanggil |
| K5 | Tiap dialog/lembar punya jalan keluar; Escape (Mac) & back (iPhone) cuma nutup yang paling atas | flow `dialogs`, langkah-langkah per area |
| K6 | Kontras & ARIA lulus WCAG 2 AA (axe: nol *serious/critical*) | axe-core di tiap langkah |
| K7 | Tap → frame berikutnya: p75 < 100 ms, maks < 200 ms (build produksi) | probe `click` → `requestAnimationFrame` |
| K8 | Akun sibuk (200 lead, 50 invoice, 60 prospek, 120 DM, 3 klien) kebuka < 8 detik per tempat, tetap lulus K1–K6 | flow `akun besar` |
| K9 | Gerak secukupnya; mati kalau perangkat minta *Reduce Motion* | CSS `prefers-reduced-motion` |
| K10 | Lapangan: INP HP < 200 ms, nol error runtime 7 hari | Vercel Speed Insights + runtime errors |

## 2. Bahan mentah yang dipakai

- **Data produksi Vercel (15 Okt):** error runtime 7 hari = **0**. Log cuma tersimpan 1 jam (paket Hobby). Belum ada data kecepatan lapangan sama sekali → `@vercel/speed-insights` dipasang di `app/layout.tsx`; **owner perlu nyalain Speed Insights** di Vercel → Project → Speed Insights.
- **Engine:** Playwright `devices['iPhone 12']` di WebKit (390×664 viewport Safari, DPR 3, sentuh, UA iOS) dan `devices['Desktop Safari']` 1440×900. Container dev cuma punya Chromium, jadi WebKit jalan di GitHub Actions.
- **Data ukuran produksi:** ditulis langsung ke emulator sebagai owner (`bigAccount()` di `tests/flows/flows.mjs`), semua nama & nomor karangan.

## 3. Yang dibangun

- `tests/flows/run.mjs`
  - `DEVICE=iphone12` / `DEVICE=safari` (WebKit), `PROD=1` (`next build && next start`, waktu respons realistis).
  - Probe di tiap halaman: hitung tap, ukur tap → frame berikutnya, tangkap `print/alert/confirm/prompt`.
  - **Audit HIG otomatis setelah tiap langkah yang lulus** (±300 layar per run): K1, K2, K3, axe. Temuan yang sama digabung jadi satu baris, dengan tempat pertama kelihatan. Run gagal kalau ada temuan.
  - Laporan `tests/flows/out/report.md` (tabel "How it feels" per flow) + `ux.json`.
- `.github/workflows/native.yml`: matriks iPhone 12 (WebKit), Desktop Safari (WebKit), Chromium HP, Chromium desktop — semua build produksi; laporan masuk ke Summary, folder `out/` jadi artifact.
- Flow baru **akun besar**; lima pekerjaan inti = flow yang udah ada: *sell* (closing → penawaran → invoice → PDF → DP, plus invoice langsung), *journey* (share post → intro → dibales → kasih data → lead), *report klien* (chat → lunas → report bulanan dibekukan → PDF), *guild* (bikin → undang → gabung → jual → report tim), *dialogs* (semua dialog di HP kecil).

## 4. Hasil (Chromium, build produksi, 15 Okt)

| | Sebelum perbaikan | Sesudah |
|---|---:|---:|
| Temuan audit unik (HP) | **107** (63 kontras, 39 target sentuh, 3 ARIA, 2 halaman) | **0** |
| Flow lulus HP / desktop | 17/17 | 17/17 |
| Tap → frame, semua tap HP | p75 16 ms · maks 234 ms | p75 14 ms · p95 24 ms · maks 152 ms |
| Akun besar: tiap tempat kebuka | 0,6–1,2 dtk | sama |

Yang dibenerin karena audit:
- **Target 44pt di HP** buat semua kontrol di app (`app/globals.css`, blok "native standard"): sub-tab, mode Beranda, logo, bar sesi hunting, Quick Pitch, edit/hapus template, bar target closing, dst. Pengecualian cuma titik peta lead dan input file tersembunyi.
- **Kontras:** token teks baru `--warn-text` (oranye), `--violet-text`, `--ok` digelapin (#087347, 5,2:1 di panel); angka statistik Penawaran/Invoice/Penjualan, tag arketipe Simulator, chip nada Script Library, judul langkah Playbook, angka filter journey.
- **ARIA:** grup avatar anggota guild dapet `role="group"`; kartu template yang dikunci (DNC) ga lagi pakai `opacity` yang nurunin kontras.
- **Gerak (K9):** lembar naik dari bawah di HP (220 ms), dialog muncul halus di Mac (180 ms), tombol mengecil dikit pas ditekan di layar sentuh; semua mati di *Reduce Motion*.

### Hasil WebKit (GitHub Actions `native`, 15 Okt)

| Run | iPhone 12 (WebKit) | Desktop Safari (WebKit) | Chromium HP | Chromium desktop |
|---|---|---|---|---|
| #3 | ga bisa mulai (izin clipboard Chromium ditolak WebKit) | sama | 17/17, audit gagal | 17/17, 66 temuan |
| #4 | 14/17 | 14/17, 13 temuan | 17/17, 53 temuan | 17/17, gagal |
| #5 | 16/17 | 16/17 | ✅ | ✅ |
| #6 | 16/17 | 16/17 | ✅ | ✅ |
| **#7** | ✅ **17/17, audit 0** | ✅ **17/17, audit 0** | ✅ | ✅ |

Yang ketemu cuma karena WebKit, dan dibenerin:
- **Bug app (Safari):** dua `history.back()` beruntun digabung Safari jadi satu langkah. Nutup form yang udah diisi (form + "Buang perubahan?") bikin back berikutnya ketelen, dan dialog berikutnya ga bisa ditutup pakai back. Sekarang `history.go(-n)` sekali, satu perjalanan history per waktu (`components/ModalA11y.tsx`).
- **Bug app (dua engine):** dialog yang dibuka sebelum back sebelumnya mendarat kehilangan entri history-nya. Sekarang push-nya nunggu.
- **Lapisan gelap di belakang lembar HP** bisa discroll pas animasi; sekarang `overflow: hidden`.
- **Audit diukur pas layar diam:** kontras dialog yang lagi fade-in kebaca rendah (63 "temuan" palsu di CI) — audit sekarang nunggu animasi selesai.
- **Batas alat tes, bukan app:** WebKit ngelewatin mock lewat service worker (diblok kecuali flow share-target), clipboard WebKit headless diganti clipboard di memori (clipboard asli dicek di UAT S1–S7), scrollbar 4px WebKit-Linux (iOS ga punya).

## 5. Repo "desain" yang dinilai (15 Okt)

Owner ngirim 10 repo yang katanya bikin agent jadi desainer UI. Dinilai pakai kriteria di atas, bukan kesan:

| Repo | Putusan | Alasan |
|---|---|---|
| Superdesign skill | ga dipasang | produk komersial, butuh login CLI; canvas draf, bukan audit app jadi |
| Better Design (marvkr) / Design Taste | **diambil prinsipnya** | sejalan sama `better-*` yang udah dipakai (PRD-008): jarak, tipografi, gerak hemat — dipakai sebagai lensa, bukan dependensi |
| Motion Primitives | **diambil polanya** | pola gerak lembar & dialog ditulis ulang pakai CSS (K9); library-nya butuh Framer Motion + Tailwind, SalesPal pakai inline style |
| Canvas UI, Paper Shaders, Hyperiux, UI Layouts, Cursify, Trickle UI Kit | ga dipakai | efek WebGL/shader/kursor: berat di baterai & GPU HP, ga ada kursor di layar sentuh, ga nambah kemampuan jualan; ngelanggar K7 di HP lama |

## 6. Bukti di luar kita (yang masih harus terjadi)

1. ✅ **CI WebKit hijau** di GitHub Actions (`native` run #7, 15 Okt): iPhone 12 & Desktop Safari 17/17, audit HIG 0. Tiap push berikutnya harus tetap hijau.
2. **Data lapangan 7 hari** dari Speed Insights: INP HP < 200 ms; error runtime tetap 0.
3. **Owner** nyelesain 5 pekerjaan inti di iPhone sendiri tanpa nanya, dicentang di `salespal-uat` (S1–S7), idealnya direkam layar.

## 7. Cara jalanin

```
npm run test:flows                       # Chromium HP 390×844
DESKTOP=1 npm run test:flows             # Chromium 1280×900
PROD=1 DEVICE=iphone12 npm run test:flows   # WebKit iPhone 12 (butuh `npx playwright install webkit`)
PROD=1 DEVICE=safari npm run test:flows     # WebKit Safari 1440×900
NO_AUDIT=1 …                             # matiin audit per langkah (debug cepat)
```

## 8. Susulan 16 Okt — Profil & Pengaturan

Owner: "masih belum halus, dan gw belum bisa milih logo profile." Lembar Profil dibikin ulang jadi daftar pengaturan ala Settings iPhone (`components/ProfileSheet.tsx`):
- **Foto profil bisa dipilih**: avatar 88px di atas (tap = ganti), pilihan Inisial atau 8 karakter (4 orang + 4 binatang). Disimpan di `users/{uid}/settings/profile.avatar` (koleksi `settings` udah dicakup rules). Tombol profil di header ikut nampilin karakternya.
- **Baris seragam** dalam grup berjudul (Akun · Aplikasi · Versi & data): ikon dalam kotak warna, label 15px, keterangan 13px, nilai atau **switch** di kanan, tinggi ≥ 52px, garis pemisah tipis. Emoji 🔔🧹 diganti ikon; "Matikan/Nyalain" dan "Cek update" yang beda-beda gayanya diganti switch dan aksi teks yang sama.
- **Logout** sendiri di paling bawah, merah, di tengah.
- Flow navigasi: pilih Singa → baris "Foto profil · Singa" dan tombol header nampilin gambarnya.

## 9. Susulan 16 Okt — Landing dibikin ulang pakai TasteSkill v2

Landing lama gagal di inspektor TasteSkill: 15 FAIL, 7 WARN. Masalahnya: judul 7 baris di HP, teks gradasi dan glow, 24 emoji jadi ikon, bayangan di tombol, teks isi 13,5px, 14 ukuran font, dan isi yang udah basi (Outscraper, Instantly). Halaman `/` (`app/page.tsx`, `app/landing.css`) dibikin ulang:
- **Arah:** "The page is the object", seed 1715383983. Warna dan font tetap dari brand (`--keep palette,type`).
- **Ide:** penawaran yang dikirim studio ke WhatsApp jadi halaman itu sendiri.
- **Yang bisa dicoba pengunjung:** slip di hero bisa diisi (nama klien, pilih paket). DP dan total ikut kehitung, dan link "Kirim contoh ini ke WhatsApp" bawa teks yang udah keisi.
- **Bagian halaman:** hero slip di samping layar app yang ganti pelan-pelan (Hunting → Penawaran → Invoice lunas), plate dengan tab (Hunting / Journey / Guild), slip "Satu hari jualan", lembar fitur yang numpuk (karakter tipe customer dan peran guild sebagai gambar), surat dari tim, satu kata "Mulai" sebagai tombol, footer dengan nama SALESPAL yang kepotong.
- **Hasil:** inspektor 0 FAIL. Satu WARN (ga ada video) dibiarin karena ga ada klip jujur buat software. Lint 0 FAIL, flow `landing` lolos di HP dan desktop dengan audit HIG 0.
- **Contoh yang mesti dicek sebelum jualan beneran:** harga paket di slip (Rp 1,5 jt / 3,5 jt / 6 jt), "Toko Kue", Q-0142 / INV-0142, nama Raka/Sinta/Bima di fragmen guild.
