# PRD-011 — Guild sebagai identitas bisnis, dan alur dokumen jualan

- **Status:** Disetujui owner 22 Okt ("SPK dll buat lebih mudah digunakan ketika mau mengirimkan penawaran"). Tahap 1 dibangun (§9). Sisanya ikut urutan §5.
- **Tanggal:** 2026-10-22
- **Konteks:** Owner ngejalanin BeUntamed (fotografi, punya nama brand dan logo PNG) dan mau Guild jadi lapisan identitas + konfigurasi bisnis yang beneran, bukan sekadar field profil. SalesPal juga bakal dipakai bisnis lain, jadi BeUntamed harus jadi *satu bisnis yang pakai SalesPal*, bukan model bawaan aplikasi. Permintaan kedua: alur dokumen jualan (penawaran, perjanjian kerja, invoice, DP/termin, NDA, creative brief) buat freelancer kreatif.
- **Terkait:** PRD-005 (Report Klien), PRD-007 (Guild + ruang kerja), PRD-009 (Hunting), PRD-010 (standar native).

Bagian 1 cuma fakta yang udah dicek di kode. Asumsi ditandai **[asumsi]**. Rekomendasi ditandai **[usul]**.

---

## 1. Fakta terverifikasi (kode per commit `0183c64`)

### 1.1 Guild dan ruang kerja
- Ada dua jenis ruang kerja (`lib/space.ts`): **Pribadi** (`users/{uid}/…`) dan **Guild** (`guilds/{g}/…`). Pemilih ruang kerja ada di header (`#space-pick`, `components/SalesTracker.tsx`).
- Guild: `guilds/{g}` `{ name, leaderUid, titles, createdAt }`, anggota di `guilds/{g}/members/{uid}` `{ uid, name, email, role, avatar? … }` (`lib/guild.ts`).
- **Multi-user: ya.** Empat peran (Leader, Officer, Member, Viewer), undangan lewat link 7 hari, serah-terima Leader, keluarkan anggota. Semuanya ditegakkan `firestore.rules` dan dites per peran (`tests/firestore.rules.test.mjs`, 143 tes).
- **Satu user di banyak guild: ya.** `users/{uid}/guilds/{g}` nyimpen daftar guild-nya; ruang kerja dipilih di header.
- **Satu user punya satu guild: tidak dibatasi.** Siapa pun bisa bikin guild baru.
- **Isolasi data ditegakkan rules, bukan cuma UI.** Di guild, data "owned" (`leads, outreach, rejections, hunts, prospects, huntSessions, quotes, invoices, clients`) punya `ownerUid`: Member cuma baca/ubah punya sendiri, Leader/Officer semua. Data "catalog" (`services, pitchTemplates, settings, campaigns, costs`) dibaca semua seller, diubah Leader/Officer. Viewer ga bisa baca keduanya.
- Data Pribadi dan Guild terpisah per path. Pindah data Pribadi → Guild ada (`lib/moveToGuild.ts`, PRD-007 §2.7).

### 1.2 Identitas bisnis yang udah ada
- **Per ruang kerja**, di `{ruang}/settings/business` (`Business`, `lib/billing.ts:86`): `name, tagline, logo (data URL ≤ ~120 KB), address, phone, email, bank, accountNo, accountName, footer (S&K)`. Diedit di **Kop & logo** (`components/BusinessEditor.tsx`).
- Guild juga punya **lambang** sendiri di `guilds/{g}/settings/look` `{ color, emblem, logo }` (PRD-007 susulan). Jadi sekarang ada **dua logo** buat satu guild: logo kop (dokumen) dan logo lambang (banner). Nama juga dua: `guilds/{g}.name` dan `settings/business.name`.
- Ga ada: nama legal vs nama tampilan, deskripsi bisnis, kategori/industri, website/sosmed, warna brand, alamat surat terpisah, NPWP/pajak, beberapa rekening/metode bayar.

### 1.3 Layanan dan harga
- Katalog **Paket** = koleksi `services` per ruang kerja (`components/Services.tsx`): `name, category, price, unit, description`.
- Ga ada: deliverables bawaan, estimasi durasi, jatah revisi, add-on, biaya tambahan.

