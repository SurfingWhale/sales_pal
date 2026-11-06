# Ambiguitas perilaku

Setiap butir di bawah adalah perilaku yang belum jelas atau saling bertentangan, ditemukan dari kode per 6 Nov 2026. **Keputusannya milik owner.** Kode produksi tidak diubah sampai daftar ini direview.

Status keputusan: ⏳ menunggu · ✅ diputuskan · ❌ ditolak.

**6 Nov 2026:** owner menyetujui semua keputusan yang disarankan ("Lanjut"); AMB-01 memakai pilihan (a). Kalau ada yang mau diubah, isi di halaman review: https://claude.ai/artifact/2jkYM9mtzkVaP85cg9uwfP. P0 dibangun di PR setelah #115 (lihat **Dibangun** di tiap butir).

Urutan prioritas:
- **P0**: data salah atau hilang.
- **P1**: pengguna tersesat atau aksinya tidak tercatat.
- **P2**: tidak konsisten.
- **P3**: rapi-rapi.

---

## P0: data salah atau hilang

### AMB-15 · ✅ · "Kasih data" bisa menimpa lead yang sudah ada
**AMBIGUITY:** Kalau prospek sudah pernah jadi lead (`leadId`), ConvertSheet menulis ulang lead itu dengan `status: Hot`, `value: 0`, `category: F&B`, dan `notes` baru (`ConvertSheet.tsx:31-37`). Setelah simpan, tidak ada tautan ke lead-nya.
**WHY IT MATTERS:** Lead yang sudah Deal (dengan nilainya) atau Gugur kembali jadi Hot dengan nilai 0. Angka pipeline dan omzet jadi salah tanpa tanda apa pun.
**RECOMMENDED DECISION:** Kalau lead sudah ada: jangan timpa status, nilai, dan kategori. Isi field yang kosong saja, dan tambahkan catatan. Setelah simpan, tampilkan "Buka lead {nama}".
**IMPACT:** `ConvertSheet.tsx`, ditambah satu flow tes (konversi kedua tidak mengubah lead Deal).
**Dibangun:** lead yang sudah ada hanya diisi bagian yang kosong (+ catatan); status, nilai, kategori, dan tanggal kontaknya tidak disentuh. Sheet menampilkan "✓ …" dengan [Selesai] [Buka lead]; lembar lead terbuka di atas kontak.

### AMB-10 · ✅ · Penawaran terkirim kehilangan data yang dikunci saat diedit, dan ada dua jalan ke "Terkirim"
**AMBIGUITY:**
- Simpan di editor memakai `setDoc` tanpa merge, sehingga kop, syarat, SPK/NDA, dan tanggal follow-up hilang (`Quotes.tsx:126-140`).
- "Tandai terkirim" dan "Kirim WA" membuat status Terkirim **tanpa** mengunci kop.
**WHY IT MATTERS:** Dokumen yang sudah diterima klien bisa berubah diam-diam, padahal penawaran adalah janji harga.
**RECOMMENDED DECISION:**
1. Penawaran Terkirim tidak bisa diedit langsung. "Ubah" membuat **Revisi** (sudah ada untuk Disetujui).
2. Hanya ada satu jalan ke Terkirim: kirim, atau "Tandai terkirim" yang juga mengunci.
**IMPACT:** `Quotes.tsx` (simpan, `setStatus`) dan flow `sell`.
**Dibangun:** "Edit" hanya untuk Draft; Terkirim/Disetujui/Ditolak mendapat "Revisi". Simpan Draft mempertahankan kop, syarat, SPK/NDA, follow-up. "Tandai terkirim" dan "Kirim WA" ikut mengunci kop dan syarat.

### AMB-06 · ✅ · Kiriman tertunda hilang
**AMBIGUITY:** Pertanyaan "udah kekirim?" muncul **saat tap**, sebelum pengguna pergi ke WhatsApp, dan hanya disimpan di state layar itu. Pertanyaan hilang kalau:
- tab dipindah, atau "‹ Daftar" ditekan;
- Percakapan atau sheet Pesan ditutup;
- iOS memuat ulang PWA saat app ditinggal (sering terjadi).

