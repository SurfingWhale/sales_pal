# PRD-021 — Satu funnel: kartu lead yang jelas, lembar kerja, riwayat customer

- **Status:** fase 1 dibangun 30 Okt (§5). Fase 2 menyusul.
- **Terkait:** PRD-008 (skor potensi), PRD-009 (journey prospek), PRD-018 (scroll), PRD-019 (lembar kerja prospek, filter tipe bisnis, chat beruntun), audit desain 29 Okt (`docs/qa-reviews/2026-10-29-design-slop-audit.md`).

## 1. Masalah

> "Magnetic scrollnya bermasalah, user jadi gapaham kalo bisa di scroll sampe bawah, overload informasi, dan card pop up-nya kurang oke padahal bisa di klik."

> "Gw gabingung data gw mana yang belom ke kontak dan statusnya udah dimana, buat leads yang gw dapet dari API dan leads yang gw pitch cold DM satu-satu. Gw punya leads tapi gabisa maintain mana yang datanya lengkap, bahkan gw gabisa intro diri gw." (owner, 30 Okt)

Penyebab yang ketemu di kode:

| Keluhan | Penyebab |
|---|---|
| Ga tau mana yang belum dikontak | Sebelum 29 Okt tiap lead baru atau hasil import dicap "kontak hari ini" (`lastContact`). 152 lead owner terbaca "Kontak: 8 hari lalu" padahal belum pernah disapa, dan tampilan "Belum dihubungi" kosong |
| Ga bisa intro | Script memilih tahap dari `lastContact`, jadi lead yang sama kebuka di **Follow-up**, bukan **Intro** |
| Tab numpuk di atas kartu | Header tanpa latar. Dulu `position: sticky` mati; begitu hidup (`overflow-x: clip`), isi halaman kelihatan tembus di balik tab |
| Scroll terasa "magnetic" | Animasi `sp-rise`: tiap blok naik dan membesar waktu masuk layar |
| Panel kepotong, ga kelihatan bisa di-scroll | Panel kanan punya scroll sendiri, `top: 120` angka mati (header lebih tinggi), dan kedorong ke bawah header di ujung halaman |
| Overload di kartu | Pill status + 5 titik + label + angka + kontak terakhir, dan bisa saling bantah (Cold vs Potensi tinggi) |

## 2. Keputusan owner (30 Okt)

- **Prospek dan Leads ga digabung jadi satu daftar.** Yang diminta: **satu funnel**. Script bisa dipanggil dari Leads, dan lead jadi tempat cari riwayat customer: tawaran apa saja yang sudah masuk.
- **Kartu:** status + kurang apa + satu tombol. Skor potensi pindah ke halaman lead.
- **Klik kartu di laptop:** lembar kerja penuh dengan ✕. Panel samping dihapus.

## 3. Solusi

### 3.1 Posisi lead dibaca dari yang beneran terjadi (`lib/leadStand.ts`)

- Kontak dihitung hanya kalau ada buktinya: baris Outreach, DM Hunting, penawaran, invoice, atau balasan. Lead **Cold** tanpa bukti apa pun dibaca sebagai belum dikontak, walau `lastContact` terisi.
- Ini dihitung saat data dibaca (`withStand`). **Tidak ada data yang ditulis ulang.** Daftar, skor, dan pilihan script semuanya lewat sini, jadi Kontak terakhir +5 yang ga pernah didapat hilang sendiri.
- "Selesai follow-up" sekarang ikut menulis baris Outreach, supaya kontaknya punya bukti.
- Enam posisi, satu lead tepat di satu posisi: **Belum dikontak · Dikontak · Dibales · Penawaran · Deal · Gugur**. Penawaran = ada penawaran *Terkirim* atau *Disetujui*.

### 3.2 Kartu dan saringan

- **Kartu:** nama, tipe · sumber, satu posisi, "Kurang: No HP, Lokasi" kalau ada, jadwal kalau ada, nilai kalau ada, dan satu tombol:

  | Keadaan | Tombol | Ke mana |
  |---|---|---|
  | Belum dikontak | Kirim intro | script, tahap Intro |
  | Dikontak | Follow-up | script |
  | Dibales | Balas | script |
  | Belum ada nomor (bukan lead DM) | Tambah nomor | kolom nomor |
  | Ada penawaran | Lihat penawaran | halaman lead |
  | Deal, Gugur | Buka | halaman lead |

- **Saringan:** satu baris chip funnel yang menempel di bawah header, dengan jumlahnya. Baris chip skor dihapus. Urutan "Skor tertinggi" tetap ada.
- **Lead DM** (Threads, Instagram, atau kontak @handle) tanpa nomor tetap bisa Kirim intro: script-nya di-copy ke DM.

### 3.3 Lembar kerja (`LeadPage`, semua layar)

- Satu halaman, satu scroll: posisi dan kurang apa → aksi cepat → **Pesan berikutnya** → **Riwayat** → brief, lokasi, skor, kontak. Di laptop kolom 720px di tengah dengan ✕; Esc atau ✕ balik ke posisi daftar yang sama.
- **Pesan berikutnya:** script terbaik buat tahapnya (dari script Quick Pitch dan Hunting, peringkat sama dengan `ChatPicker`), tinggal **Pilih script & kirim**.
- **Riwayat** (`lib/leadHistory.ts`): penawaran, invoice, chat, DM Hunting, dan balasan, terbaru di atas, dengan ringkasan "2 penawaran · 1 invoice". Penawaran dan invoice bisa dibuka langsung.

### 3.4 Cari

Kolom cari Leads ikut mencari **nomor dan judul proyek** penawaran serta invoice, jadi "Q-2026-014" menemukan customer-nya.

### 3.5 Scroll

- Header solid. Animasi yang ikut scroll dibuang, kecuali garis tepi header.
- Baris funnel menempel di bawah header (`--sp-head`).
- Tap tab yang sedang aktif → kembali ke atas (PRD-018 §3).

## 4. Data & rules

Tidak ada koleksi atau field baru, jadi rules tidak berubah. `quoted` dan `docs` hanya hidup di memori.

## 5. Fase

1. ✅ **Dibangun 30 Okt:** semua §3.
   - **Tes:** flow baru `satu funnel` (tanggal cap import ≠ kontak, kartu, Kirim intro buka tahap Intro, Riwayat membuka penawaran, cari nomor penawaran); `akun besar` menambah header solid, baris funnel menempel, tap tab → atas. Flow desktop lain pindah dari panel ke lembar kerja.
2. **Berikutnya:**
   - Riwayat ikut menampilkan journey prospek (intro, follow-up dari Threads) buat lead yang asalnya prospek;
   - dari halaman penawaran atau invoice bisa balik ke lead-nya;
   - kolom Tempel di lembar kerja buat melengkapi nomor;
   - Beranda ikut pakai posisi yang sama (PRD-019 §3.2).

## 6. Risiko

- Lead Cold yang pernah dihubungi di luar app dan tidak tercatat akan terbaca "Belum dikontak". Dipilih sengaja: lebih aman menawarkan intro daripada menyembunyikan lead yang belum pernah disapa, dan begitu ada chat tercatat statusnya benar.
- Kesepakatan dengan PRD-019 §3.5 (kirim baru dicatat setelah dikonfirmasi): kalau itu dibangun, `logContact` tetap satu pintu, jadi `withStand` ikut benar.
