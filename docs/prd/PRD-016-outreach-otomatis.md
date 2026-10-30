# PRD-016 — Outreach otomatis dengan budget Rp 300rb/bulan

- **Status:** rencana, 23 Okt. Belum dibangun.
- **Terkait:** PRD-002 dan PRD-009 (Hunting, DNC), PRD-003 (Radar Threads), PRD-012 (Cari bisnis: email yang ditemukan, pesan pembuka), PRD-015 (akses dan batas bulanan), PRD-017 (paket dan penawaran yang dikirim).

## 1. Masalah

> "Gimana caranya make modal lu yang 300 ribu sebulan, sales pal bisa kirim penawaran dan perkenalan otomatis, baik channel instagram dll." (owner, 23 Okt)

Sekarang SalesPal cuma **menyiapkan** pesan pembuka. Pengirimannya tetap manual satu per satu: Salin, Kirim WA, atau sesi Hunting. Owner pengin perkenalan dan penawaran jalan sendiri, dengan total biaya maksimal Rp 300rb sebulan.

## 2. Batas tiap channel

Yang menentukan apa yang boleh otomatis adalah aturan platformnya, bukan kemampuan teknis kita.

| Channel | Kirim duluan otomatis ke orang yang belum pernah chat? | Yang boleh otomatis | Biaya | Kalau dilanggar |
|---|---|---|---|---|
| **Instagram** | ✗. API resmi cuma boleh membalas dalam **24 jam** setelah orangnya chat duluan. Komentar boleh dibalas **1 DM** dalam 7 hari (*private reply*). | Komentar kata kunci → 1 DM penawaran. Balas otomatis DM masuk. Semuanya dicatat jadi lead. | API gratis. Perlu akun IG Professional + Facebook Page + Meta App Review (`instagram_manage_messages`, `instagram_manage_comments`) | Bot atau API tidak resmi → akun dibatasi atau di-banned |
| **WhatsApp** | Hanya pakai **template yang disetujui Meta**, ke orang yang **sudah setuju** (opt-in) | Follow-up ke lead yang sudah chat atau mengisi form situs. Pengingat invoice. | ±Rp 590 per pesan marketing (tarif pihak ketiga, cek tarif Meta saat setup). Pesan utility lebih murah. | Kirim tanpa opt-in → kualitas nomor turun, nomor diblokir. Gateway tidak resmi → nomor di-banned |
| **Email** | ✓ untuk **kontak bisnis yang dipublikasikan**, asal identitas pengirim jelas dan ada link berhenti langganan | Urutan 3 email per lead | Domain ±Rp 200rb/tahun. Layanan kirim: paket gratis (cek batasnya saat setup) | Terlalu banyak atau tanpa izin DNS → masuk spam, domain di-blacklist |
| **Threads** | ✗ (membalas post orang secara otomatis = spam) | Radar (PRD-003) menemukan orang yang butuh jasa; DM tetap manual | gratis | akun dibatasi |

**Bukan opsi:** bot DM Instagram tidak resmi, gateway WhatsApp tidak resmi (Fonnte dan sejenisnya), dan kirim massal ke nomor hasil Cari bisnis. Murah, tapi akun atau nomor owner yang menanggung risikonya.

## 3. Budget

| Pos | Per bulan | Rem |
|---|---|---|
| Domain pengirim email (dibayar tahunan) | ±Rp 17rb | — |
| Layanan kirim email | Rp 0 (paket gratis) | batas harian di app (§4A) |
| AI nulis pesan personal | ≤ Rp 50rb | batas bulanan di app, cara PRD-015 (`takeMonthly`) |
| WhatsApp Cloud API (follow-up ke yang opt-in) | ≤ Rp 200rb (±340 pesan marketing) | batas bulanan di app + limit di Meta |
| Instagram (komentar → DM, balas DM) | Rp 0 | batas Meta |
| Google Places (Cari bisnis, cari alamat) | Rp 0 | sudah dibatasi di bawah jatah gratis (PRD-015) |
| **Total** | **≤ Rp 270rb** | |

Semua yang dihitung per pemakaian dapat batas bulanan di app. Budget alert saja tidak cukup, karena alert tidak menghentikan tagihan. Angka biaya AI dan batas paket gratis email dicek ulang sebelum fase itu dibangun.

## 4. Fase

### A. Email otomatis 3 langkah (dibangun pertama)
Alasannya: paling cepat jalan, paling murah, dan tidak menunggu review Meta.

