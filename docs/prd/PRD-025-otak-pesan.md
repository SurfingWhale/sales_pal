# PRD-025 — Otak Pesan: satu pesan yang tepat, buat orang ini, sekarang

- **Status:** desain, 5 Nov 2026. Fase A dibangun hari ini. Fase B–F urut §8.
- **Asal:** owner, 5 Nov, sambil lihat Hunting dan Script pesan di HP:
  - *"Segini doang? Gaada grand design?"*
  - *"aim-nya script sesuai dan tepat saat nawarin cold call"*
  
  Screenshot hari itu:
  - Cold DM terbaca *"postingan kakak yang ini "kebutuhannya""*.
  - 8 kartu Intro harus dipilih sendiri.
  - Ada peringatan di tiap kartu script.
  - Desktop sempit.
- **Menggantikan arah:** PRD-023 (Analisis Chat) dan PRD-024 (Script sebagai satu sistem) tetap berlaku. Dokumen ini menyatukan *pemilihan dan penulisan pesan* ke satu otak.

## 1. Masalahnya, jujur

| Gejala | Akar |
|---|---|
| Pesan bisa memuat kata pengganti ("kebutuhannya") atau mengarang kebutuhan dari default | Mengisi kata kosong itu soal **fakta**. Selama ini diperlakukan sebagai soal teks |
| 8 kartu, penjual memilih sendiri | Ada **tiga otak** yang tidak saling kenal: `lib/scriptPick` (lead), `lib/scriptFit` (Saran), `api/_intel` (Analisis Chat). Tidak ada satu pun yang berani bilang "kirim yang ini" |
| Angka per script ("45 terkirim · dibales 18%") cuma pajangan | Angkanya **tidak dipakai** waktu memilih |
| Brand salah ("UNTMD" terisi Visufavor) | Brand cuma label di script (PRD-024 langkah 3) |
| Desktop seperti HP yang dilebarkan | Layout dibuat per layar, tanpa pola laptop |

## 2. Tujuan

Untuk setiap prospek, app menyiapkan **satu pesan**. Pesan itu ditulis dari fakta orang ini, dipilih dari script yang terbukti dibalas, dan dijelaskan dalam satu baris. Penjual tinggal baca, ubah kalau perlu, kirim, lalu lanjut ke orang berikutnya.

Yang tidak berubah:
- Penjual yang mengirim.
- Script lama tidak ditimpa.
- Tidak ada yang dikarang: harga, slot, testimoni, kebutuhan.

## 3. Satu otak: `lib/brain/`

Otak ini jalan di browser: instan, tetap jalan saat sinyal jelek, Rp 0.

Tabel aturannya (kata tipe bisnis, keberatan, bobot, larangan) pindah ke satu file `lib/brain/rules.json`. File yang sama dibaca dua mesin:
- **TS** (`lib/brain`) untuk Hunting, Pesan lead, dan Kampanye;
- **Python** (`api/_intel`) untuk Analisis Chat.

Jadi aturannya cuma ditulis sekali. `scriptPick` dan `scriptFit` dilebur ke sini.

```
facts(prospect | lead)  →  candidates(scripts)  →  gate  →  rank  →  compose  →  explain
```

### 3.1 Fakta (`facts`)

Fakta adalah yang beneran diketahui, masing-masing dengan sumbernya:
- dari prospek: nama, post (teks dan tanggal), kebutuhan yang terbaca, kapan, di mana, budget, tipe bisnis;
- dari ruang kerja: brand, tahap journey, apa yang sudah dikirim ke orang ini dan kapan, balasan terakhir.

Fakta yang tidak ada ditandai *tidak diketahui*, bukan diisi default.

### 3.2 Gerbang (gate)

Script yang tidak lolos gerbang **tidak muncul** sebagai saran. Gerbangnya:
- tahap tidak cocok;
- brand lain;
- ditandai untuk tipe bisnis lain;
- sudah pernah dikirim ke orang ini;
- masih menawarkan setelah orangnya menolak;
- kalimat inti butuh fakta yang tidak ada, sehingga yang tersisa tinggal salam.

Ini sama dengan "mismatch kritis" di PRD-023 §4.

### 3.3 Peringkat (rank)

`skor = cocok × bukti × segar`

- **Cocok (0–1):** bobot PRD-023 (konteks 30, tahap 25, maksud 20, tujuan 15, nada/kanal 10).
- **Bukti:** angka balasan per script. Script baru dikasih prior kecil, Beta(1, 1), supaya 1 balasan dari 2 kirim tidak mengalahkan 8 dari 45.
  - Kalau satu tipe bisnis sudah punya ≥ 20 kiriman, angka per tipe bisnis itu yang dipakai.
  - Sekitar 1 dari 6 kali, otak memilih script yang belum banyak dicoba (Thompson sampling). Kartunya ditandai **"lagi dicoba"**, supaya script baru dapat kesempatan dan penjual tahu alasannya.
- **Segar:** follow-up mengikuti jeda yang wajar: hari ke-2, ke-5, dan ke-12, lalu berhenti 14 hari (Fanatical Prospecting). Script yang sama tidak dikirim dua kali ke orang yang sama.

