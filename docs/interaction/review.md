# Review kritis

Apakah SalesPal sekarang (per 6 Nov 2026, termasuk PR #115) bisa dipahami sebagai satu sistem? Jawabannya: ✅ ya, 🟡 sebagian, ❌ tidak.

## Bisakah pengguna memahami …

| Pertanyaan | Jawaban | Kenapa |
|---|---|---|
| Di mana dia berada? | 🟡 | Nav dan subnav jelas. Overlay penuh (lembar lead, kontak, Percakapan) menutup seluruh layar tanpa jejak "dari mana" di kepalanya, kecuali label tutup yang sekarang menyebut tujuannya |
| Kenapa dia di sini? | 🟡 | Lompatan dari Beranda kini menyebut asalnya ("‹ Beranda"). Membuka app lagi setelah iOS memuat ulang membawanya ke Beranda tanpa penjelasan (AMB-25) |
| Apa yang bisa dilakukan? | 🟡 | Kartu lead dan prospek punya satu aksi utama. Halaman Kirim dan lembar lead masih punya banyak aksi setara |
| Apa yang terjadi setelah tap? | ❌ | Delapan jalan kirim dengan tiga arti "Terkirim" (AMB-08). Banyak aksi tanpa feedback sama sekali (AMB-13) |
| Dalam state apa dia sekarang? | 🟡 | Posisi lead dan status prospek terlihat. Status prospek memakai empat set label (C1). Kiriman tertunda tidak terlihat sama sekali (AMB-06) |
| Bagaimana membatalkan atau memulihkan? | ❌ | Undo bertahan 5 dtk, 10 dtk, sampai ditutup, atau tidak ada. Hasil prospek, Gugur, dan status penawaran tidak bisa dibatalkan (AMB-09, AMB-13, AMB-24) |
| Ke mana dia akan kembali? | 🟡 | Benar untuk jalur yang diperbaiki di PR #115. Back setelah pindah tab keluar dari app (AMB-01). Langkah di dalam Pesan tidak punya Back (AMB-16) |

## Bisakah engineer memahami …

| Pertanyaan | Jawaban | Kenapa |
|---|---|---|
| State apa yang harus ada? | 🟡 | Artefak C memetakannya. State "kiriman tertunda" belum ada sebagai benda (AMB-06) |
| Transisi apa yang terjadi? | ✅ | Diagram C1–C6 dan tabel D, dengan `file:baris` |
| Komponen mana pemiliknya? | 🟡 | Artefak F memetakannya. Satu perilaku tersebar di banyak pemilik: kiriman tertunda di 5 komponen, hasil prospek di 2, konteks balik di 4 mekanisme |
| Konteks apa yang harus bertahan? | 🟡 | Tertulis di E. Belum ada satu tempat yang menyimpannya (AMB-03, AMB-25) |
| Apa yang terjadi saat tutup atau Back? | ✅ | E + PRD-026 + flow `navigasi balik` |
| Apa yang terjadi antar tab? | 🟡 | Lompatan sudah jelas (`cameFrom`). Pindah tab lewat nav dan Back belum diputuskan (AMB-01) |
| Apa yang terjadi saat app dibuka lagi? | ❌ | Tidak dirancang. Hanya preferensi di `localStorage` yang kembali (A4) |

## Bisakah QA mengetes …

| Pertanyaan | Jawaban | Kenapa |
|---|---|---|
| Setiap transisi? | 🟡 | 34 flow mencakup jalur utama. Transisi otomatis berbasis waktu (2/5 hari, parkir 60/90 hari, jatuh tempo) belum dites dengan jam palsu |
| Setiap state? | 🟡 | Beberapa state hanya bisa dicapai dengan menanam data (akun besar) |
| Setiap jalur balik? | 🟡 | Lima jalur di flow `navigasi balik`. Sisanya ada di tabel PRD-026 tanpa tes |
| Setiap error? | ❌ | Kondisi offline tidak bisa dites karena tulisan menggantung (AMB-07). Banyak aksi tanpa `catch` |
| Setiap transisi eksternal? | ❌ | Kembali dari WhatsApp tidak dideteksi, jadi tidak ada yang bisa dites. Kiriman tertunda yang hilang tidak tercatat di mana pun |

## Kesimpulan

Model interaksi SalesPal **belum lengkap**. Masalah terbesarnya bukan tampilan atau navigasi, tetapi tiga hal di inti produk:

1. **Kiriman.** Tidak ada satu kontrak untuk "Terkirim", dan kiriman tertunda bisa hilang (AMB-06, AMB-08).
2. **Pemulihan.** Tidak ada aturan undo dan feedback yang sama (AMB-09, AMB-13, AMB-24).
3. **Data.** Ada tiga tempat yang menulis ulang data tanpa sepengetahuan pengguna (AMB-15, AMB-10, AMB-21).

Script Chat belum menjadi sistem: script tidak tahu tujuan, respons yang diharapkan, atau langkah berikutnya (AMB-18).

**Urutan kerja yang disarankan setelah review owner:**
1. **P0** (AMB-15, AMB-10, AMB-06, AMB-07, AMB-11): data dan kiriman.
2. **Satu kontrak kirim + satu aturan feedback** (AMB-08, AMB-13), yang sekaligus menutup AMB-09, AMB-17, dan AMB-24.
3. **Tumpukan konteks** (AMB-03), yang menutup AMB-01, AMB-14, AMB-16, dan AMB-25.
4. **Script Chat sebagai sistem** (AMB-18 sampai AMB-21) bersama PRD-024 langkah 5 dan PRD-025 Fase B.
