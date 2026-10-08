# PRD-008 — Arah desain baru: Beranda yang nyuruh, skor potensi, profil customer dari WhatsApp

- **Status:** desain disetujui di canvas **SalesPal Redesign** (artifact, 5 artboard, 2026-10-08). 8.1–8.2 rilis.
- **Sumber:** artboard *Beranda — desktop*, *Leads + skor potensi*, *Beranda — HP*, *Profil customer — HP*, *Tarik dari WhatsApp — HP*. Nama & angka di mockup itu contoh, bukan data.
- **Lanjutan dari:** PRD-001 (brand), PRD-004 (audit tampilan), PRD-006 (Perlu Ditindak), PRD-002 §8 (Balas cepat).

## Masalah

Beranda sekarang kumpulan angka (Total Leads, Conversion Rate, Avg Lead Score…) yang ga bilang **harus ngapain**. Skor lead masih acak (`50 + random`), jadi ga bisa dipakai buat milih siapa yang dikejar. Info soal customer (kebutuhan, keberatan, gaya ngobrol) cuma ada di kepala atau di chat WA.

## 1. Beranda (desktop & HP)

- **Sapaan + tanggal + jumlah tugas:** "Selamat pagi. Ada N hal yang perlu ditindak hari ini." Tombol **Import** dan **Tambah lead** di kanan atas.
- **4 angka saja:** Lead aktif (+N minggu ini) · Potensi tinggi (skor ≥ 70) · Closing bulan ini (x / target) · Nilai pipeline (Rp, + berapa di potensi tinggi). HP: 3 angka pertama.
- **Perlu ditindak = kartu dengan satu aksi utama**, urut paling mendesak:
  | Jenis | Contoh aksi |
  |---|---|
  | Minta penawaran, belum dikirim | **Buat penawaran** · Tunda |
  | Call/jadwal hari ini (jam) | Lihat catatan |
  | Balasan masuk (kutipan pesannya) | **Balas cepat** (PRD-002 §8) |
  | Invoice jatuh tempo besok / telat | Kirim pengingat |
  Plus yang udah ada: follow-up, penawaran nunggu, deal macet (PRD-007 §2.6).
- **Peta lead** (scatter): X = skor potensi 0–100, Y = nilai deal (Rp). Satu titik satu lead. Empat kuadran, garis di **skor 60** dan **Rp 10 jt** (bisa diatur):
  | Kuadran | Aturan | Saran |
  |---|---|---|
  | **Kejar sekarang** | skor ≥ 60, nilai ≥ batas | hubungi minggu ini |
  | **Rawat** | skor < 60, nilai ≥ batas | nilai besar tapi belum responsif |
  | **Cepat closing** | skor ≥ 60, nilai < batas | responsif, kecil — tutup cepat |
  | **Nanti** | sisanya | belum prioritas |
  Klik titik → kartu kecil (skor, nilai, alasan, **Buka lead** / **Chat**). Daftar "Kejar sekarang" di samping; ringkasan per kuadran (jumlah + total nilai), hover buat ngintip, klik buat nyorot di peta. HP: peta mini + jumlah "kejar sekarang" + lead teratas.

## 2. Skor potensi (ganti skor acak)

Skor 0–100 dari 5 sinyal, tiap sinyal punya maksimum dan alasan yang ditampilkan ("Kenapa 84"):

| Sinyal | Maks | Diambil dari |
|---|---|---|
| Respons | 30 | kapan terakhir mereka bales (hari ini 30 → >2 minggu ~0); dari hunt `Dibales/Tertarik`, Balas cepat, atau ringkasan WA |
| Langkah berikutnya | 20 | ada `nextActionDate` / penawaran terjadwal = 20, kosong = 0 |
| Nilai deal | 20 | `value` relatif ke batas kuadran (≥ 2× batas = 20) |
| WhatsApp | 10 | nomor ada = 10 |
| Kontak terakhir | 20 | `lastContact`: hari ini 20, makin lama makin turun |

- Level: **tinggi** ≥ 70 · **sedang** 40–69 · **rendah** < 40.
- Tiap lead nampilin **"Biar naik:"** — sinyal dengan selisih terbesar ("jadwalin langkah berikutnya").
- Dihitung di klien dari data yang ada (`lib/score.ts`, fungsi murni + tes), **ga disimpan**, jadi selalu segar. Lead Closed / Lost ga ikut peta.

## 3. Leads (desktop)

- Daftar kiri: filter per level (Semua / Tinggi / Sedang / Rendah + jumlah), kartu = inisial, nama, kategori · sumber, "Potensi …", skor, kontak terakhir, nilai. "Muat lagi" per 20.
- Panel kanan (lead terpilih): skor besar + rincian 5 sinyal (bar per sinyal), "Biar naik", **Berikutnya**, lalu **Profil**: Kebutuhan · Pain point · Keberatan (+ sumber: "Dari chat WhatsApp, tgl"). Kosong → "Tarik dari WhatsApp" / "Isi manual". Tombol **Chat WhatsApp** (atau Tambah nomor) & **Buat penawaran**.
- QuickPitch/Balas cepat pakai profil ini buat milih script.

## 4. Profil customer (HP)

