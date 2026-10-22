# PRD SalesPal — indeks

SalesPal: PWA buat freelancer & tim sales kecil di Indonesia — cari lead, ngobrol lewat WhatsApp, kirim penawaran & invoice, dan bikin report bulanan buat klien. Live di https://salespal-alpha.vercel.app.

| PRD | Isi | Status | PR |
|---|---|---|---|
| [001](PRD-001-brand-unification-and-auth-persistence.md) | Logo & warna biru seragam, sesi login PWA ga hilang | Dibangun | #3, #10, #39 |
| [002](PRD-002-hunting-mode.md) | Hunting Mode: catat DM per template, lihat template mana yang dibales; Balas cepat | Dibangun | #14, #17, #23 |
| [003](PRD-003-threads-radar.md) | Radar Threads: siapa yang bales/mention, DM dari Hunting | Kode jadi, nunggu Meta App | #18 |
| [004](PRD-004-interface-audit.md) | Audit antarmuka pertama: dialog, keyboard, kontras, ukuran input | Dibangun | #21 |
| [005](PRD-005-funnel-hulu-ke-hilir.md) | Funnel hulu ke hilir: konten → chat → lunas → report bulanan klien (PDF + WA) | Fase 0 dibangun | #26–#28 |
| [006](PRD-006-audit-dan-platform.md) | Audit flow & backend: login di server, brankas token, kuota, tanpa data contoh | P0 dibangun | #29 |
| [007](PRD-007-guild.md) | Guild: tim dengan peran Leader/Officer/Member/Viewer, pipeline & report tim, ruang kerja, notifikasi pagi; banner guild; bawa data Pribadi ke guild | v1 + Fase 2 + §2.7 dibangun | #30–#33, #43, #45 |
| [008](PRD-008-redesign-skor-potensi.md) | Desain baru: Beranda yang nyuruh, peta lead, skor potensi 5 sinyal, profil customer dari WhatsApp; audit `better-*`; uji tiap deploy; Beranda tiga mode; menu per alur | Dibangun | #34–#40, #44, #45 |
| [009](PRD-009-hunting-session-journey.md) | Sesi hunting + journey prospek: share post Threads → prospek dengan konteks (butuh apa, kapan, di mana), template kanban per tahap + variabel, Copy = kirim (Batal), disposisi status + hasil, DNC, NTB → ETB, kampanye, performa hunter & biaya; masukan QA 11 Okt (ID prospek, log berlabel, kalender job, kop & logo invoice, report penjualan); Log aktivitas + heat map | Dibangun (belum: PiP desktop) | #42, #47 |
| [010](PRD-010-standar-native.md) | Standar "native" iPhone 12 & Mac yang terukur: kriteria HIG, tes WebKit (iPhone 12, Safari) di GitHub Actions, audit HIG + axe di tiap langkah, akun ukuran produksi, waktu respons tap, Speed Insights; penilaian 10 repo desain | Dibangun; CI WebKit hijau. Nunggu data lapangan & UAT owner | #52, #53 |
| [011](PRD-011-bisnis-dan-dokumen.md) | Guild sebagai identitas bisnis + alur dokumen: snapshot kop & syarat, default dokumen, kirim penawaran dengan SPK/NDA, status tanda tangan terpisah; rencana MVP 8 langkah | Tahap 1 dibangun (kirim + SPK/NDA, snapshot, default dokumen) | #60 |
| [012](PRD-012-cari-bisnis.md) | Cari bisnis di Google Maps (Places API resmi, bukan scraping), titik lemah dari ulasan, pesan pembuka, simpan jadi lead; template Excel + import; rencana sumber pihak ketiga, verifikasi email, AI | MVP dibangun; perlu `GOOGLE_PLACES_API_KEY` | #60 |
| [013](PRD-013-peta-lokasi.md) | Peta 3D (MapLibre + OpenFreeMap) dengan pin tiap lead, lokasi lead dari alamat/GPS/geser peta, Beranda dengan tipe scroll jelas (antrian geser, sheet, kotak terbatas), kartu bergaris tahap | Dibangun | #61 |
| [015](PRD-015-akses-dan-batas-api.md) | Akses tertutup (undangan guild owner), izin alat berbayar per peran dari Leader, batas bulanan di bawah jatah gratis (Cari bisnis 900, cari alamat 4.500, scan AI 300), header keamanan | Dibangun | |

Uji otomatis: `npm run test:flows` (HP), `DESKTOP=1 npm run test:flows`, dan WebKit `DEVICE=iphone12|safari` (CI `native`) — 17 flow lewat emulator Firebase, dengan audit HIG di tiap langkah. Uji manual tiap deploy: skill `salespal-uat` (claude-config).
