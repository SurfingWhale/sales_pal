# PRD-017 — Pricelist pusat dan penawaran berkomponen

- **Status:** fase 1 dibangun 23 Okt (§7). Fase 2–4 rencana.
- **Terkait:** PRD-011 (bisnis dan dokumen), PRD-005 (funnel), PRD-016 (outreach yang membawa link pricelist), `creative-hub/standards/pricelist.md` (v0, draf standar lintas situs), `creative-hub/standards/leads.md`.

## 1. Masalah

> "Since sales pal funneling dari ke-3 website gw, apakah gw juga punya authorisasi pricelist? Jadi saling sync, gw bisa manage dari aplikasinya. Terus penawaran masih cramped banget, dan gaada template buat taro component, price harga, cost dll, termasuk misal gw mau masukin component yang diluar list kaya vendor, studio, karena gw jasa foto." (owner, 23 Okt)

Sekarang:
- **Paket** cuma berisi nama, kategori, harga, satuan, dan deskripsi. **Item penawaran** cuma nama, qty, harga, dan deskripsi.
- Tidak ada biaya modal (HPP), margin, vendor, atau jenis komponen (sewa studio, MUA, transport).
- Item di luar katalog bisa ditambah lewat "+ item manual", tapi tidak bisa disimpan untuk dipakai lagi.
- Editor penawaran berupa dialog sempit yang panjang ke bawah. Total ada di bawah, dan tombol Simpan abu-abu tanpa menunjukkan kolom mana yang kurang.
- Harga di tiap situs diurus sendiri-sendiri: UNTMD Sports di CMS-nya (`/admin` → Harga), Visufavor di `content.json`, BeUntamed belum menampilkan harga. Mengubah harga berarti mengubahnya di beberapa tempat.

## 2. Komponen: bahan penyusun harga

Katalog baru, `components`, khusus internal.

| Field | Isi |
|---|---|
| nama | mis. "Fotografer (per jam)", "Sewa studio Kemang", "MUA", "Cetak 4R" |
| jenis | Jasa sendiri · Alat · Vendor · Tempat/studio · Transport & akomodasi · Lainnya |
| satuan | jam · hari · orang · pcs · paket · km |
| **biaya modal (HPP)** | yang kamu bayar atau korbankan per satuan |
| harga jual bawaan | harga ke klien per satuan |
| vendor | nama dan kontak vendor (opsional) |
| catatan | mis. "minimal sewa 3 jam" |

Biaya modal, vendor, dan catatan **tidak pernah dicetak** di PDF dan tidak pernah dikirim ke situs.

## 3. Paket = susunan komponen

- Paket berisi komponen beserta jumlahnya, mis. "Event 4 jam" = fotografer × 4 jam + editor × 1 + transport × 1.
- **Harga paket** bisa manual, atau otomatis = jumlah harga jual komponennya.
- **Margin** tampil langsung: harga paket − total biaya modal, dalam Rp dan %. Ada peringatan kalau di bawah target (bawaan 30%, bisa diubah).
- **Bagian publik** (yang boleh tampil di situs): nama publik, yang didapat klien, di luar scope, urutan, foto (opsional), dan **situs mana** (Visufavor · BeUntamed · UNTMD Sports) dengan pilihan tampil/sembunyi per situs.

### 3a. Dua harga, dengan ikon sync

> "Buat situs mungkin bisa 'mulai dari'. Jadi ada dua komponen nih: satu di website, satu lagi list harga. Terus ada icon sync, jadi gw bisa sync, atau gw biarin harga product di SalesPal sekian, dan harga juga bisa di-call ke penawaran sampai invoicing." (owner, 23 Okt)

Tiap paket punya dua harga:

| Harga | Dipakai di | Siapa yang ubah |
|---|---|---|
| **Harga SalesPal** (list harga) | penawaran → invoice | SalesPal |
| **Harga situs**, "mulai dari", satu per situs | tampilan di situs itu | SalesPal atau admin situs itu (dual control, §6) |

