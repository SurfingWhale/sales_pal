# PRD-012 — Cari bisnis: calon klien dari Google Maps dan daftar Excel

- **Status:** MVP dibangun 22 Okt (§6). Fase berikutnya di §7.
- **Tanggal:** 2026-10-22
- **Konteks:** Owner lihat "Mapileads" (alat bikinan Claude Code yang nyari bisnis di Google Maps, ngambil email & telepon, baca sampai 50 ulasan buat nyari titik lemah, terus bikin cold email yang dipersonalisasi). Minta fitur serupa di Beranda: MVP dulu, plus cara bebas narik data dan import Excel dengan template dari SalesPal.
- **Terkait:** PRD-008 (skor potensi, profil lead), PRD-009 (Hunting), PRD-011 (bisnis & dokumen).

---

## 1. Masalah

Freelancer kreatif butuh calon klien yang **punya masalah yang bisa dia bantu** (menu tanpa foto, belum punya website, ulasan ngeluh soal tampilan). Nyarinya manual di Google Maps itu lama, dan hasilnya tercecer di screenshot.

## 2. Cara narik data — pilihan dan putusannya

| Cara | Legal / ketentuan | Data yang didapat | Biaya | Putusan |
|---|---|---|---|---|
| **Scrape langsung maps.google.com** (headless browser, parsing HTML) | **Melanggar Ketentuan Layanan Google Maps Platform** (dilarang ngambil data di luar API). IP gampang diblok, HTML sering berubah | Semua yang kelihatan | "Gratis" tapi rapuh dan berisiko akun/IP | **Tidak dibangun di SalesPal** |
| **Google Places API (New)** — Text Search + field mask | Resmi, pakai API key owner | Nama, kategori, alamat, telepon, website, rating, jumlah ulasan, link Maps, **maksimal 5 ulasan** per tempat | Bayar per permintaan (SKU Text Search tingkat Enterprise + Atmosphere karena minta ulasan). Ada kredit bulanan dari Google; cek harga terbaru di console | **Dipakai di MVP** (`app/api/places`) |
| **Layanan pihak ketiga** (Outscraper, Apify, SerpAPI, dll.) | Tanggung jawab penyedia; baca ketentuan masing-masing | Bisa sampai puluhan–ratusan ulasan, email | Per hasil / langganan | **Fase 2** sebagai sumber opsional (API key owner), lewat route server yang sama |
| **Ekstensi browser / ekspor tool lain → Excel** (kayak di screenshot) | Tanggung jawab pemakai tool | Apa pun yang diekspor | Tergantung tool | **Didukung sekarang lewat template Excel** |
| **Isi manual / tempel dari spreadsheet** | Aman | Apa pun | — | Didukung (template + import) |

Kenapa Places API dan bukan scraping: fitur yang jalan di Vercel dengan akun Google owner tidak boleh bergantung pada pelanggaran ketentuan yang bisa mematikan akun Cloud-nya, dan scraping HTML pecah tiap Google ganti tampilan.

## 3. Email

- **Places API tidak memberi email.**
- MVP: centang "Cari juga email di website-nya": server buka **halaman website bisnis itu sendiri** (beranda, `/kontak`, `/contact`, `/hubungi-kami`), ambil alamat email yang tertulis publik, utamakan yang domainnya sama dengan website. Cuma host publik (bukan IP/alamat internal), maksimal satu redirect, timeout 4 detik per halaman. Label di app: email **ditemukan**, bukan **diverifikasi**.
- Fase 2 — **verifikasi**: cek MX domain (server, DNS), opsional layanan verifikasi (ZeroBounce/NeverBounce/Hunter) pakai key owner. Status per email: `ditemukan` → `domain valid` → `terverifikasi` / `gagal`.
- Ga ada tebak-tebakan pola email (`nama@domain`) yang dikirim tanpa verifikasi.

## 4. Titik lemah

- **MVP (aturan, tanpa AI):** belum punya website · rating di bawah 4,3 · ulasan di bawah 20 · tema keluhan di ulasan 1–3★ (pelayanan, lama nunggu, harga, kebersihan, kualitas, foto/tampilan beda, info/kontak) + kutipan ulasan terburuk. Sengaja umum: SalesPal dipakai lebih dari sekadar fotografer (PRD-011).
- Fase 2 — **AI**: kirim sampai 50 ulasan (dari sumber pihak ketiga) ke model (server, kuota harian seperti `/api/scan`), minta 3 titik lemah yang **relevan dengan jasa di Kop & logo** ("Jasa apa") beserta bukti kutipannya. Jangan pernah mengarang keluhan yang ga ada di ulasan.

