# B. Alur pengguna

Semua diagram menggambarkan perilaku kode per 6 Nov 2026, **termasuk PR #115** (navigasi balik). Langkah yang baru benar setelah PR #115 ditandai ¹.

- Garis putus-putus = keluar dari app.
- Kotak bersudut tumpul = pertanyaan.
- **⚠** = perilaku yang bermasalah, dengan rujukan ke [ambiguities.md](ambiguities.md).

## B1. Prospek: dari post sampai jadi Lead

```mermaid
flowchart TD
  S1[Post Threads dibagikan / link ditempel] --> P1[Prospek Baru<br/>Hunting › Prospek]
  P1 --> K1[Kontak prospek<br/>overlay]
  K1 -->|✉ Kirim intro| HK[Halaman Kirim<br/>menggantikan daftar ⚠ AMB-14]
  HK --> SC[Pilih script per tahap<br/>atau kartu Saran]
  SC -->|Copy / Copy & DM| EXT[(Threads / IG / WA)]
  EXT -.->|kembali ke app| Q1([Pesan ke X udah kekirim?])
  Q1 -->|Belum| HK
  Q1 -->|Udah, catat| R1[Hunt Terkirim + Prospek Intro<br/>toast Batal 10 dtk]
  R1 -->|Udah, lanjut ke Y| HK
  R1 -->|‹ Daftar / Back| K1
  K1 -->|💬 Percakapan| TH[Percakapan<br/>overlay di atas kontak ¹]
  TH -->|tutup / Back| K1
  K1 -->|💬 Dibales| T1[Terhubung]
  T1 -->|✅ Tertarik / 🤔 / ⏳| T2[Hasil + jadwal berikutnya]
  T2 -->|Kasih data →| CV[ConvertSheet: WA atau email]
  CV -->|Simpan jadi Lead| L1[Lead Hot · Prospek ETB<br/>⚠ tidak ada tautan ke lead · AMB-15]
  K1 -->|🚫 Menolak dihubungi → Kunci| DNC[Jangan dihubungi<br/>⚠ tanpa konfirmasi kedua · AMB-09]
```

**Belum dimodelkan:** apa yang disarankan SalesPal setelah **balasan** masuk (harga? portofolio? belum sekarang?). Sekarang penjual menandai hasil sendiri, lalu memilih script tahap berikutnya sendiri. Rancangannya ada di [script-chat.md](script-chat.md).

## B2. Lead: dari daftar sampai pesan terkirim

```mermaid
flowchart TD
  LL[Jualan › Leads<br/>atau Hunting › Leads] -->|tap kartu| LP[Lembar lead<br/>overlay]
  LL -->|tombol kartu: Balas / Kirim intro / Follow-up| CP
  LP -->|Tulis pesan| CP[Pesan ke X<br/>sheet penuh, script terisi otomatis]
  CP -->|Ganti script| PK[Pilih script<br/>⚠ Back menutup Pesan · AMB-16]
  PK --> CP
  CP -->|Kirim di WhatsApp| WA[(WhatsApp)]
  WA -.-> Q2([Pesannya udah kekirim?])
  Q2 -->|Belum, balik ke pesan| CP
  Q2 -->|Udah, catat| N1[Lembar lead + ChatNote<br/>Follow-up kapan? Besok / 3 hari / 1 minggu]
  Q2 -->|Udah, lanjut ke Y| LP2[Lembar lead Y<br/>⚠ undo X hilang · AMB-17]
  CP -->|✕ dibuka dari tombol kartu| LL
  CP -->|✕ dibuka dari Tulis pesan| LP
  LP -->|Kembali ke asal ¹| LL
```

## B3. Penawaran sampai uang masuk

```mermaid
flowchart TD
  LP[Lembar lead] -->|Penawaran| DE[Penawaran › DocEditor<br/>tombol ‹ Kembali ke lead ¹]
  DE -->|Simpan| QD[Draft<br/>⚠ tanpa feedback]
  QD -->|Kirim penawaran| WS[Sheet kirim: Buka WA + Lampirkan PDF<br/>dicatat saat tap ⚠ AMB-08]
  QD -->|Tandai terkirim| QT2[Terkirim tanpa kunci kop ⚠ AMB-10]
  WS --> QT[Terkirim · kop dan syarat dikunci]
  QT -->|3 hari tanpa jawaban| BR[Beranda: Penawaran nunggu]
  BR -->|Follow up via WA| WA[(WhatsApp)]
  QT -->|✓ Disetujui| QA[Disetujui · lead Deal<br/>⚠ tanpa konfirmasi atau undo]
  QA -->|Buat invoice DP| IV[Invoice Draft<br/>⚠ ketuk 2x = 2 invoice · AMB-11]
  IV -->|Tagih via WA| IS[Diterbitkan]
  IS -->|lewat jatuh tempo| TL[Telat → Beranda]
  IS -->|Catat pembayaran| PY[DP masuk → Lunas]
```

## B4. Navigasi dan konteks balik

```mermaid
flowchart LR
  B[Beranda] -->|kartu prospek ¹| HC[Hunting · kontak orangnya]
  HC -->|‹ Beranda ¹| B
  B -->|kartu lead| LP[Lembar lead<br/>di atas Beranda]
  LP -->|Kembali ke Beranda ¹| B
  B -->|Lihat semua| SH[Perlu ditindak]
  SH -->|baris lead ¹| LP2[Lembar lead<br/>di atas sheet]
  LP2 -->|tutup| SH
  LP -->|Riwayat → penawaran ¹| Q[Penawaran · PDF]
  Q -->|‹ Kembali ke lead ¹| LP
  H[Hunting] -->|nav: Jualan| J[Jualan]
  J -->|Back browser| X[(keluar app ⚠ AMB-01)]
```

## B5. Kirim: semua jalan ke "Terkirim"

```mermaid
flowchart TD
  subgraph Tanya dulu
    A1[Hunting Kirim] --> Q([udah kekirim?])
    A2[Percakapan] --> Q
    A3[Pesan lead] --> Q
    A4[Beranda kartu] --> Q
    A5[Follow-up beruntun] --> Q
  end
  subgraph Langsung dicatat
    B1[Kirim penawaran] --> C[Terkirim]
    B2[Follow-up penawaran] --> C
    B3[Tagih via WA] --> C
  end
  subgraph Tidak dicatat
    D1[Kirim WA di penawaran non-draf]
    D2[Tagih via WA pada invoice terbit<br/>⚠ tapi bilang tercatat]
  end
  Q -->|Udah| C
```

## B6. Script: dari dibuat sampai dipakai

```mermaid
flowchart TD
  M[Script pesan] -->|Baru / Ubah| ED[Editor: nama, brand, dipakai di, tahap, tipe bisnis, isi, pratinjau]
  ED -->|Simpan ⚠ tanpa toast| M
  M -->|⋯ Jadikan default| DF[Default tahap itu]
  DF --> CP[Pesan lead: default terisi duluan]
  DF -.->|tidak berpengaruh ⚠ AMB-12| HK[Hunting Kirim: urut judul]
  M -->|⋯ Arsipkan| AR[Arsip + Batal 5 dtk]
  QP[Quick Pitch: simpan] -->|⚠ menimpa field script| M
  AC[Analisis Chat: Simpan sebagai script] -->|tanpa workflow dan brand| M
```
