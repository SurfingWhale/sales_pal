# Decision log interaksi SalesPal

Keputusan UX yang sudah diambil, supaya tidak diperdebatkan ulang oleh orang (atau AI) berikutnya. Setiap entri menulis konteks, masalah, pilihan yang dipertimbangkan, pilihan yang diambil, alasannya, harganya, dan feature yang terkena.

Keputusan baru ditambahkan di bawah dengan nomor berikutnya. Keputusan yang diganti tidak dihapus: tandai **Digantikan oleh DEC-n** dan biarkan alasannya tetap terbaca.

Asal: [ambiguities.md](ambiguities.md) (disetujui owner 6 Nov 2026), PRD-026, peta tombol (6 Nov), PR #115 dan #116.

| ID | Keputusan | Status |
|---|---|---|
| [DEC-001](#dec-001) | "Terkirim" = penjual mengonfirmasi, bukan saat tap | ✅ Hunting, Percakapan, Pesan lead · ❌ Beranda, penawaran, invoice |
| [DEC-002](#dec-002) | Pertanyaan "udah kekirim?" disimpan sampai dijawab, ditanya di tingkat app | ✅ #116 |
| [DEC-003](#dec-003) | Dialog tengah ditinggalkan: sheet bawah, layar penuh, atau confirm sheet | 🟡 bertahap |
| [DEC-004](#dec-004) | Bisa dibalik → langsung + Batal 10 dtk. Tidak bisa dibalik → tanya dulu | 🟡 Kontak prospek ✅ |
| [DEC-005](#dec-005) | Feedback sukses hanya setelah tulisan berhasil | 🟡 |
| [DEC-006](#dec-006) | Offline-first: tulis lokal, kirim saat ada sinyal | ✅ #116 |
| [DEC-007](#dec-007) | Tutup = kembali ke tempat asal; empat jenis perpindahan | ✅ #115 · 🟡 tumpukan konteks |
| [DEC-008](#dec-008) | Satu aksi utama per layar; yang jarang dan berisiko di ⋯ | 🟡 Kontak prospek ✅ |
| [DEC-009](#dec-009) | Satu sheet hasil prospek untuk semua tempat | 🟡 Percakapan belum |
| [DEC-010](#dec-010) | Kasih data menggabungkan ke lead yang ada, tidak menimpa | ✅ #116 |
| [DEC-011](#dec-011) | Dokumen terkirim mengunci kop & syarat; perubahan = Revisi | ✅ #116 |
| [DEC-012](#dec-012) | Tahap script mengikuti Posisi lead, bukan Status | ❌ belum dibangun |
| [DEC-013](#dec-013) | Rp 0: tanpa AI; mesin aturan + konfirmasi satu tap | ✅ |
| [DEC-014](#dec-014) | Script punya tujuan, respons yang diharapkan, dan langkah berikutnya | ❌ belum dibangun |
| [DEC-015](#dec-015) | Pindah tab = navigasi sadar; Back tidak keluar app | 🟡 |

---

### DEC-001
**"Terkirim" berarti penjual mengonfirmasi pesan sudah terkirim**

- **Context:** Ada delapan jalan kirim (Hunting, Percakapan, Pesan lead, Beranda, Follow-up beruntun, Kirim penawaran, Follow-up penawaran, Tagih via WA) dengan tiga perilaku berbeda: tanya dulu, dicatat saat tap, atau tidak dicatat (AMB-08).
- **Problem:** WhatsApp dan Instagram tidak memberi tahu apakah pesan benar-benar dikirim. Mencatat saat tap menghitung pesan yang dibatalkan di WhatsApp; tidak mencatat membuat pengingat Beranda terus muncul. Angka "Terkirim" di laporan jadi tidak bisa dipercaya.
- **Options considered:** (a) catat saat tap, (b) tanya setelah kembali, (c) catat saat tap + undo.
- **Chosen:** (b) untuk semua kirim lewat WhatsApp/DM. Berbagi PDF lewat share sheet tetap dihitung kirim, karena share sheet mengembalikan hasil. "Tagih via WA" selalu mengisi `remindedAt`.
- **Why:** Hanya penjual yang tahu. Satu pertanyaan saat kembali lebih murah daripada laporan yang salah, dan kalimat "Terkirim" di GLOSSARY harus berarti satu hal.
- **Trade-off:** Satu tap ekstra per kiriman. Penjual yang lupa menjawab tidak tercatat (dikurangi oleh DEC-002).
- **Affected:** hunting, percakapan, pesan-ke-lead, beranda, penawaran, invoice.

### DEC-002
**Pertanyaan "udah kekirim?" disimpan sampai dijawab, dan ditanya di tingkat app kalau layarnya hilang**

- **Context:** Pertanyaan dulu hidup di komponen yang bertanya.
- **Problem:** Penjual pindah tab, menutup sheet, atau iOS memuat ulang PWA selagi penjual di WhatsApp: pertanyaan hilang, kiriman tidak pernah dicatat (AMB-06).
- **Options:** (a) simpan di Firestore sebagai draft, (b) simpan di `sessionStorage` dengan kepemilikan layar, (c) tidak tanya, catat otomatis.
- **Chosen:** (b). `lib/pendingSend.ts`: setiap pertanyaan disimpan; layar yang sedang bertanya "memiliki" pertanyaannya; saat tidak ada pemilik, `components/PendingSends.tsx` bertanya dan mencatat dengan cara yang sama. Kedaluwarsa 12 jam. Per ruang kerja.
- **Why:** Pertanyaan ini milik sesi, bukan data bisnis. `sessionStorage` bertahan saat reload iOS tetapi tidak menumpuk selamanya. Kepemilikan mencegah dua tempat bertanya hal yang sama.
- **Trade-off:** Tidak lintas perangkat. Pertanyaan di tab browser lain tidak terlihat.
- **Affected:** hunting, percakapan, pesan-ke-lead; beranda dan penawaran menyusul.

### DEC-003
**Dialog tengah ditinggalkan**

- **Context:** Sekitar 40 dialog di 15 komponen memakai `modalBox` (kotak di tengah layar) untuk form, daftar, dan pertanyaan.
- **Problem:** Di iPhone, dialog tengah jauh dari jempol, tertutup keyboard, tidak bisa digeser turun, dan tidak punya tempat yang jelas untuk Batal/Simpan. Ia juga menjadi wadah umum, sehingga form panjang dan pertanyaan "Hapus?" terlihat sama.
- **Options:** (a) biarkan, (b) ganti semua sekaligus, (c) pindah per kelompok sesuai isi, dengan flow tes di 390/375/1440.
- **Chosen:** (c). Isi menentukan wadah: form > 3 isian → layar penuh (P6); 1–3 isian → sheet bawah (P5); pertanyaan berisiko → confirm sheet (P7); daftar/alur → layar penuh dengan langkah. Komponen sudah ada: `Sheet` (`full`, `wide`, `onBack`), `ConfirmSheet`.
- **Why:** Wadah yang benar bergantung pada apa yang dikerjakan penjual, bukan pada apa yang paling mudah dibuat.
- **Trade-off:** Banyak PR kecil; selama transisi dua pola hidup berdampingan.
- **Affected:** semua.

### DEC-004
**Bisa dibalik → langsung + Batal 10 detik. Tidak bisa dibalik → tanya dulu**

- **Context:** Undo bertahan 5 detik, 10 detik, sampai ditutup, atau tidak ada. Konfirmasi ada di tempat yang tidak perlu dan hilang di tempat yang perlu (AMB-09, AMB-13, AMB-24).
- **Problem:** Penjual tidak bisa menebak apakah aksinya jalan dan apakah bisa dibatalkan. Salah tap "Tidak tertarik" memarkir orang 90 hari; salah tap "Disetujui" mengubah lead jadi Deal.
- **Options:** (a) konfirmasi untuk semua, (b) undo untuk semua, (c) pembagian menurut dapat-dibaliknya.
- **Chosen:** (c). Dapat dibalik: langsung, toast dengan akibatnya + Batal 10 detik; undo menulis balik persis field yang berubah. Tidak dapat dibalik (menghapus riwayat, menghapus dokumen, pesan ke pihak lain): ConfirmSheet dulu, toast tanpa Batal. Perubahan yang langsung terlihat di layar (chip menyala): tanpa toast.
- **Why:** Konfirmasi untuk semua melatih penjual menekan "Ya" tanpa membaca. Undo membuat aksi cepat aman.
- **Trade-off:** Undo butuh snapshot per aksi; hitungan sesi juga harus dibalik.
- **Affected:** kontak-prospek (✅), percakapan, lembar-lead, penawaran, invoice, beranda, script-pesan (5 → 10 dtk).

### DEC-005
**Feedback sukses hanya setelah tulisan berhasil**

- **Context:** Beberapa aksi menampilkan "✓" sebelum `await` selesai, atau tanpa `catch`.
- **Problem:** "✓ Dicatat" yang bohong lebih buruk daripada tidak ada feedback: penjual berhenti mengecek.
- **Chosen:** Toast sukses setelah tulisan selesai; gagal → error di tempat + coba lagi (P10). Dengan cache persisten (DEC-006), tulisan offline selesai di lokal dengan cepat, jadi menunggu tidak terasa lambat.
- **Trade-off:** Tidak ada "optimistic toast".
- **Affected:** lembar-lead ("Mereka bales"), percakapan (Buang), semua toast baru.

### DEC-006
**Offline-first**

- **Context:** Penjual bekerja di jalan, sinyal sering hilang. Tulisan dulu menggantung (AMB-07).
- **Chosen:** Firestore `persistentLocalCache` dengan multi-tab manager (`lib/firebase.ts`), banner "Offline. Perubahan disimpan di HP ini dan dikirim begitu ada sinyal."
- **Why:** Penjual tidak boleh berhenti bekerja karena sinyal.
- **Trade-off:** Tombol yang menunggu konfirmasi server bisa tetap "Menyimpan…" saat offline (gap terbuka, P14).
- **Affected:** semua.

### DEC-007
**Tutup = kembali ke tempat asal; empat jenis perpindahan**

- **Context:** Menutup lead dari Beranda membawa ke Hunting, bukan kembali ke Beranda (PRD-026).
- **Chosen:** Setiap transisi adalah Overlay, Navigasi, Lompatan, atau Eksternal (README). Lompatan mengingat asal dan menyebut namanya ("‹ Kembali ke Beranda"). Arah berikutnya: satu tumpukan konteks app (`push`/`pop`) menggantikan empat mekanisme yang ada (`cameFrom`, `backTo`+`fromContact`, `leaveTo`, `direct`; AMB-03), halaman Kirim menjadi overlay (AMB-14), dan permukaan teratas dibuka lagi setelah reload (AMB-25).
- **Why:** Penjual harus bisa menebak ke mana Back membawa.
- **Trade-off:** Refactor sedang; dilindungi flow `navigasi balik`.
- **Affected:** semua.

### DEC-008
**Satu aksi utama per layar; yang jarang dan berisiko di ⋯**

- **Context:** Kontak prospek punya 13 tombol setara, termasuk "Menolak dihubungi" di antara hasil biasa. Baris penawaran punya sampai 8.
- **Options:** (a) urutkan ulang chip, (b) satu aksi utama + sheet keputusan + ⋯.
- **Chosen:** (b). Aksi utama mengikuti state (P1); keputusan dalam action sheet yang menyebut akibat (P4); jarang/berisiko di ⋯, destruktif paling bawah dan merah (P3).
- **Why:** Penjual satu tangan, di tengah percakapan. Mata harus langsung menemukan langkah berikutnya.
- **Trade-off:** Aksi di ⋯ satu tap lebih jauh.
- **Affected:** kontak-prospek (✅ #116), beranda, penawaran, invoice, lembar-lead.

### DEC-009
**Satu sheet hasil prospek untuk semua tempat**

- **Context:** Kontak prospek, halaman Kirim, dan Percakapan masing-masing menawarkan hasil yang berbeda (label, alasan, Pikir-pikir/Hubungi nanti).
- **Chosen:** `useOutcome().ask` ("{nama} jawab apa?") di semua tempat, dengan editor tanggal/alasan di dalam sheet.
- **Why:** Jawaban yang sama harus punya akibat yang sama, di mana pun dicatat.
- **Affected:** kontak-prospek (✅), hunting (✅), percakapan (belum).

### DEC-010
**Kasih data menggabungkan ke lead yang ada**

- **Context/Problem:** Prospek yang sudah punya lead ditimpa saat Kasih data dipakai lagi (AMB-15).
- **Chosen:** Kalau lead sudah ada: isi hanya yang kosong, tambah catatan. Sheet menunjukkan hasilnya + [Selesai] [Buka lead].
- **Affected:** kontak-prospek, percakapan, lembar-lead.

### DEC-011
**Dokumen terkirim mengunci kop & syarat**

- **Context/Problem:** Mengedit penawaran terkirim mengambil kop dan syarat terbaru dari pengaturan, sehingga dokumen yang sudah di tangan klien berubah diam-diam (AMB-10).
- **Chosen:** Edit hanya untuk Draft; selain itu "Revisi" yang membuat versi baru dan menandai yang lama Digantikan. "Terkirim" mengunci `issuer` dan `terms`.
- **Why:** Dokumen yang dikirim adalah janji kepada klien.
- **Affected:** penawaran, invoice.

### DEC-012
**Tahap script untuk lead mengikuti Posisi**

- **Problem:** `leadStage` memakai Status, sehingga lead Cold yang sudah membalas mendapat script Follow-up (AMB-23).
- **Chosen:** Belum dikontak → Intro; Dikontak → Follow-up; Dibales → Gali kebutuhan, atau Penawaran kalau Hot.
- **Affected:** pesan-ke-lead, script-pesan.

### DEC-013
**Rp 0: tanpa AI berbayar**

- **Context:** Budget owner nol.
- **Chosen:** Pengisian script dan pembacaan maksud balasan memakai aturan (`api/` Script Intelligence, `fillFor`). Penjual menempel balasan, mesin menebak maksud, penjual mengonfirmasi satu tap (AMB-19).
- **Trade-off:** Tebakan lebih kasar; konfirmasi penjual wajib.
- **Affected:** script-pesan, percakapan, analisis chat.

### DEC-014
**Script punya tujuan, respons yang diharapkan, dan langkah berikutnya**

- **Chosen:** Field `goal`, `when`, `after`, `expects`, `next` dengan bawaan per tahap, bisa ditimpa per script ([script-chat.md](script-chat.md), AMB-18/20). Script lama tetap jalan tanpa migrasi.
- **Status:** belum dibangun (PRD-024 langkah 5, PRD-025 fase B).

### DEC-015
**Pindah tab = navigasi sadar**

- **Chosen:** AMB-01 opsi (a): pindah tab tidak menambah history; Back di tab dasar tetap di app dengan satu entri penjaga dan "Geser lagi untuk keluar".
- **Status:** sebagian (penjaga history di `SalesTracker`).
