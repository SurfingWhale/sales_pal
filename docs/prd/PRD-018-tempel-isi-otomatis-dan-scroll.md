# PRD-018 — Tempel apa saja → kolom terisi; scroll yang tidak bikin kerja dua kali

- **Status:** fase 1 dibangun 30 Okt (§4). Fase 2 (scroll) sebagian lewat PRD-021 §3.5. Fase 3 (Google + AI) menyusul.
- **Terkait:** PRD-009 (unfurl Threads), PRD-012 (Cari bisnis, email dari website), PRD-013 (`readPlace`: membaca link Maps dan koordinat), PRD-015 (izin dan batas Google), PRD-010 dan `docs/standards/design.md` (standar native dan desain).

## 1. Masalah

> "Apakah ada mekanisme parser teks buat auto field? Jadi misal gw paste contact maps, lu auto retrieve datanya kaya di Thread? Kenapa Thread bisa gratis sedangkan yang lain kaya Maps bayar?" (owner, 23 Okt)

> "Soal behaviour scroll apps: kaya contoh si table leads, kalo gw scroll infinite dan kehilangan header, gw kudu kerja dua kali buat bolak-balik ngetap header." (owner, 23 Okt)

## 2. Tempel → isi otomatis

Satu kolom **Tempel** di *Tambah lead* (nanti juga di target Hunting dan Lokasi lead) yang menerima teks bebas atau link. Setelah ditempel, SalesPal mengisi kolom yang bisa dikenali, lalu menampilkan apa saja yang ditemukan sebelum disimpan:

> Ditemukan: **Nama** ✓ · **Alamat** ✓ · **Titik peta** ✓ · **No HP** —

| Yang ditempel | Yang terisi | Biaya |
|---|---|---|
| Link post Threads | nama, @handle, isi post (unfurl yang sudah ada, PRD-009) | gratis |
| Link atau teks bagikan Google Maps | nama tempat (dari link), alamat (dari teks bagikan), titik peta (`readPlace`, PRD-013); link pendek dibuka di server | gratis |
| …lalu "Lengkapi dari Google" | telepon, website, rating, kategori: **1 panggilan Places** (cari nama + titik) | masuk jatah gratis Cari bisnis (900/bulan), hanya untuk yang diizinkan (PRD-015) |
| Link website bisnis | judul dan deskripsi (tag pratinjau), email publik (halaman kontak, cara yang sama dengan Cari bisnis) | gratis |
| Link profil Instagram | @handle; nama kalau tag pratinjau tersedia (IG sering minta login, jadi bisa kosong) | gratis |
| Teks bebas (kartu nama, bio, chat WA) | no HP (`08…`/`+62…` → format wa), email, @handle, link | gratis (aturan pola) |
| Teks berantakan | AI memilah kolom (opsional, bisa dimatikan) | batas AI bulanan (budget PRD-016) |

- **Kenapa Threads gratis, Maps tidak:**
  - Halaman post Threads yang publik memberi *tag pratinjau* (judul + isi), yang dipakai aplikasi chat untuk preview link. Membacanya satu kali per link yang dibagikan itu wajar dan diizinkan.
  - Halaman Google Maps tidak memberi tag itu ke server (halamannya dirender JavaScript), dan ketentuan Google melarang *scraping*. Data terstrukturnya (telepon, website, rating) hanya lewat Places API, yang gratis sampai jatah bulanan lalu berbayar.
  - Jadi dari link Maps, yang gratis adalah nama, alamat, dan titik. Sisanya satu panggilan Places, yang hanya dipakai kalau diminta.
- **Duplikat:** sebelum simpan, cek lead yang sudah ada dengan no HP, ID tempat Google, atau @handle yang sama, lalu tawarkan "Buka yang sudah ada".
- **Sumber dicatat** di lead ("dari tempelan Maps", "dari Threads").

## 3. Scroll yang tidak bikin kerja dua kali

**Prinsip: konten yang bergerak, kontrol tetap di tempat.** Tidak pakai parallax atau scroll "magnetik" sebagai hiasan: berat di HP, bikin pusing, dan melanggar *reduced motion*. *Snap* hanya untuk konten yang memang per halaman (antrean kartu yang sudah ada, PRD-013).

