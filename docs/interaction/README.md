# SalesPal sebagai sistem interaksi

Folder ini memodelkan **perilaku** SalesPal, bukan tampilannya:

```
niat pengguna → konteks → aksi → perubahan state → feedback → aksi berikutnya → konteks balik
```

Satu layar hanyalah satu wujud dari sistem ini. Sebelum mengubah UI, baca dulu artefak yang relevan di sini.

**Status:** draf pertama, 6 Nov 2026. Semua keputusan yang ditandai **AMBIGUITY** di [ambiguities.md](ambiguities.md) menunggu review owner. Kode produksi tidak diubah sampai model ini disetujui.

| Artefak | Isi | Dipakai untuk |
|---|---|---|
| [A. Arsitektur informasi](A-information-architecture.md) | Struktur sebenarnya: tempat, tab, pane, permukaan (halaman, sheet, dialog, popover, toast, overlay), tujuan eksternal, UI yang menetap dan yang sementara | Tahu di mana sesuatu tinggal |
| [B. Alur pengguna](B-user-flows.md) | Diagram Mermaid untuk perjalanan penting, sesuai perilaku kode | Tahu urutan langkah dan cabangnya |
| [C. Model state](C-state-models.md) | State Prospek, Lead, Outreach, Penawaran, Invoice, Script beserta transisinya | Tahu apa yang berubah dan kapan |
| [D. Kontrak interaksi](D-interaction-contracts.md) | Pemicu → prasyarat → aksi → perubahan state → feedback → aksi berikutnya → konteks balik | Membangun dan mengetes satu aksi |
| [E. Spesifikasi perilaku layar](E-screen-behavior.md) | Per layar: tujuan, pintu masuk/keluar, aksi utama/sekunder, loading/kosong/error/sukses, Back, tutup, konteks | Membangun dan mengetes satu layar |
| [F. Peta perilaku komponen](F-component-behavior.md) | Komponen → aksinya → yang terjadi | Tahu komponen mana pemilik perilaku apa |
| [Ambiguitas](ambiguities.md) | Perilaku yang belum jelas: kenapa penting, keputusan yang disarankan, dampaknya | Keputusan owner |
| [Review](review.md) | Bisakah pengguna, engineer, dan QA menjawab pertanyaan dasar dari model ini? | Mengukur kelengkapan |

## Tiga jenis perpindahan

Setiap transisi masuk ke salah satu jenis berikut. Jenisnya menentukan arti Back dan Tutup.

| Jenis | Arti | Tutup / Back |
|---|---|---|
| **Overlay** | Konteks asal tetap hidup di bawahnya (lembar lead, kontak prospek, chat, sheet, dialog) | Satu langkah mundur ke konteks itu, dengan state utuh |
| **Navigasi** | Pengguna sengaja pindah tempat (nav, subnav) | Konteks lama boleh dilepas. Tidak ada tombol "kembali ke …" |
| **Lompatan** | Aksi di satu tempat membawa ke tempat lain (Beranda → orang di Hunting, Riwayat → penawaran) | Tujuan diingat dan disebut namanya: "‹ Kembali ke Beranda" |
| **Eksternal** | SalesPal ditinggal sementara (WhatsApp, IG, Threads, Maps, berbagi PDF) | Saat kembali: konteks yang sama, plus pertanyaan "Udah kekirim?" kalau kirimnya tidak bisa diketahui |

## Kosakata

Istilah mengikuti [GLOSSARY.md](../../GLOSSARY.md): Prospek, Lead, Posisi, Status, Dikontak, Deal, Gugur, Script, Tahap, Brand, Workflow, Outreach, Terkirim. Kalau artefak di sini butuh istilah baru, tambahkan dulu di GLOSSARY.

## Hubungan dengan dokumen lain

- **Aturan visual:** [standards/design.md](../standards/design.md).
- **Aturan perilaku yang terukur (44pt, Escape, axe, kecepatan):** [standards/native.md](../standards/native.md).
- **Keputusan per fitur:** [prd/](../prd/). PRD-026 (navigasi balik) adalah *bagian* dari model ini, bukan model penuhnya.
- **Daftar overlay:** [ui-inventory.md](../ui-inventory.md). Dibaca bersama A dan F.
- **Cara mengaudit dan mengubah layar:** skill `.claude/skills/salespal-ui-audit`. Setiap perubahan UI memperbarui artefak di sini dalam PR yang sama.