- **Persiapan owner:** domain pengirim (mis. `halo@<domain>`), SPF + DKIM + DMARC di DNS, dan akun layanan kirim (Resend atau sejenisnya). **Koreksi 31 Okt:** Resend, SES, Mailgun, Postmark, dan Brevo melarang cold email atau mewajibkan opt-in, jadi bagian ini perlu ditulis ulang (PRD-022 §5.2). Env: `EMAIL_API_KEY`, `OUTREACH_FROM`.
- **Urutan per kampanye:** Perkenalan (hari 0) → Follow-up (hari 3) → Penutup (hari 7). Template pakai variabel PRD-012 §5 (`{nama} {kelemahan} {rating} {bisnis} {jasa}`) + link penawaran atau pricelist (PRD-017). Versi AI di fase D.
- **Masuk urutan cuma kalau dipilih owner.** Di Leads atau hasil Cari bisnis ada centang **"Masukkan ke urutan email"**, dan cuma lead yang punya email yang bisa dicentang. Tidak ada kirim ke semua lead.
- **Pengiriman:** Vercel Cron tiap jam kerja (Senin–Jumat, 09–16 WIB), maksimal `OUTREACH_DAILY_LIMIT` (bawaan 25) per hari untuk seluruh akun, dengan jeda acak.
- **Berhenti sendiri** kalau: dibalas (webhook email masuk, atau tombol "Dibales" di lead), klik berhenti langganan (`/u/{token}`), email mental (bounce), atau lead masuk DNC (PRD-009).
- **Data:** status urutan per lead (`step`, `nextAt`, `status: aktif | dibales | berhenti | mental`) dan antrean kirim khusus server. **Koleksi baru wajib ditambahkan ke `firestore.rules`** (deploy rules menggantikan semuanya) beserta tesnya.
- **Ukuran sukses:** tingkat balasan per langkah, per template, per kategori bisnis.

### B. Instagram: komentar → DM, balas DM masuk
- Owner pasang post atau Reels dengan ajakan ("komen MAU buat pricelist") → SalesPal kirim 1 DM berisi penawaran + link → orangnya jadi lead (sumber Instagram, post-nya dicatat).
- DM masuk → balasan otomatis dengan tombol (Lihat harga · Tanya jadwal · Ngobrol sama orang). Jendela 24 jam dihormati; lewat dari itu tetap balasan manual.
- Butuh: Meta app (bisa sama dengan app Threads, PRD-003), App Review + verifikasi bisnis, endpoint webhook `/api/ig/webhook`, token di brankas `connections` (PRD-006).

### C. WhatsApp Cloud API untuk yang sudah setuju
- Template follow-up penawaran (marketing) dan pengingat invoice (utility), dikirim **hanya ke lead yang punya opt-in**: dia chat duluan, atau mencentang izin di form situs (perlu tambahan di `creative-hub/standards/leads.md`).
- Cek dulu apakah nomor yang sekarang dipakai di aplikasi WhatsApp Business bisa sekaligus dipakai di API (*coexistence*). Kalau tidak bisa, pakai nomor terpisah.

### D. AI menulis pesan personal
- Dari titik lemah (PRD-012 §4), jasa di Kop & logo, dan paket yang cocok (PRD-017). Tidak pernah mengarang keluhan yang tidak ada di ulasan.
- Owner bisa lihat dan ubah sebelum masuk urutan. Batas bulanan seperti PRD-015.

## 5. Aturan main
- Yang dihubungi cuma **kontak bisnis yang dipublikasikan** atau yang sudah setuju. Ikuti UU PDP (UU 27/2022): simpan seperlunya, hapus kalau diminta.
- Tiap pesan pertama menyebut jelas siapa pengirimnya dan menyediakan cara berhenti. Permintaan berhenti dicatat di DNC dan berlaku di semua channel.
- Tidak ada kirim massal tanpa pilih. Batas harian berlaku untuk seluruh app, bukan per akun.

## 6. Keputusan owner
1. Domain pengirim: pakai domain yang ada atau beli baru khusus outreach? Domain terpisah melindungi domain utama dari risiko spam.
2. Siapa yang boleh menjalankan urutan: owner saja, atau peran guild yang diizinkan (cara PRD-015)?
3. Nomor WhatsApp untuk fase C.
4. Kata kunci komentar IG dan isi DM pertamanya.