- **Ikon sync** per situs, di samping harga situs:
  - 🔗 **Terikat:** harga situs selalu sama dengan harga SalesPal. Diubah di mana pun, keduanya ikut berubah.
  - **Lepas:** harga situs berdiri sendiri. Contoh: situs "mulai dari Rp 1,5 jt", sementara di SalesPal Rp 1,75 jt karena sudah termasuk transport. Ikonnya menunjukkan **"beda Rp 250rb"**. Tap ikonnya untuk memilih:
    - **Pakai harga SalesPal di situs** (sekali);
    - **Pakai harga situs di SalesPal** (sekali);
    - **Ikat terus.**
- **Daftar Paket** menampilkan semuanya dalam satu tabel: Paket · Harga SalesPal · Visufavor · UNTMD · BeUntamed. Tiap sel harga situs punya ikon sync-nya, jadi harga yang tidak sama kelihatan sekilas.
- Paket baru: harga situs bawaannya **terikat**.
- Data: `services` yang ada diperluas (komponen, bagian publik); `components` koleksi baru. **Keduanya ditambahkan ke `firestore.rules`**, dengan aturan yang sama seperti `services` (katalog bersama di guild) plus tesnya.

## 4. Penawaran berkomponen

- **Tambah item** dengan tiga cara:
  - dari paket;
  - dari komponen;
  - item manual: bebas, untuk vendor atau studio di luar katalog, dengan centang **"Simpan ke katalog komponen"** supaya bisa dipakai lagi.
- **Tiap baris:** nama, qty, satuan, harga jual, biaya modal (internal), vendor (internal). Kolom internal ditandai jelas dan tidak dicetak.
- **Ringkasan yang selalu kelihatan:** subtotal, diskon, pajak, total, DP/termin, **total biaya modal dan margin** (khusus internal).
- **Template penawaran:**
  - Simpan penawaran jadi template ("Wedding full day", "Event 4 jam", "Foto menu 10 item"). Isinya item, yang didapat klien, di luar scope, termin, dan berlaku sampai.
  - Mulai dari **Penawaran baru → dari template**.
- PDF ke klien tetap seperti sekarang: urutan sama, bagian yang kosong tidak dicetak, tanpa biaya modal, vendor, atau margin.
- **Harga ikut sampai invoice:**
  - Penawaran "dari paket" memakai **harga SalesPal**, bukan harga situs, beserta komponen dan biaya modalnya.
  - Invoice dibuat dari penawaran yang disetujui (sudah ada: DP / termin / pelunasan) dan membawa item serta harga yang sama.
  - Harga paket yang diubah belakangan **tidak** mengubah penawaran atau invoice yang sudah dibuat. Mereka menyimpan salinan saat dibuat (snapshot, PRD-011).

## 5. Editor yang tidak sempit

- **Desktop (≥ 1024px):** halaman penuh, bukan dialog.
  - Kiri: bagian-bagian form (Klien & acara · Item · Yang didapat · Di luar scope · Harga & pembayaran · Syarat).
  - Kanan: ringkasan menempel (total, margin, termin) + Simpan / Kirim.
  - Bisa dibuka **pratinjau PDF** di kanan.
- **Tabel item** dengan kolom rapi (qty · satuan · harga · biaya modal · jumlah). Enter di baris terakhir menambah baris baru. Urutan bisa digeser.
- **HP:** lembar penuh, bagian bisa dilipat, total menempel di bawah (seperti sekarang).
- **Validasi di tempatnya:** "Isi nama klien dulu" muncul di kolom klien. Simpan tetap bisa ditekan dan langsung membawa ke kolom yang kurang, bukan abu-abu tanpa penjelasan.
- Mengikuti `docs/standards/design.md` dan PRD-010 (target 44pt, kolom 16px, ada jalan keluar dari tiap dialog).