### 1.4 Dokumen yang udah ada
- **Penawaran** (`quotes`, `components/Quotes.tsx`): nomor `Q-YYMM-NNN`, tanggal, `validUntil` (bawaan +14 hari), klien (disalin dari lead: `leadId, leadName, contact, phone`), project/tanggal/jam/lokasi/deliverables (`Brief`), item (`name, qty, price, description`), diskon, `dpPercent` (bawaan 50), catatan.
  - Status: `Draft → Terkirim → Disetujui / Ditolak`. "Kedaluwarsa" dihitung, bukan disimpan.
  - Disetujui → lead otomatis jadi Closed.
  - **Penawaran yang udah Disetujui masih bisa di-Edit dan ditimpa langsung.** Ga ada versi atau riwayat.
- **Invoice** (`invoices`, `components/Invoices.tsx`): nomor `INV-YYMM-NNN`, `quoteId`, klien (disalin), item, diskon, `dpPercent`, `dueDate` (+7 hari), `payments[]` `{date, amount, note}`.
  - **Pembayaran sebagian: ya.** Status pembayaran dihitung: `Belum bayar / DP masuk / Telat / Lunas`. Bikin invoice **ga** otomatis menandai lunas.
  - Ga ada status terbit terpisah (Draft / Diterbitkan / Dibatalkan).
  - "Buat invoice" dari penawaran yang Disetujui nyalin item, diskon, DP%, catatan, dan brief. **Satu penawaran → satu invoice.** Ga ada jadwal termin.
- **PDF**: dibikin di HP (`lib/pdfDoc.ts`, jsPDF), pratinjau di `components/PrintSheet.tsx`. **PDF ga disimpan**; tiap kali dibuka, dibikin ulang.
- **Identitas bisnis dan S&K di PDF diambil live** dari `settings/business` saat dicetak. Artinya **ganti rekening, logo, atau S&K hari ini mengubah tampilan semua penawaran/invoice lama** saat dicetak ulang. Ini bertentangan langsung sama aturan "default yang diubah ga boleh menulis ulang dokumen yang udah terbit".
- **Penomoran** dihitung di HP dari nomor yang kelihatan (`nextNumber`, `lib/billing.ts:176`). Di guild, Member cuma lihat dokumen miliknya, jadi **dua Member bisa dapet nomor yang sama** (mis. dua `INV-2610-001`).
- Ga ada: Perjanjian Kerja/SPK, NDA, creative brief, status tanda tangan, Cloud Storage (logo disimpan sebagai data URL di dokumen Firestore).

### 1.5 Lead, klien, tahap jualan
- **Lead** (`leads`): `status` Hot/Warm/Cold/Closed, skor potensi, profil (kebutuhan, keberatan, tipe customer), jadwal follow-up. Penawaran dan invoice **nyalin** nama/kontak/nomor lead, bukan merujuk ke entitas klien.
- **"Klien" di Report Klien** (`clients/{c}/deals`) itu konsep lain: brand yang sosmednya dikelola, dengan deal bertahap `lead → qualified → quoted → won → paid` (`lib/funnel.ts`). Bukan buku alamat klien jasa.
- **Hunting** punya tahap journey sendiri (PRD-009).
- Tahap jualan **ga bisa dikonfigurasi** per bisnis.

### 1.6 Yang di-hardcode ke bisnis owner (melanggar prinsip "BeUntamed = satu pengguna")
- `components/BusinessEditor.tsx`: preset logo **beUntamed, Visufavor, UNTMD Sports** muncul buat semua user.
- `components/QuickPitch.tsx:20-21`: template awal "Aku fotografer makanan freelance… foto menu".
- `lib/inbound.ts:28`: kategori lead per situs owner (visufavor → F&B, dll). Ini memang integrasi situs owner (standar leads di creative-hub), bukan logika umum.
- `lib/templates.ts:58`: contoh `{bisnis}` = "Visufavor".
- Landing (`app/page.tsx`): contoh paket foto. Ini contoh di halaman publik, wajar, tapi harus netral.

## 2. Jawaban enam pertanyaan Guild

