# PRD-003 — Radar Threads

- **Status:** Coming soon. Kodenya sudah jadi (PR #18); aktif begitu Meta App selesai disetel.
- **Tanggal:** 2026-09-26
- **Konteks:** Klien foto sekarang datang dari Threads. Orang yang balas atau mention post studio sudah lihat karyanya, jadi mereka DM paling hangat. Hunting Mode (PRD-002) sudah mencatat DM; Radar mencari **siapa** yang harus di-DM.

---

## 1. Batas Threads API (dicek 25 Sep 2026)

- **Tidak ada API DM.** DM tetap manual lewat Hunting (Tempel link / DM dia →).
- **Balasan & mention di post sendiri** bisa dibaca tanpa app review Meta, karena itu data akun sendiri.
- **Cari post orang lain** (`threads_keyword_search`, mis. "butuh fotografer makanan") butuh app review. Sebelum lolos, hasilnya cuma post milik sendiri.

## 2. Yang dibangun (PR #18)

- Panel **📡 Radar Threads** di atas tab Hunting.
- **Hubungkan sekali**: OAuth Threads → `/threads/callback` → kode ditukar di server jadi token 60 hari (`/api/threads/token`), disimpan di `users/{uid}/settings/threads`, diperpanjang otomatis kalau sisa < 30 hari (`/api/threads/refresh`).
- **Pindai** (`/api/threads/radar`): 15 post terakhir + semua balasannya + mention → satu baris per orang, terbaru dulu.
- Per orang: **DM dia →** (isi target Hunting `@user` di Threads), **Lihat ↗**, **Jadiin Lead** (Warm, sumber Threads), **✓ Beres** (sembunyi sampai dia ngomong lagi, `users/{uid}/radarSeen`). Tanda "udah di-DM" kalau DM ke dia sudah dicatat.
- Izin: `threads_basic`, `threads_read_replies`, `threads_manage_mentions`.
- Gratis: Vercel function paket Hobby, tanpa Firebase Blaze.
- Sebelum disetel, panel tampil sebagai kartu "Segera hadir" (tanpa `NEXT_PUBLIC_THREADS_APP_ID`).

## 3. Kenapa belum aktif

Setup Meta App mentok di sisi akun Meta, bukan di kode:
1. Langkah **Bisnis** di "Buat aplikasi" butuh portofolio bisnis yang dimiliki akun Facebook yang sama dengan akun developer. Portofolio yang ada dibuat lewat login Instagram, jadi tidak kebaca.
2. Verifikasi developer butuh nomor ponsel yang terpasang di profil Facebook lewat Pusat Akun. Nomor yang dipakai bersama banyak profil IG/Threads ditolak.

## 4. Langkah melanjutkan (sekali saja)

1. Nomor ponsel baru yang belum dipakai akun Meta mana pun → Pusat Akun → Info kontak → pasang **hanya** ke profil Facebook pemilik.
2. `developers.facebook.com/async/registration` → verifikasi pakai nomor itu (tanpa 0 di depan).
3. `developers.facebook.com/apps` → Buat aplikasi → use case **Access the Threads API** → pilih portofolio bisnis milik akun Facebook itu.
4. Permissions: `threads_basic`, `threads_read_replies`, `threads_manage_mentions`.
5. Settings: redirect, uninstall, dan delete callback → `https://salespal-alpha.vercel.app/threads/callback`.
6. App roles → Threads Testers → akun Threads yang dipakai berburu; terima undangan di app Threads (Settings → Account → Website permissions → Invites).
7. Vercel Production: `NEXT_PUBLIC_THREADS_APP_ID`, `THREADS_APP_SECRET` → redeploy.

## 5. Sementara ini

Di Threads buka **Aktivitas** → tahan nama orang yang balas → **Copy link** → Hunting **📋 Tempel link** → DM → catat. Tracking dan evaluasi template tetap jalan.

## 6. Nanti

- Radar kata kunci (`threads_keyword_search`) setelah app review.
- Notifikasi Telegram gratis saat ada balasan baru (Vercel cron harian).
