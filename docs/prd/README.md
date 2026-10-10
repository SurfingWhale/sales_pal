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
| [007](PRD-007-guild.md) | Guild: tim dengan peran Leader/Officer/Member/Viewer, pipeline & report tim, ruang kerja, notifikasi pagi | v1 + Fase 2 dibangun | #30–#33 |
| [008](PRD-008-redesign-skor-potensi.md) | Desain baru: Beranda yang nyuruh, peta lead, skor potensi 5 sinyal, profil customer dari WhatsApp; audit `better-*`; uji tiap deploy | Dibangun | #34–#40 |
| [009](PRD-009-hunting-session-journey.md) | Sesi hunting + journey prospek: share post Threads → prospek dengan konteks (butuh apa, kapan, di mana), template kanban per tahap + variabel, Copy = kirim (Batal), disposisi status + hasil, DNC, NTB → ETB, kampanye, performa hunter & biaya | Dibangun, nunggu merge | #42 |

Uji otomatis: `npm run test:flows` (HP) dan `DESKTOP=1 npm run test:flows` — 13 flow lewat emulator Firebase. Uji manual tiap deploy: skill `salespal-uat` (claude-config).