1. **Implementasi Guild sekarang:** ruang kerja tim lengkap dengan peran, undangan, pipeline, target, report tim, lambang (§1.1). Bukan sekadar field profil.
2. **Field yang udah ada:** §1.2–1.4.
3. **Invoice dapet identitas dari mana:** bisnis = `settings/business` ruang kerja aktif, **live saat cetak**. Klien = salinan dari lead/penawaran saat invoice dibuat (§1.4).
4. **Multi-bisnis / multi-user:** ya dan ya, dengan isolasi di rules (§1.1). Pribadi pun berfungsi sebagai "bisnis" sendiri (freelancer solo).
5. **Yang harus berubah:** bukan modelnya, tapi (a) **snapshot** identitas + syarat ke dokumen saat diterbitkan, (b) satu sumber identitas per ruang kerja (gabung nama/logo guild dan kop), (c) default dokumen yang dikonfigurasi per bisnis lalu disalin ke dokumen, (d) penomoran yang aman di guild, (e) buang hardcode bisnis owner dari kode umum.
6. **Rencana:** §5.

**[usul] Model domain:** jangan bikin entitas baru "Business" atau "Organization". **Ruang kerja (Pribadi atau Guild) sudah adalah bisnisnya**: path root (`users/{uid}` atau `guilds/{g}`) adalah ID bisnis yang stabil, rules udah menegakkan batasnya, dan semua data owned/catalog udah ada di bawahnya. Di UI, Guild tetap "Guild"; halaman pengaturannya dinamai **Profil bisnis**.

## 3. Model domain dokumen [usul]

```
Lead ──(bikin)──▶ Penawaran v1 ──revisi──▶ Penawaran v2 (yang berlaku)
                      │ disetujui
                      ├──▶ Perjanjian Kerja (opsional; status tanda tangan sendiri)
                      └──▶ Jadwal bayar: [DP 50%, Pelunasan 50%]  ← salinan default bisnis, bisa diubah
                                 │ per baris jadwal
                                 └──▶ Invoice (terbit/batal) ──▶ Pembayaran[] (yang udah ada)
NDA, Creative brief: dokumen opsional yang nempel ke lead/penawaran, ga wajib.
```

- **Klien:** tetap pakai Lead sebagai sumber, plus salinan di tiap dokumen (udah begitu sekarang). Buku alamat klien terpisah **ditunda**.
- **Project:** di MVP, "project" = penawaran yang disetujui + `Brief`-nya (udah ada). Entitas project terpisah **ditunda**.
- **Status dipisah, ga digabung:**
  - Penawaran: `Draft → Terkirim → Disetujui / Ditolak / Digantikan`; Kedaluwarsa tetap dihitung dari `validUntil`.
  - Perjanjian: `Draft → Dikirim → Ditandatangani / Ditolak / Digantikan`. Generate ≠ ditandatangani.
  - Invoice: terbit `Draft / Diterbitkan / Dibatalkan` **terpisah** dari pembayaran `Belum bayar / Sebagian / Lunas / Telat` (yang udah ada).
- **Nilai yang dibedakan:** total disepakati (penawaran berlaku) · kewajiban terjadwal (jadwal bayar) · ditagih (invoice terbit) · diterima (pembayaran) · sisa (disepakati − diterima).

## 4. Aturan bisnis kunci [usul]

- **Snapshot saat terbit.** Saat penawaran ditandai Terkirim/Disetujui atau invoice Diterbitkan, salin `issuer` (nama tampilan, nama legal, logo, alamat, kontak, rekening) dan `terms` (S&K, revisi, pembatalan) ke dokumennya. PDF pakai snapshot itu. Draft tetap ngikutin bisnis live.
- **Penawaran yang disetujui dikunci.** Edit = bikin revisi baru (`Q-…-r2`, `supersedes`), yang lama jadi Digantikan dan tetap kebaca.
- **Default disalin, bukan dirujuk.** Masa berlaku, DP/termin, jatah revisi, S&K diambil dari Profil bisnis saat dokumen dibuat, lalu jadi milik dokumen itu.
- **DP ga diasumsikan 50% atau hangus.** Jadwal bayar = daftar baris (label, persen atau nominal, kapan jatuh tempo), bisa nol baris (bayar sekali).
- **Penomoran per ruang kerja, unik.** Penghitung `{ruang}/counters/{prefix-YYMM}` dinaikkan pakai transaksi Firestore. Butuh rules baru (seller boleh menaikkan penghitung, ga boleh menurunkan).
- **Template perjanjian/NDA bukan nasihat hukum.** Teks template milik bisnis, dengan catatan jelas di editor bahwa syarat hukum harus dicek sendiri.

