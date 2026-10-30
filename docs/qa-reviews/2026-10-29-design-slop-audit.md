# Design Slop Audit — 2026-10-29

- **Rubrik:** skill `slop-audit` (fauzy-setup) — 11 indikator, skor 0–4, tiap temuan pakai bukti + kontra-argumen + tingkat yakin. Diukur juga terhadap [standar visual](../standards/design.md) repo ini.
- **Target:** `origin/main` @ `b1b400b` (#88), emulator Auth + Firestore, project `demo-salespal`, seed seukuran produksi dari `tests/flows/flows.mjs` (`bigAccount`: 200 lead, 40 penawaran, 50 invoice, 60 prospek, 120 DM).
- **Diambil:** landing, login, dan 16 tempat/tab (Beranda, Hunting + Performa, Jualan: Leads + detail, Penawaran, Invoice, Paket; Tim: Dashboard tim, Guild, Report Klien, Log aktivitas, Outreach, Rejection Log; Belajar: Script Library, Simulator, AI Playbook) × HP 390×844 + laptop 1280×900 × terang + gelap.
- **Belum dicek:** hover/focus, sebagian besar dialog, Safari/WebKit, data kosong (akun baru). Kontras & performa **tidak diukur** di sini — itu wilayah `native.md` dan CI-nya.
- **Status:** diaudit, belum diperbaiki.

> **Riwayat:** pass pertama hari ini jalan di branch lokal yang ketinggalan 118 commit dari main. Temuan beratnya — mockup "SALESRADAR" di landing, stat tanpa sumber, garis `#161b22` di Simulator, tombol outreach ganda, kotak 4 lapis di Hunting — **sudah beres di main** (landing rebuild, `design.md` #74, rombakan Hunting #55 dan #75 dkk.). Laporan ini cuma memuat yang masih ada di main.

---

## A. Verdict

**Filosofi visual:** main sudah punya arah yang disengaja dan tertulis — `design.md` (22 Okt) lahir dari kritik "slop" yang sama: satu hero per layar, strip angka tanpa kotak, kotak cuma kalau ada alasan, emoji bukan ikon. Landing baru ("halaman adalah slip penawaran", UI app digambar apa adanya, karakter clay owner) adalah **identitas ekspresif**, bukan template. Dashboard tim adalah contoh paling bersih dari standar itu.

Masalahnya sekarang **bukan arah, tapi penerapan yang belum rata**: aturannya ada, tapi baru sebagian layar dan sebagian kecil kode yang ngikutin.

**Tiga temuan paling berat:**
1. **Tab Tim kepotong semua di HP** — 6 tab di segmented control 390px: "Dashb…", "Repor…", "Log ak…", "Outre…", "Reject…". Label navigasi yang ga kebaca = orang nebak.
2. **Lead masih punya sinyal kualitas yang saling bantah** — pill status + dot meter + label + angka. Contoh di seed: "Usaha Contoh 180" = **Cold** tapi **Potensi tinggi 71**, di daftar maupun di halaman lead. Di laptop (grid 3 kolom + panel) justru **namanya** yang kepotong ("Usaha Conto…"), sementara label potensi tampil utuh.
3. **`design.md` belum ditaati kode:** 31 ukuran huruf literal; token `--fs-*` cuma 80 dari ±1.340 pemakaian (6%). `12px` ×421 padahal ga ada di skala. Ukuran pecahan (12.5, 13.5) masih 30× padahal dilarang. Radius 28 nilai (aturan: 4). 141 hex, 109 rgba.

**Yang dipertahankan:** landing baru; Dashboard tim (hero angka + kalimat perubahan, strip bergaris, grafik bergrid & bersumbu); strip angka Hunting; karakter clay sebagai tipe customer; satu set ikon garis di nav.

---

## B. Audit per indikator

| Indikator | Skor | Bukti | Dampak | Rekomendasi | Yakin |
|---|---|---|---|---|---|
| 1. Tag/badge | **3** | Leads: pill status + 5 dot + label "Potensi …" + angka di tiap kartu, dan bisa bertentangan (Cold vs Potensi tinggi 71). Hunting: tahap "Baru" muncul 3× per kartu prospek (baris meta, stepper, label di bawah stepper). Penawaran: pill status + peringatan kuning "Belum ada nomor WA — …" diulang di **tiap** kartu. Leads: chip "Sangat tinggi 0". | Kartu lambat dipindai; sinyal yang bantah-bantahan bikin ragu mana yang dipercaya. | Satu sinyal kualitas utama per lead. Tahap cukup di stepper. Peringatan nomor WA sekali di atas daftar ("4 penawaran belum punya nomor WA"). Sembunyikan chip 0. | Tinggi |
| 2. Italic | **1** | Tanda tangan "*Tim SalesPal*" di landing; kutipan script. | — | Pertahankan. | Tinggi |
| 3. Font tren | **1** | Bebas dipakai buat angka sesuai `design.md`. Efek sampingnya: Bebas cuma huruf kapital, jadi "Rp" di hero Dashboard tim kebaca **"RP 15.000.000"**. | Kecil, tapi "RP" bukan cara nulis rupiah. | "Rp" pakai Jakarta, angkanya Bebas. | Tinggi |
| 4. Kerning negatif | **1** | Tracking negatif di Bebas (`.feat-title` −0.4px, `.sc-name` −0.3px, `.hero-headline`) sekarang **CSS mati** — class-nya ga dipakai lagi sejak landing rebuild. Heading besar landing −0.05/−0.06em di ukuran display: wajar. | — | Hapus CSS landing lama dari `globals.css`. | Tinggi |
| 5. UI berlebih | **2** | Beranda: blob radial biru di peta lead; header 6 lapis `backdrop-filter`; tombol "Mulai hunting" pakai gradient + glow, padahal tombol primer lain solid. Beranda laptop: "Per kuadran" = 4 kartu map dengan lembar yang ngintip saat hover ("Arahkan kursor buat ngintip isinya"), isinya sama dengan label kuadran di peta tepat di atasnya (Rawat 40, Nanti 79, …) dan kartu "Kejar sekarang". | Konsep kuadran tampil 3× di satu layar; intip cuma jalan pakai mouse. | Blob dibuang. "Per kuadran" digabung ke peta (klik label kuadran = filter). "Mulai hunting" solid seperti tombol lain (warnanya tetap `HUNT_COLOR`). | Sedang |
| 6. Divider | **1** | Garis rambut sesuai `design.md`; garis titik-titik di landing = perforasi slip (bagian dari metafora). | — | Pertahankan. | Tinggi |
| 7. Shade/opacity | **3** | 141 hex, 109 rgba. Strip Outreach: 5 angka, 5 warna (biru, coklat, hijau, abu, merah). Strip Penawaran: biru, hijau, ungu. `design.md` minta "satu warna per arti". | Warna kehilangan arti; dark mode rawan. | Angka strip pakai `--app-text`; warna cuma buat perubahan (▲/▼) dan status. | Tinggi |
| 8. Kontainer berbingkai | **2** | Hunting dan Beranda laptop sudah strip tanpa kotak. Sisa: strip angka Beranda **di HP**, Outreach, Penawaran masih **di dalam kotak**. Kartu penawaran berisi sampai 7 tombol + 1 peringatan. Beranda HP: 4 kartu bertumpuk sebelum strip angka (bar hunting, peta, Kejar sekarang, Cari calon klien). | Hierarki rata lagi di layar yang belum dimigrasi. | Strip angka tanpa kotak di semua layar (§2). Kartu penawaran: 1 aksi utama sesuai status + menu "…" buat sisanya. | Tinggi |
| 9. Diagram berlebih | **3** | Peta lead dengan 120 lead: blob biru jadi awan besar yang nutupin kepadatan titik — yang mau dibaca dari peta justru ketutup. Grafik Dashboard tim sudah benar (grid 3 garis, sumbu). | Peta susah dibaca di data nyata. | Buang blob; kepadatan dari titik sendiri (opasitas/cluster). | Tinggi |
| 10. Label teknis | **2** | Nomor penawaran/invoice pakai `fontFamily: "monospace"` (`Quotes.tsx:269`, `Invoices.tsx:238`). Jargon "ETB/NTB" di baris meta prospek, filter Hunting, dan "Jadi ETB" di Dashboard tim. | Monospace bikin kesan teknis di layar jualan; ETB jelas buat yang paham istilah bank, kabur buat freelancer. | Nomor pakai `tabular-nums` Jakarta. ETB → "Jadi klien" (ETB di tooltip/legenda), atau putuskan memang buat tim bank. | Sedang |
| 11. Penomoran section | **1** | Tahap "1. Intro / 2. Follow-up / 3. Gali" = urutan nyata. | — | Pertahankan. | Tinggi |

Skor total sengaja ga dihitung: bobot layar beda jauh.

---

## C. Diagnosis pola

- **Sistem konsisten:** Dashboard tim, Hunting (strip + tab), landing. Ngikutin `design.md`, kelihatan dibuat orang.
- **Estetika template:** hampir habis. Sisanya detail: blob, glow di tombol, warna per angka.
- **Identitas ekspresif:** landing (slip, perforasi, "Mulai" raksasa) dan karakter clay — ini kekuatan SalesPal sekarang.
- **Akumulasi:** layar Jualan (Penawaran, Invoice) dan Tim (Outreach, Rejection Log) belum dimigrasi ke `design.md`. Jejaknya ada di kode: 94% ukuran huruf masih literal.

**Akar masalah:** standar ditulis 22 Okt dan dipakai di layar baru. Layar lama belum disapu.

---

## D. Prioritas

**P0:** ga ada yang terbukti dari inspeksi visual.

**P1**
1. **Tab Tim di HP:** 6 tab ga muat di segmented control → scroll horizontal dengan label utuh, atau kelompokin (Dashboard · Guild · Log), sisanya di "Lainnya". → Label kebaca.
2. **Sinyal kualitas lead:** satu sinyal utama (usul: Potensi = dot + angka; status manual cuma kalau Closed/Lost, atau jadi filter). → Ga ada lagi "Cold tapi Potensi tinggi", dan di laptop nama lead dapat ruang lagi.
3. **Kartu penawaran:** satu aksi utama per status (Draft → Kirim; Terkirim → Follow-up WA; Disetujui → Buat invoice), sisanya di "…". Peringatan nomor WA sekali di atas daftar. → Daftar bisa dipindai.

**P2**
4. **Sapu token:** `fontSize` literal → `--fs-*` (mulai dari 12px ×421 dan 12.5/13.5), radius → `--r-*`. Bisa per layar barengan migrasi `design.md`.
5. **Strip angka tanpa kotak** di Beranda, Outreach, Penawaran; angka satu warna.
6. **Peta lead:** buang blob.
7. **"Mulai hunting":** solid tanpa glow/gradient.
8. **Landing 390px:** ikon ↗ numpuk di kata "DM" ("Bikin akun, tempel satu link post, kirim DM pertama kamu.").
9. **FAB chat** nutup angka "Nilai pipeline" di Beranda HP saat posisi awal.
10. **Beranda laptop: tiga tombol solid** sekaligus ("Tambah lead" biru, "Mulai hunting" oranye, "Cari bisnis" biru). Pilih satu primer per layar; sisanya outline.
11. **"Per kuadran"** digabung ke peta (lihat #5).

**P3**
12. "RP" → "Rp" di hero Bebas.
13. Hapus CSS landing lama (`.feat-title`, `.sc-name`, `.hero-headline`, dll.).
14. Monospace di nomor dokumen → `tabular-nums`.
15. Glyph ✓/✗ di tombol Disetujui/Ditolak → ikon `Icon.tsx` (`design.md` §4).

Di luar audit ini, dari laporan owner hari yang sama: Profil & Pengaturan di laptop kebuka di tengah layar, bukan di bawah avatar → diperbaiki di #92.

---

## E. Pertahankan / Buang / Uji

**Pertahankan**
- Landing baru (slip, UI asli, karakter clay).
- Dashboard tim sebagai contoh standar.
- Strip angka + tab di Hunting.
- Karakter clay untuk tipe customer, peran, dan empty state.
- Ikon garis di nav.
- Tahap bernomor.

**Buang / sederhanakan**
- Blob peta.
- Kartu map "Per kuadran".
- Glow/gradient "Mulai hunting".
- Warna per angka di strip.
- Kotak di sekitar strip angka.
- Peringatan nomor WA per kartu.
- Tahap 3× per kartu prospek.
- Label "Potensi …" ganda.
- CSS landing lama.

**Uji dulu**
- Pengguna ambil keputusan dari status manual atau Potensi?
- Siapa yang paham "ETB": tim sales bank atau freelancer?
- Biaya blur 6 lapis header di Android kelas bawah.
- Bentuk navigasi Tim di HP (scroll tab vs dikelompokkan) — tes dengan owner.

---

## F. Prinsip

**Standarnya sudah benar — sekarang sapu rata.** Tiap layar lama dimigrasi ke `design.md` satu per satu, dan tiap angka, warna, dan badge punya satu arti yang sama di seluruh app.

---

## Reproduksi

- Worktree dari `origin/main`, `npm ci`, emulator + `next dev` dengan env yang sama seperti `tests/flows/run.mjs` (`ACCESS_OPEN=1`, `NEXT_PUBLIC_EMU_*_PORT`, nilai Firebase palsu), port digeser (offset 700) biar ga bentrok sama sesi lain.
- Akun via Auth emulator; data dari `bigAccount(uid)` + `seedDocs` di `tests/flows/flows.mjs`; peta di-stub (`stubMap`).
- Tiap tempat/tab: klik `.sp-nav-btn` / `.sp-sub-btn`, scroll sampai bawah dulu (konten reveal-on-scroll), lalu screenshot full-page.
- Hitungan: `python3 -I <claude-config>/skills/slop-audit/scripts/count_patterns.py . app components`.
