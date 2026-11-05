# SalesPal — Product Master Roadmap

- **Status:** disetujui owner, 5 Nov 2026. Dokumen ini mengalahkan urutan nomor PRD. Kalau sebuah PRD bilang lain soal prioritas, yang berlaku di sini.
- **Arah:** SalesPal adalah sistem operasi penjualan, bukan pencatat prospek: Lead → Percakapan → Kebutuhan → Penawaran → Closing → Uang masuk → Evaluasi.
- **Prinsip satu kalimat:** jangan optimalkan untuk mengirim lebih banyak pesan. Optimalkan untuk lebih banyak transaksi yang menguntungkan dari tiap prospek yang ditemukan.

## 1. Cara memilih prioritas

Tiap pekerjaan dinilai pakai tiga ukuran:

1. **Revenue impact:** menambah peluang dapat klien atau closing?
2. **Daily utility:** membantu kerja jualan sehari-hari?
3. **Cost & complexity:** bisa selesai dengan Next.js, Firebase, dan budget Rp 0?

Tidak semua PRD yang belum selesai harus dilanjutkan. Ada yang diselesaikan, ada yang dipangkas, dan ada yang belum waktunya.

## 2. Urutan

| Tingkat | PRD | Isi |
|---|---|---|
| **P0 — mesin pendapatan** | 021 | Satu funnel lead dari prospek sampai lunas |
| | 024 | Script satu sistem: brand, channel, keberatan, konteks |
| | 025 | Otak Pesan: pesan paling masuk akal buat orang ini sekarang |
| | 017 | Pricelist & penawaran |
| | 011 | SPK, invoice, dokumen |
| | 022 Fase 3 | Biaya alat. **Selesai sebelum penawaran dipakai serius**, supaya harga jual tidak memakan margin |
| **P1 — produktivitas hunting** | 019 | Satu kolom cari dan lembar kerja prospek |
| | Peta & Quick Pitch | Memilih peluang dan sudut pendekatan |
| | 012 | Cari bisnis, fase lanjut tanpa layanan berbayar |
| **P2 — ukur & intelijen** | 005 | Funnel hulu ke hilir, internal dulu |
| | 014 B | Import Meta Ads |
| | 018 Fase 3 | Baca Google + AI |
| **Ditahan** | MCP + Discord | Lihat §5 |
| **Nunggu pihak luar** | 003 | Radar Threads, setelah Meta App disetel |
| | 016 | Outreach otomatis, setelah ada budget dan daftar opt-in |

## 3. Keputusan per PRD

### PRD-021 — Satu funnel lead (P0, fondasi)

- Tahap usulan: Baru → Dikontak → Merespons → Terkualifikasi → Penawaran → Negosiasi → Menang / Gugur → Lunas.
- **Menang ≠ Lunas.** Setuju penawaran belum tentu sudah bayar.
- **Gugur wajib punya alasan:** harga, tidak ada respons, pilih kompetitor, kebutuhan tidak cocok, atau waktu tidak sesuai.
- **Perlu dicocokkan dulu:** posisi sekarang (`lib/leadStand.ts`, `GLOSSARY.md`) adalah Belum dikontak, Dikontak, Dibales, Penawaran, Deal, Gugur, dan dibaca dari yang beneran terjadi. Usulan menambah Terkualifikasi, Negosiasi, dan Lunas. Lihat §7 nomor 1.

### PRD-024 — Script satu sistem (P0, fondasi Otak Pesan)

- Brand jadi entitas. Script adalah entitas utama. Keberatan jadi koleksi sendiri.
- Field: channel (WhatsApp, Instagram, lainnya), nada (santai, profesional, persuasif), konteks (intro, follow-up, harga, keberatan, closing), status (draft, aktif, arsip).
- Satu editor. Pratinjau pakai data lead asli.
- **Brand Profile satu sumber,** dipakai bersama PRD-011.
- AI generate belum. Pastikan dulu sistem bisa menemukan template yang tepat dari konteks.

### PRD-025 — Otak Pesan (P0)