## 5. MVP terkecil yang berguna [usul] — urutan

| # | Apa | Kenapa duluan | Ubah rules? | Risiko regresi |
|---|---|---|---|---|
| 1 | **Snapshot identitas + S&K ke dokumen saat terbit** (`issuer`, `terms` di quote/invoice; PDF & pratinjau baca snapshot, fallback ke live buat dokumen lama) | Bug nyata hari ini: ganti rekening/logo mengubah invoice lama | Tidak | PDF/pratinjau; dokumen lama tanpa snapshot tetap jalan (fallback) |
| 2 | **Profil bisnis** = satu halaman pengaturan per ruang kerja dengan bagian **Identitas · Detail bisnis · Layanan & harga · Default dokumen · Tim** (Tim cuma di guild). Gabung logo/nama lambang guild dengan kop: satu sumber. Pratinjau kop seperti di PDF. | Owner bisa ngisi BeUntamed lengkap di satu tempat | Tidak (pakai `settings`) | Kop & logo dan "Atur guild" yang sekarang pindah tempat; flow dialogs/guild/sell perlu disesuaikan |
| 3 | **Field baru opsional** di `settings/business`: nama legal, deskripsi, kategori, website/sosmed, alamat surat, NPWP (opsional), metode bayar tambahan. Di `services`: deliverables bawaan, durasi, jatah revisi, satuan. | Isi PDF dan penawaran lebih lengkap tanpa ngetik ulang | Tidak | Kecil |
| 4 | **Default dokumen**: masa berlaku penawaran (hari), jadwal bayar bawaan (baris DP/termin), jatah revisi, syarat pembatalan/jadwal ulang, S&K per jenis dokumen. Disalin ke penawaran baru. | "Isi sekali, pakai berulang" | Tidak | Form penawaran (`DocEditor`) |
| 5 | **Jadwal bayar → invoice per termin** + status terbit invoice (Draft/Diterbitkan/Dibatalkan) + ringkasan disepakati/ditagih/diterima/sisa di penawaran | Freelancer kreatif hampir selalu DP + pelunasan | Tidak | Hitungan Report Klien & Penjualan (pakai pembayaran, bukan status) |
| 6 | **Kunci penawaran disetujui + revisi** | Jejak harga/scope yang disepakati | Tidak | Kecil |
| 7 | **Penomoran pakai penghitung transaksi** | Nomor dobel di guild | **Ya** (+ tes per peran) | Nomor lama tetap; mulai berlaku buat dokumen baru |
| 8 | **Buang hardcode bisnis owner**: preset logo di Kop, template Quick Pitch foto makanan jadi netral, contoh `{bisnis}` netral | Prinsip "BeUntamed = satu pengguna" | Tidak | Owner perlu upload logo sendiri sekali (preset hilang) |

**Ditunda (fase 2+):** Perjanjian Kerja/SPK dari penawaran (template + blok tanda tangan + status tanda tangan manual), NDA, creative brief (form yang bisa diisi klien), tahap jualan yang bisa dikonfigurasi, buku alamat klien & entitas project, beberapa mata uang/pajak, Cloud Storage buat logo besar, PDF yang disimpan.

## 6. UX [usul]
- **Profil bisnis** dibuka dari pemilih ruang kerja di header (Pribadi atau nama guild) dan dari Tim → Guild. Gayanya daftar pengaturan bergrup kayak Profil & Pengaturan (PRD-010 §8), bukan halaman sosial.
- Tiap bagian ada **pratinjau kop** persis kayak di PDF, plus catatan: "Perubahan berlaku buat dokumen baru. Dokumen yang udah terkirim tetap pakai data saat dikirim."
- Dokumen tetap di Jualan (Penawaran, Invoice). Perjanjian dan dokumen opsional nanti muncul sebagai aksi di kartu penawaran yang disetujui ("Bikin perjanjian kerja"), bukan tab baru.
- Di kartu penawaran: satu baris uang — "Disepakati Rp X · Ditagih Rp Y · Diterima Rp Z · Sisa Rp W".