## 5. Pesan pembuka

- Template yang bisa diubah: `{nama} {kelemahan} {rating} {bisnis} {jasa}`; `{bisnis}` dan `{jasa}` dari Kop & logo. Kalau ga ada titik lemah, klausanya hilang sendiri.
- Kirim: **Salin pesan** atau **Kirim WA** (kalau ada nomor). Email langsung dari app **ditunda**: butuh domain pengirim terverifikasi dan batas kirim biar ga jadi spam.
- **Etika & aturan:** kontak yang dipakai itu kontak **bisnis yang dipublikasikan**. Pesan pertama harus jelas siapa pengirimnya dan gampang bilang "ga tertarik" (dicatat sebagai DNC seperti di Hunting). Ikuti UU PDP (UU 27/2022): simpan seperlunya, hapus kalau diminta. Ga ada kirim massal otomatis.

## 6. MVP — dibangun 22 Okt

- **Beranda → kartu "Cari calon klien" → Cari bisnis** (`components/LeadFinder.tsx`):
  1. Ketik yang dicari ("coffee shop Jakarta Selatan"), opsional cari email.
  2. Hasil (20 per halaman, **Muat 20 lagi**): nama, kategori, rating, alamat, telepon/email/website/link Maps, chip titik lemah, kutipan ulasan terburuk.
  3. Yang punya titik lemah otomatis kecentang; yang udah ada di Leads ditandai dan ga bisa dipilih lagi.
  4. **Salin pesan / Kirim WA** per bisnis; template pesan bisa diubah (disimpan di HP ini).
  5. **Simpan N jadi lead**: Cold, sumber "Google Maps", catatan berisi titik lemah dan ulasan, `profile.pain` = titik lemah. ID lead = ID tempat Google (`gm_…`), jadi ga pernah dobel.
- **Server** `app/api/places/route.ts`: login wajib, kuota harian (`PLACES_DAILY_LIMIT`, bawaan 30 pencarian/user/hari), `GOOGLE_PLACES_API_KEY`. Tanpa key: pesan jelas + arahan pakai Import Excel.
- **Template Excel** (`SalesPal-template-leads.xlsx`, tombol **Download template Excel**): sheet **Leads** (satu baris contoh) + sheet **Panduan**. Kolom:

| Kolom | Wajib | Masuk ke |
|---|---|---|
| Nama Bisnis | ya | `name` |
| Kategori | | `category` |
| Alamat | | `address` |
| No. HP | | `phone` |
| Email | | `email` |
| Website | | `website` (kosong = titik lemah) |
| Rating | | `rating` (1–5, koma/titik) |
| Jumlah Ulasan | | `reviewCount` |
| Link Google Maps | | `mapsUrl` |
| Titik Lemah | | `profile.pain` (pisah pakai `;`) |
| Kontak | | `contact` |
| Catatan | | `notes` |
| Status | | Cold/Warm/Hot/Closed |
| Value (Rp) | | `value` |

  Importer yang udah ada (Leads → Import) memetakan kolom ini otomatis; kolom lain dari ekspor tool apa pun tetap bisa dipetakan manual.
- **Tes:** flow `cari bisnis` (respon Google di-mock): titik lemah muncul, pesan berisi nama + titik lemah, simpan sekali (pencarian ulang menandai "udah ada di Leads"), template punya kolomnya, template yang diisi bisa di-import balik. Audit HIG 0.

### Yang harus owner lakukan biar pencarian Google jalan

Satu key dipakai buat dua hal: **Cari bisnis** (`/api/places`) dan **Cari alamat** lokasi lead (`/api/geocode`, PRD-013). Key cuma disimpan di server Vercel, ga pernah sampai ke browser.

1. **Bikin project.** Buka https://console.cloud.google.com/projectcreate → nama mis. `salespal` → Create. Pastikan project itu yang kepilih di atas.
2. **Nyalain billing.** https://console.cloud.google.com/billing → Link a billing account (kartu kredit/debit). Wajib walau pemakaiannya masih di jatah gratis bulanan.
3. **Aktifin API-nya.** https://console.cloud.google.com/apis/library/places.googleapis.com → pastiin judulnya **Places API (New)**, bukan "Places API" lama → **Enable**.
4. **Bikin key.** https://console.cloud.google.com/apis/credentials → **Create credentials → API key** → salin.
5. **Kunci key-nya** (tombol Edit API key di halaman yang sama):
   - *API restrictions* → **Restrict key** → centang **Places API (New)** aja → Save.
   - *Application restrictions* → biarin **None**: key dipanggil dari server Vercel yang IP-nya ganti-ganti, bukan dari browser.