Kembalinya pengguna dari WhatsApp juga tidak dideteksi.
**WHY IT MATTERS:** Kiriman yang benar-benar terjadi tidak tercatat, sehingga angka harian, follow-up, dan Posisi salah. Ini inti produk (*Terkirim* = dikonfirmasi).
**RECOMMENDED DECISION:**
1. Satu **antrean kiriman tertunda** di tingkat app, disimpan di `sessionStorage` dan bertahan saat reload.
2. Saat app kembali terlihat (`visibilitychange`), muncul satu sheet: "Pesan ke {nama} udah kekirim?" dengan jawaban Udah / Belum.
3. Kalau ada beberapa kiriman, sheet menampilkan daftarnya.
4. PRD-019 §167 sudah menulis ini, tapi belum dibangun.
**IMPACT:** Komponen baru (antrean + sheet). Lima tempat kirim memakainya. Flow tes per tempat.
**Dibangun:** `lib/pendingSend.ts` (antrean di sessionStorage) + `components/PendingSends.tsx` (sheet app). Hunting, Percakapan, dan Pesan lead mendaftarkan pertanyaannya; layar yang pergi melepasnya, lalu app bertanya, juga setelah reload dan saat kembali ke app. Belum: kartu Beranda (penawaran/invoice) dan Follow-up beruntun.

### AMB-07 · ✅ · Offline: tulisan menggantung
**AMBIGUITY:** Firestore dipakai tanpa persistensi. Saat offline, tombol tetap "Menyimpan…" tanpa batas, error tidak pernah muncul, dan tulisan yang menunggu hilang kalau app dimuat ulang.
**WHY IT MATTERS:** Penjual sering di lapangan dengan sinyal jelek. Mereka tidak tahu apakah aksinya tersimpan.
**RECOMMENDED DECISION:**
- Aktifkan persistensi IndexedDB Firestore, sehingga tulisan antre dan bertahan saat reload.
- Tampilkan satu indikator di header, "Offline · N perubahan menunggu".
- Tombol tidak boleh menggantung: anggap tersimpan secara lokal, lalu tandai "menunggu sinyal".
**IMPACT:** `lib/firebase.ts`, indikator di header, tes dengan emulator yang diputus.
**Dibangun:** persistensi IndexedDB Firestore (fallback memori) + baris "Offline. Perubahan disimpan di HP ini…" di atas app. Belum: tombol yang menunggu server masih bisa tampil "Menyimpan…" saat offline.

### AMB-11 · ✅ · Ketuk dua kali = dua dokumen
**AMBIGUITY:** "Buat invoice DP" dan "Simpan sebagai script" (Analisis Chat) tidak punya status sibuk.
**WHY IT MATTERS:** Dua invoice untuk satu termin bisa membuat tagihan ganda ke klien.
**RECOMMENDED DECISION:** Setiap aksi yang membuat dokumen memakai `useSave` (sibuk + error), sesuai pola di native.md.
**IMPACT:** Dua komponen.
**Dibangun:** "Buat invoice" dan "Simpan script" (Analisis Chat) punya status sibuk; ketukan kedua tidak berbuat apa-apa.

---

## P1: pengguna tersesat atau aksinya tidak tercatat

### AMB-08 · ✅ · Apa arti "Terkirim"?
**AMBIGUITY:** Ada delapan jalan kirim dengan tiga perilaku:
- **Tanya dulu:** Hunting, Percakapan, Pesan lead, Beranda, Follow-up beruntun.
- **Dicatat saat tap:** Kirim penawaran, Follow-up penawaran, Tagih via WA.
- **Tidak dicatat:** "Kirim WA" di penawaran non-draf.

"Tagih via WA" pada invoice yang sudah terbit bilang "tercatat terkirim" padahal **tidak menulis apa pun**.
**WHY IT MATTERS:** Glossary bilang *Terkirim = dikonfirmasi penjual*. Kalau aturannya beda di tiap tempat, angka "kekirim hari ini" dan pengingat tidak bisa dipercaya.
**RECOMMENDED DECISION:**
- Semua kiriman lewat WhatsApp atau DM memakai **satu kontrak**: tanya setelah kembali (AMB-06).
- Membagikan PDF tetap dihitung kirim, karena share sheet mengembalikan hasil.
- "Tagih via WA" selalu mengisi `remindedAt`.
**IMPACT:** WaSendSheet, Quotes `sendWA`, Invoices `markBilled`, dan kontrak D1.

