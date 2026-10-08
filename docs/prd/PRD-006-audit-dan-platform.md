# PRD-006 — Audit Flow & Backend: dari Login sampai Sales Reporting

- **Status:** Draft → menunggu keputusan (lihat §8)
- **Tanggal:** 2026-10-08
- **Visi user:** *tiap user bisa login → isi preferensi bisnisnya → app nyesuain kebutuhannya → fiturnya jalan sampai tim sales bisa reporting sales.*
- **Terkait:** PRD-001…005, `firestore.rules`, `CLAUDE.md`.

---

## 1. Ringkasan

SalesPal sekarang adalah **app satu orang**: semua data nempel di `users/{uid}`, semua fitur tampil buat semua user, dan pipeline lead website di-hardcode ke satu email owner. Itu cukup buat lo pakai sendiri, tapi **belum bisa jadi produk** yang dipakai bisnis lain atau tim sales.

Buat visi lo, yang kurang bukan fitur di depan, tapi **lapisan backend**:
1. **Identitas server** (Firebase Admin SDK) — sekarang server sama sekali ga tau siapa yang manggil.
2. **Workspace + peran** (owner / sales / viewer klien) — sekarang data per orang, bukan per bisnis.
3. **Onboarding + profil bisnis** yang nyalain/matiin fitur.
4. **Job terjadwal** (cron) — buat token, snapshot konten, pengingat follow-up, report otomatis.
5. **Notifikasi** (push PWA / email / WA template).

Ada juga **3 masalah yang sebaiknya dibenerin sekarang**, sebelum ada user lain (§3, tingkat Kritis).

---

## 2. Yang udah ada (peta singkat)

| Area | Yang jalan | Disimpan di |
|---|---|---|
| Login | Google + email, sesi persist di PWA (IndexedDB + proxy `/__/auth`) | Firebase Auth |
| Leads | CRUD, import Excel/CSV/vCard, scan gambar (Grok), lead website otomatis | `users/{uid}/leads`, `inbound_leads` |
| Hunting | log DM per template, eval response/win rate, target harian, Threads Radar | `users/{uid}/hunts`, `settings/hunting`, `settings/threads` |
| Jualan | paket, penawaran, invoice, DP, cetak/PDF | `users/{uid}/{services,quotes,invoices}` |
| Report Klien | chat+sumber → tahap → lunas, angka konten, report bulanan, **cetak/PDF**, kirim WA | `users/{uid}/clients/{c}/…` |
| Insights | funnel, sumber, performa pitch | (baca saja) |
| Server | `/api/scan` (Grok), `/api/threads/*` (tukar & refresh token), `/api/version` | tanpa database, tanpa identitas |

---

## 3. Audit flow & keterbatasan

Diurutkan per perjalanan user. **Kritis** = benerin sebelum ada user kedua.

### 3.1 Masuk pertama kali
| # | Temuan | Dampak | Tingkat |
|---|---|---|---|
| A1 | **User baru langsung diisi lead/outreach/rejection contoh** (`SEED_LEADS` dll.) ke data aslinya | Angka dashboard & report user baru tercampur data palsu; harus dihapus manual | **Kritis** |
| A2 | Ga ada onboarding: user ga ditanya bisnisnya apa | Semua orang lihat semua fitur (Hunting, Paket, Report Klien, Simulator…) walau ga relevan | Tinggi |
| A3 | Copy & contoh dibikin buat satu kasus (fotografer makanan / agency) | Bisnis lain bingung | Sedang |