- Urutan fase berikut:
  1. Baca tahap funnel.
  2. Baca histori percakapan.
  3. Kenali keberatan dan kebutuhan.
  4. Cari script yang cocok.
  5. Beri alasan.
  6. Satu pesan utama, plus alternatif kalau perlu.
- Berbasis aturan dulu, AI belakangan.
- **Skor kecocokan script bukan peluang closing.** Itu dua metrik berbeda dan tidak boleh tampil seolah sama.

### PRD-017 — Pricelist & penawaran (P0)

- **BeUntamed ikut pricelist pusat, dengan override per brand.** Tidak ada dua pricelist terpisah.
- Paket standar diwariskan dari pusat. Brand boleh punya harga khusus.
- Tiap penawaran menyimpan **snapshot harga** saat dibuat, jadi perubahan pusat tidak mengubah penawaran lama.

### PRD-011 — Bisnis & dokumen (P0)

| Pertanyaan | Keputusan |
|---|---|
| Logo dan nama | Satu sumber: Brand Profile |
| Kop dokumen | Diambil dari Brand Profile |
| Termin bayar | Default DP 50%, pelunasan 50% H-1, bisa diubah per kesepakatan |
| NPWP | Opsional |
| SPK | Naik prioritas, di atas mempercantik invoice |

- **Brand Profile:** nama bisnis, logo, alamat, telepon, email, identitas pajak, rekening, penandatangan.
- **SPK minimal:** lingkup kerja, deliverables, jadwal produksi, hak pakai foto, revisi, pembatalan, jadwal bayar, persetujuan kedua pihak.

### PRD-022 Fase 3 — Biaya alat (P0, scope kecil)

- Rumus awal: biaya alat per job = penyusutan per bulan ÷ job per bulan.
  - Contoh ilustrasi: kamera Rp 15 juta, masa pakai 60 bulan → Rp 250.000 per bulan, 10 job → Rp 25.000 per job.
- Masa pakai, nilai sisa, servis, dan intensitas pakai dibedakan kalau mau lebih akurat.
- **Angka asli belum ada.** Baseline-nya satu paket jasa yang benar-benar dijual owner. Jangan dikarang.

### PRD-019 — Lembar kerja prospek (P1)

| Item | Prioritas |
|---|---|
| Satu kolom cari: nama bisnis, nama lead, nomor, alamat, kategori | P0 dalam P1 |
| Saklar Data saya / Bisnis baru | P0 dalam P1 |
| Cluster peta | P0 dalam P1 |
| Ikon Maki | P1 |
| Filter kategori | P1 |
| Filter kategori per hari | P2 |

### Peta & Quick Pitch (P1)

- **Peta = tempat menjelajah. Quick Pitch = bantuan memutuskan.**
- **Peta wajib:** layar penuh, Back aman, 2D sebagai default, cluster, ikon Maki, cari lead sendiri tanpa API, bottom sheet.
- **Quick Pitch wajib menampilkan satu peluang:** nama bisnis, kategori, status, alasan, satu sudut pendekatan, tombol buka lead atau mulai hunting. Bukan sepuluh rekomendasi sekaligus.

### PRD-012 — Cari bisnis (P1)

- **Pertahankan:** Google Places dan cek dobel.
- **Tunda:** verifikasi email otomatis, sumber pihak ketiga, enrichment AI. Tidak bergantung pada scraping, dan email hasil cari tidak dianggap terverifikasi.
- **Tambah: status verifikasi lead.** Isinya: Belum diverifikasi, Data Maps ada, Kontak ditemukan, Dicek manual, Tidak valid.
- **Kuota:** 900 panggilan per bulan, sekitar 30 per hari. Jangan habis buat mencari ulang bisnis yang sudah tersimpan.

### PRD-005 — Funnel hulu ke hilir (P2)

- Internal dulu. White-label menyusul.
- Klien pilot: yang transaksinya bisa dilacak dari awal sampai bayar.
- **Batas tiket besar: Rp 5 juta.** Ini angka awal untuk operasional, bukan ukuran kerumitan.
- Objek dipisah: Konten, Lead, Percakapan, Deal, Invoice, Pembayaran. Satu klien bisa datang dari beberapa konten tanpa jadi lead ganda.

### PRD-014 B — Import Meta Ads (P2, tunda)