Halaman penuh per lead: avatar, nama, "kontak, peran · kategori · lokasi", badge akun bisnis WA & status. Aksi: Chat · Telepon · Penawaran · Jadwal.

1. **Brief** (dari N pesan WA): 2–3 kalimat — siapa, kenal dari mana, posisi deal, gaya bales.
2. Kebutuhan · Keberatan · Berikutnya.
3. **Skor** + "Kenapa".
4. **Dari WhatsApp:** nama di WA, nomor, kategori bisnis, lokasi, jam buka (dari screenshot profil bisnis) + **Tarik ulang**.
5. **Pola chat:** jumlah pesan sejak tgl, rata-rata waktu bales mereka, jam paling aktif, grafik pesan per minggu, siapa lebih banyak ngechat.
6. **Tipe customer** = arketipe Script Library (`lib/salespal-data.ts`) + kata pemicu yang muncul ("berapa" 4×…) + saran gaya + **Buka script**.
7. **Yang mereka tanya:** pertanyaan dari chat, ditandai dijawab/belum, tombol **Balas** buat yang belum.

## 5. Tarik dari WhatsApp (HP, bottom sheet)

Tiga sumber:
- **Ekspor chat** (paling lengkap) → brief, kebutuhan, keberatan, tipe customer, pertanyaan, pola chat. Cara: buka chat → Ekspor chat → Tanpa media → Android: bagikan ke SalesPal (Web Share Target); iPhone: simpan ke File lalu unggah.
- **Bagikan kontak** → nama + nomor (vCard; parser `.vcf` udah ada).
- **Screenshot profil bisnis** → kategori, lokasi, jam buka (pakai `/api/scan`, **1 kuota scan**).

Langkah 2: "Ketemu dari N pesan · rentang tgl", tiap bagian (Brief, Kebutuhan, Keberatan, Tipe customer, Pertanyaan, Pola chat) bisa dimatiin, lalu **Simpan N bagian ke {lead}**.

**Privasi (wajib):** isi chat diproses di HP, ga diunggah mentah dan ga disimpan; yang disimpan cuma ringkasan yang dipilih. Pola chat, kata pemicu, dan pertanyaan bisa dihitung lokal (parser teks ekspor WA). Brief / kebutuhan / keberatan butuh model bahasa: kirim **potongan teks yang udah dipangkas** (tanpa nomor) ke server lewat `requireUser` + kuota, jangan simpan di server, dan bilang jelas ke user sebelum dikirim.

## Gaya visual (dari canvas)

- Plus Jakarta Sans, wordmark Bebas Neue "SALESPAL"; biru `#005eb0` satu-satunya aksen; abu netral (`#f4f5f7` latar, kartu putih, garis `#e3e6ea`); dark mode punya token sendiri (`brand-text #7ab5ef`).
- Sudut besar (kartu 22px, sheet 36px), tombol pil, sheet kaca buram di HP, ikon garis (bukan emoji) di layar baru, target sentuh ≥ 44px, angka tabular.
- Navigasi tetap 5 tempat (Beranda, Hunting, Leads, Jualan, Lainnya) + pemilih ruang **Pribadi / guild** di header (PRD-007 §2.5).

## Data

```
leads/{id} + profile?: { need, pain, objection, brief, archetype, cues: {word: n}[],
             questions: [{ text, at, answered }], chat: { messages, since, avgReplyMin,
             activeHours, perWeek: [n], mine, theirs }, wa: { name, category, location, hours },
             source: "wa-export" | "manual", at }
leads/{id}.lastReplyAt?   // buat sinyal Respons
```
Masuk ke `leads` yang udah dicakup rules (pribadi & ruang guild) — ga perlu koleksi baru.

## Urutan kerja

| Fase | Isi | Selesai kalau |
|---|---|---|
| **8.1** ✅ | `lib/score.ts` (5 sinyal, level, "biar naik") + tes; skor acak dihapus; Leads nampilin skor, level, filter | flow: lead dengan follow-up & nomor naik skornya |
| **8.2** ✅ | Beranda baru: sapaan, 4 angka, kartu Perlu ditindak dengan aksi, Peta lead + kuadran (desktop & HP) | flow: lead "kejar sekarang" muncul di peta & daftar |
| **8.3** | Panel detail Leads + Profil (isi manual), QuickPitch/Balas cepat baca arketipe dari profil | flow: isi profil manual, tampil di panel |
| **8.4** | Tarik dari WhatsApp: parser ekspor lokal (pola chat, kata pemicu, pertanyaan), vCard, screenshot profil bisnis; layar pilih bagian | flow: unggah file ekspor contoh → simpan 3 bagian |
| **8.5** | Brief/kebutuhan/keberatan via model (opt-in, potongan tanpa nomor) + Web Share Target Android | tes server: tanpa login 401, kuota jalan |
| **8.6** | Profil customer HP lengkap (pola chat, grafik mingguan, pertanyaan + Balas) | flow HP |

## Belum / di luar

- Baca chat WA otomatis (ga ada API buat akun pribadi; WABA beda urusan).
- Kalibrasi bobot skor dari data closing beneran — sesudah ada ≥ 3 bulan data.
