# E. Spesifikasi perilaku layar

Setiap layar penting ditulis dengan format yang sama.
- **Sekarang**: perilaku per 6 Nov 2026, termasuk PR #115.
- **⚠**: celah, dengan rujukan ke [ambiguities.md](ambiguities.md).

## E1. Beranda (mode Jualan)

| | |
|---|---|
| Tujuan | Satu jawaban: apa yang perlu dikerjakan sekarang, dan yang paling banyak uangnya duluan |
| Masuk | Nav "Beranda", logo, buka app (bawaan), "‹ Kembali ke Beranda" |
| Keluar | Kartu → lembar lead (overlay) / kontak prospek di Hunting (lompatan) / dokumen (lompatan); Cari calon klien; Peta → lembar lead |
| Aksi utama | Aksi kartu teratas (WA, Kirim intro, Follow-up, Lihat penawaran, Kirim pengingat) |
| Aksi sekunder | Tunda, Buka, Chat (pratinjau), Lihat semua |
| Loading | ⚠ Kosong sampai data datang, tanpa kerangka (AMB-22) |
| Kosong | Tidak ada yang perlu ditindak: teks + "Cari calon klien" |
| Error | ⚠ Tidak ada state untuk gagal memuat |
| Sukses | Kartu "✓ Follow-up ke X dicatat" + Batal (tidak hilang sendiri) |
| Back / tutup | Tempat dasar, tidak ada yang ditutup. Back = keluar app ⚠ AMB-01 |
| Konteks dijaga | Mode, tampilan Peta. Pertanyaan "udah kekirim?" **hilang saat pindah tab** ⚠ AMB-06 |

## E2. Hunting › Prospek (daftar)

| | |
|---|---|
| Tujuan | Siapa yang dihubungi sekarang, dan di mana posisi tiap orang |
| Masuk | Nav, Beranda (dengan fokus satu orang ¹), `?hunt`, berbagi dari Threads |
| Keluar | Kartu → kontak (overlay); cari / tempel → halaman Kirim (menggantikan daftar) |
| Aksi utama | Tap kartu |
| Aksi sekunder | Tampilan (filter), cari, tempel link, Radar, Gabungin jadi journey, menu + |
| Loading | Ada (`ready`) |
| Kosong | Per tampilan |
| Back / tutup | — |
| Konteks dijaga | Filter dan kata cari (milik Hunting). ⚠ **Scroll dan batas 30 kartu hilang** saat halaman Kirim dibuka (AMB-14) |

## E3. Kontak prospek

| | |
|---|---|
| Tujuan | Seluruh cerita satu orang, dan satu langkah berikutnya |
| Masuk | Kartu daftar, kembali dari halaman Kirim (hanya kalau datang dari sini ¹), Beranda ¹ |
| Keluar | Kirim (halaman Kirim), Percakapan (overlay di atasnya ¹), Kasih data (sheet), Profil / post (eksternal) |
| Aksi utama | Dok bawah: **Kirim intro / Kirim follow-up / Kirim pesan** sesuai status, di sebelahnya **Dia jawab…** |
| Aksi sekunder | Satu baris tautan: Percakapan, Buka post, ⋯ Lainnya (Tambah catatan, Buang ke Arsip, Hapus journey, Dia minta jangan dihubungi…) |
| Hasil | Sheet "{nama} jawab apa?": Tertarik, Pikir-pikir, Hubungi nanti…, Tidak tertarik…, Cuma bales…, lalu "Dia kasih nomor → Kasih data". Editor alasan/tanggal muncul di dalam sheet; Back kembali ke daftar hasil |
| State yang ditampilkan | Status, langkah journey, riwayat, konteks post |
| Feedback | Toast "✓ {nama}: Tertarik · follow-up Kam 7 Nov" + Batal 10 detik. Jangan dihubungi tidak bisa dibatalkan, jadi ditanya dulu dalam merah |
| Back / tutup | "‹ Prospek" → daftar. Kalau dibuka dari Beranda: "‹ Beranda" ¹ |
| Konteks dijaga | Ya (overlay) |

## E4. Hunting › halaman Kirim

| | |
|---|---|
| Tujuan | Satu pesan yang pas, kirim, catat, lalu orang berikutnya |
| Masuk | Kontak (✉), cari / tempel, menu +, `?hunt&target` |
| Keluar | "‹ Daftar" / Back / Escape → daftar (+ kontak kalau datang dari sana ¹); "Berikutnya" → orang berikutnya |
| Aksi utama | Copy & … pada script tahap yang cocok, atau kartu Saran |
| Aksi sekunder | Ganti tahap, ubah konteks, Kampanye buat dia, tandai hasil tanpa kirim |
| Feedback | "Pesan ke X udah kekirim?" → toast "Tercatat … Batal" 10 dtk |
| Konteks dijaga | ⚠ Pertanyaan tertunda **hilang dengan "‹ Daftar"** (AMB-06). ⚠ Script default diabaikan (AMB-12) |

