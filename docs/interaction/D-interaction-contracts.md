# D. Kontrak interaksi

Setiap aksi penting ditulis sebagai kontrak:

```
Pemicu → Prasyarat → Aksi → Perubahan state → Feedback → Undo → Aksi berikutnya → Konteks balik
```

- **Kolom "Sekarang"** ditulis dari kode per 6 Nov 2026, dengan rujukan `file:baris`.
- **Kolom "Seharusnya"** baru diisi kalau sekarang tidak konsisten. Keputusannya menunggu owner di [ambiguities.md](ambiguities.md).

Ada dua kondisi yang berlaku untuk semua kontrak:

- **Offline.** Firestore dipakai tanpa persistensi (`lib/firebase.ts:59`). Saat offline, sebuah tulisan tidak pernah selesai: tombolnya tetap "Menyimpan…", pesan error tidak pernah muncul, dan tulisan yang masih antre hilang kalau PWA dimuat ulang (AMB-07).
- **Kembali dari WhatsApp atau IG.** Tidak ada kode yang mendengar kembalinya pengguna. Pertanyaan "udah kekirim?" sudah dipasang saat tap, dan hanya hidup di state React layar itu (AMB-06).

## D1. Kirim pesan: inti SalesPal

Pola yang benar (glossary: *Terkirim* = dikonfirmasi penjual, bukan sekadar WhatsApp yang terbuka):

```
tap kirim → buka WA / salin → tanya "udah kekirim?" → Udah → catat (Outreach / hunt) → undo → aksi berikutnya
```

| Tempat | Pemicu | Tanya dulu? | Optimistis? | Undo | Kalau gagal | Pertanyaan hilang saat … |
|---|---|---|---|---|---|---|
| Hunting, halaman Kirim | Copy / Copy & buka post / Copy & DM / Kirim WA (`Hunting.tsx:362`) | Ya: "Pesan ke {who} udah kekirim?" [Belum] [Udah, catat] / [Udah, lanjut ke X] | Ya. Pertanyaan muncul lagi kalau gagal | 10 dtk "Batal catat". Tidak ada teks setelah batal | "Pesan belum kecatat…" + tanya lagi | Pindah tab, "‹ Daftar", reload |
| Percakapan prospek | Ikon salin / kirim (`ProspectThread.tsx:228`) | Ya: "Pesannya udah kekirim?" | Tidak, menunggu tulisan selesai | 10 dtk. Tidak ada teks setelah batal | "Pesan belum kecatat…" | Percakapan ditutup |
| Pesan ke lead (ChatPicker) | "Kirim di WhatsApp" (`ChatPicker.tsx:170`) | Ya: [Udah, catat / lanjut ke X] [Udah, selesai dulu] [Belum, balik ke pesan] | Sheet tutup duluan, catatan muncul setelah tulisan selesai | Sampai ditutup (ChatNote). Hilang kalau "lanjut ke X" | "Chat-nya gagal dicatat…" | Sheet ditutup |
| Beranda, Perlu ditindak | Tautan WA di kartu (`Beranda.tsx:482`) | Ya: [Udah, catat] [Belum] | Ya. **Tidak** muncul lagi kalau gagal, jadi tidak bisa diulang | Sampai ditutup | "WhatsApp kebuka, tapi gagal dicatat…" | Pindah tab |
| Follow-up beruntun | "Chat WhatsApp" (`FollowUpRun.tsx`) | Ya: [Udah, catat] [Belum, balik] | Tidak | **Tidak ada** | "Gagal nyimpen…" | Antrean ditutup |
| Penawaran: Kirim | "Buka WA" di WaSendSheet (`WaSendSheet.tsx:53`) | **Tidak**, dicatat saat tap | — | Selama sheet terbuka | "Gagal dicatat…" | — |
| Penawaran (status lain): Kirim WA | `sendWA` | **Tidak** | — | — | — | **Tidak pernah dicatat** |
| Invoice: Tagih via WA | WaSendSheet (`Invoices.tsx`) | **Tidak** | — | — | — | Invoice yang sudah terbit: tertulis "tercatat terkirim" padahal **tidak ada yang ditulis**, dan `remindedAt` tidak diisi |

**Seharusnya:** satu kontrak "Kirim" untuk semua tempat (AMB-08):

