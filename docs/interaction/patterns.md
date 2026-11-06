# Pustaka pola interaksi SalesPal

Pola yang berulang di semua feature, ditulis sekali di sini. File feature (`features/*.md`) merujuk ke sini dan tidak menulis ulang aturannya.

Setiap pola menjawab hal yang sama: **Purpose**, **Kapan dipakai**, **Kapan TIDAK dipakai**, **State pengguna**, **Feedback yang diharapkan**, **Pemulihan**, **Alasan native (iPhone)**, dan **Contoh di SalesPal** (yang sudah benar dan yang belum).

Pertanyaan yang memilih pola, dalam urutan ini:

```
Apa yang sedang dicoba penjual?
├── Melakukan langkah berikutnya dari pekerjaannya  → Primary action
├── Memilih satu dari beberapa jawaban/aksi          → Action sheet
├── Mengisi sesuatu
│   ├── 1–3 isian, konteks di belakang tetap perlu   → Bottom sheet
│   └── banyak isian, butuh perhatian penuh          → Full-screen form
├── Melakukan hal yang jarang atau berisiko          → Overflow (⋯) → Confirm sheet
└── Meninggalkan SalesPal sementara                  → External handoff
Apa yang terjadi setelahnya?
├── Bisa dibalik             → Toast + Undo
├── Tidak bisa dibalik       → Confirm sheet SEBELUM, toast sesudah
├── Gagal                    → Error di tempat + Retry
└── Belum tahu (di app lain) → Pertanyaan saat kembali (Pending send)
```

---

## P1. Primary action