## 6. Pricelist ke ketiga situs: dual control

> "Dual control ajah, jadi website bisa update dan gw juga bisa update lewat sales pal." (owner, 23 Okt)

**Satu data, dua pintu.** Harga disimpan sekali, di SalesPal, dan bisa diubah dari dua tempat:
- dari **SalesPal** (Paket);
- dari **admin situs**: UNTMD `/admin` → Harga, Visufavor `admin.html`, BeUntamed kalau ada.

Situs tidak menyimpan salinan sendiri, jadi tidak pernah ada dua versi yang saling menimpa diam-diam.

- **Baca (publik):** `GET /api/pricelist?site=visufavor|beuntamed|untmd-sports` → paket yang tampil di situs itu. Bentuknya mengikuti `creative-hub/standards/pricelist.md`. Cache 5 menit di CDN: perubahan dari pintu mana pun tampil di situs dalam ±5 menit, **tanpa redeploy**.
- **Tulis dari situs:**
  - Admin situs (sudah login dengan standar auth situsnya) → route **server** situs itu → `PUT /api/pricelist/{id}?site=…` di SalesPal.
  - Route itu memakai kunci rahasia per situs (`PRICELIST_KEY_<SITE>`), yang disimpan di env server situs dan SalesPal dan tidak pernah sampai ke browser.
  - Membuat paket baru dari situs boleh (`POST`). Menghapus cuma menyembunyikan dari situs itu; yang bisa menghapus permanen hanya SalesPal.
- **Yang bisa diubah dari situs:** bagian publik paket **untuk situs itu**, yaitu nama publik, harga situs ("mulai dari"), yang didapat, di luar scope, urutan, dan tampil/sembunyi.
  - Kalau harga situs itu **terikat** (§3a), mengubahnya dari situs ikut mengubah harga SalesPal, dan harga situs lain yang terikat. Kalau **lepas**, hanya harga situs itu yang berubah.
  - Komponen, biaya modal, vendor, dan catatan hanya bisa diubah di SalesPal.
  - Paket baru dari situs masuk SalesPal tanpa komponen dan ditandai **"belum ada biaya modal"** sampai dilengkapi.
- **Bentrok:**
  - Tiap paket punya nomor `version`. Setiap perubahan, dari pintu mana pun, mengirim nomor versi yang terakhir dia lihat.
  - Kalau sudah ada yang mengubah lebih dulu, SalesPal menolak (409) dan mengirim data terbaru.
  - Layar yang ditolak menampilkan *"Harga ini baru diubah di {SalesPal | admin situs} jam {x}. Muat ulang?"*. Tidak ada perubahan yang hilang diam-diam.
- **Jejak:** tiap perubahan dicatat: dari mana (SalesPal / visufavor / untmd-sports), siapa, harga lama → baru, dan kapan. Bisa dilihat di **Paket → Riwayat**.
- **Margin tetap dijaga:** harga yang diubah dari situs langsung menghitung ulang margin di SalesPal. Kalau margin turun di bawah target, owner dapat notifikasi.
- **Data dan rules:**
  - Tulis dari situs hanya lewat server SalesPal (Admin SDK).
  - Riwayat perubahan disimpan di koleksi khusus server.
  - Yang boleh mengubah dari dalam SalesPal: owner (`isOwner`, PRD-015).
  - Semua koleksi baru ditambahkan ke `firestore.rules` beserta tesnya.