| Bagian | Isi |
|---|---|
| Pemicu | Satu tombol yang menyebut salurannya: "Kirim di WhatsApp", "Copy & DM (IG)" |
| Prasyarat | Ada tujuan (nomor, handle, atau post). Kalau tidak ada, tombolnya hilang dan diganti alasannya plus jalan keluarnya, misalnya "Belum ada nomor · Tambah nomor" |
| Aksi | Salin dan buka aplikasi luar |
| Perubahan state | Belum ada. Kiriman dicatat sebagai *tertunda* (lokal + `sessionStorage`) |
| Feedback | Saat pengguna **kembali** (`visibilitychange`), atau langsung kalau ia tidak pergi: "Pesan ke {nama} udah kekirim?" [Udah, catat] [Belum]. Teks dan urutan tombolnya sama di semua tempat |
| Udah | Catat Outreach / hunt + perbarui Lead / Prospek. Optimistis, dan pertanyaan muncul lagi kalau gagal |
| Undo | 10 dtk, lalu "Dibatalin, ga dicatat." di semua tempat |
| Aksi berikutnya | Kalau ada antrean: "Udah, lanjut ke {berikutnya}". Kalau tidak: langkah berikutnya untuk orang ini (jadwal follow-up) |
| Konteks balik | Layar yang sama, orang yang sama. Kiriman tertunda bertahan saat pindah tab dan saat reload |

## D2. Jawaban dan hasil (Prospek)

| Aksi | Kontak prospek (`useOutcome`) | Percakapan (⋯ Status & aksi) | Konsisten? |
|---|---|---|---|
| Dia membalas | "💬 Dibales": editor tempel balasan → `replyPatch`, menghitung `counts.replies` | "💬 Dia bales": sama, tapi **tidak** menghitung `counts.replies` | Tidak (label dan hitungan) |
| Tertarik | "✅ Tertarik", satu tap | "✅ Tertarik", satu tap, tanpa hitungan | Hitungan tidak sama |
| Pikir-pikir / Hubungi nanti | Ada (dengan tanggal) | **Tidak ada** | Tidak |
| Tidak tertarik | "❌ Tidak tertarik": alasan + parkir N hari | "❌ Nolak": tanpa alasan | Tidak |
| Kasih data → | ConvertSheet → Lead Hot, prospek jadi ETB. "{nama} masuk Leads sebagai Hot". **Tidak ada tautan ke lead-nya** | Sama | Ya, tapi tanpa aksi berikutnya |
| Jangan hubungi | "Kunci", **tanpa** konfirmasi kedua | Konfirmasi di tempat "…Ga bisa dibalikin." | Tidak, padahal ini aksi yang tidak bisa dibalik |
| Buang / Hapus | "🗑 Hapus" dengan ConfirmSheet | "🗑 Buang" **tanpa** konfirmasi, dan errornya tertelan (`ProspectThread.tsx:161`) | Tidak |
| Undo | Tidak ada untuk semua hasil | Tidak ada | — |

**Seharusnya:** satu daftar hasil dengan label dan efek yang sama di kedua tempat. Setiap hasil yang bisa dibalik dapat undo 10 dtk. Aksi yang tidak bisa dibalik (Jangan hubungi, Hapus) selalu bertanya sekali (AMB-09).

## D3. Lead

