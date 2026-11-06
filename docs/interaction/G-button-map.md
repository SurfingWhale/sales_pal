# G. Peta tombol (audit 6 Nov 2026)

Audit per tombol: ditap ke mana, dibuka dengan pola apa, feedback-nya, dan penilaiannya. Ini **bahan**, bukan desain: alasan, state, dan keputusan setiap feature ada di [features/](features/), pola di [patterns.md](patterns.md), keputusan di [decisions.md](decisions.md).

> Dibaca dari kode setelah PR #115. Bagian **Kontak prospek** di bawah menggambarkan halaman *sebelum* PR #116; masalahnya sudah diperbaiki (lihat [features/kontak-prospek.md](features/kontak-prospek.md)). Versi interaktif: artifact "Peta Tombol SalesPal".

## Beranda · Perlu ditindak

Tujuan: apa yang dikerjakan sekarang · Aksi utama: tombol kartu teratas

```mermaid
flowchart LR
  K[Kartu tugas] -->|aksi WA| WA[(WhatsApp)]:::ext
  WA -.->|kembali| Q([udah kekirim? kartu di Beranda]):::warn
  K -->|Buka · lead| LP[Lembar lead]:::ov
  K -->|Kirim intro · prospek| HC[Hunting · kontaknya]:::nav
  K -->|Lihat penawaran| QD[Penawaran · PDF]:::nav
  K -->|Chat| PV[Pratinjau chat]:::sh
  K -->|Tunda ⚠ diam| K
  B[Lihat semua] --> SH[Sheet Perlu ditindak]:::sh
  SH -->|baris lead| LP
  classDef ov fill:#2563eb22,stroke:#2563eb
  classDef sh fill:#0d948822,stroke:#0d9488
  classDef nav fill:#7c3aed22,stroke:#7c3aed
  classDef ext stroke:#6b7280,stroke-dasharray:4 3
  classDef warn fill:#d9770622,stroke:#d97706
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| Aksi kartu (WA) | WhatsApp | Kartu "udah kekirim?" di Beranda | ⚠ Pertanyaan muncul sebelum pergi; kalau pindah tab, hilang (kartu Beranda belum ikut antrean P0) | Pakai antrean kiriman tertunda yang sama dengan Hunting |
| Tunda | — | Tidak ada | ⚠ Kartu tetap terlihat, hanya tanggal yang berubah, tanpa tanda | Kartu bergeser keluar + toast "Ditunda ke besok · Batal" |
| Buka / Chat / Lihat semua | Overlay / sheet | — | OK Ditumpuk; tutup kembali ke Beranda | — |
| 3 tombol per kartu | — | — | ⚠ Aksi, Tunda, Buka, Chat bersaing sama besar di kartu sempit | Satu tombol utama; Tunda dengan geser kartu, sisanya di ⋯ |

## Kontak prospek

Overlay di atas daftar · 13 tombol terlihat sekaligus

```mermaid
flowchart LR
  C[Kontak prospek] -->|✉ Kirim intro| HK[Halaman Kirim]:::nav
  C -->|💬 Percakapan| TH[Percakapan]:::ov
  C -->|💬 Dibales| ED[editor di tempat]
  C -->|✅ 🤔 ⏳ ❌| R[hasil · tanpa undo ⚠]:::warn
  C -->|Kasih data →| CV[Kasih data · dialog tengah ⚠]:::md
  CV -->|Buka lead| LP[Lembar lead]:::ov
  C -->|🚫 Menolak dihubungi → Kunci| DNC[Kunci · tanpa tanya lagi ⚠]:::bad
  C -->|🗑 Hapus| CF[ConfirmSheet]:::sh
  C -->|Profil Threads| EXT[(Threads)]:::ext
  classDef ov fill:#2563eb22,stroke:#2563eb
  classDef sh fill:#0d948822,stroke:#0d9488
  classDef nav fill:#7c3aed22,stroke:#7c3aed
  classDef ext stroke:#6b7280,stroke-dasharray:4 3
  classDef warn fill:#d9770622,stroke:#d97706
  classDef md fill:#d9770622,stroke:#d97706,stroke-width:2px
  classDef bad fill:#dc262622,stroke:#dc2626
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| 13 tombol setara | — | — | ⚠ Kirim, Percakapan, Dibales, Catatan, 4 hasil, Kasih data, Menolak, Hapus semuanya chip berukuran sama. Tidak ada satu aksi utama | Satu tombol besar di bawah sesuai status ("Kirim follow-up"). "Dia bales…" membuka sheet hasil (Tertarik / Pikir / Nanti / Tidak / Kasih data). Hapus & Jangan hubungi di ⋯ |
| Emoji sebagai ikon | — | — | ⚠ design.md: emoji bukan ikon; tombolnya terlihat seperti chat, bukan kontrol | Ikon garis dari Icon.tsx + label |
| Hasil (✅ 🤔 ⏳ ❌) | Tulis langsung | Hanya tombol tertekan | ⚠ Salah tap "Tidak tertarik" = parkir 90 hari, tanpa Batal | Toast "Ditandai Tidak tertarik · Batal" 10 dtk (AMB-09) |
| Kasih data → | Dialog di tengah | ✓ di sheet + Buka lead (P0) | ⚠ Form 4 isian di dialog tengah; keyboard iPhone menutupinya | Bottom sheet yang naik di atas keyboard, Simpan di atas |
| Menolak dihubungi → Kunci | Editor di tempat | — | ⚠ Menghapus riwayat selamanya, tanpa pertanyaan kedua; letaknya di antara hasil biasa | Pindah ke ⋯, merah, lewat ConfirmSheet |
| Percakapan / Kirim | Overlay / halaman | — | OK Tutup kembali ke kontak (PR #115) | — |

## Hunting · Halaman Kirim

Menggantikan daftar Prospek · Aksi utama: Copy & … pada script

```mermaid
flowchart LR
  L[Daftar Prospek] -->|kartu / cari| HK[Halaman Kirim ⚠ menggantikan daftar]:::warn
  HK -->|Copy / Copy & DM| EXT[(Threads / IG / WA)]:::ext
  EXT -.-> Q([udah kekirim? · toast]):::ov
  Q -->|Udah, catat| T[Toast Tercatat + Batal 10 dtk]
  Q -.->|pindah tab / reload| PS[Sheet app: udah kekirim? P0]:::sh
  HK -->|‹ Daftar| L
  HK -->|Berikutnya| HK
  HK -->|Script pesan| SM[Script pesan · layar penuh]:::sh
  classDef ov fill:#2563eb22,stroke:#2563eb
  classDef sh fill:#0d948822,stroke:#0d9488
  classDef ext stroke:#6b7280,stroke-dasharray:4 3
  classDef warn fill:#d9770622,stroke:#d97706
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| Kartu script (Copy + Copy & …) | Keluar app | Toast tanya, lalu Tercatat + Batal | ⚠ 8 kartu script per tahap; penjual memilih sendiri. Default diabaikan (AMB-12) | "Pesan buat {nama}": satu kartu besar terisi, sisanya dilipat (PRD-025 B) |
| Masuk dari daftar | Menggantikan daftar | — | ⚠ Scroll dan batas 30 kartu hilang saat kembali (AMB-14) | Halaman Kirim jadi overlay di atas daftar |
| "Udah dijawab? Tandai…" | Hasil di tempat | Teks | ⚠ Hasil yang sama dengan kontak, label & efek berbeda | Satu sheet hasil untuk semua tempat |

## Percakapan prospek

```mermaid
flowchart LR
  TH[Percakapan · overlay di atas kontak] -->|kirim| EXT[(WA / IG)]:::ext
  EXT -.-> Q([Pesannya udah kekirim?]):::ov
  TH -->|⋯ Status & aksi| P[Panel di tempat]
  P -->|Buang ⚠ tanpa tanya| A[Arsip]:::bad
  P -->|Jangan hubungi| C[konfirmasi di tempat]:::bad
  P -->|Kasih data| CV[dialog tengah ⚠]:::md
  TH -->|tutup / Back| K[Kontak prospek]
  classDef ov fill:#2563eb22,stroke:#2563eb
  classDef ext stroke:#6b7280,stroke-dasharray:4 3
  classDef md fill:#d9770622,stroke:#d97706,stroke-width:2px
  classDef bad fill:#dc262622,stroke:#dc2626
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| ⋯ Status & aksi | Panel di header | — | ⚠ Hasilnya berbeda dari kontak: tidak ada Pikir-pikir/Hubungi nanti, "Nolak" tanpa alasan | Action sheet hasil yang sama dengan kontak |
| 🗑 Buang | Langsung | Error tertelan | ⚠ Tanpa konfirmasi; kalau gagal, pesan error tidak sempat terlihat | ConfirmSheet, lalu toast "Dibuang · Batal" |

## Lembar lead

Overlay di atas tempat asal · Aksi utama: dari Posisi (Balas / Kirim intro / Follow-up)

```mermaid
flowchart LR
  LP[Lembar lead] -->|Tulis pesan| CP[Pesan ke … · layar penuh]:::sh
  LP -->|Mereka bales ⚠| R[✓ Dicatat · walau gagal]:::warn
  LP -->|Jadwal| J[Sheet langkah berikutnya · tutup diam ⚠]:::sh
  LP -->|Penawaran| QD[Tab Penawaran + Kembali ke lead]:::nav
  LP -->|⋯ Ubah data → Gugur ⚠| G[Sheet · tanpa feedback]:::bad
  LP -->|⋯ Hapus| H[Sheet Hapus lead?]:::bad
  LP -->|Riwayat → dokumen| PDF[PDF di tab lain + Kembali]:::nav
  LP -->|Lokasi| LOC[Sheet lokasi]:::sh
  classDef sh fill:#0d948822,stroke:#0d9488
  classDef nav fill:#7c3aed22,stroke:#7c3aed
  classDef warn fill:#d9770622,stroke:#d97706
  classDef bad fill:#dc262622,stroke:#dc2626
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| Mereka bales | — | "✓ Dicatat" 2,5 dtk | ⚠ Muncul sebelum tersimpan, tanpa catch: bisa bohong | Tunggu tulisan (cepat lewat persistensi), error bisa diulang, + Batal |
| Gugur (di Ubah data lead) | Sheet form | Sheet tertutup diam | ⚠ Keputusan besar disembunyikan di dalam form edit; tanpa konfirmasi atau undo | Aksi sendiri di ⋯ "Tandai gugur…" → sheet alasan → toast + Batal |
| Jadwal | Sheet | Tertutup diam | ⚠ Tidak ada konfirmasi tanggal yang tersimpan | Toast "Follow-up Kam 12 Nov · Batal"; tanggal terlihat di lembar |
| Penawaran / Riwayat | Pindah tab | "Kembali ke {lead}" | OK Setelah PR #115 | — |

## Pesan ke lead

```mermaid
flowchart LR
  W[Tulis · script terisi] -->|Ganti script| PK[Pilih script ⚠ Back = tutup]:::warn
  PK --> W
  W -->|Kirim di WhatsApp| WA[(WhatsApp)]:::ext
  WA -.-> S([Udah kekirim? · langkah 3]):::ov
  S -->|Udah, catat| N[Lembar lead + ChatNote]
  S -->|Udah, lanjut ke Y ⚠| Y[Lead Y · undo X hilang]:::warn
  S -->|Belum| W
  S -.->|ditutup / reload| PS[Sheet app P0]
  classDef ov fill:#2563eb22,stroke:#2563eb
  classDef ext stroke:#6b7280,stroke-dasharray:4 3
  classDef warn fill:#d9770622,stroke:#d97706
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| Ganti script | Langkah 2 di sheet | — | ⚠ Back menutup seluruh Pesan, bukan kembali ke tulis (AMB-16) | Back per langkah |
| Udah, lanjut ke Y | Lead berikutnya | ChatNote X hilang | ⚠ Salah konfirmasi tidak bisa dibatalkan (AMB-17) | Toast app yang bertahan saat pindah orang |

## Penawaran (baris dokumen)

Sampai 8 tombol per baris

```mermaid
flowchart LR
  Q[Baris penawaran] -->|Kirim penawaran| WS[Sheet kirim · dicatat saat tap]:::sh
  Q -->|Tandai terkirim| T[status · kop dikunci P0]
  Q -->|✓ Disetujui ⚠| D[lead jadi Deal · tanpa tanya/undo]:::bad
  Q -->|✗ Ditolak ⚠| X[tanpa tanya/undo]:::bad
  Q -->|Buat invoice| IV[tab Invoice · tanpa Kembali ⚠]:::nav
  Q -->|Edit / Revisi| DE[DocEditor · dialog tengah ⚠]:::md
  Q -->|PDF| PDF[PrintSheet · overlay]:::ov
  Q -->|Perpanjang| P[diam ⚠]:::warn
  classDef ov fill:#2563eb22,stroke:#2563eb
  classDef sh fill:#0d948822,stroke:#0d9488
  classDef nav fill:#7c3aed22,stroke:#7c3aed
  classDef warn fill:#d9770622,stroke:#d97706
  classDef md fill:#d9770622,stroke:#d97706,stroke-width:2px
  classDef bad fill:#dc262622,stroke:#dc2626
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| Deretan tombol | — | — | ⚠ Kirim, Disetujui, Ditolak, Tandai terkirim, Perpanjang, Buat invoice, Copy, PDF, Edit sejajar di setiap baris | Baris = satu aksi utama sesuai status; tap baris membuka dokumen (layar penuh) dengan aksi lain di ⋯ |
| ✓ Disetujui / ✗ Ditolak | Langsung | Tidak ada | ⚠ Mengubah lead jadi Deal dan nilai omzet dalam satu tap (AMB-24) | Toast "{lead} jadi Deal Rp X · Batal" |
| Edit / Revisi (DocEditor) | Dialog tengah | "Buang perubahan?" | ⚠ Form panjang (item, biaya, termin) di dialog; di HP sudah dibuat tinggi penuh, tapi tetap pola dialog | Layar penuh dengan Batal/Simpan di atas, ringkasan total menempel di bawah |
| Buat invoice | Pindah tab | — | ⚠ Tidak ada "Kembali ke Penawaran" | Lompatan dengan Kembali, seperti dari lead |

## Invoice

```mermaid
flowchart LR
  I[Baris invoice] -->|Terbitkan ⚠ diam| T[Diterbitkan]:::warn
  I -->|Tagih via WA| WS[Sheet kirim]:::sh
  WS -->|sudah terbit ⚠| L[bilang tercatat · tidak menulis]:::bad
  I -->|+ Catat pembayaran| P[Dialog tengah ⚠]:::md
  I -->|Batalkan| C[ConfirmSheet · tak bisa dibalik]:::bad
  classDef sh fill:#0d948822,stroke:#0d9488
  classDef warn fill:#d9770622,stroke:#d97706
  classDef md fill:#d9770622,stroke:#d97706,stroke-width:2px
  classDef bad fill:#dc262622,stroke:#dc2626
    
```

| Tombol | Membuka | Feedback | Penilaian | Usulan |
|---|---|---|---|---|
| Tagih via WA (sudah terbit) | Sheet kirim | "tercatat terkirim" | ⚠ Tidak ada yang ditulis; pengingat Beranda tetap muncul (AMB-08) | Selalu isi remindedAt |
| + Catat pembayaran | Dialog tengah | Tertutup diam | ⚠ Dua isian di dialog tengah, tanpa konfirmasi jumlah | Bottom sheet dengan jumlah besar + toast "Rp X masuk · sisa Rp Y" |
| Terbitkan | Langsung | Tidak ada | ⚠ Status berubah tanpa tanda | Toast + Batal |

## Script pesan

```mermaid
flowchart LR
  L[Daftar · baris per tahap] -->|tap baris| E[Editor · layar penuh]:::sh
  L -->|⋯| A[Action sheet]:::sh
  A -->|Arsipkan| T[Toast + Batal 5 dtk]
  A -->|Hapus permanen| C[ConfirmSheet]:::bad
  L -->|Filter| F[Sheet filter]:::sh
  E -->|Simpan ⚠ diam| L
  classDef sh fill:#0d948822,stroke:#0d9488
  classDef bad fill:#dc262622,stroke:#dc2626
    
```

> Sudah mengikuti pola yang benar (redesign 5 Nov): baris, action sheet, filter di sheet, editor layar penuh. Sisa: Simpan tanpa toast; undo 5 dtk dibanding 10 dtk di tempat lain.

## Semua dialog di tengah layar

Sekitar 40 dialog di 15 komponen memakai pola dialog tengah (modalBox). Di iPhone, pola ini paling terasa tidak native: jauh dari jempol, tertutup keyboard, dan tidak bisa digeser turun.

| Jenis isi | Contoh | Pola sekarang | Pola native |
|---|---|---|---|
| Form panjang | Tambah lead, DocEditor, Paket, Komponen, Kop bisnis, dialog Guild & Report Klien | Dialog tengah | Layar penuh: Batal kiri atas, Simpan kanan atas, Back = Batal (dengan "Buang perubahan?") |
| Form pendek (1–3 isian) | Kasih data, Catat pembayaran, Target harian, Default kalau kosong | Dialog tengah | Bottom sheet yang naik di atas keyboard |
| Daftar / alur | Follow-up beruntun, Import, Cari bisnis | Dialog tengah | Layar penuh dengan langkah dan Back per langkah |
| Pertanyaan singkat | Hapus?, Buang perubahan?, Batalkan invoice? | ConfirmSheet (bawah) | OK sudah benar |

> Satu komponen Sheet sudah ada dengan mode bawah dan layar penuh, plus Back yang benar. Usulnya: semua dialog di atas pindah ke Sheet, bertahap per kelompok, setiap kelompok dengan flow tes di 390/375/1440.
