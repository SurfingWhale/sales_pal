# PRD-013 — Peta 3D: lokasi tiap lead, dan Beranda yang ga terasa scroll tanpa ujung

- **Status:** Dibangun 22 Okt.
- **Tanggal:** 2026-10-22
- **Konteks:** Owner nyobain Beranda di iPhone. Keluhannya: kartu cuma kotak kosong, ga jelas tipe scroll-nya (mana yang digeser, mana yang dibatasi), jadi tiap fitur terasa scroll tanpa ujung. Owner minta Peta lead naik ke atas, ada pill buat ganti ke peta 3D kayak contoh di video (peta jalan gelap, titik bulat berlabel, kartu muncul dari titik yang ditap), dan tiap lead bisa dicatat titik lokasinya.
- **Terkait:** PRD-008 (Beranda, peta potensi), PRD-010 (standar native), PRD-012 (Cari bisnis).

## 1. Tipe scroll di Beranda (HP)

Halamannya satu scroll vertikal yang pendek dan ada ujungnya. Tiap bagian punya bentuknya sendiri:

| Bagian | Tipe | Batas |
|---|---|---|
| Hunting hari ini | Kotak tetap | — |
| **Peta lead** | Kotak tetap (250px Potensi, 400px Peta 3D) | Geser/zoom cuma di dalam peta |
| Kejar sekarang | Kotak tetap | 5 teratas, sisanya di Leads |
| Cari calon klien, KPI | Kotak tetap | — |
| **Perlu ditindak** | Kartu geser samping, snap, kartu berikutnya ngintip | 10 kartu + kartu "+N · Lihat semua" |
| Lihat semua | Bottom sheet, list scroll di dalamnya sendiri | Semua item |
| Dari mana uangnya | Kotak tetap | 3 teratas + "Lihat semua N sumber" |

## 2. Kartu

- Warna per jenis tugas di kotak ikon dan wash gradien kartu: Hunting oranye, Penawaran biru, Invoice hijau (telat merah), Follow-up ungu, Deal macet kuning tua.
- **Garis tahap**: tiap kartu nunjukin posisinya di alurnya sendiri (Intro → Follow-up → Tertarik → Lead; Dibuat → Terkirim → Disetujui; Terbit → Ditagih → Lunas; …). Tahap yang lewat terisi, yang sekarang dilingkari.
- Hunting, Cari klien, KPI dapat wash warna masing-masing; tinggi semua kartu antrian sama.

## 3. Peta 3D

- Pill **Potensi | Peta 3D** di pojok peta (diingat di HP ini). Potensi = peta skor × nilai yang lama.
- Peta 3D: **MapLibre GL** + tile **OpenFreeMap** (open source, gratis, tanpa API key, ada gedung 3D), dimiringin 55°. Mode gelap: tile dibalik warnanya jadi malam.
- Tiap lead yang punya titik = **pin**: muka bulat 40px di atas ekor pendek, ujung ekor = titik lead (anchor bawah).
  - **Tipe customer ketahuan** (`profile.archetype`, dari impor chat WA atau form Profil) → karakter clay tipenya di muka pin, kepalanya nongol di atas lingkaran, latar warna tipe (Burung Hantu ungu, Singa kuning, Lumba-Lumba biru muda, Kelinci oranye).
  - **Belum ketahuan** → ikon garis putih di atas warna **keluarga kategorinya** (kategori Google dari Cari bisnis, atau kategori isian sendiri): kuliner oranye, kecantikan pink, olahraga & kebugaran hijau, kesehatan merah, penginapan indigo, sekolah & komunitas coklat, toko ungu, jasa & kantor biru. Kategori yang ga kebaca → inisial abu (biru gradien kalau layak dikejar). Kenapa: lead dari Cari bisnis belum punya chat, jadi tanpa ini semua pin abu-abu.
  - Layak dikejar (kuadran "kejar") → cincin biru di luar cincin putih.
  - Lencana skor di pojok kanan atas (biru kalau layak dikejar).
  - Label nama + kategori di kanan pin. Tiap peta berhenti geser/zoom, label yang nabrak label lain atau pin lain disembunyiin, mulai dari lead terbaik (layak dikejar, skor tertinggi); pin yang dipilih selalu tampil labelnya.