### 3.2 Data & akses
| # | Temuan | Dampak | Tingkat |
|---|---|---|---|
| B1 | **`/api/scan` ga cek login** — siapa pun yang tau URL-nya bisa manggil Grok pakai kunci lo | Kredit xAI bisa habis / disalahgunakan | **Kritis** |
| B2 | **Token Threads disimpan di `users/{uid}/settings/threads`** — kebaca dari browser, dikirim ulang tiap request | Kalau akun/browser bocor, token ikut bocor; pola ini ga boleh dipakai buat token Meta/TikTok berikutnya | **Kritis** (sebelum PRD-005 Fase 2) |
| B3 | Data per **orang** (`users/{uid}`), bukan per **bisnis** | Tim sales ga bisa berbagi lead; manager ga bisa lihat kerjaan sales; ga ada serah-terima kalau orang keluar | Tinggi |
| B4 | Pipeline `inbound_leads` cuma bisa dibaca **satu email owner** (hardcode di rules) | Bisnis lain ga bisa terima lead dari websitenya | Tinggi (buat SaaS) |
| B5 | Semua layar baca **seluruh koleksi** via `onSnapshot` dan hitung di HP | Lambat & mahal begitu data ribuan baris | Sedang |
| B6 | Ga ada export / hapus data per customer | Belum memenuhi UU PDP (hak akses & hapus) | Sedang |

### 3.3 Kerja harian
| # | Temuan | Dampak | Tingkat |
|---|---|---|---|
| C1 | Ga ada pengingat: follow-up, invoice jatuh tempo, deal macet — cuma kelihatan kalau app dibuka | Deal kelupaan | Tinggi |
| C2 | Ga ada riwayat aktivitas (siapa ngubah apa, kapan) | Ga bisa audit tim | Sedang (Tinggi kalau ada tim) |
| C3 | Ga jalan offline | Di tempat sinyal jelek, input gagal | Rendah |

### 3.4 Reporting
| # | Temuan | Dampak | Tingkat |
|---|---|---|---|
| D1 | Report klien dikirim sebagai **teks WA atau PDF**, belum ada link yang bisa dibuka klien | Klien ga bisa lihat versi interaktif | Sedang |
| D2 | Angka konten masih **input manual / CSV** | Kerja bulanan masih ada copy-paste | Sedang (PRD-005 Fase 1–2) |
| D3 | Ga ada **report sales per orang** (aktivitas, pipeline, target vs realisasi) | Visi "sales bisa reporting sales" belum ada sama sekali | Tinggi |
| D4 | Ga ada report dikirim otomatis (mis. tiap tanggal 1) | Owner tetap harus ingat | Sedang |
| D5 | Cetak/PDF pakai print browser. **Di PWA iPhone belum dites**; kalau dialog print ga muncul, buka lewat Safari | Bisa gagal di HP tertentu | Rendah |

---

## 4. Visi: login → preferensi bisnis → kebutuhan → fitur → sales reporting

### 4.1 Onboarding (± 1 menit, 5 pertanyaan)
1. **Lo jualan apa?** Jasa (foto, desain, servis) · Produk (toko, aksesoris) · Agency (pegang bisnis orang lain)
2. **Customer biasanya dateng dari mana?** (pilih banyak) Instagram · TikTok · Facebook · Threads · WhatsApp · Website · Marketplace · Referral · Datang langsung
3. **Closing-nya di mana?** WhatsApp · Telepon/ketemu · Marketplace · Website
4. **Ukuran deal biasanya?** < Rp 1 Jt · 1–10 Jt · > 10 Jt (→ batas deal besar/kecil)
5. **Berapa orang yang jualan?** Sendiri · 2–5 · > 5

Jawaban disimpan sebagai **profil bisnis** dan dipakai buat nyalain fitur + isi default (sumber, kategori, template pitch, istilah).

### 4.2 Peta profil → fitur

| Kalau… | Nyala | Default |
|---|---|---|
| Jualan **jasa** | Paket & Harga, Penawaran, Invoice + DP | template pitch jasa |
| Jualan **produk** | Leads + Deal per transaksi, kode promo per channel | tanpa Paket |
| **Agency** | Report Klien (multi-klien), angka konten, report bulanan per klien | Report Klien jadi menu utama |
| Sumber termasuk **IG/TikTok/Threads** | Hunting, Quick Pitch, (nanti) tarik angka konten | chip sumber sesuai pilihan |
| Sumber termasuk **Website** | Lead website (`inbound_leads` per workspace) | — |
| Closing di **WhatsApp** | link WA di semua tempat, (nanti) tangkap klik iklan WA | — |
| Tim **> 1 orang** | Workspace, undang anggota, peran, **Report Sales per orang**, target | owner = manager |