| Aksi | Pemicu | Perubahan state | Feedback | Undo | Konteks balik |
|---|---|---|---|---|---|
| Tulis / balas pesan | "Tulis pesan", tombol kartu "Balas / Kirim intro / Follow-up" | Lihat D1 | ChatNote + chip "Follow-up kapan?" | Sampai ditutup | Tombol kartu → daftar (PR #115). "Tulis pesan" → lembar lead |
| Tandai udah dikontak | Menu ⋯ (hanya Posisi "belum") | `lastContact`, `contactedAt`. **Tanpa** Outreach | "✓ Ditandai udah dikontak" + Batal | Sampai ditutup | Lembar lead |
| Mereka bales | Tombol di lembar | `markReplied` | "✓ Dicatat" **optimistis, tanpa catch**: tetap tampil walau gagal | — | Lembar lead |
| Jadwal | "Jadwal" → sheet Langkah berikutnya | `nextAction`, `nextActionDate` | Sheet tutup, **tanpa** konfirmasi | — | Lembar lead |
| Gugur | Ubah data → status "Gugur" → alasan + coba lagi | Lead Lost + Rejection Log | Sheet tutup, **tanpa** konfirmasi | **Tidak ada** | Lembar lead |
| Hapus lead | Menu ⋯ → "Hapus lead?" | `deleteDoc` | Kembali ke daftar, **tanpa** toast | Tidak ada (sudah diperingatkan) | Daftar |
| Buat penawaran | "Penawaran" | Pindah ke Penawaran + DocEditor | "‹ Kembali ke {lead}" (PR #115) | — | Lewat tombol kembali |

## D4. Penawaran dan invoice

| Aksi | Perubahan state | Feedback | Undo | Catatan |
|---|---|---|---|---|
| Simpan penawaran | `quotes/q_…` Draft | Editor tutup, **tanpa** toast | — | |
| Kirim penawaran | Terkirim + `sentAt`, kop dan syarat dikunci | "✓ Penawaran … tercatat terkirim" + Batal | Selama sheet terbuka | Dicatat tanpa bertanya (D1) |
| Tandai terkirim | Status + `sentAt`, **kop tidak dikunci** | Tidak ada | Tidak ada | Dua jalan menuju "Terkirim" dengan efek berbeda (AMB-10) |
| ✓ Disetujui / ✗ Ditolak | Status, `acceptedAt`, lead jadi Closed + nilainya, penawaran lama "Digantikan" | **Tidak ada** | **Tidak ada** | Mengubah Lead tanpa memberi tahu dan tanpa undo |
| Perpanjang 7 hari | `validUntil` | Tidak ada | Tidak ada | |
| Buat invoice DP | `invoices/inv_…` Draft + id di penawaran | Pindah ke Invoice, **tanpa** "Kembali ke Penawaran" | Tidak ada | **Ketuk dua kali = dua invoice** (AMB-11) |
| Terbitkan | Diterbitkan | Tidak ada | Tidak ada | |
| Catat pembayaran | `payments[]` (+ terbit kalau masih draf) | Dialog tutup | Hapus pembayaran (dengan konfirmasi) | |
| Batalkan invoice | Dibatalkan | ConfirmSheet | **Tidak bisa dibalik** | |

## D5. Script pesan

| Aksi | Perubahan state | Feedback | Undo |
|---|---|---|---|
| Simpan (baru / ubah) | `pitchTemplates/tpl_…` | Kembali ke daftar, **tanpa** toast | — |
| Duplikat | Dokumen baru tanpa default | "Disalin: …" | Tidak ada |
| Jadikan default | Default di tahap itu pindah | "… jadi default …" | Tidak ada |
| Arsipkan | `archived` + hapus default | "Diarsipkan: …" + Batal | 5 dtk |
| Balikin | Hapus `archived` | "Dibalikin: …" | Default **tidak** kembali |
| Hapus permanen | `deleteDoc` | ConfirmSheet | Tidak ada |

**Bagaimana script sampai ke pesan:**

| Tempat | Daftar yang dipakai | Urutan | Terisi otomatis? |
|---|---|---|---|
| Pesan ke lead (ChatPicker) | Bukan "hunting", brand yang diingat, tahap posisi lead | `rankScripts`, lalu **default dulu** | Ya, script teratas |
| Hunting, halaman Kirim (TemplateBoard) | Bukan "leads", dikelompokkan per tahap | **Judul saja**. Default dan brand diabaikan | Tidak, kecuali kartu "Saran" |
| Percakapan prospek | Sama dengan Hunting | Judul | Tidak, kotak pesan kosong |

Jadi **"Jadikan default" tidak berpengaruh di Hunting** (AMB-12).

## D6. Analisis Chat

| Aksi | Perubahan state | Feedback | Catatan |
|---|---|---|---|
| Analisis | `analyses/an_…` (kalau "Simpan" aktif dan speaker jelas), umur 90 hari | Hasil + scroll ke hasil | |
| Simpan sebagai script baru | `pitchTemplates/tpl_…` **tanpa workflow dan brand** | "Tersimpan jadi script …" | Tanpa busy, jadi ketuk dua kali = duplikat. Tidak ada tautan ke script-nya |
| Hapus riwayat (satu) | `deleteDoc` | Tidak ada | Tanpa konfirmasi, undo, atau catch |

## D7. Pola feedback yang dipakai sekarang

| Pola | Dipakai | Masalah |
|---|---|---|
| Toast dengan undo | Hunting (10 dtk), Script pesan (5 dtk), Percakapan (10 dtk) | Durasinya beda-beda |
| Catatan menetap dengan Batal | ChatNote lead, Beranda | Tidak pernah hilang sendiri. Hilang saat lembar dimuat ulang |
| ConfirmSheet | Hapus lead / journey / pembayaran / script, batalkan invoice | Jangan hubungi ("Kunci") dan Buang di Percakapan tidak memakainya |
| Teks di tempat (`role=status` / `alert`) | Hasil prospek, error | Kadang `status`, kadang `alert` |
| **Tidak ada sama sekali** | Status penawaran, Perpanjang, Buat invoice, Terbitkan, Tunda, Simpan penawaran / script, Gugur, Jadwal, hapus satu riwayat analisis | Pengguna tidak tahu apakah aksinya jalan |

Aturan feedback yang diusulkan ada di [ambiguities.md](ambiguities.md) (AMB-13).