- Tap pin → kartu: karakter/inisial 56px, kategori · status, nama, alamat; baris **tipe** (nama tipe + gaya komunikasinya, atau ajakan impor chat WA kalau belum ketahuan); skor + bar + nilai; **Buka lead**, **Rute** (Google Maps), **Chat** kalau ada nomor.
- Gambar karakter diambil dari `animalSrc()` di `components/AnimalArt.tsx`, satu sumber dengan bagian app lain (PRD-010 karakter tinggal ganti di situ).
- Lead tanpa titik: chip "N belum ada lokasi · Atur" → buka lead pertama yang belum.
- Library-nya baru dimuat waktu Peta 3D dibuka (dynamic import), jadi Beranda tetap ringan. Tanpa WebGL: pesan jelas, Potensi tetap jalan.
- Kredit © OpenStreetMap · OpenFreeMap selalu tampil (wajib dari lisensi).

## 4. Lokasi lead

- `leads/{id}.geo = { lat, lng, by }`, `by` ∈ `maps | alamat | pin | gps | link`; `address` teks. Ga ada perubahan rules (dokumen lead ga dibatasi bentuknya).
- **Cari bisnis** langsung nyimpen titik dari Google (field `places.location` ditambah di field mask).
- Di detail lead (panel desktop dan halaman HP) ada baris **Lokasi**: alamat, sumber titiknya, **Rute**, **Atur lokasi / Ubah** → sheet:
  1. **Cari alamat** → `POST /api/geocode` (login wajib, kuota `GEOCODE_DAILY_LIMIT` bawaan 100/hari). Pakai Google Places kalau `GOOGLE_PLACES_API_KEY` ada (paling kenal nama usaha), **cuma buat yang boleh pakai key** (`mayUse(caller, "geocode")`, PRD-015) dan selama jatah bulanan semua akun belum habis (`takeMonthly("geocode")`, `GEOCODE_MONTHLY_LIMIT` bawaan 4.500 < 5.000 gratis Text Search Pro; panggilan yang gagal dikembalikan). Tanpa key, ga boleh, jatah habis, atau Google nolak: **gratis lewat OpenStreetMap**, Photon dulu lalu Nominatim, dibatasi ke Indonesia. OSM bagus buat jalan/kelurahan/tempat terkenal, tipis buat UMKM kecil; hasilnya diberi kredit "Data © OpenStreetMap" + saran tempel link. Pilih hasil → tersimpan.
  2. **Tempel link Maps** (tombol baca clipboard, atau tempel langsung di kolom): dibaca di HP tanpa server kalau link/teksnya udah ada titiknya: link Google Maps panjang (`!3d…!4d…`, lalu `@lat,lng`), `?q=lat,lng` (lokasi WhatsApp), `?query=`, Apple Maps `coordinate=`, OpenStreetMap `#map=` / `mlat`, koordinat polos ("-6.175392, 106.827153", minimal 4 desimal biar harga/no HP ga kebaca) dan derajat-menit-detik. **Link pendek** (`maps.app.goo.gl`, `goo.gl/maps`, `maps.apple`) dibuka di server (browser ga bisa baca redirect-nya): cuma host itu yang di-request, maks 4 lompatan, titik dibaca dari URL tujuan; kalau tujuannya cuma nama/alamat (`?q=`), itu yang dicari. Teks share sheet di sekitar link (nama + alamat) jadi alamat lead. Tersimpan sebagai `by: "link"` → "dari link peta".
  3. **Pakai lokasi saya sekarang** (GPS HP, buat yang lagi di tempat klien).
  4. **Geser peta** sampai pin merah pas → **Pakai titik ini**.
  5. **Hapus lokasi**.

## 5. Tes

- Flow `lokasi lead`: cari alamat (respon di-mock) → titik tersimpan "dari alamat" → geser peta → "ditandai di peta" → tempel link Google Maps (event paste) → "dari link peta".
- Flow `akun besar`: separuh lead punya titik; Peta 3D nampilin pin, pin dibuka jadi kartu dengan Rute, chip lead tanpa lokasi muncul; antrian Perlu ditindak dibatasi, sheet scroll sendiri.
- Tile di tes diganti style polos (`stubMap`), jadi tes ga bergantung internet.

## 6. Sisa

- Titik di peta Potensi versi desktop masih 28px; di iPad (layar sentuh) di bawah 44pt. Disengaja karena 200 titik 44px bakal tumpang tindih; rencana: tap area kosong → pilih titik terdekat.
- Foto tempat di pin (kayak di video) butuh Places Photos (berbayar per foto): fase berikutnya, opsional.
- Clustering pin kalau ratusan lead di satu kota (pin karakter lebih besar dari titik lama, jadi lebih cepat numpuk).
- **Logo asli bisnis** di muka pin dan kartu: urutan logo → karakter → inisial. Butuh field `logo` di lead + tempat ngunggah/nempel URL-nya.
- **Bagikan dari Google Maps langsung ke SalesPal** (share target PWA): pilih lead → titik tersimpan, tanpa salin-tempel.