- Belum perlu, karena belum ada iklan aktif.
- Cukup field manual: `lead_source`, `campaign_name`, `ad_spend`, `conversion_status`.

### PRD-018 Fase 3 — Baca Google + AI (P2, tunda)

- Yang dipertahankan: tempel chat, baca teks, scroll ke pesan yang relevan, kenali nama dan kebutuhan secara lokal kalau bisa, dan sambungan ke Script Intelligence.
- AI reader menunggu sampai alur tempel chat → analisis → rekomendasi dipakai rutin.

## 4. Sprint

Ini urutan kerja, bukan estimasi waktu.

| Sprint | Isi |
|---|---|
| 1 — Satukan sistem penjualan | 021 Fase 2 · 024 brand entity + satu editor · 019 satu kolom cari · audit status antarhalaman |
| 2 — Percepat konversi | 025 Fase B–F bertahap · 017 BeUntamed (override) · Quick Pitch · pratinjau script pakai lead asli |
| 3 — Amankan transaksi dan margin | 022 biaya alat · 011 SPK · termin bayar · invoice dengan snapshot harga |
| 4 — Evaluasi dan optimasi | 005 laporan internal · 012 kuota dan status verifikasi · evaluasi kebutuhan 014 dan 018 |

## 5. MCP + Discord: ditahan

| Fitur | Keputusan |
|---|---|
| Approval workflow, cek DNC | Pertahankan, sudah aman (P0 selesai) |
| Link Discord | P2 |
| Notifier approval | P2 |
| Kirim pesan otomatis | Tetap ditahan |

Infrastruktur agent tidak dikembangkan lebih jauh sebelum aplikasi utamanya stabil.

## 6. Metrik yang harus ada

Aktivitas bukan hasil. 100 pesan terkirim tidak otomatis lebih baik dari 30 pesan yang menghasilkan 5 percakapan berkualitas.

| Metrik | Menjawab |
|---|---|
| Leads discovered | Berapa prospek ditemukan |
| Contact rate | Berapa yang berhasil dihubungi |
| Response rate | Berapa yang merespons |
| Qualification rate | Berapa yang punya kebutuhan nyata |
| Proposal rate | Berapa yang dapat penawaran |
| Closing rate | Berapa yang setuju transaksi |
| Payment conversion | Berapa yang benar-benar bayar |
| Average deal value | Nilai rata-rata transaksi |
| Gross margin | Untung setelah biaya langsung, termasuk biaya alat |
| Follow-up compliance | Berapa yang ditindaklanjuti sesuai jadwal |

## 7. Belum boleh dikerjakan

1. Fitur AI sebelum alur tanpa AI matang.
2. Dashboard yang banyak angka tapi tidak membantu memutuskan.
3. Sumber prospek baru tanpa menjaga kualitas dan duplikasi.
4. Otomatisasi WhatsApp sebelum persetujuan dan kontrolnya matang.
5. Integrasi Discord hanya karena agent sudah tersedia.
6. Laporan klien sebelum transaksi dan biaya produksi tercatat benar.

## 8. Yang masih perlu dicocokkan dengan kode

Usulan di atas ditulis dari ringkasan, jadi tiga hal harus dicek ke implementasi sebelum dibangun:

1. **Tahap funnel (021).** Posisi sekarang dibaca dari kejadian nyata (kontak, balasan, penawaran, deal). Terkualifikasi dan Negosiasi belum punya kejadian yang bisa dibaca, jadi perlu ditentukan: penjual menandai sendiri, atau diturunkan dari data, misalnya kebutuhan sudah tercatat → Terkualifikasi, dan penawaran direvisi → Negosiasi. Lunas bisa dibaca dari invoice.
2. **`{bisnis}` (024).** Di app, `{bisnis}` adalah nama bisnis **penjual**. Nama bisnis **prospek** perlu placeholder sendiri, misalnya `{usaha}`, supaya dua arti tidak tercampur.
3. **Brand Profile (011, 024, 017).** Sekarang ada `settings/business` satu per ruang kerja, dan brand cuma label di script. Brand Profile berarti satu struktur `settings/brands` yang dipakai kop, script, dan override harga.
