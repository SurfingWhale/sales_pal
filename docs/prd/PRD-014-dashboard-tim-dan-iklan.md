# PRD-014 — Dashboard tim & iklan Meta

- **Status:** Bagian A (Dashboard tim) dibangun 2026-10-22. Bagian B (Iklan Meta, import) menyusul.
- **Pemilik:** owner (leader + sales sekaligus).
- **Terkait:** PRD-005 (funnel & Report Klien; Fase 1 import CSV Meta, Fase 3 CTWA/ROAS), PRD-007 (Guild, Report Tim), PRD-009 (Hunting, Log aktivitas).

## 1. Masalah

> "Soal reporting kayanya gw gadapet dashboard yang menggambarkan gw sebagai leader dan sales udah ngelakuin apa aja dll dan conversion dll, padahal gw udah kasih referensi yang lengkap. Selain scraping, mantau performa dan make Meta Ads kayanya hal yang bantu buat jualan juga." — owner, 22 Okt

Yang ada sekarang kepencar dan ga ada yang jawab "tim gw ngapain aja, hasilnya apa":

| Tempat | Isi | Kurangnya |
|---|---|---|
| Guild → Report Tim | lead, penawaran, lunas, omzet vs target per orang | cuma dari `deals` pipeline guild; aktivitas hunting, penawaran & invoice dari Jualan ga kehitung |
| Hunting → Performa | contact rate, NTB → ETB, biaya | per orang yang lagi login, ga per anggota |
| Log aktivitas | heat map & daftar aksi | cuma punya sendiri |
| Report Klien | konten → chat → lunas buat klien | buat klien, bukan tim sendiri; biaya iklan belum masuk |

Referensi owner (laporan agency ke klien: performa sosmed + hasil Meta Ads) pakai pola yang sama: **angka utama + perubahan vs periode lalu, tren harian, sebaran, 5 teratas / 5 terbawah**, dan buat iklan: **spend, hasil (percakapan), biaya per hasil, jangkauan, frekuensi, CTR, CPC, per kampanye dan per iklan**. Kolom yang selalu kosong di Ads Manager: **nilai hasil & ROAS** — Meta ga tau siapa yang akhirnya bayar. SalesPal tau.

## 2. Bagian A — Dashboard tim

Tab **Tim & Report → Dashboard tim** (paling depan), juga dari Beranda → Report & closing.

- **Periode:** 7 hari · 30 hari · Bulan ini · Bulan lalu. Dibanding periode sebelumnya yang sama panjang.
- **Lihat:** Semua tim, atau satu orang (tap baris di tabel). Member biasa cuma liat dirinya (aturan baca guild yang udah ada).
- **Angka utama** (tiap kotak + perubahan vs periode lalu; di bawah 10 ditulis selisihnya, bukan persen):
  - Aktivitas.
  - DM / intro terkirim.
  - Dibales (rate).
  - Jadi ETB (rate dari yang di-intro).
  - Penawaran dikirim.
  - Closing (penawaran diterima).
  - Uang masuk.
- **Tren harian:** aktivitas per hari, garis + tooltip.
- **Funnel periode:**
  - urutan tahapnya: prospek baru → DM → dibales → ETB → penawaran → closing;
  - persen antar tahap;
  - dihitung dari kejadian di periode, bukan cohort (cohort ada di Report Klien).
- **Per sales:** satu baris per orang, isinya:
  - aktivitas, DM, % dibales, ETB, penawaran, closing, uang masuk;
  - terakhir aktif ("3 hari lalu" ditandai).

  Tap baris → dashboard jadi punya orang itu, plus heat map & log-nya.
- **Paling aktif / Perlu dicek:** 3 teratas, dan siapa yang ga ada aktivitas ≥ 3 hari.
- **Sumber data:** sama kayak Log aktivitas (`lib/activity.ts`), tiap kejadian bawa `ownerUid`. **Ga nulis data baru, rules ga berubah.**
- **Ga dicampur dengan `deals` guild.** Target & pipeline tetap di Report Tim (link dari dashboard), biar omzet ga kehitung dua kali.

## 3. Bagian B — Iklan Meta (menyusul)

- **Import** export Ads Manager (CSV/XLSX, level kampanye atau iklan; mapper kolom toleran kayak Import XLS Leads): spend, hasil + jenis hasil, biaya per hasil, impresi, jangkauan, frekuensi, CPM, klik link, CTR, CPC, ThruPlay.
- **Gabung ke SalesPal** per periode: lead bersumber Iklan → **CPL beneran**; closing & uang masuk dari lead itu → **biaya per closing, ROAS** (yang di Ads Manager kosong).
- **Tampil** di dashboard (kotak Iklan) dan bisa ditempel ke Report Klien (PRD-005) buat laporan agency: tabel per iklan, 5 teratas / terbawah per biaya per hasil.
- **Koleksi baru** `ads` (owned) → masuk `firestore.rules` + test sebelum deploy.

## 4. Biaya & alternatif

| Fitur | Cara | Biaya | Catatan |
|---|---|---|---|
| Dashboard tim | dihitung di browser dari data yang udah ada | Rp0 | baca Firestore per buka; akun tim besar = banyak baca (Spark 50K/hari) → kalau mepet, ringkasan harian via cron |
| Iklan: import | CSV/XLSX dari Ads Manager (lib `xlsx` udah ada) | Rp0 | manual tiap periode, ±1 menit |
| Iklan: sync otomatis | Meta Marketing API (`ads_read`) + Vercel Cron | Rp0 (API gratis) | butuh Meta app + System User token dari akun Business owner → **ditunda**, nunggu owner |
| Atribusi per iklan | CTWA referral via WhatsApp Cloud API (PRD-005 Fase 3) | tarif per pesan | ditunda |
| Alternatif berbayar | Metricool / Supermetrics / konektor Looker Studio | langganan bulanan | ga dipakai (belum ada biaya) |

## 5. Fase

1. **A** — Dashboard tim (sekarang).
2. **B1** — import Ads Manager + CPL / biaya per closing / ROAS.
3. **B2** — sync API (setelah owner bikin Meta app), tempel ke Report Klien.