| | |
|---|---|
| **Purpose** | Menunjukkan satu langkah berikutnya yang paling mungkin benar untuk state saat ini, supaya penjual tidak perlu memilih. |
| **Kapan dipakai** | Setiap layar yang punya pekerjaan (kontak, lead, penawaran). Labelnya berubah sesuai state: "Kirim intro" untuk prospek baru, "Kirim follow-up" untuk yang belum respon. |
| **Kapan TIDAK** | Layar yang hanya untuk membaca (laporan). Dua tombol sama besar yang bersaing. Aksi berisiko (Hapus, Ditolak) tidak pernah menjadi primary. |
| **State pengguna** | "Saya tahu orang ini, saya mau lanjut." Penjual sedang di tengah pekerjaan, sering satu tangan. |
| **Feedback** | Mengikuti aksinya: perpindahan ke layar kirim, handoff, atau toast. |
| **Pemulihan** | Mengikuti aksinya (lihat P10–P13). |
| **Alasan native** | iOS menaruh aksi utama di area jempol dan memberinya bobot visual paling besar. Satu fokus per layar mengurangi beban memilih. |
| **Contoh** | ✅ Dok bawah di Kontak prospek (PR #116). ✅ Posisi di Lembar lead (Balas / Kirim intro / Follow-up). ❌ Baris penawaran: sampai 8 tombol sejajar, tidak ada yang utama (GAP-QUO). ❌ Kartu Beranda: Aksi, Tunda, Buka, Chat sama berat. |

## P2. Secondary action

| | |
|---|---|
| **Purpose** | Jalan lain yang sah tapi bukan langkah berikutnya: membaca percakapan, membuka post, membuka profil. |
| **Kapan dipakai** | Navigasi ke konteks pendukung. Satu baris tautan tenang (teks + ikon garis), bukan chip berbingkai. |
| **Kapan TIDAK** | Untuk keputusan (hasil, status). Keputusan masuk Action sheet. |
| **State pengguna** | "Saya perlu lihat sesuatu dulu sebelum memutuskan." |
| **Feedback** | Layar/overlay yang dibuka. |
| **Pemulihan** | Back kembali ke tempat yang sama (P14). |
| **Alasan native** | iOS membedakan tombol (aksi) dari tautan (navigasi). Kalau semua berbingkai, mata tidak tahu mana yang penting. |
| **Contoh** | ✅ Baris "Percakapan · Buka post · Lainnya" di Kontak prospek. |

## P3. Overflow action (⋯ Lainnya)

| | |
|---|---|
| **Purpose** | Menyimpan aksi yang jarang atau berisiko di luar jangkauan tap tidak sengaja, tanpa menyembunyikannya selamanya. |
| **Kapan dipakai** | Catatan, arsip, hapus, jangan dihubungi, ubah data, duplikasi. Membuka Action sheet (P4). |
| **Kapan TIDAK** | Aksi yang dilakukan setiap hari. Kalau penjual membuka ⋯ untuk pekerjaan rutin, aksi itu salah tempat. |
| **State pengguna** | "Ada yang tidak biasa dengan orang ini." |
| **Feedback** | Action sheet terbuka; setelah memilih, feedback aksinya. |
| **Pemulihan** | Tutup sheet = tidak terjadi apa-apa. |
| **Alasan native** | Pola `ellipsis` iOS. Destruktif paling bawah dan merah. |
| **Contoh** | ✅ ⋯ Lainnya di Kontak prospek. ✅ ⋯ di baris Script pesan. ❌ Gugur ada di dalam form Ubah data lead, bukan aksi sendiri (GAP-LEAD). ❌ Menolak dihubungi dulu sejajar dengan Tertarik (✅ diperbaiki PR #116). |

## P4. Action sheet

| | |
|---|---|
| **Purpose** | Meminta satu pilihan dari daftar pendek, di dekat jempol, dengan setiap pilihan menyebut akibatnya. |
| **Kapan dipakai** | Hasil prospek ("{nama} jawab apa?"), isi ⋯, pilih script, pilih saluran kirim. Baris setinggi ≥ 56 px: judul + satu baris akibat ("Follow-up besok"). |
| **Kapan TIDAK** | Lebih dari ~7 pilihan (pakai daftar layar penuh dengan cari). Pilihan yang butuh isian panjang (pakai P6). |
| **State pengguna** | "Saya harus memutuskan, dan saya ingin tahu apa akibat tiap pilihan." |
| **Feedback** | Sheet tertutup, toast menyebut pilihan dan akibatnya. |
| **Pemulihan** | Undo di toast (P10). Pilihan yang butuh detail (tanggal, alasan) membuka editornya **di dalam sheet**; Back kembali ke daftar pilihan, bukan menutup semuanya. |
| **Alasan native** | `UIAlertController.actionSheet` / `confirmationDialog` SwiftUI. Pilihan berbentuk chip di halaman membuat keputusan terlihat seperti dekorasi. |
| **Contoh** | ✅ "Dia jawab…" (Kontak prospek dan halaman Kirim). ❌ Percakapan masih punya panel hasilnya sendiri dengan pilihan berbeda (GAP-PCK). |

## P5. Bottom sheet

| | |
|---|---|
| **Purpose** | Tugas pendek yang butuh konteks di belakangnya tetap terasa: isian 1–3 field, pratinjau, konfirmasi kiriman. |
| **Kapan dipakai** | Kasih data (telepon, nama), Catat pembayaran, Jadwal follow-up, "Pesannya udah kekirim?". Komponen: `components/Sheet.tsx` (portal ke `<body>`, Back/Escape/scrim menutup, `onBack` untuk langkah di dalam sheet). |
| **Kapan TIDAK** | Form panjang (P6). Pertanyaan ya/tidak berisiko (P7). Konten yang harus dibaca lama. |
| **State pengguna** | "Sebentar, saya isi ini lalu lanjut." |
| **Feedback** | Tombol simpan berubah "Menyimpan…" lalu sheet menutup dengan toast, atau menampilkan hasil + langkah berikutnya di sheet yang sama (Kasih data: "✓ … [Selesai] [Buka lead]"). |
| **Pemulihan** | Error tampil di sheet, isian tetap; tombol bisa ditap lagi. Isian kotor + tutup → P12. |
| **Alasan native** | Sheet iOS naik dari bawah, dekat jempol, bisa ditutup dengan geser atau Back, dan tidak tertutup keyboard seperti dialog tengah. |
| **Contoh** | ✅ ConfirmSheet, PendingSends, "Dia jawab…". ❌ Sekitar 40 dialog tengah (`modalBox`) memuat form pendek: Kasih data, Catat pembayaran, Target harian (GAP lintas feature, DEC-003). |

## P6. Full-screen form

| | |
|---|---|
| **Purpose** | Pekerjaan isian yang butuh perhatian dan ruang: penawaran, lead baru, paket, komponen, script. |
| **Kapan dipakai** | > 3 field, ada daftar item, atau ada pratinjau. `Sheet full` (layar penuh di HP, `wide` di laptop). Batal di kiri atas, Simpan di kanan atas; ringkasan penting (total) menempel di bawah. |
| **Kapan TIDAK** | Satu atau dua isian (P5). |
| **State pengguna** | "Saya sedang menyusun sesuatu yang akan dilihat orang lain." |
| **Feedback** | Simpan: "Menyimpan…", lalu kembali ke tempat asal dengan toast. |
| **Pemulihan** | Unsaved changes (P12). Error di atas tombol Simpan, isian utuh. |
| **Alasan native** | Form iOS adalah layar sendiri (modal `pageSheet`/`fullScreen`) dengan Cancel/Done di nav bar. Dialog tengah setinggi layar memotong keyboard dan tidak punya tempat yang jelas untuk Batal. |
| **Contoh** | ✅ Editor Script pesan. 🟡 DocEditor (penawaran): sudah tinggi penuh di HP, tapi masih pola dialog (GAP-QUO). ❌ Tambah lead, Paket, Komponen, Kop bisnis: dialog tengah. |

## P7. Confirm sheet

| | |
|---|---|
| **Purpose** | Menghentikan penjual satu detik sebelum aksi yang **tidak bisa dibalik**, dengan kata-kata yang menyebut apa yang hilang. |
| **Kapan dipakai** | Hapus permanen, Batalkan invoice, Jangan dihubungi (menghapus riwayat), Buang perubahan. `components/ConfirmSheet.tsx` / `useConfirm()`: Batal + aksi merah, "Menghapus…", error di sheet. |
| **Kapan TIDAK** | Aksi yang bisa dibalik. Di sana konfirmasi hanya memperlambat; pakai Undo (P10). Konfirmasi untuk semua hal melatih penjual menekan "Ya" tanpa membaca. |
| **State pengguna** | "Saya yakin ini sudah selesai selamanya." |
| **Feedback** | Sheet menutup setelah tulisan berhasil, lalu toast tanpa Undo. |
| **Pemulihan** | Gagal: "Gagal. Cek koneksi, lalu coba lagi." di sheet, tombol aktif lagi. |
| **Alasan native** | Pengganti `confirm()` browser, yang tidak ada di PWA iOS dengan gaya yang benar dan dilarang di native.md. |
| **Contoh** | ✅ Hapus journey, Hapus lead, Hapus script, Batalkan invoice. ✅ Jangan dihubungi: editor merah di sheet dengan "Ini ga bisa dibatalin." ❌ Buang di Percakapan tanpa konfirmasi (GAP-PCK). |

## P8. Toast

| | |
|---|---|
| **Purpose** | Mengatakan apa yang baru saja terjadi, tanpa menghentikan penjual. |
| **Kapan dipakai** | Setelah setiap aksi yang mengubah data dan tidak memindahkan penjual ke layar yang menunjukkan hasilnya. `.sp-toast` (di atas nav bawah di HP, tengah bawah di laptop), `role="status"`. Isi: subjek + hasil + akibat ("✓ Toko Kue: Tertarik · follow-up Kam 7 Nov"). |
| **Kapan TIDAK** | Error yang butuh tindakan (P11). Hal yang terlihat jelas di layar (status yang berubah di tempat). |
| **State pengguna** | "Tadi itu kesimpan nggak?" |
| **Feedback** | Ini feedback-nya. Muncul **setelah** tulisan berhasil (DEC-005). |
| **Pemulihan** | Undo bila bisa dibalik (P10). Tutup ×. |
| **Alasan native** | Snackbar/banner singkat; tidak modal, tidak mencuri fokus. |
| **Contoh** | ✅ Hasil prospek, Kirim di Hunting ("Tercatat … Batal"), PendingSends. ❌ "Mereka bales" menampilkan "✓ Dicatat" sebelum tersimpan (GAP-LEAD). ❌ Tunda, Jadwal, Terbitkan, Catat pembayaran diam (lihat file feature). |

## P9. Undo

| | |
|---|---|
| **Purpose** | Membuat salah tap murah, sehingga aksi bisa cepat tanpa konfirmasi. |
| **Kapan dipakai** | Semua aksi yang bisa dibalik dengan menulis ulang nilai sebelumnya: hasil prospek, arsip, tunda, status penawaran, catat kirim. Jendela **10 detik** (DEC-004). Undo menulis balik **persis field yang berubah** (field yang sebelumnya tidak ada dihapus), dan membalik hitungan sesi. |
| **Kapan TIDAK** | Aksi yang menghapus data atau menyentuh pihak lain (pesan yang sudah dikirim, riwayat yang dihapus). Itu P7. |
| **State pengguna** | "Eh, salah pencet." |
| **Feedback** | "Dibatalin". |
| **Pemulihan** | Undo yang gagal: pesan error + coba lagi. |
| **Alasan native** | Pola "Undo" iOS Mail/Photos: aksi langsung, pembatalan murah. |
| **Contoh** | ✅ `useOutcome` (10 dtk). 🟡 Arsip script 5 dtk (beda jendela, GAP-SCR). ❌ Udah, lanjut ke Y: undo X hilang saat pindah orang (AMB-17). |

## P10. Retry

| | |
|---|---|
| **Purpose** | Saat tulisan gagal, penjual tidak kehilangan apa yang sudah ia kerjakan dan tahu cara mengulang. |
| **Kapan dipakai** | Setiap tulisan ke Firestore yang bisa gagal karena koneksi. Pesan: "Gagal nyimpen. Cek koneksi lalu coba lagi." Tombol tetap di tempat dan aktif lagi; isian tidak dihapus. `useSave()` di `FormGuard.tsx`. |
| **Kapan TIDAK** | Offline biasa: Firestore menyimpan lokal dan mengirim nanti (DEC-006). Retry hanya untuk tulisan yang benar-benar ditolak. |
| **State pengguna** | "Kok nggak masuk?" |
| **Feedback** | Error di dekat tombol (`role="alert"`). |
| **Pemulihan** | Tap lagi. |
| **Alasan native** | Pesan iOS: "Not Delivered", ketuk untuk kirim ulang. |
| **Contoh** | ✅ ConfirmSheet, PendingSends ("Belum kecatat. Cek koneksi lalu tap Udah lagi."). ❌ Buang di Percakapan menelan error (GAP-PCK). |

## P11. External app handoff

| | |
|---|---|
| **Purpose** | Mengirim lewat WhatsApp/IG/Threads (tempat percakapan sebenarnya terjadi), lalu kembali ke SalesPal tanpa kehilangan apa pun. |
| **Kapan dipakai** | Semua kirim pesan dan penawaran. Teks disalin/diisi, app lain dibuka. |
| **Kendala sistem** | WhatsApp dan Instagram **tidak melapor** apakah pesan terkirim. iOS bisa memuat ulang PWA saat penjual di app lain. |
| **Akibat** | Kirim dicatat **hanya setelah penjual mengonfirmasi** saat kembali (DEC-001). Pertanyaan itu disimpan (`lib/pendingSend.ts`) sampai dijawab; kalau layar yang bertanya sudah hilang, sheet tingkat app (`PendingSends`) yang bertanya (DEC-002). |
| **State pengguna** | "Saya kirim dulu, nanti balik." Setelah kembali: "Tadi sudah kekirim, kan?" |
| **Feedback** | Saat kembali: "Pesannya udah kekirim?" → Udah, catat / Belum. Setelah Udah: toast "Tercatat … Batal". |
| **Pemulihan** | Belum: tidak ada yang dicatat, pesan masih siap. Lupa menjawab: ditanya lagi setelah reload sampai 12 jam. |
| **Alasan native** | Universal link/`wa.me` adalah handoff resmi iOS; app tidak bisa mengintip hasilnya, jadi tanya adalah satu-satunya cara jujur. |
| **Contoh** | ✅ Hunting, Percakapan, Pesan ke lead (PR #116). ❌ Kartu Beranda dan Kirim penawaran belum memakai antrean ini (lihat beranda.md, penawaran.md). |

## P12. Unsaved changes

| | |
|---|---|
| **Purpose** | Tidak pernah membuang tulisan penjual tanpa bertanya. |
| **Kapan dipakai** | Setiap form yang bisa ditutup (×, Back, scrim, Escape) saat isiannya berbeda dari yang tersimpan. `useDiscard(dirty, onClose)`: ConfirmSheet "Buang perubahan?" dengan "{Isian ini} belum disimpan. Kalau dibuang, hilang." |
| **Kapan TIDAK** | Form yang belum disentuh. Sheet pilihan (tidak ada isian). |
| **State pengguna** | "Saya mau keluar" (sering tidak sengaja: geser Back di iPhone). |
| **Feedback** | Sheet tanya; Buang menutup, Batal kembali ke form utuh. |
| **Pemulihan** | Batal. |
| **Alasan native** | "Discard Changes?" di form iOS. Geser Back yang tidak sengaja sangat umum di iPhone. |
| **Contoh** | ✅ DocEditor, editor Script, Tambah lead, TeamLogs. |

## P13. Back behavior

| | |
|---|---|
| **Purpose** | Back selalu berarti "satu langkah ke tempat saya tadi", tidak pernah keluar app atau melompat ke tempat lain. |
| **Aturan** | Overlay: Back menutup lapisan teratas (`ModalA11y`: satu entri history per `.modal-overlay`). Langkah di dalam sheet: `onBack` mundur satu langkah. Lompatan: tujuan mengingat asal (`cameFrom`) dan tombolnya menyebut namanya ("‹ Kembali ke Beranda"). Navigasi (tab): tidak ada tombol kembali, Back browser mengikuti tab (AMB-01). |
| **Kapan TIDAK** | Back tidak pernah dipakai untuk menyimpan. |
| **State pengguna** | "Balik ke tadi." |
| **Feedback** | Tempat asal dengan posisi, scroll, dan isian utuh. |
| **Alasan native** | Geser dari tepi kiri di iOS adalah gerakan paling sering. Kalau menutup app atau melompat, kepercayaan hilang. |
| **Contoh** | ✅ PRD-026 (#115). ✅ Editor di "Dia jawab…": Back ke daftar pilihan. ❌ Pesan ke lead: Back di langkah Ganti script menutup seluruh Pesan (AMB-16). ❌ Halaman Kirim menggantikan daftar, scroll hilang (AMB-14). |

## P14. Loading / pending

| | |
|---|---|
| **Purpose** | Menunjukkan bahwa sesuatu sedang terjadi, dan mencegah tap ganda. |
| **Kapan dipakai** | Tombol yang menulis: label berubah ("Menyimpan…", "Membuang…"), `disabled`, `aria-busy`. Layar yang memuat: skeleton/label yang menyebut apa yang ditunggu ("Cek login…", "Cek akses…"), dan setelah 10 detik jalan keluar ("Muat ulang"). |
| **Kapan TIDAK** | Spinner tanpa batas waktu atau tanpa kata. |
| **State pengguna** | "Lagi jalan, atau macet?" |
| **Feedback** | Label tombol; setelah selesai, P8 atau P10. |
| **Pemulihan** | Batas waktu + Muat ulang (gerbang dashboard, #115). |
| **Alasan native** | Indikator aktivitas iOS selalu disertai konteks, dan tombol yang sedang bekerja tidak bisa ditekan dua kali. |
| **Contoh** | ✅ Buat invoice, Simpan script (#116). 🟡 Offline: tombol bisa tetap "Menyimpan…" sampai online karena tulisan menunggu server (GAP, AMB-07). |

## P15. Error

| | |
|---|---|
| **Purpose** | Mengatakan apa yang gagal dan apa yang bisa dilakukan, di tempat kejadian. |
| **Kapan dipakai** | Teks merah `role="alert"` di dekat aksi, dalam bahasa penjual ("Cek koneksi lalu coba lagi"). Offline: banner tetap `sp-offline` "Offline. Perubahan disimpan di HP ini dan dikirim begitu ada sinyal." |
| **Kapan TIDAK** | `alert()` browser (dilarang native.md). Kode error. Toast yang hilang sebelum terbaca. |
| **State pengguna** | "Ada yang salah, saya harus apa?" |
| **Pemulihan** | P10 Retry, isian utuh. |
| **Alasan native** | Error iOS inline di form, bukan dialog. |

---

## Dialog tengah (`modalBox`) — pola yang ditinggalkan

Dialog di tengah layar dipakai sekitar 40 kali di 15 komponen. Di iPhone, pola ini jauh dari jempol, tertutup keyboard, tidak bisa digeser turun, dan menjadi wadah umum untuk apa saja. Keputusannya ada di [DEC-003](decisions.md#dec-003): setiap dialog pindah ke P5, P6, atau P7 sesuai isinya, bertahap per kelompok. Dialog tengah tidak dipakai untuk yang baru.