## 7. Migrasi & risiko
- **Dokumen lama tanpa snapshot:** dibiarkan; PDF pakai identitas live dengan label kecil "pakai kop saat ini". Opsional tombol "Kunci kop ke dokumen ini" buat invoice lama yang masih ditagih.
- **Dua logo/nama guild:** saat pertama buka Profil bisnis di guild, kalau kop kosong, isi dari lambang/nama guild (sekali, ditampilkan buat dicek).
- **Nomor:** penghitung mulai dari nomor tertinggi yang ada per bulan.
- **Rules:** cuma item 7 yang mengubah rules; ikut alur deploy otomatis (`.github/workflows/firestore-rules.yml`) setelah tes per peran.
- **Flow tes** yang kena: `sell`, `dialogs` (Kop & logo), `guild` (Atur guild), `report klien` (uang masuk).

## 8. Keputusan yang perlu owner
1. Setuju ruang kerja (Pribadi/Guild) = bisnis, tanpa entitas baru?
2. Gabung logo/nama lambang guild dengan kop dokumen jadi satu sumber?
3. Preset logo beUntamed/Visufavor/UNTMD dihapus dari kode (owner upload sekali)?
4. Urutan MVP di §5 oke, atau Perjanjian Kerja mau dinaikkan sebelum item 5–7?
5. Jadwal bayar bawaan BeUntamed: berapa baris dan persennya (mis. DP 50% saat booking, pelunasan 50% H-1 acara)?
6. NPWP/pajak perlu dicetak di invoice BeUntamed sekarang, atau cukup opsional?

## 9. Tahap 1 — dibangun 22 Okt

Owner minta SPK dkk. gampang dipakai **pas ngirim penawaran**, jadi Perjanjian Kerja naik ke depan dan nempel ke alur kirim:
- **Kirim penawaran** (`components/SendQuoteSheet.tsx`): tombol di penawaran Draft. Penawaran selalu ikut; **Perjanjian Kerja (SPK)** dicentang bawaan; **NDA** opsional. Isi SPK/NDA keisi dari penawaran (klien, project, tanggal & lokasi acara, total, DP dan pelunasan) dan Default dokumen; bisa dibaca dan diubah sebelum dikirim. **Bagikan PDF** ngirim semua PDF sekaligus (share sheet di HP, unduhan di laptop); **Kirim teks WA** ngirim ringkasan.
- **Snapshot (MVP #1):** saat dikirim, kop (`issuer`) dan syarat (`terms`) dikunci ke penawaran; invoice dikunci saat dibuat. PDF dan teks WA pakai salinan itu. Pratinjau bilang kopnya dikunci; Kop & logo dari situ mengubah kop live buat dokumen baru. Dokumen lama tanpa snapshot tetap pakai kop live.
- **Status perjanjian terpisah:** `spk/nda = { title, body, sentAt, signedAt? }` di penawaran. Kartu nampilin "dikirim, belum ditandatangani" sampai owner menekan **Tandai SPK ditandatangani**. Disetujui ≠ ditandatangani.
- **Default dokumen (MVP #4)** di Kop & logo: masa berlaku, DP %, DP kapan, pelunasan kapan, revisi, pembatalan & jadwal ulang, judul + template SPK, template NDA (`{bisnis} {klien} {project} {nomor} {tanggal_acara} {lokasi} {total} {pembayaran} {revisi} {pembatalan}`). Penawaran baru ngambil masa berlaku dan DP dari sini.
- PDF SPK/NDA (`lib/agreements.ts`): kop, judul, nomor `SPK-<nomor penawaran>`, para pihak, isi, dua blok tanda tangan kosong.
- Ga ada perubahan rules (semua field di dokumen `quotes`/`invoices`/`settings` yang udah dicakup).
- Flow `sell`: default diisi → kirim penawaran + SPK → isi SPK memuat klien, bisnis, total, DP/pelunasan, revisi → dua PDF (penawaran + SPK) dengan para pihak → tandai ditandatangani → disetujui → ganti nama kop → PDF penawaran tetap pakai nama lama.
