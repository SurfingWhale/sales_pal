# Audit satu hari kerja — 31 Okt 2026

Pertanyaan: bisa jualan murah pakai SalesPal, dan fitur mana yang menghambat?

**Jawaban:** biayanya murah, kecuali hosting. Yang menghambat adalah alur kerja: alur intro lambat, Hunting tidak nyambung ke Leads, dan biaya alat salah model.

## Cara uji

- **Uji jalan:** flow `sehari kerja`, production build, Chromium 1280×900, akun simulasi 142 lead, 4 script, 1 paket.
- **Baca kode** di `main` `9c501df`.
- **Screenshot QA-4** dari pemakaian asli owner.
- **Riset harga:** harga resmi per Oktober 2026 kalau terbaca. Yang dari pihak ketiga ditandai.

Tap dihitung dari klik di halaman. Waktu tidak dilaporkan, karena robot jauh lebih cepat dari orang.

## Hasil uji jalan

| Pekerjaan | Tap | Temuan |
|---|---:|---|
| Lihat siapa yang bales | 3 | Lancar |
| Balas satu orang | 3 | Lancar |
| Intro 5 lead | 16 | Tiga tap per orang, balik ke daftar tiap kali. 12 orang ±36 tap |
| Cari lead di Hunting | 1 | 0 ketemu, Enter mengisi target prospek baru |
| Import 20 dari Excel | 5 | Lancar, tapi tanpa cek dobel |
| Cari di Maps, simpan 20 | 15 | Tanpa Pilih semua, 10 centang manual |
| Catat "dia bales" | 7 | Tombolnya di dalam lipatan skor |
| Bikin penawaran dari lead | 4 | Lancar |
| Kirim penawaran | 4 | Lancar |
| Setuju dan invoice DP | 4 | Lancar |
| Paket 300 ribu, modal kamera 15 juta | 4 | Margin -4900%, tanpa peringatan |
| Jalur penyusutan | 4 | Form ada, tapi tidak bisa dipasang ke paket |
| Rekap sore | 2 | Intro WhatsApp masuk Catatan, Hunting 0 |

## Kelemahan per fitur

P1 = menghalangi kerja harian. P2 = bikin lambat atau bingung. P3 = rapikan.

| Fitur | Level | Kelemahan | Bukti |
|---|---|---|---|
| Chat | P1 | Script Threads ("aku lihat postingan kakak") muncul buat lead Maps | Screenshot QA-4. Script tidak punya `workflow` |
| Chat | P1 | Modal di atas modal | `ChatPicker` sebagai `Sheet` di atas `LeadPage` |
| Chat | P1 | Tercatat saat tombol dipencet, bukan saat terkirim | `logContact` di `onSend`. `wa.me` tidak memberi kabar balik |
| Chat | P1 | Tidak ada lanjut ke orang berikutnya | Uji jalan |
| Chat | P2 | Teks rusak: "Hello kakLa Alcienda", kalimat bolong kalau kebutuhan kosong | Screenshot QA-4 |
| Lembar kerja | P1 | Script salah tahap: lead dengan penawaran disarankan Gali kebutuhan | `leadStage` hanya membaca status |
| Lembar kerja | P1 | Tiga tombol biru buat satu aksi | `LeadPage` |
| Lembar kerja | P1 | Mereka bales tersembunyi | `Why` di dalam lipatan skor |
| Leads | P1 | Belum dikontak merah, warna yang sama dengan Hot | `standOf` |
| Leads | P2 | Tanda kontak dibaca dari Outreach, yang tidak terbaca Member lain di guild | `spaceQuery`, `withStand` |
| Leads | P2 | Status dan urutan kepotong di HP | Screenshot audit 30 Okt |
| Hunting | P1 | Tidak bisa mencari lead, dan Enter menyiapkan prospek baru | `commitSearch` di `Hunting.tsx:410` |
| Hunting | P2 | Kalender di Performa isinya job, bukan outreach | `OccupancyCalendar` |
| Hunting | P2 | Tiap baris log punya tujuh tombol | Screenshot QA-4 |
| Hunting | P2 | Target 20 DM per hari melebihi angka aman buat WhatsApp | Riset §WhatsApp |
| Cari bisnis | P1 | Tanpa Pilih semua, centang otomatis hanya yang punya titik lemah | `LeadFinder.tsx:85` |
| Cari bisnis | P1 | Cek dobel harus nama dan nomor persis, jadi beda ejaan lolos | `LeadFinder.tsx:67` |
| Import | P2 | Tidak ada cek dobel | `runImport` |
| Import | P2 | Excel terkubur di bawah Cari bisnis | `LeadFinder.tsx:197` |
| Scan gambar | P1 | Fitur mati dan pesan teknis terbaca user | `app/api/scan/route.ts:56` |
| Scan gambar | P2 | Model bawaan tidak lagi tercantum di dokumentasi xAI | `app/api/scan/route.ts:72`, belum dites |
| Paket | P1 | Kamera 15 juta diterima sebagai biaya satu paket | `Services.tsx` |
| Paket | P1 | Penyusutan tidak bisa dipasang ke paket | `Service` hanya punya `cost` |
| Penawaran | P3 | Modal alat harus ditambah per penawaran | `production` di `DocEditor` |
| Peta | P2 | Tidak ada cari dan layar penuh | `GeoMap.tsx` |
| Peta | P2 | Pin susah dibaca, belum ada cluster | PRD-019 §3.1 |
| Log aktivitas | P2 | Intro WhatsApp tercatat sebagai Catatan | Uji jalan |
| Log aktivitas | P2 | Tidak ada jawaban "berapa kekirim hari ini" | Uji jalan |
| PRD-016 | P1 | Rencana email memakai Resend, yang melarang cold outreach | PRD-016 baris 44 |
| Hosting | P1 | Vercel Hobby tidak boleh dipakai komersial | Paket aktif belum terbaca, cek di dashboard |