6. **Pasang rem biaya:**
   - Kuota: https://console.cloud.google.com/apis/api/places.googleapis.com/quotas → *SearchText requests per day* → mis. **300**. Mau pasti **Rp 0**: isi **30**: 30 × 30 hari tetap di bawah 1.000 jatah gratis Cari bisnis. Kuota ini yang benar-benar menghentikan permintaan; budget cuma ngasih tahu.
   - Budget: Billing → **Budgets & alerts** → Create budget mis. **Rp 100.000/bulan**, alert email 50% dan 90%.
   - Di app sendiri udah ada batas per user per hari: `PLACES_DAILY_LIMIT` (bawaan 30 pencarian) dan `GEOCODE_DAILY_LIMIT` (bawaan 100 cari alamat).
7. **Masukin ke Vercel.** Vercel → project SalesPal → **Settings → Environment Variables** → Add:
   - `GOOGLE_PLACES_API_KEY` = key tadi, centang **Production** dan **Preview**.
   - Opsional: `PLACES_DAILY_LIMIT`, `GEOCODE_DAILY_LIMIT`.
8. **Redeploy.** Vercel → Deployments → deployment terbaru → ⋯ → **Redeploy** (env baru cuma kebaca di build berikutnya).
9. **Tes.** Beranda → Cari calon klien → Cari bisnis → "coffee shop Jakarta Selatan". Terus buka satu lead → Lokasi → Atur lokasi → Cari.

**Biaya:** Cari bisnis minta ulasan, jadi kena SKU *Text Search Enterprise + Atmosphere*; Cari alamat kena SKU *Text Search Pro*. Google ngasih jatah gratis per SKU tiap bulan (sejak Maret 2025 bentuknya kuota gratis per SKU, bukan kredit $200). Cek angka terbaru di halaman pricing Google Maps Platform sebelum dipakai banyak. Satu pencarian = sampai 20 bisnis, jadi 30 pencarian/hari ≈ 600 bisnis/hari.

**Tanpa key:** Cari bisnis minta Import Excel; Cari alamat di Lokasi lead tetap jalan gratis lewat OpenStreetMap, dan tempel link Google Maps ga butuh key sama sekali (PRD-013 §4).

**Kalau error:**

| Pesan di app | Artinya | Benerin |
|---|---|---|
| "…GOOGLE_PLACES_API_KEY belum diisi di server…" | Env belum ada di deployment ini | Langkah 7–8 (jangan lupa Redeploy) |
| "Google Maps nolak permintaan: …has not been used in project… / disabled" | API belum di-enable, atau enable-nya belum nyebar | Langkah 3, tunggu ±5 menit |
| "…API key not valid…" | Salah salin key, atau key dibatasi ke API lain | Salin ulang; cek langkah 5 |
| "…billing…" | Billing belum ke-link | Langkah 2 |
| "Batas pencarian hari ini (30) udah habis" | Batas per user di app | Naikin `PLACES_DAILY_LIMIT` |

## 7. Fase berikutnya

| Fase | Isi | Butuh |
|---|---|---|
| 2a | **Sumber pihak ketiga** (Outscraper/Apify) di route yang sama: lebih banyak ulasan (sampai 50), email dari penyedia | API key owner, kuota |
| 2b | **Verifikasi email** (MX + layanan verifikasi) dengan status per email | Key layanan verifikasi |
| 2c | **Titik lemah pakai AI** dari ulasan, relevan dengan jasa di Kop & logo, dengan bukti kutipan | Kuota AI seperti `/api/scan` |
| 2d | **Simpan pencarian** + jalankan ulang mingguan, tandai bisnis baru | Koleksi `searches` (perlu tambahan di rules) |
| 3 | **Kirim email dari app** (domain terverifikasi, batas harian, unsubscribe) dan urutan follow-up | Layanan email (Resend/SES), DNS SPF/DKIM |
| 3 | **Peta hasil** di Peta lead Beranda | — |

## 8. Risiko

- **Biaya API:** tiap pencarian bayar; kuota harian per user menahan. Field mask cuma minta yang dipakai.
- **Kualitas titik lemah:** cuma 5 ulasan dari Places; ditulis sebagai petunjuk, bukan vonis. Penjual tetap baca ulasannya sebelum kirim.
- **Email salah alamat:** ditandai "ditemukan", bukan "diverifikasi", sampai fase 2b.
- **Spam & reputasi:** ga ada kirim massal; satu pesan per tap.
