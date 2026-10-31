# PRD-022 — Satu hari kerja

- **Status:** rencana, 31 Okt. Keputusan owner sudah masuk (§3). Belum dibangun.
- **Peran dokumen ini:** tulang punggung. Fitur baru mengikuti alur di sini, bukan sebaliknya.
- **Terkait:** PRD-009 (journey), PRD-012 (Cari bisnis), PRD-016 (outreach), PRD-017 (biaya), PRD-018 (tempel, scroll), PRD-019 (lembar kerja, kirim dikonfirmasi), PRD-021 (posisi lead), QA-4 di Notion, `GLOSSARY.md`, `docs/qa-reviews/2026-10-31-audit-satu-hari-kerja.md`.
- **Desain per komponen:** artifact [Hunting Workspace](https://claude.ai/artifact/FAsiHgRjGGtAu1oMBs222F) (private).

## 1. Masalah

> "Hunting ini belom dipikirkan dengan baik PRD-nya. Kayanya masalah tiap fitur ga ditulis dengan baik." (owner, 30 Okt)

18 dokumen PRD menyebut Hunting, tapi tidak ada yang menulis satu hari kerja dari awal sampai akhir. PRD-002 memikirkan DM Threads, PRD-012 menambah bisnis dari Maps, dan keduanya tidak pernah disambung. Hasilnya tiap fitur jalan sendiri-sendiri, dan yang terasa baru kelihatan waktu dipakai.

Aturan kerja mulai sekarang: fitur berangkat dari skenario owner dengan angka aslinya, di-grill sebelum dibangun, dan skenario itu jadi tes.

## 2. Satu hari kerja

Satu orang, studio foto kecil, jualan sambil kerja motret.

| Waktu | Yang dilakukan | Harus terasa |
|---|---|---|
| Pagi | Buka Hunting. Lihat siapa yang bales, balas dulu | Satu layar, tanpa nyari |
| Siang | Tambah bisnis baru dari Maps, Excel, atau tempelan | Yang sudah ada kelihatan jelas, tanpa dobel |
| Siang | Kirim intro satu per satu, 10–12 orang | Dari satu orang langsung ke orang berikutnya |
| Kapan saja | Yang tertarik dikirimi penawaran | Harga benar, modal masuk akal |
| Sesudah deal | Bikin invoice, catat DP dan pelunasan | Dari penawaran, tanpa ngetik ulang |
| Sore | Lihat berapa yang kekirim dan dibales hari ini | Satu angka jujur |

**Batas harian:** target bawaan 12 chat baru per hari kerja, bukan 20 (§5.3).

## 3. Keputusan owner (30 Okt)

| # | Keputusan |
|---|---|
| Q1 | "Script call" = script pesan yang dipanggil dari lead. Naskah telepon tidak dibangun sekarang |
| Q2 | Ada tombol **Tandai udah dikontak** buat kontak di luar app |
| Q3 | Tanda sudah dikontak disimpan di lead, supaya semua orang di guild melihat hal yang sama |
| Q5 | Dropdown Cold/Warm/Hot keluar dari daftar. Gugur jadi chip terakhir di baris funnel |
| Q6 | Penawaran Disetujui = Deal. Ditolak = balik ke posisi sebelumnya |
| Q7 | Urutan bawaan: Perlu dikerjain. Skor tertinggi tetap jadi pilihan |
| Q8 | Tombol Balas hanya kalau giliran kita. Kalau tidak, Follow-up |
| Q9 | Lead yang punya email tanpa HP tetap bisa Kirim intro, manual |
| Q10 | Urutan kerja: stabilkan → biaya alat → chat → peta. Tiap bagian di-grill dulu |
| Q11 | Daftar tetap dua, pintu kerja satu: Hunting membaca Prospek dan Leads |
| Q12 | Tambah lead jadi satu pintu: Tempel, Manual, Excel, Cari di Maps |
| Q13 | Cari di Maps: Pilih semua yang belum ada, yang sudah ada dipisah, tanpa centang otomatis |

Q4 ditarik dan diganti Q11.

## 4. Hunting Workspace (QA-4)

Mengikuti desain owner, dengan empat perubahan yang dijelaskan di artifact: editor template memakai Simpan, ada langkah konfirmasi setelah WhatsApp, Island ciut secara bawaan, menu bawah HP tetap lima.

- **Activity Island:** ringkasan hari ini, kalender minggu, heatmap 17 minggu. Sumbernya `lib/activity.ts`. Kalender job tampil sebagai Jadwal.
- **Tab Prospek · Leads · Performa:** kolom cari membaca Prospek dan Leads. Hasil di daftar lain ditawarkan, bukan malah membuat prospek baru.
- **Pesan:** satu panel menggantikan lembar kerja, tanpa modal di atas modal. Di HP dua layar berurutan.
- **Script Management:** halaman sendiri. `pitchTemplates` mendapat `workflow` dan `brand`. Template lama dibaca Semua.
- **Konfirmasi kirim:** app tidak bisa tahu pesan terkirim, karena `wa.me` hanya membuka WhatsApp. Setelah balik, penjual konfirmasi, lalu lanjut ke orang berikutnya. Ini menggantikan PRD-009 D1 dan menjalankan PRD-019 §3.5.

Lembar kerja prospek (PRD-019 §3.4) dan lembar kerja lead memakai pola yang sama.

## 5. Biaya: bisa jualan murah?

**Budget sekarang Rp 0 (keputusan owner, 31 Okt).** Semua jalan manual sampai ada uang, jadi tidak ada fitur berbayar di rencana ini. Rp 300.000 per bulan adalah rencana nanti. Urutan bayarnya ada di halaman Notion *Budget SalesPal*. Rincian dan sumber harga ada di audit.

| Pos | Sekarang | Kalau ada uang, per bulan |
|---|---|---|
| WhatsApp | Rp 0, manual | Rp 0 |
| Firebase Spark | Rp 0, berhenti di batas, tidak menagih | Rp 0 |
| Cari di Maps | Rp 0 sampai 900 panggilan, dikunci di app | Rp 0 |
| Domain | Belum, pakai alamat `vercel.app` | ±Rp 18.000 |
| Email | Manual, sesekali | ±Rp 11.000–18.000 buat domain kedua |
| Baca gambar | Dimatikan: tempel teks atau Excel | ±Rp 6 per scan lewat Gemini |
| Vercel Pro | Belum | Rp 363.000: sendirian melewati Rp 300.000 |

### 5.1 Hosting
Vercel Hobby tidak boleh dipakai komersial. Paket yang aktif belum terbaca lewat API. Selama budget Rp 0, app tetap di paket yang sekarang dan risikonya diterima sementara. Owner mengecek paketnya di dashboard.

### 5.2 Email
PRD-016 merencanakan Resend. Resend, SES, Mailgun, Postmark, dan Brevo melarang cold email atau mewajibkan opt-in. Selama budget Rp 0 email dikirim sendiri sesekali. Kalau nanti dipakai serius: mailbox biasa di domain kedua, maksimal 20 per hari setelah pemanasan 3–4 minggu.

### 5.3 WhatsApp
Tidak ada angka aman resmi. Satu vendor melaporkan peringatan di 300 chat tak terbalas per bulan, jadi perencanaannya 10–14 chat baru per hari kerja. Semua dikirim manual. API resmi nanti hanya buat yang sudah opt-in: Rp 586 per pesan marketing, jadi Rp 300.000 setara ±460 pesan termasuk PPN.

### 5.4 Yang membatasi
Bukan uang, tapi jumlah kontak aman per hari dan follow-up. Dengan 12 chat per hari kerja, sebulan ±260 kontak. Hitungan buat harga paket Rp 450.000:

| Tertarik | Jadi deal | Deal per bulan | Omzet |
|---|---|---|---|
| 1% | 1 dari 3 | ±1 | ±Rp 450.000 |
| 3% | 1 dari 3 | ±3 | ±Rp 1.350.000 |
| 5% | 1 dari 3 | ±4 | ±Rp 1.800.000 |

Angka tertarik dan jadi deal adalah asumsi. Tolok ukur lokal tidak ditemukan, jadi 100–200 kiriman pertama adalah pengukuran, bukan ramalan. Satu deal menutup biaya sebulan.

## 6. Biaya alat (Q10 nomor 2)

Skenario owner: kamera 15 juta, paket 300 ribu. Sekarang kolom Biaya modal menerima 15 juta dan margin jadi -4900%, sementara penyusutan hanya ada di katalog komponen dan tidak bisa dipasang ke paket.

Arah, di-grill dulu dengan satu paket asli owner:
- Paket bisa dipasangi komponen, dan modalnya dihitung dari situ.
- Angka yang jauh di atas harga jual menawarkan "Ini alat? Hitung per job".
- Tool foto dan CRM yang dicek tidak ada yang menyebar biaya alat ke per job, jadi ini bisa jadi pembeda SalesPal.

## 7. Data

Tidak ada koleksi baru.

| Tempat | Tambahan | Buat |
|---|---|---|
| `leads` | `contactedAt` | Q2, Q3: bukti kontak yang sama bagi semua orang di guild |
| `pitchTemplates` | `workflow`, `brand`, `archived`, `isDefault` | Script Management |
| `outreach`, `hunts` | status kirim dikonfirmasi | Log dan heatmap jujur |
| `services` | `parts` (komponen dan jumlahnya) | Biaya alat |

Rules: koleksi di atas sudah tertutup. `firestore.rules` tetap dites per peran sebelum deploy.

## 8. Fase

| Fase | Isi | Selesai kalau |
|---|---|---|
| 0 | Temuan P1 audit: script salah tahap, tiga tombol, Mereka bales, warna; Q2, Q3, Q5, Q7, Q8, Q9; Scan gambar tampil sebagai "belum aktif", arahkan ke tempel teks atau Excel | Flow `sehari kerja` lulus dengan langkah baru |
| 1 | Pesan + Script Management + konfirmasi kirim (QA-4 Chat) | Intro 12 lead beruntun tanpa balik ke daftar |
| 2 | Tambah lead satu pintu, Pilih semua, cek dobel di Maps dan Excel (Q12, Q13) | Beda ejaan dengan nomor sama ketahuan |
| 3 | Biaya alat | Kamera 15 juta menghasilkan margin masuk akal |
| 4 | Hunting Workspace: Island, tab Leads, cari gabungan (Q11) | Cari nama lead di Hunting ketemu |
| 5 | Performa ringkas, rekap harian jujur | "Berapa kekirim hari ini" satu angka |
| 6 | Peta: cari, layar penuh, pin (PRD-019 §3.1) | Di-grill dulu |
| 7 | Email, tulis ulang PRD-016 | Nunggu budget, di-grill dulu |

Fase 1 sebelum Fase 4 karena Hunting tidak berguna kalau kirimnya belum enak.

## 9. Tes

Flow `sehari kerja` menjalankan hari di §2 dengan akun seukuran milik owner dan mengukur tap tiap pekerjaan. Sekarang ia hanya gagal kalau ada jalan buntu. Tiap fase menambah syaratnya, misalnya "intro 12 lead maksimal 2 tap per orang".

Sebelum PR: `PROD=1`, karena CI memakai production build dan `next dev` tidak menangkap crash minifier.

## 10. Risiko dan keputusan terbuka

- **Hosting:** §5.1.
- **Target harian:** 12 itu perkiraan dari laporan vendor. Sesuaikan kalau ada peringatan dari WhatsApp.
- **Hukum:** kirim iklan elektronik diizinkan PP 80/2019, tapi nomor HP pribadi termasuk data pribadi di UU PDP. PP 33/2026 berlaku 16 Januari 2027. Ada risiko abu-abu buat cold chat ke nomor pribadi, jadi lead perlu status Jangan dihubungi dan penghapusan yang cepat. Ini bukan nasihat hukum: tanyakan ke ahli hukum sebelum outreach dibuat lebih masif.
- **Scan gambar:** mati selama budget Rp 0. Kalau nanti dinyalakan lewat Gemini, pakai yang berbayar: teks klien dikirim ke pihak ketiga, dan paket gratisnya memakai konten buat melatih produk.
- **App Check:** keputusan terpisah karena menyentuh tiga situs.
- **Draft pesan:** "Simpan draft" di mock ditunda.