Fitur yang ga relevan disembunyiin, bukan dihapus — bisa dinyalain lagi di Pengaturan.

### 4.3 Peran
| Peran | Bisa |
|---|---|
| **Owner** | semua, termasuk anggota, profil bisnis, tagihan langganan |
| **Manager** | lihat semua deal & report tim, atur target |
| **Sales** | lead & deal miliknya (+ yang di-share), isi aktivitas, report dirinya |
| **Klien (viewer)** | buka report bulanan miliknya lewat link, read-only |

### 4.4 Sales reporting (yang belum ada)
- Tiap deal punya **pemilik** (sales). Tiap aktivitas (chat, follow-up, penawaran, lunas) tercatat dengan siapa & kapan.
- **Report harian/mingguan sales**, otomatis dari aktivitas: chat baru, follow-up, penawaran terkirim, deal lunas, nilai pipeline, deal macet > N hari. Sales cukup tambah catatan, ga ngetik ulang angka.
- **Target vs realisasi** per sales per bulan (omzet & deal), dengan aturan tampil yang sama kayak report klien (basis kecil, bulan dasar).
- **Dashboard manager**: papan peringkat, funnel per sales, deal butuh tindakan.

---

## 5. Backend yang perlu dibikin

| # | Komponen | Kenapa | Detail | Prioritas |
|---|---|---|---|---|
| 1 | **Firebase Admin SDK di server** | Fondasi semua yang lain: server harus tahu siapa yang manggil & bisa nulis data yang ga boleh disentuh browser | Service account di env Vercel (`FIREBASE_SERVICE_ACCOUNT`), helper `requireUser(req)` yang verifikasi ID token | **P0** |
| 2 | **Kunci semua API route** | Tutup B1 | `/api/scan` & `/api/threads/*` wajib ID token; kuota per user (mis. 50 scan/hari) dicatat server-side | **P0** |
| 3 | **Brankas token** | Tutup B2, prasyarat PRD-005 Fase 2–3 | koleksi top-level `connections/{id}` (rules: deny all), token terenkripsi, cuma dibaca server | **P0** |
| 4 | **Hapus seed data** | Tutup A1 | contoh jadi "mode demo" terpisah atau tombol "isi contoh", bukan otomatis ke data asli | **P0** |
| 5 | **Workspace & keanggotaan** | B3, B4, sales reporting | `workspaces/{w}` + `members/{uid}` {role}; custom claims `{w, role}` lewat Admin SDK; undangan via link/email | P1 |
| 6 | **Rules ditulis ulang per workspace + peran** | Keamanan multi-user | `allow read: if isMember(w)`; sales cuma ubah deal miliknya; viewer klien cuma report miliknya. `tests/firestore.rules.test.mjs` diperluas per peran | P1 |
| 7 | **Migrasi data** | Data lama lo tetap ada | script Admin SDK: `users/{uid}/*` → `workspaces/{w}/*` sekali jalan, dengan dry-run & backup | P1 |
| 8 | **Onboarding + profil + feature flag** | A2, A3 | `workspaces/{w}/settings/profile`; flag dihitung di client; dipakai juga buat default | P1 |
| 9 | **Log aktivitas** | C2, sales reporting | `workspaces/{w}/activities/{id}` {who, what, dealId, at}, ditulis bareng tiap aksi | P1 |
| 10 | **Agregat & report sales** | D3, B5 | ringkasan harian per sales `stats/{day_uid}` dihitung server (trigger/cron), bukan baca semua baris di HP | P2 |
| 11 | **Cron (Vercel Cron)** | C1, D2, D4 | tiap jam: refresh token; tiap malam: snapshot konten, deal macet, invoice jatuh tempo; tanggal 1: draft report bulanan | P2 |
| 12 | **Notifikasi** | C1, D4 | Web Push (PWA iOS 16.4+ kalau di-install), email (mis. Resend), WhatsApp template (butuh WABA) | P2 |
| 13 | **Link report publik** | D1 | `sharedReports/{token}` isinya angka beku tanpa data pribadi customer, dibaca publik; atau dirender server pakai Admin SDK | P2 |
| 14 | **Export & hapus data (UU PDP)** | B6 | export workspace (JSON/Excel), hapus per customer, backup terjadwal Firestore | P2 |
| 15 | **Langganan / pembayaran** | kalau jadi SaaS berbayar | Midtrans/Xendit, plan per jumlah anggota/klien | P3 |
| 16 | **Monitoring** | tahu kalau ada yang rusak | error tracking (mis. Sentry), log API, alert kuota | P2 |