### 3.4 Tulis (compose)

Kata yang tidak diketahui **menghapus kalimatnya**, tidak diganti kata pengganti. Satu-satunya yang punya pengganti adalah nama ("kak"). Dibangun di Fase A.

`"{kebutuhan}"` di dalam tanda kutip berarti kutipan dari mereka. Kalau kebutuhannya belum terbaca, yang dipakai kutipan post mereka sendiri.

Lalu penyesuaian Saran (`scriptFit`) **langsung diterapkan**, tidak di kartu terpisah:
- sebut yang mereka cari;
- jadwal dan tempat tanpa menjanjikan slot;
- buang kalimat tentang bisnis lain.

Daftar perubahannya bisa dibuka. "Pakai aslinya" mengembalikan script asli.

### 3.5 Jelaskan (explain)

Satu baris di bawah pesan, contohnya:

> **Cold DM · BeUntamed** · cocok: post soal launching cafe, Intro · dibales 18% dari 45

Teori yang dipakai dan semua skor ada di "Kenapa ini?", tertutup secara default.

## 4. UI

**Hunting → halaman kirim (HP):**
1. Satu kartu besar **Pesan buat {nama}**, isinya pesan siap kirim, satu baris alasan, tombol Copy & buka post / Kirim, lalu Udah.
2. **"Script lain (7)"** dilipat di bawahnya. Kalau dibuka, urutannya sesuai peringkat, dan script yang gugur ditulis kenapa gugur.

Peringatan teknis (`{kebutuhan}`, placeholder) tidak pernah tampil di kartu.

**Desktop (≥ 1024px), tiga kolom:**

| Kolom | Isi |
|---|---|
| Kiri | Antrian prospek |
| Tengah | Pesan + alasan |
| Kanan | Post dan konteks orangnya, riwayat |

Tidak ada sheet yang mentok 960px. Script pesan sudah full lebar (Fase A).

**Antrian hari ini (Fase E):** otak juga mengurutkan *siapa* yang dikontak sekarang:
- yang baru posting;
- yang sudah waktunya di-follow-up;
- yang membalas.

Penjual cukup Kirim → Udah → orang berikutnya, sampai target harian.

## 5. Brand otomatis

Ini PRD-024 langkah 3, digabung ke sini.
- `settings/brands` menyimpan per brand: nama, sapaan, dan **tipe bisnis yang dilayani**, mis. UNTMD Sports untuk olahraga, Visufavor untuk F&B dan produk, BeUntamed untuk event.
- Post orangnya menentukan brand. `{bisnis}` diisi nama brand itu.
- Penjual bisa ganti brand di kartu, dan pilihannya diingat per orang.

## 6. Belajar dari hasil

- Setiap baris Outreach dan hunt menyimpan: `scriptId`, `brand`, `category`, `stage`, dan `edited` (dikirim apa adanya atau diubah).
- Balasan menempel ke baris itu.
- Performa menampilkan per script × tipe bisnis: kirim, dibalas, tertarik, dengan rentang ketidakpastian. Tidak ada klaim "script X menaikkan Y%" sebelum datanya cukup (PRD-023 §7 Fase 4).

## 7. Ukuran keberhasilan

| Ukuran | Dari mana |
|---|---|
| Waktu per DM (tap Kirim → Udah) | Log sesi hunting |
| % pesan dikirim tanpa diubah | `edited` |
| Reply rate per 100 cold DM, per brand dan tipe bisnis | Outreach |
| Pesan yang memuat kata pengganti atau fakta karangan | Harus 0. Dicek tes `brain` di setiap PR |

## 8. Fase

| Fase | Isi | Status |
|---|---|---|
| A | Kata kosong menghapus kalimat; `"{kebutuhan}"` = kutipan post; peringatan di kartu dihapus; Script pesan full lebar di desktop (daftar dua kolom, editor kiri-kanan) | ✅ 5 Nov |
| B | `lib/brain`: fakta → gerbang → peringkat (cocok × bukti × segar) → tulis → jelaskan. Satu kartu "Pesan buat {nama}" di Hunting dan Pesan lead. `scriptPick`/`scriptFit` dilebur | Berikutnya |
| C | Brand otomatis (`settings/brands`, tipe bisnis per brand) | |
| D | Outreach menyimpan `scriptId`, `brand`, `category`, `edited`; Performa per script × tipe bisnis; "lagi dicoba" (Thompson) | |
| E | Antrian hari ini; desktop tiga kolom | |
| F | AI (setelah ada budget): menulis ulang gaya bahasa di atas fakta yang sama, dengan kontrak dan gerbang yang sama | Ditunda (Rp 0) |

## 9. Tes

- `tests/brain` (unit, Node): untuk setiap kombinasi script contoh × prospek contoh, pesan tidak memuat `{`, "kebutuhannya", atau fakta yang tidak ada di input. Gerbang menolak brand lain, tahap salah, dan yang sudah dikirim.
- Flow `hunting` dan `journey`: kartu pertama berisi pesan untuk orang itu, dengan satu baris alasan. "Script lain" bisa dibuka.