**Yang sudah baik:** penawaran sampai invoice, import Excel, posisi lead setelah PRD-021, kolom Tempel, cek rules per peran.

## Biaya

Kurs ±Rp 18.100 per dolar. Harga per Oktober 2026.

| Pos | Harga | Catatan |
|---|---|---|
| Firebase Spark | Rp 0 | 50 ribu baca, 20 ribu tulis per hari. Di batas, berhenti |
| Places Text Search Enterprise + Atmosphere | 1.000 panggilan gratis per bulan, lalu $40 per 1.000 | Dikunci 900 per bulan, tiap panggilan sampai 20 bisnis |
| Vercel Hobby | Rp 0 | Non-komersial |
| Vercel Pro | $20, ±Rp 363.000 per bulan | Melewati budget sendirian |
| Domain | ±Rp 219.000 per tahun | |
| WhatsApp Business app | Rp 0 | Tanpa angka aman resmi |
| WhatsApp Cloud API, Indonesia | Marketing Rp 586,33, utility Rp 356,65 | Sebelum PPN. Sumber vendor, bukan rate card Meta |
| Layanan WhatsApp lewat vendor | Rp 740.000 ke atas per bulan | Melewati budget |
| Email: sending API | Hampir gratis | Melarang cold email |
| Email: mailbox | Zoho Free Rp 0, Google Workspace ±Rp 141.000 per bulan setelah tahun pertama | Zoho melarang promosi, Google melarang massal |
| Baca gambar | ±Rp 6 per scan (Gemini), ±Rp 115 (Grok) | Perkiraan |

**Pembanding:** HubSpot Free dan Bigin Free gratis tapi tanpa WhatsApp di CRM. Bigin Express ±Rp 127.000–163.000 per bulan ditambah biaya Meta. Tool foto mulai $16 per bulan. Dari sisi lisensi SalesPal tidak lebih murah. Keunggulannya kecocokan: script, WhatsApp, penawaran, dan biaya per job dalam satu alur.

**Celah pasar:** tool foto dan CRM yang dicek tidak ada yang menyebar biaya alat ke per job.

Laporan lengkap dan sumbernya ada di catatan riset owner, di luar repo.

## Yang belum diuji

- WhatsApp dan Maps di uji jalan dimock, jadi perilaku aslinya belum kena.
- Perilaku WhatsApp asli, termasuk pembatasan akun.
- Dark mode.
- Pemakaian oleh Member guild.
- Angka balasan lokal: tolok ukur Indonesia tidak ditemukan.

## Arah

Rencana dan urutannya ada di PRD-022.