---

## 6. Data model target

```
workspaces/{w}                         profil bisnis, plan, createdAt
  members/{uid}                        role: owner|manager|sales|viewer, joinedAt
  settings/profile                     jawaban onboarding → feature flags & default
  leads/{id}                           + ownerUid, firstTouch (immutable)
  deals/{id}                           + ownerUid, stage dates (PRD-005)
  activities/{id}                      who, what, refId, at
  targets/{yyyy-mm_uid}                omzet & deal per sales per bulan
  stats/{yyyy-mm-dd_uid}               agregat harian (ditulis server)
  clients/{c}/…                        Report Klien (agency)
  hunts, pitchTemplates, services, quotes, invoices …
inbound_leads/{id}                     + workspaceId (gantiin email hardcode)
connections/{id}                       token platform, deny-all, server only
sharedReports/{token}                  report beku yang boleh dibuka klien
```

Aturan `CLAUDE.md` tetap berlaku: rules di-deploy utuh, tiap koleksi baru masuk daftar coverage + test sebelum deploy, perubahan shape `inbound_leads` ke standar di `creative-hub` dulu.

---

## 7. Roadmap

| Fase | Isi | Kenapa duluan |
|---|---|---|
| **P0 — sebelum ada user kedua** (± 1 minggu) | Admin SDK, kunci API routes + kuota, brankas token, hapus seed otomatis | nutup 3 masalah Kritis; fondasi semua langkah berikut |
| **P1 — jadi produk multi-user** (± 3–4 minggu) | workspace + peran + undangan, rules baru + test per peran, migrasi data lo, onboarding + feature flag, log aktivitas | syarat buat tim sales & user lain |
| **P2 — sales reporting & otomatis** (± 4 minggu) | report sales per orang + target + dashboard manager, cron, notifikasi push/email, link report publik, export/hapus data, monitoring | visi "sampe sales bisa reporting sales" |
| **P3 — integrasi & bisnis** | PRD-005 Fase 2–3 (API Meta/TikTok, klik iklan WA), langganan berbayar | butuh approval platform & keputusan bisnis |

---

## 8. Keputusan terbuka

- **D1:** SalesPal jadi **produk buat bisnis lain** (SaaS), atau **tools internal** lo + tim? Ini nentuin perlu P3 langganan & seberapa umum onboarding-nya.
- **D2:** "Sales" di visi lo = **tim lo sendiri**, **tim sales klien**, atau dua-duanya? Kalau tim klien, klien jadi workspace sendiri, bukan cuma `clients/{c}`.
- **D3:** Klien boleh login (peran viewer) atau cukup terima link/PDF?
- **D4:** Notifikasi lewat apa duluan: push di HP, email, atau WhatsApp (WhatsApp butuh WABA + biaya per pesan)?
- **D5:** Koordinasi: P0–P1 nyentuh rules, auth, dan hampir semua koleksi — perlu satu session yang pegang, biar ga tabrakan sama session lain.