## E5. Percakapan prospek

| | |
|---|---|
| Tujuan | Membaca percakapan seperti app chat dan membalas dari situ |
| Masuk | 💬 Percakapan di kontak |
| Keluar | ✕ / Back → kontak ¹; aksi Jangan hubungi → daftar |
| Aksi utama | Kirim dari kotak pesan |
| Aksi sekunder | Template per tahap, ⋯ Status & aksi |
| Feedback | "Tercatat terkirim." + Batal 10 dtk |
| ⚠ | Hasil yang ditawarkan berbeda dari kontak (AMB-09). Buang tanpa konfirmasi dan errornya tertelan |

## E6. Lembar lead

| | |
|---|---|
| Tujuan | Seluruh cerita satu lead dan langkah berikutnya |
| Masuk | Kartu Leads (Jualan / Hunting), Beranda, Peta, Perlu ditindak, Follow-up beruntun, pencarian Hunting, "‹ Kembali ke {lead}" ¹ |
| Keluar | Tulis pesan (sheet), Penawaran (lompatan ¹), Riwayat → dokumen (lompatan ¹), Lokasi / Jadwal / Ubah / Hapus (sheet) |
| Aksi utama | Langkah dari Posisi: Balas / Kirim intro / Follow-up / Tambah nomor / Lihat penawaran |
| Aksi sekunder | Mereka bales, Jadwal, Penawaran, ⋯ (Tandai udah dikontak, Ubah, Hapus) |
| Feedback | ChatNote + Batal. ⚠ "Mereka bales" tampil "✓ Dicatat" walau gagal. ⚠ Jadwal / Gugur / Ubah tanpa feedback |
| Back / tutup | "Kembali ke {Beranda / Hunting / Leads}" ¹ |
| Konteks dijaga | Ya (portal di atas asal) |

## E7. Pesan ke lead (ChatPicker)

| | |
|---|---|
| Tujuan | Pesan yang tepat, kirim lewat WhatsApp, catat |
| Masuk | Tulis pesan, tombol kartu, "Pesan berikutnya" |
| Langkah | tulis → (pilih script) → kirim → udah kekirim? |
| Aksi utama | Kirim di WhatsApp. Tanpa nomor: email, atau copy untuk DM |
| Feedback | Pertanyaan → ChatNote di lembar lead |
| Back / tutup | ✕ → lembar lead, atau daftar kalau dibuka dari tombol kartu ¹. ⚠ Langkah di dalamnya tidak punya Back sendiri, dan Back di "udah kekirim?" menutup tanpa mencatat (AMB-16) |

## E8. Script pesan

| | |
|---|---|
| Tujuan | Menyimpan dan merapikan pesan siap pakai per tahap |
| Masuk | Hunting (header, menu +), Pesan → Kelola |
| Keluar | ✕ → asal; editor → daftar (atau asal kalau `startNew`) |
| Aksi utama | Tap baris → ubah; Baru |
| Aksi sekunder | ⋯ Duplikat, Jadikan default, Arsipkan, Balikin, Hapus permanen; Filter; cari; tahap |
| Loading / kosong / error | Ada (kerangka, 6 contoh, "Hapus pencarian & filter", pesan koneksi) |
| Feedback | Toast + Batal (arsip). ⚠ Simpan tanpa toast |
| ⚠ | Tidak tahu tujuan, respons, atau aksi berikutnya ([script-chat.md](script-chat.md)) |

## E9. Penawaran dan Invoice

| | |
|---|---|
| Tujuan | Dari harga ke uang masuk |
| Masuk | Subtab, lembar lead (Penawaran / Riwayat ¹), Beranda (dokumennya langsung ¹) |
| Aksi utama | Sesuai status: Kirim penawaran → Follow-up WA → ✓ Disetujui → Buat invoice → Tagih → Catat pembayaran |
| Feedback | Sheet kirim (+ Batal). ⚠ Perubahan status, Perpanjang, Buat invoice, dan Terbitkan **tanpa feedback** (AMB-13) |
| Back / tutup | Editor dan PDF → daftar. "‹ Kembali ke {lead}" kalau datang dari lead ¹. ⚠ Buat invoice → Invoice tanpa jalan balik ke Penawaran |
| ⚠ | Edit penawaran terkirim menghapus data yang dikunci (AMB-10). Ketuk dua kali = dua invoice (AMB-11) |

¹ benar setelah PR #115.
