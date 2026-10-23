# PRD-017 — Pricelist pusat dan penawaran berkomponen

- **Status:** rencana, 23 Okt. Belum dibangun.
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
- **Bagian publik** (yang boleh tampil di situs): nama publik, harga "mulai dari", yang didapat klien, di luar scope, urutan, foto (opsional), dan **situs mana** (Visufavor · BeUntamed · UNTMD Sports) dengan pilihan tampil/sembunyi per situs.
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

## 5. Editor yang tidak sempit

- **Desktop (≥ 1024px):** halaman penuh, bukan dialog.
  - Kiri: bagian-bagian form (Klien & acara · Item · Yang didapat · Di luar scope · Harga & pembayaran · Syarat).
  - Kanan: ringkasan menempel (total, margin, termin) + Simpan / Kirim.
  - Bisa dibuka **pratinjau PDF** di kanan.
- **Tabel item** dengan kolom rapi (qty · satuan · harga · biaya modal · jumlah). Enter di baris terakhir menambah baris baru. Urutan bisa digeser.
- **HP:** lembar penuh, bagian bisa dilipat, total menempel di bawah (seperti sekarang).
- **Validasi di tempatnya:** "Isi nama klien dulu" muncul di kolom klien. Simpan tetap bisa ditekan dan langsung membawa ke kolom yang kurang, bukan abu-abu tanpa penjelasan.
- Mengikuti `docs/standards/design.md` dan PRD-010 (target 44pt, kolom 16px, ada jalan keluar dari tiap dialog).

## 6. Pricelist ke ketiga situs

- **SalesPal satu-satunya sumber harga.** Situs hanya membaca, tidak pernah menulis.
- **Endpoint publik, hanya baca:** `GET /api/pricelist?site=visufavor|beuntamed|untmd-sports` → paket yang dipublikasikan ke situs itu. Bentuknya mengikuti `creative-hub/standards/pricelist.md`.
- **Cache 5 menit di CDN.** Harga yang diubah di app tampil di situs dalam ±5 menit, **tanpa redeploy situs**.
- **Yang boleh publikasi:** owner saja (`isOwner`, PRD-015), di **Paket → Tampil di situs**.
- **Situs menampilkan** "mulai dari Rp X" + yang didapat. Tombol tetap ke WhatsApp atau form lead (standar leads), dengan `utm_content=pricelist-{id}`, jadi lead dari pricelist terlihat sumbernya.
- **Kalau SalesPal tidak bisa dihubungi,** situs menampilkan versi terakhir yang tersimpan, atau menyembunyikan blok harga. Tombol kontak tetap jalan.
- **Urutan pemasangan:**
  1. Visufavor dulu (pilot leads juga).
  2. UNTMD Sports: tab Harga di CMS jadi baca-saja + link "Ubah di SalesPal". Keputusan owner.
  3. BeUntamed kalau owner mau menampilkan harga. Repo-nya publik: kodenya ditulis dengan istilah BeUntamed sendiri, tanpa nama owner atau situs lain (batas privasi creative-hub).

## 7. Fase

1. Komponen + biaya modal + margin di penawaran; item manual bisa disimpan ke katalog.
2. Editor halaman penuh + ringkasan menempel + template penawaran.
3. Bagian publik paket + endpoint pricelist + standar di creative-hub naik ke v1 + pasang di Visufavor.
4. UNTMD Sports, lalu BeUntamed (opsional).

**Tes:**
- flow `sell` diperluas: komponen, margin, item manual disimpan ke katalog, template, PDF tanpa biaya modal;
- tes rules untuk `components`;
- tes endpoint: paket yang tidak dipublikasikan dan field internal tidak pernah keluar.

## 8. Keputusan owner
1. Situs menampilkan "mulai dari" atau harga penuh per paket?
2. Tab Harga di CMS UNTMD: pindah ke SalesPal?
3. BeUntamed menampilkan harga atau tidak?
4. Target margin minimum (bawaan 30%).