- **Situs menampilkan** "mulai dari Rp X" + yang didapat. Tombol tetap ke WhatsApp atau form lead (standar leads), dengan `utm_content=pricelist-{id}`, jadi lead dari pricelist terlihat sumbernya.
- **Kalau SalesPal tidak bisa dihubungi,** situs menampilkan versi terakhir yang tersimpan, atau menyembunyikan blok harga. Mengubah harga dari admin situs menampilkan pesan "SalesPal sedang tidak bisa dihubungi" (tidak menyimpan diam-diam ke salinan lokal). Tombol kontak tetap jalan.
- **Urutan pemasangan:**
  1. **Visufavor** dulu (pilot leads juga). Situsnya statis, jadi ditambah satu Vercel Function untuk meneruskan perubahan dari `admin.html`.
  2. **UNTMD Sports:** tab Harga di CMS membaca dan menulis ke SalesPal. Harga lama di CMS dipindahkan sekali ke SalesPal.
  3. **BeUntamed** kalau owner mau menampilkan harga. Repo-nya publik: kodenya ditulis dengan istilah BeUntamed sendiri, tanpa nama owner atau situs lain (batas privasi creative-hub).

## 7. Fase

1. ✅ **Dibangun 23 Okt:** komponen + biaya modal + margin di penawaran; item manual bisa disimpan ke katalog.
   - **Paket → Komponen** (`components/ComponentCatalog.tsx`): nama, jenis, satuan, biaya modal, harga jual, vendor, dan catatan, dengan margin per satuan. Paket juga punya **biaya modal** opsional, jadi margin terlihat di kartu paket.
   - **Penawaran/invoice:**
     - item bisa ditambah dari paket, **dari komponen**, atau manual;
     - tiap item punya kotak **Internal · ga dicetak** (modal per satuan, vendor, margin item);
     - item manual bisa dicentang **Simpan ke katalog komponen**, lengkap dengan jenis dan satuannya;
     - footer menampilkan **modal** dan **margin** (kuning di bawah 30%, merah kalau rugi).
   - **Tidak bocor:** PDF, teks salinan, dan WhatsApp tetap hanya berisi nama, rincian, qty, dan harga. Item menyimpan `unit`, `cost`, `vendor`, `componentId`, `serviceId`.
   - **Data:** `components` jadi katalog bersama (pribadi dan guild, aturan sama dengan `services`). Rules + 4 tes (156 lulus).
     - Catatan: di guild, **anggota bisa melihat biaya modal** di katalog, sama seperti paket. Kalau mau disembunyikan dari anggota, itu keputusan owner untuk fase berikutnya.
   - **Tes:** flow `komponen` (Chromium HP & desktop, iPhone 12 & Safari WebKit), audit HIG 0 temuan.
   - Paket yang disusun dari komponen (§3) belum termasuk; sekarang paket cuma punya satu angka biaya modal.
2. Editor halaman penuh + ringkasan menempel + template penawaran.
3. Dua harga + ikon sync (§3a) + bagian publik paket + endpoint baca & tulis (kunci per situs, `version`, riwayat) + standar di creative-hub naik ke v1 + pasang di Visufavor (baca + admin bisa ubah).
4. UNTMD Sports (tab Harga CMS baca/tulis ke SalesPal, harga lama dipindahkan), lalu BeUntamed (opsional).

**Tes:**
- flow `sell` diperluas: komponen, margin, item manual disimpan ke katalog, template, PDF tanpa biaya modal, harga SalesPal terbawa dari paket → penawaran → invoice;
- flow pricelist: ubah harga terikat → situs ikut berubah; lepas → "beda Rp X"; tap sync → sama lagi;
- tes rules untuk `components`;
- tes endpoint: paket yang tidak dipublikasikan dan field internal tidak pernah keluar.

## 8. Keputusan owner
- ✅ **Dual control** (23 Okt): harga bisa diubah dari SalesPal dan dari admin tiap situs; datanya tetap satu di SalesPal (§6).
- ✅ **Situs menampilkan "mulai dari"** (23 Okt). Harga situs terpisah dari harga SalesPal, dengan ikon sync (terikat / lepas) per situs (§3a). Harga SalesPal yang dipakai sampai penawaran dan invoice.
1. BeUntamed menampilkan harga atau tidak?
2. Target margin minimum (bawaan 30%).
