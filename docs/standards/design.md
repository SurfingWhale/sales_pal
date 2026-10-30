# Standar visual — SalesPal

Berlaku buat **semua perubahan UI**, bareng [native.md](native.md) (yang itu ngatur
perilaku: tap, dialog, kecepatan; yang ini ngatur **hierarki dan detail**).
Token-nya di `app/globals.css` (`--fs-*`, `--sp-*`, `--r-*`).

## Kenapa ada

Kritik yang owner bawa (22 Okt): UI buatan AI kerasa *slop*. Ciri-cirinya:
- semua dibungkus kotak;
- ga ada hierarki ukuran;
- detailnya hilang: garis, grid, gambar vektor.

Diukur di repo ini (22 Okt): **20 ukuran huruf berbeda** (9–34px, termasuk 12.5 dan 13.5). Mayoritas 12–13px, jadi hampir semua teks sama kecilnya. Ada **10 radius sudut** dan **82 pemakaian `card`**. Dashboard tim punya 8 kotak sama besar tanpa satu pun yang jadi fokus.

## 1. Hierarki: satu yang paling penting per layar

**Skala huruf: cuma token ini, ga ada ukuran lain**

| Token | Ukuran | Dipakai buat |
|---|---|---|
| `--fs-hero` | 40 (HP 34) | **Satu** hal per layar: angka utama atau kalimat utama ("39 hal perlu ditindak hari ini.") |
| `--fs-title` | 22 | Judul layar |
| `--fs-section` | 17 | Judul seksi |
| `--fs-body` | 15 | Isi, baris daftar, angka di tabel |
| `--fs-meta` | 13 | Keterangan, label, perubahan ("▲ +3 vs sebelumnya") |
| `--fs-micro` | 11 | Sumbu grafik, badge. **Batas bawah.** |
| `--fs-num-hero` | 64 (HP 52) | Angka hero dalam `.num` (Bebas Neue sempit, jadi lebih gede) |
| `--fs-num` | 32 (HP 28) | Angka di strip angka |

Kolom isian tetap 16 (native K2). Angka besar pakai `.num` (Bebas Neue). Tebal: 700 judul, 600 seksi, 400–500 isi.

**Aturan:**
- **Satu hero per layar.** Kalau semua penting, ga ada yang penting.
- **Cuma ukuran dari token.** Satu seksi atau kotak maksimal 3 ukuran. Ukuran pecahan (12.5, 13.5) ga ada.
- **Urutan baca = urutan ukuran.** Kesimpulan dulu (gede), rinciannya belakangan (kecil).
- **Angka utama + kalimat konteks.** "Rp12,4 jt uang masuk bulan ini, naik 18% dari bulan lalu" lebih kebaca daripada 8 kotak angka.

## 2. Kotak: cuma kalau ada alasannya

Kotak (`card`) **boleh** buat:
1. **Satu benda yang ditap utuh** (baris lead, kartu prospek, kartu template).
2. **Benda yang bisa dipindah, dipilih, atau ditutup** (kanban, lembar, dialog).
3. **Isi yang konteksnya beda dari halaman** (peringatan, kutipan post orang).

Kotak **jangan** dipakai buat:
- **Tiap angka.** Pakai **strip angka**: angka berjejer, dipisah garis vertikal 1px.
- **Seksi informasi.** Pakai judul seksi + jarak 32 + garis rambut di atasnya.
- **Kotak di dalam kotak.** Maksimal satu tingkat.
- **Daftar.** Baris dipisah garis rambut, bukan kotak per baris.

## 3. Jarak & sudut

- **Jarak:** 4 · 8 · 12 · 16 · 24 · 32 · 48 (`--sp-1`…`--sp-7`).
  - Antar seksi 32 (HP 24).
  - Dalam grup 8–12.
  - Grup yang nyambung lebih rapat daripada grup yang beda.
- **Sudut:** cuma 4 nilai.
  - `--r-s` 8: chip, kontrol kecil.
  - `--r-m` 12: kartu, isian.
  - `--r-l` 20: lembar, dialog.
  - `999`: pil.

## 4. Detail: yang bikin kerasa dibuat orang

- **Garis rambut.** 1px `--app-border` sebagai pemisah, bukan bayangan atau kotak. Garis yang lebih tebal (`--app-line-strong`) cuma di bawah kepala tabel.
- **Grafik:**
  - grid horizontal tipis, 3 garis (0, tengah, atas);
  - sumbu 11px;
  - satu warna per arti (`--heat-*` biru);
  - label langsung di titik penting;
  - tooltip di hover/tap;
  - ga ada grafik tanpa angka sumbu.
- **Angka:** `tabular-nums` di semua tabel dan angka yang dibandingin. Rupiah rata kanan. Perubahan selalu pakai panah + kata (▲ / ▼ / "sama"), bukan warna doang.
- **Ikon:** satu set garis (`components/Icon.tsx`), stroke 1.8, ukuran 16 / 20 / 24. **Emoji bukan ikon.** Emoji boleh di isi pesan, ga boleh di tombol atau navigasi.
- **Latar vektor halus:** di hero dan empty state boleh pola titik/grid tipis (`.sp-grid-bg`, kontras ≤ 4%). Di layar kerja (daftar, form) ga ada.
- **Ilustrasi:** karakter clay owner (`public/archetypes`, `public/guild`) buat empty state, peran, dan tipe customer. Ilustrasi vektor baru = aset dari owner/desainer, bukan digambar AI.
- **Warna teks:** token (`--brand-text`, `--ok`, `ink()`), bukan warna mentah. Lihat native.md.

## Scroll

Konten yang bergerak, kontrol tetap di tempat (PRD-018 §3, PRD-021 §3.5).

- **Ga ada yang ikut gerak sama scroll** selain garis tepi header. Ga ada parallax, ga ada blok yang naik pas masuk layar: bikin halaman terasa "magnetic" dan orang ga yakin masih bisa di-scroll.
- **Apa pun yang menempel punya latar solid**, dan offset-nya `var(--sp-head)`, bukan angka mati. Isi halaman ga boleh kelihatan tembus di balik tab.
- **Satu layar, satu scroll.** Hindari panel dengan scroll sendiri di dalam halaman yang juga scroll: orang ga tau ada isi di bawahnya.
- **Tap tab yang aktif → ke atas.** Buka detail di atas daftar, jadi tutup = posisi yang sama.
- *Snap* cuma buat konten yang emang per halaman (antrean kartu).

## 5. Cek sebelum PR (visual)

- [ ] Ada **satu** hero, dan dia memang hal paling penting di layar itu
- [ ] Semua ukuran huruf dari token §1; ≤ 3 ukuran per seksi
- [ ] Tiap kotak punya alasan dari §2; ga ada kotak di dalam kotak
- [ ] Daftar dipisah garis rambut, bukan kotak per baris
- [ ] Grafik punya grid tipis, angka sumbu, dan tooltip
- [ ] Angka pakai `tabular-nums`; perubahan pakai panah + kata
- [ ] Screenshot HP (390) dan laptop (1280) dicek sebelum/sesudah, terang dan gelap

## 6. Contoh: Dashboard tim (22 Okt)

**Sebelum:** 8 kotak angka sama besar (24px semua), grafik dan funnel masing-masing di kotak, per sales = kotak per orang.

**Sesudah:**
- Hero "**Rp X uang masuk** · N closing", dengan kalimat perubahan.
- Strip 6 angka tanpa kotak.
- Grafik & funnel di bawah judul seksi, dipisah garis rambut.
- Per sales jadi tabel bergaris rambut.