### AMB-01 · ✅ · Back setelah pindah tab keluar dari app
**AMBIGUITY:** Pindah tab tidak menambah history. Back di tab kedua menutup PWA, atau kembali ke halaman sebelum login.
**WHY IT MATTERS:** Di iPhone, swipe-back adalah gerakan paling alami. Kehilangan app saat swipe-back terasa seperti crash.
**RECOMMENDED DECISION:** Dua pilihan:
- **(a)** Pindah tab lewat nav = navigasi sadar, jadi Back **tidak** membawa ke tab sebelumnya. Back di tab dasar tetap tinggal di app, dengan satu entri penjaga dan pesan "Geser lagi untuk keluar".
- **(b)** Setiap pindah tab masuk history.

Saran: **(a)**, karena sejalan dengan aturan "pilihan sadar menghapus jejak" dan lebih sederhana dibanding menyatukannya dengan ModalA11y.
**IMPACT:** `SalesTracker` (penjaga history) dan flow `navigation`.

### AMB-09 · ✅ · Hasil prospek: dua implementasi, tanpa undo
**AMBIGUITY:**
- Kontak prospek (`useOutcome`) dan Percakapan (`act` lokal) menawarkan hasil yang berbeda: label, ada atau tidaknya alasan, Pikir-pikir dan Hubungi nanti tidak ada di Percakapan, dan hitungan sesi juga berbeda.
- "Jangan dihubungi" lewat "Kunci" tidak dikonfirmasi lagi, padahal tidak bisa dibalik.
- Semua hasil tidak punya undo.
**WHY IT MATTERS:**
- Salah tap "Tidak tertarik" memarkir orang itu 90 hari tanpa jalan kembali.
- "Jangan dihubungi" menghapus riwayat untuk selamanya.
**RECOMMENDED DECISION:**
1. Satu komponen hasil dipakai di kedua tempat.
2. Hasil yang bisa dibalik mendapat undo 10 detik.
3. Jangan dihubungi dan Hapus selalu lewat ConfirmSheet.
**IMPACT:** `ProspectOutcome`, `ProspectThread`, flow `journey`.
**Dibangun (6 Nov, peta tombol):** Kontak prospek dan halaman Kirim memakai satu sheet "{nama} jawab apa?" (`useOutcome().ask`). Setiap hasil yang bisa dibalik memunculkan toast "✓ … · Batal" 10 detik, dan undo mengembalikan persis field yang berubah. Jangan dihubungi pindah ke ⋯ Lainnya, berwarna merah, dan menjelaskan apa yang dihapus sebelum Kunci. Hapus journey lewat ConfirmSheet. Belum dibangun: Percakapan (`ProspectThread`) masih memakai hasilnya sendiri (poin 1).

### AMB-12 · ✅ · Script default tidak berpengaruh di Hunting
**AMBIGUITY:** "Jadikan default" menaruh script di urutan pertama dan mengisinya otomatis di Pesan lead. Di Hunting dan Percakapan, script diurutkan menurut judul dan tidak ada yang terisi otomatis.
**WHY IT MATTERS:** Owner mengatur default di Script pesan, lalu tidak melihat efeknya di tempat ia paling sering mengirim.
**RECOMMENDED DECISION:** Default dan peringkat berlaku di semua tempat lewat satu pemilih (PRD-025 Fase B, "Pesan buat {nama}").
**IMPACT:** TemplateBoard dan ProspectThread memakai pemilih yang sama dengan ChatPicker.

