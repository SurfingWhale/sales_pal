# PRD-007 — Guild (mode tim / enterprise)

- **Status:** v1 dibangun 2026-10-08 — tab **Lainnya → Guild** (`components/GuildHub.tsx`, `lib/guild.ts`, `app/join/page.tsx`)
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

**Perlu deploy rules:** `firebase deploy --only firestore:rules --project sales-pal` — tanpa itu, guild ditolak di produksi (koleksi `guilds` belum ada aturannya di live).

## Belum ada (berikutnya)

- Pindahin Leads / Hunting / Jualan / Report Klien ke dalam guild (opsional per fitur).
- Officer/Leader bikin deal atas nama orang lain dari UI (rules udah izinin), dan pindah pemilik deal.
- Log aktivitas, pengingat follow-up, notifikasi (PRD-006 P2).
- Nama peran custom di halaman gabung (sekarang nampil nama default).
- Cetak/PDF report tim.