1. **Header tabel dan toolbar menempel** (cari, filter, tab status) di semua list panjang: Leads, Penawaran, Invoice, Prospek.
2. **Judul besar mengecil** jadi bar tipis saat discroll, seperti aplikasi iOS. Tombol utama (mis. *+ Tambah lead*) tetap terjangkau.
3. **Tap tab navigasi yang sedang aktif → kembali ke atas** (perilaku iOS).
4. **Kembali dari detail ke list → posisi scroll dan filter seperti semula.**
5. **List panjang dirender bertahap**, supaya tetap mulus di HP dengan ratusan baris, dan menunjukkan jumlahnya ("120 lead · 40 tampil"). Bukan scroll tanpa ujung yang tidak jelas batasnya.
6. **Tombol "ke atas"** muncul setelah dua layar.

- **Tempatnya:** prinsip dan aturan nomor 1–6 masuk `docs/standards/design.md` sebagai bagian Scroll (dikelola sesi standar desain). PRD ini yang menerapkannya ke Leads, Penawaran, dan Invoice.
- **Tes** (flow `akun besar`, 200 lead):
  - setelah scroll 3 layar, header tabel dan toolbar masih terlihat;
  - tap Leads lagi → kembali ke atas;
  - buka lead lalu kembali → posisi scroll sama;
  - semua di HP (WebKit iPhone 12) dan desktop.

## 4. Fase
1. ✅ **Dibangun 30 Okt:** kolom **Tempel** di *Tambah lead* + cek duplikat.
   - **Membaca:** `lib/paste.ts`, pola saja, langsung di HP:
     - link Maps: nama, alamat dari teks bagikan, titik peta;
     - link Threads dan Instagram: @handle;
     - teks bebas: no HP (`08…`, `+62…`, `wa.me/…`), email, @handle;
     - domain polos (`kopisenja.id`): website.
   - **Lalu ke server, gratis:**
     - post Threads lewat unfurl yang sudah ada;
     - link Maps pendek lewat `/api/geocode`;
     - website dan profil Instagram lewat `/api/site` baru (`lib/siteRead.ts`, dipakai juga oleh Cari bisnis): nama, deskripsi, email publik, nomor WA atau telepon, IG. Batas 60 per hari per orang; hanya alamat publik.
   - **Mengisi:** hanya kolom yang masih kosong; yang sudah diketik tidak ditimpa. Sumber ikut link (GMaps, Threads, DM IG, Lainnya), dan catatan dapat satu baris "Dari tempelan …: link".
   - **Hasil:** "Dari Maps: Nama ✓ · Kontak — · No HP ✓ · Email — · Lokasi ✓". Titik peta dan alamat ikut tersimpan ke lead dan bisa dihapus sebelum simpan.
   - **Duplikat:** `lib/leadDupes.ts` membandingkan no HP (`08…` = `+62…`), email, @handle, atau nama yang sama. Hasilnya peringatan "Mirip lead yang udah ada: X (no HP sama)" dengan tombol **Buka yang udah ada**; bukan blokir, karena dua cabang bisa bernama sama. Indeksnya dibangun sekali per daftar, jadi bisa dipakai import CSV besar.
   - **Belum:** kolom Tempel di target Hunting dan Lokasi lead; ID tempat Google sebagai kunci duplikat (lead belum menyimpannya).
   - **Tes:** flow `tempel lead` (Maps share → kolom + titik peta; website mengisi yang kosong saja; no HP sama → Buka yang udah ada). Lulus di Chromium HP & desktop dan iPhone 12 WebKit, audit HIG 0 temuan.
2. Scroll: header dan toolbar menempel, tap nav aktif → atas, posisi kembali (Leads dulu, lalu Penawaran dan Invoice).
   - ✅ **Lewat PRD-021 (30 Okt):** header solid, animasi ikut-scroll dibuang, baris funnel Leads menempel, tap tab aktif → atas, posisi tetap karena lembar kerja membuka di atas daftar.
   - Belum: Penawaran dan Invoice, judul mengecil, tombol "ke atas".
3. "Lengkapi dari Google" + AI untuk teks berantakan (pakai budget PRD-016).