### AMB-03 · ✅ · Satu aturan, empat mekanisme konteks balik
**AMBIGUITY:** `cameFrom`, `backTo` + `fromContact`, `leaveTo`, dan `direct` (PR #115) menerapkan aturan yang sama dengan cara berbeda. Halaman Kirim *menggantikan* daftar, sementara yang lain *ditumpuk*.
**WHY IT MATTERS:** Setiap fitur baru harus memilih mekanisme sendiri, sehingga bug navigasi akan terus muncul.
**RECOMMENDED DECISION:**
- Satu **tumpukan konteks** di tingkat app: `push(surface, origin)` dan `pop()`.
- ModalA11y dan halaman Kirim memakainya.
- Halaman Kirim berubah menjadi overlay di atas daftar (sekaligus memperbaiki AMB-14).
**IMPACT:** Refactor sedang. Dikerjakan setelah tes navigasi (flow `navigasi balik`) melindungi perilakunya.

### AMB-16 · ✅ · Langkah di dalam Pesan tidak punya Back
**AMBIGUITY:** Pesan punya tiga langkah: tulis, pilih script, dan "udah kekirim?". Back menutup seluruh sheet. Di langkah "udah kekirim?", menutup berarti tidak tercatat, tanpa ditanya.
**WHY IT MATTERS:** Swipe-back saat memilih script membuang pesan yang sedang ditulis.
**RECOMMENDED DECISION:** `Sheet onBack` per langkah: pilih → tulis, tulis → tutup. Di langkah "udah kekirim?", Back = "Belum".
**IMPACT:** ChatPicker dan LeadDetail.

### AMB-17 · ✅ · "Udah, lanjut ke Y" membuang undo X
**AMBIGUITY:** Lembar lead dimuat ulang untuk Y, sehingga catatan "✓ Dicatat … Batal" milik X hilang.
**WHY IT MATTERS:** Salah konfirmasi di X tidak bisa dibatalkan lagi.
**RECOMMENDED DECISION:** Undo milik app, bukan milik lembar: toast di tingkat app bertahan saat pindah orang (berkaitan dengan AMB-13).
**IMPACT:** Toast global.

### AMB-24 · ✅ · Disetujui / Ditolak tanpa konfirmasi atau undo
**AMBIGUITY:** "✓ Disetujui" mengubah lead jadi Deal beserta nilainya, dan menandai penawaran lama "Digantikan". Semua itu dalam satu tap, tanpa feedback dan tanpa undo.
**WHY IT MATTERS:** Salah tap mengubah angka omzet.
**RECOMMENDED DECISION:** Toast "Disetujui · {lead} jadi Deal Rp X" dengan Batal 10 detik. Undo membalik ketiga perubahan.
**IMPACT:** `Quotes.tsx` `setStatus`.

---

## P2: tidak konsisten

### AMB-13 · ✅ · Aturan feedback
**AMBIGUITY:** Undo bertahan 5 detik, 10 detik, sampai ditutup, atau tidak ada. Error memakai `role=status` atau `role=alert`. Banyak aksi tanpa feedback sama sekali (status penawaran, Perpanjang, Terbitkan, Tunda, Simpan penawaran dan script, Gugur, Jadwal).
**WHY IT MATTERS:** Pengguna tidak bisa menebak apakah aksinya jalan dan apakah bisa dibatalkan.
**RECOMMENDED DECISION:** Satu aturan:

| Jenis aksi | Feedback |
|---|---|
| Bisa dibalik | Toast app: "{apa yang terjadi}" + Batal, 10 dtk |
| Tidak bisa dibalik | ConfirmSheet dulu, lalu toast tanpa Batal |
| Perubahan yang terlihat langsung di layar (chip berubah) | Tanpa toast |
| Gagal | Teks di tempat (`role=alert`) + aksi yang bisa diulang |
| Offline | Indikator di header (AMB-07) |

**IMPACT:** Satu komponen toast app. Semua aksi di D disesuaikan.

### AMB-23 · ✅ · Tahap script untuk lead dibaca dari Status, bukan Posisi
**AMBIGUITY:** `leadStage` memakai Status (Hot → Penawaran, Warm → Gali). Akibatnya lead Cold yang sudah membalas mendapat script Follow-up, dan lead Gugur masih mendapat "Pesan berikutnya".
**WHY IT MATTERS:** Script yang salah tahap untuk orang yang sedang menunggu jawaban kita.
**RECOMMENDED DECISION:** Tahap mengikuti Posisi:

| Posisi | Tahap |
|---|---|
| Belum dikontak | Intro |
| Dikontak | Follow-up |
| Dibales | Gali kebutuhan, atau Penawaran kalau Status Hot |
| Penawaran | Closing |
| Gugur | Tidak ada pesan |

**IMPACT:** `ChatPicker.leadStage`.

### AMB-14 · ✅ · Halaman Kirim menggantikan daftar Prospek
**AMBIGUITY:** Daftar di-unmount, sehingga scroll dan batas 30 kartu hilang. Kartu di luar 30 tidak bisa di-scroll-kan lagi ke layar.
**RECOMMENDED DECISION:** Jadikan halaman Kirim overlay (AMB-03), atau minimal sembunyikan daftar (`hidden`), jangan dibongkar.
**IMPACT:** `Hunting.tsx`.

### AMB-02 · ✅ · `?guild` menempel di URL
**AMBIGUITY:** Setiap reload membuka Guild.
**RECOMMENDED DECISION:** Buang parameter setelah dibaca, seperti `?hunt` dan `?share`.
**IMPACT:** Satu baris.

### AMB-05 · ✅ · Lonceng tidak masuk history
**AMBIGUITY:** Back saat lonceng terbuka meninggalkan halaman, bukan menutup lonceng.
**RECOMMENDED DECISION:** Lonceng menjadi popover yang terdaftar di ModalA11y.
**IMPACT:** Kecil.

### AMB-22 · ✅ · Loading dan error di Beranda dan Leads
**AMBIGUITY:** Data yang belum datang terlihat seperti "kosong". Gagal memuat tidak punya tampilan.
**RECOMMENDED DECISION:** `useSpaceCollectionLive` (sudah dipakai di Script pesan) untuk Beranda dan Leads: kerangka saat memuat, dan pesan koneksi saat gagal.
**IMPACT:** Dua layar.

### AMB-25 · ✅ · Membuka app lagi
**AMBIGUITY:** Setelah reload (iOS sering memuat ulang PWA di latar), lead, kontak, atau penawaran yang terbuka hilang, dan pengguna kembali ke Beranda.
**RECOMMENDED DECISION:** Simpan *permukaan teratas* di `sessionStorage` (jenis + id). Saat app dibuka dalam satu sesi, permukaan itu dibuka lagi. Ini berjalan bersama antrean kiriman (AMB-06).
**IMPACT:** Tumpukan konteks (AMB-03).

---

## P3 dan keputusan produk untuk Script Chat

### AMB-18 · ✅ · Script punya tujuan, respons yang diharapkan, dan aksi berikutnya?
**AMBIGUITY:** Script sekarang hanya teks per tahap.
**WHY IT MATTERS:** Setelah balasan masuk, SalesPal tidak bisa menyarankan apa pun. Penjual menentukan tahap dan script berikutnya sendiri.
**RECOMMENDED DECISION:** Tambah `goal`, `when`, `after`, `expects`, dan `next` ([script-chat.md](script-chat.md)). Nilai bawaan diambil per tahap, sehingga script lama tetap bekerja tanpa migrasi.
**IMPACT:** Langkah 5 PRD-024, editor script, Otak Pesan.

### AMB-19 · ✅ · Siapa yang membaca maksud balasan?
**RECOMMENDED DECISION:** Penjual menempel balasan, mesin aturan Analisis Chat menebak maksudnya, lalu penjual mengonfirmasi dengan satu tap. Tanpa AI (Rp 0).
**IMPACT:** Endpoint `api/_intel` dipakai ulang.

### AMB-20 · ✅ · Perilaku sesudah kirim: per tahap atau per script?
**RECOMMENDED DECISION:** Bawaan per tahap (tabel di script-chat.md §4), bisa ditimpa per script.

### AMB-21 · ✅ · Quick Pitch punya editor script sendiri
**AMBIGUITY:** Quick Pitch menyimpan script dengan cara yang menimpa field lain, menampilkan script yang diarsipkan, dan bisa menghapus tanpa arsip.
**RECOMMENDED DECISION:** Quick Pitch hanya memilih dan memakai script. Membuat dan mengubah script membuka Script pesan (PRD-024 langkah 4).

### AMB-04 · ✅ · Cari bisnis hanya ada di Beranda
**RECOMMENDED DECISION:** Tambahkan juga di Leads (header dan keadaan kosong) dan di menu + Hunting.
