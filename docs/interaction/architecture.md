# SalesPal sebagai satu sistem — arsitektur interaksi global

Dokumen ini menunjukkan SalesPal sebagai **satu perjalanan penjual**, bukan kumpulan halaman. Setiap feature di [features/](features/) adalah satu ruas dari perjalanan ini.

## 1. Why satu sistem

Penjual tidak berpikir "sekarang saya di tab Hunting". Ia berpikir: *siapa yang harus saya hubungi sekarang, apa yang harus saya bilang, dan apa yang terjadi setelahnya*. Kalau setiap halaman punya aturan sendiri soal kirim, hasil, Back, dan feedback, penjual harus belajar ulang di setiap tempat, dan data yang mengalir antar ruas (prospek → lead → penawaran → invoice) bocor di sambungannya.

Tiga hal yang membuat SalesPal satu sistem:

1. **Satu benang orang.** Orang yang sama bergerak dari Prospek ke Lead ke klien. Riwayatnya ikut (`prospect.leadId`, `quote.leadId`, `invoice.quoteId`).
2. **Satu kontrak kirim.** Semua pesan keluar lewat app lain dan dicatat hanya setelah penjual mengonfirmasi ([DEC-001](decisions.md#dec-001), [DEC-002](decisions.md#dec-002)).
3. **Satu aturan kembali dan satu aturan feedback.** Tutup selalu ke tempat asal ([DEC-007](decisions.md#dec-007)); setiap perubahan memberi tahu hasilnya dan cara membatalkannya ([DEC-004](decisions.md#dec-004), [DEC-005](decisions.md#dec-005)).

## 2. Tujuan penjual sepanjang sistem

> "Saya ingin tahu siapa yang harus saya hubungi hari ini, mengirim pesan yang tepat untuk tahap orang itu, dan tidak kehilangan satu pun orang atau rupiah di antara chat, penawaran, dan pembayaran."

## 3. Perjalanan global

```mermaid
flowchart TD
  subgraph Hari["Mulai hari"]
    B[Beranda: apa yang perlu ditindak sekarang]
  end

  subgraph Temukan["Hunting: menemukan dan menyapa"]
    H1[Prospek ditemukan: link post, cari, Cari bisnis]
    H2[Kontak prospek: siapa dia, sampai mana]
    H3[Halaman Kirim: script untuk tahapnya]
  end

  subgraph Keluar["Di luar SalesPal"]
    X[(WhatsApp / IG / Threads)]
  end

  Q{Udah kekirim?}
  R{Dia jawab apa?}

  subgraph Lead["Lead: mengelola orang yang serius"]
    L1[Lembar lead: Posisi dan langkah berikutnya]
    L2[Pesan ke lead: script terisi]
  end

  subgraph Uang["Penawaran sampai pembayaran"]
    P1[Penawaran Draft]
    P2[Penawaran Terkirim: kop dan syarat dikunci]
    D{Klien setuju?}
    I1[Invoice Draft]
    I2[Invoice terbit: belum bayar]
    PAY{Pembayaran masuk?}
    LUNAS[Lunas]
  end

  B -->|kartu prospek| H2
  B -->|kartu lead| L1
  B -->|kartu penawaran / invoice| P2
  B -->|WA dari kartu| X
  H1 --> H2 --> H3 --> X
  L1 --> L2 --> X
  P2 -->|Kirim / follow-up| X
  I2 -->|Tagih via WA| X

  X -.->|kembali ke SalesPal| Q
  Q -->|Udah| SENT[Terkirim tercatat: hitungan, follow-up dijadwalkan]
  Q -->|Belum| RESUME[Pesan tetap siap, tidak ada yang dicatat]
  Q -.->|layar hilang / reload| PEND[Ditanya di tingkat app sampai 12 jam]
  PEND --> Q

  SENT --> WAIT[Menunggu balasan]
  WAIT -->|2 hari tanpa jawaban| FU[Follow-up: Belum respon]
  FU --> H3
  WAIT -->|3 kali tanpa jawaban| PARK[Tidak terhubung, diparkir 60 hari]
  WAIT -->|dia membalas| R

  R -->|Tertarik / Pikir-pikir / Nanti| NEXT[Follow-up dijadwalkan]
  NEXT --> H3
  R -->|Tidak tertarik| TOLAK[Diparkir 90 hari]
  R -->|Jangan hubungi| DNC[Dikunci, riwayat dihapus]
  R -->|Kasih data| L1

  L1 -->|Mereka bales| L1
  L1 -->|Buat penawaran| P1
  P1 -->|Kirim| P2
  P2 --> D
  D -->|Disetujui| DEAL[Lead jadi Deal]
  D -->|Ditolak| L1
  D -->|Revisi| P1
  DEAL --> I1 --> I2 --> PAY
  PAY -->|DP| I2
  PAY -->|Sisa lunas| LUNAS
  I2 -->|lewat jatuh tempo| TELAT[Telat: muncul di Beranda]
  TELAT --> B
  NEXT -.->|tanggalnya tiba| B
  FU -.-> B
  L1 -->|Gugur| GUGUR[Gugur + Rejection Log]
```

## 4. Titik keputusan global

```
Siapa yang saya hubungi sekarang?            (penjual, dibantu Beranda)
├── Ada tugas yang jatuh tempo     → kartu Beranda, urut uang terbesar dulu
└── Tidak ada                      → Hunting: cari prospek baru

Orang ini sudah pernah dihubungi?            (sistem, dari journey/Posisi)
├── Belum                          → Intro
├── Sudah, belum dibalas           → Follow-up (2, lalu 5 hari)
├── Sudah 3× tanpa jawaban         → Parkir 60 hari
└── Sudah dibalas                  → Gali kebutuhan / Penawaran

Pesan sudah terkirim?                        (hanya penjual yang tahu)
├── Udah   → Terkirim tercatat, hitungan sesi naik, follow-up dijadwalkan
├── Belum  → tidak ada yang dicatat
└── Tidak dijawab → tetap ditanya (antrean kiriman tertunda)

Dia jawab apa?                               (penjual, sheet "{nama} jawab apa?")
├── Tertarik / Pikir-pikir / Hubungi nanti → follow-up +1 / +3 / tanggal
├── Tidak tertarik                         → parkir 90 hari
├── Kasih data                             → Lead (ETB), digabung bila sudah ada
└── Jangan hubungi                         → dikunci selamanya (tanya dulu)

Lead siap ditawari?                          (penjual)
├── Ya    → Penawaran Draft → Terkirim (kop & syarat dikunci)
└── Tidak → Gugur, dengan alasan, ke Rejection Log

Klien setuju?                                (penjual menandai)
├── Disetujui → lead jadi Deal, nilai masuk omzet      ⚠ tanpa undo (GAP-QUO)
├── Ditolak   → lead kembali ke Dibales                 ⚠ tanpa undo
└── Minta ubah → Revisi (versi lama Digantikan)

Uang sudah masuk?                            (penjual mencatat)
├── Sebagian → DP masuk, sisa tetap ditagih
├── Semua    → Lunas
└── Belum, lewat jatuh tempo → Telat, muncul di Beranda
```

## 5. State yang menembus feature

| State | Arti bagi penjual | Disimpan di | Dibaca oleh |
|---|---|---|---|
| Journey prospek (`contact`, `result`, `nextAt`, `history`) | Sampai mana saya dengan orang ini | Firestore `prospects` | Hunting, Kontak, Percakapan, Beranda |
| Log DM (`hunts`) | Pesan apa yang saya kirim, script mana | Firestore `hunts` | Hunting (riwayat, angka template) |
| Sesi hunting (`huntSessions.counts`) | Target hari ini, sudah berapa | Firestore `huntSessions` | Bar sesi |
| Lead (Posisi, Status, `nextAt`) | Orang serius dan langkah berikutnya | Firestore `leads` | Leads, Lembar lead, Beranda, Pesan |
| Penawaran (`status`, `issuer`, `terms`, `supersededBy`) | Janji yang sudah saya kirim | Firestore `quotes` | Penawaran, Lembar lead, Beranda |
| Invoice (`payments`, jatuh tempo) | Uang yang masih di luar | Firestore `invoices` | Invoice, Beranda |
| Kiriman tertunda | "Tadi udah kekirim?" yang belum dijawab | `sessionStorage` `sp-pending-sends` (12 jam) | PendingSends, layar pengirim |
| Asal lompatan (`cameFrom`, `leaveTo`, `backTo`) | Tempat saya tadi | Memori React | Tombol "Kembali ke …" |
| Tulisan offline | Perubahan yang belum sampai server | Cache Firestore lokal (IndexedDB) | Semua |
| **Hanya di kepala penjual** | Pesan benar-benar terkirim; isi balasan di WhatsApp | Tidak ada, sampai penjual mengonfirmasi atau menempel | — |

## 6. Sambungan antar feature (tempat yang paling sering rusak)

| Sambungan | Yang harus ikut | Status |
|---|---|---|
| Beranda → Kontak / Lead / Penawaran | Asal, supaya Tutup kembali ke Beranda | ✅ #115 |
| Kontak → Halaman Kirim → kembali | Orang yang sama, daftar dan scroll | 🟡 daftar dibongkar (AMB-14) |
| Kirim → WhatsApp → kembali | Pertanyaan "udah kekirim?" | ✅ Hunting/Percakapan/Pesan · ❌ Beranda/penawaran |
| Kasih data → Lead | Riwayat dan kontak, tanpa menimpa | ✅ #116 |
| Lead → Penawaran → kembali | "Kembali ke {lead}" | ✅ #115 |
| Penawaran → Invoice | "Kembali ke Penawaran" | ❌ |
| Disetujui → Deal | Undo bila salah tap | ❌ (AMB-24) |
| Reload iOS di tengah | Permukaan teratas dibuka lagi | ❌ (AMB-25) |

## 7. Indeks feature

| Feature | File | Ruas perjalanan |
|---|---|---|
| Beranda | [features/beranda.md](features/beranda.md) | Mulai hari, apa yang perlu ditindak |
| Hunting | [features/hunting.md](features/hunting.md) | Menemukan prospek, menyiapkan dan mengirim pesan |
| Kontak prospek | [features/kontak-prospek.md](features/kontak-prospek.md) | Satu orang: cerita, langkah berikutnya, hasil |
| Percakapan | [features/percakapan.md](features/percakapan.md) | Membaca dan membalas seperti di chat |
| Lembar lead | [features/lembar-lead.md](features/lembar-lead.md) | Orang serius: Posisi, jadwal, dokumen |
| Pesan ke lead | [features/pesan-ke-lead.md](features/pesan-ke-lead.md) | Mengirim dengan script terisi dan mencatatnya |
| Penawaran | [features/penawaran.md](features/penawaran.md) | Janji tertulis kepada klien |
| Invoice | [features/invoice.md](features/invoice.md) | Menagih dan mencatat uang masuk |
| Script pesan | [features/script-pesan.md](features/script-pesan.md) | Apa yang dikatakan di setiap tahap |

## 8. Gap lintas feature

Gap per feature ada di §12 setiap file. Kalau dikumpulkan (6 Nov 2026: ±136 gap, 11 sudah diperbaiki di #115/#116), sebagian besar bukan masalah satu layar. Masalahnya adalah **satu aturan sistem yang belum diterapkan di semua tempat**. Memperbaiki aturannya sekali menutup banyak gap sekaligus.

| Aturan sistem yang bocor | Gap yang tertutup bila aturannya diterapkan | Keputusan |
|---|---|---|
| **Satu kontrak kirim.** Semua handoff ke WhatsApp/DM memakai antrean kiriman tertunda; dicatat hanya setelah "Udah" | GAP-BER-3/4, GAP-QUO-6/7/8, GAP-INV-1/2, GAP-HUN-9, GAP-PSN-10/13 | DEC-001, DEC-002 |
| **Satu aturan feedback.** Bisa dibalik → toast setelah tulisan + Batal 10 dtk di tingkat app (bertahan saat pindah layar); tidak bisa dibalik → confirm dulu | GAP-BER-1/5/6, GAP-LEAD-1/2/3/5/10/11, GAP-QUO-3/9/15, GAP-INV-3/4/9, GAP-PCK-2/4/5/6/11, GAP-HUN-4/5/6/17, GAP-SCR-1/2, GAP-PSN-3/5 | DEC-004, DEC-005 |
| **Satu sheet hasil prospek** | GAP-PCK-1/3, GAP-HUN-3 | DEC-009 |
| **Satu tumpukan konteks.** Overlay di atas asal; lompatan mengingat asal; permukaan teratas dibuka lagi setelah reload | GAP-HUN-1/16, GAP-BER-8/9/10, GAP-QUO-5/11, GAP-LEAD-12/13, GAP-PSN-1/2, GAP-KON-18/19, GAP-PCK-14 | DEC-007 |
| **Wadah sesuai isi** (dialog tengah ditinggalkan) | GAP-KON-12, GAP-QUO-16, GAP-INV-4/10 | DEC-003 |
| **Script yang tepat dipilih untuk orangnya** (default dipakai, tahap dari Posisi, brand) | GAP-HUN-2, GAP-SCR-3/4/5/6/16, GAP-PSN-8, GAP-PCK-10 | DEC-012, DEC-014 |
| **Status dokumen jujur** (Disetujui/Ditolak/Revisi/Hapus menjaga lead dan versi tetap sinkron) | GAP-QUO-4/10/12/13, GAP-LEAD-6/7, GAP-INV-5/6/7/8 | DEC-011 |

**Urutan yang disarankan:** kontrak kirim dan aturan feedback dulu (keduanya menyentuh setiap hari kerja penjual dan menyangkut kejujuran angka), lalu tumpukan konteks (refactor sedang, dilindungi flow `navigasi balik`), lalu wadah dialog per kelompok, lalu script dan status dokumen.
