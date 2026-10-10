# PRD-007 — Guild (mode tim / enterprise)

- **Status:** v1 dibangun 2026-10-08 (#30); Fase 2 rilis 2026-10-08 — 2.1–2.4 (#31), 2.6 notifikasi pagi (#32), 2.5 ruang kerja Pribadi/Guild (#33). Tab **Lainnya → Guild** (`components/GuildHub.tsx`, `lib/guild.ts`, `app/join/page.tsx`)
- **Keputusan user:** SalesPal = **alat internal**; "sales" = **tim sendiri dan tim sales klien**; modelnya **guild** kayak di game — siapa pun yang login (Gmail) bisa bikin/gabung guild, guild yang nentuin peran.
- **Lanjutan dari:** PRD-006 (P1: workspace + peran).

## Konsep

| Peran (nama bisa diganti per guild) | Bisa |
|---|---|
| **Leader** | ganti nama guild & nama peran, undang Officer/Member/Viewer, ganti peran siapa pun, keluarkan siapa pun, serahkan Leader |
| **Officer** | lihat semua deal, atur target, bekukan report tim, undang Member/Viewer, pindahin Member ↔ Viewer, keluarkan Member/Viewer |
| **Member** | kerjain & lihat **deal miliknya sendiri**, lihat baris report dirinya |
| **Viewer** | lihat daftar anggota, target, dan **report yang udah dibekukan**. Ga bisa lihat deal (nama customer). Cocok buat klien |

- Satu orang bisa ikut beberapa guild (mis. Leader di tim lo, Officer di guild tim sales klien).
- **Undangan** = link `/join?g=…&c=…`, berlaku 7 hari, buat peran tertentu. Belum login → login dulu (`/login?next=…`) → balik ke halaman gabung.
- **Serah-terima Leader** dalam satu batch: yang dituju jadi Leader, Leader lama turun jadi Officer.
- Data pribadi (`users/{uid}/…`: Leads, Hunting, Jualan, Report Klien) **tetap pribadi**. Guild cuma nambah ruang bersama; migrasi fitur lain ke guild = langkah berikutnya.

## Fitur v1

1. **Pipeline tim** — sama kayak Report Klien (chat + sumber → tahap → lunas), tiap deal punya pemilik. Leader/Officer lihat semua + nama pemilik; Member cuma miliknya.
2. **Report Tim** — per bulan: total tim (omzet lunas, deal lunas, chat) vs rata-rata 3 bulan, tabel per sales (chat, penawaran, lunas, omzet, target, capaian %), urut omzet. Member lihat barisnya sendiri. Leader/Officer **atur target** per orang, **bekukan** report (baru kelihatan buat Viewer), **kirim via WA**.
3. **Anggota** — daftar + peran, ganti peran, keluarkan, bikin/cabut link undangan, atur nama guild & nama peran, serahkan Leader, keluar dari guild.

## Data & keamanan

```
guilds/{g}                 { name, leaderUid, titles, createdAt }
  members/{uid}            { uid, name, email, role, inviteCode?, joinedAt }
  invites/{code}           { role, guildName, createdBy, createdAt, expiresAt }
  deals/{id}               Deal (lib/funnel.ts) + ownerUid, ownerName
  targets/{yyyy-mm_uid}    { uid, month, revenue, deals }
  reports/{yyyy-mm}        report tim beku
users/{uid}/guilds/{g}     { name, joinedAt } — daftar guild milik user
```

Semua aturan peran ditegakkan di `firestore.rules` (bukan cuma di UI), termasuk: gabung cuma dengan undangan yang masih berlaku dan **persis** buat peran itu, ga bisa ambil alih guild orang, Member ga bisa baca deal orang lain atau ngubah sumber yang udah tercatat, Viewer ga bisa baca deal, Leader ga bisa keluar sebelum serah-terima. **81 test rules** (`tests/firestore.rules.test.mjs`) + flow dua akun (`guild: found, invite, join by link, sell, team report with target`).

**Rules di-deploy 2026-10-10** (`firebase deploy --only firestore:rules --project sales-pal`). Sebelumnya "Bikin guild" ditolak di produksi karena koleksi `guilds` belum ada aturannya di live, walau flow test di emulator lulus. Tiap PR yang ngubah `firestore.rules` perlu deploy rules sesudah merge.

## Fase 2 — dikerjakan 2026-10-08

Diminta user: "catet ke PRD terus lakuin semuanya". Urutan eksekusi = dari yang kecil & aman ke yang paling lebar.

| # | Item | Keputusan desain | Status |
|---|---|---|---|
| 2.1 | **Nama peran custom di halaman gabung** | undangan nyimpen judul peran saat dibuat (`roleTitle`), halaman `/join` nampilin itu | ✅ rilis |
| 2.2 | **Deal atas nama orang lain + pindah pemilik** | Leader/Officer pilih "Pemilik" pas bikin deal dan bisa pindahin deal ke anggota lain (rules udah izinin; Member tetap cuma bisa atas nama sendiri) | ✅ rilis |
| 2.3 | **Cetak/PDF report tim** | lembar A4 hitam-putih kayak report klien: total tim, tabel per sales, target & capaian, definisi | ✅ rilis |
| 2.4 | **Log aktivitas** | `guilds/{g}/activities/{id}` { who, whoName, what, ref, refName, at }: bikin deal, geser tahap, lunas, gugur, pindah pemilik, gabung, ganti peran, keluar, target. Ditulis bareng aksinya, ga bisa diedit/dihapus (rules), dibaca Leader/Officer semua & Member yang menyangkut dirinya. Tab **Aktivitas** | ✅ rilis |
| 2.5 | **Mode ruang kerja (fitur pindah ke guild)** | pemilih **Pribadi / nama guild** di header. Leads, Outreach, Rejection, Hunting, Jualan (Paket, Penawaran, Invoice), Report Klien, Quick Pitch & Insights baca/tulis ke ruang yang dipilih. Di guild: data jualan punya **pemilik** (Member lihat miliknya, Leader/Officer semua, Viewer ga lihat); katalog bersama (Paket, template pitch, info bisnis, target harian) diatur Leader/Officer. **Tetap pribadi:** Threads Radar (token per orang) & lead website (pipeline owner). Data pribadi ga dipindah otomatis | ✅ rilis — `lib/space.ts`; data di `guilds/{g}/…` dengan `ownerUid`; pemilih ruang di header (muncul kalau ikut guild sebagai penjual) |
| 2.6 | **Pengingat & notifikasi** | (a) panel **Perlu Ditindak** di Dashboard: penawaran > 3 hari belum gerak, deal aktif macet > 7 hari, follow-up jatuh tempo, invoice lewat tempo; (b) **push notif** PWA tiap pagi (Web Push, VAPID) lewat cron Vercel — iPhone butuh app di-install ke home screen (iOS 16.4+). Butuh env `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`CRON_SECRET` + service account | ✅ rilis — panel nambah deal macet (Report Klien + deal guild milik sendiri) & follow-up rejection; push 08.00 WIB (`/api/cron/digest`, `pushSubs/` server-only), tombol di Profil |

## Banner guild (2026-10-10)

Di atas tab: lambang (inisial nama guild dalam perisai, warnanya dari nama), nama + peran kamu, avatar anggota diwarnai per peran, **Level guild** (naik tiap deal tim lunas: 3, 10, 25, 50, 100, 200, 400), dan **bulan ini vs target** (tim buat Leader/Officer, punya sendiri buat Member). Viewer ga lihat deal, jadi cuma lambang, nama, dan anggota.

## Belum ada (sesudah Fase 2)

- Salin/pindah data pribadi lama ke guild secara massal.
- Notifikasi lewat email / WhatsApp template (butuh layanan email / WABA).
