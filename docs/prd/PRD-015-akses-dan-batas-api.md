# PRD-015 — Akses tertutup & batas API berbayar

- **Status:** dibangun 2026-10-22.
- **Terkait:** PRD-012 (Cari bisnis), PRD-013 (cari alamat), PRD-006 (serverAuth, kuota), PRD-007 (Guild).

## 1. Masalah

> "Guild owner harus bisa ngebatesin, biar cuma role tertentu yang bisa (Cari bisnis). Sementara sistem ini jangan dibuka ke publik dulu, takut API gw malah di-abuse. Abis itu security, abis itu soal API yang rawan di-abuse kalau di-load berkali-kali. Gw belum ada duit, jadi manfaatin limit gratis dulu aja." — owner, 22 Okt

Sebelumnya:
- Siapa pun bisa daftar.
- Tiap akun dapet 30 Cari bisnis, 100 cari alamat, dan 40 scan AI per hari, semua pakai key owner.
- Bikin 10 akun = 10× lipat. Ga ada batas untuk seluruh app.

## 2. Aturan

| Siapa | Masuk app | Cari bisnis | Cari alamat | Scan AI |
|---|---|---|---|---|
| Owner (alamat terverifikasi di `OWNER_EMAILS`; default sama dengan `isOwner()` di rules) | ✓ | ✓ | ✓ | ✓ |
| Anggota guild yang Leader-nya owner | ✓ | Leader + peran yang dicentang (default Officer) | default Leader/Officer/Member | default Leader/Officer/Member |
| Orang lain | layar **"SalesPal masih tertutup"** | 403 | 403 | 403 |

- **Yang menentukan peran.** Leader-lah yang milih peran mana yang boleh pakai tiap alat, di **Guild → Atur guild → Akses alat berbayar**. Isinya disimpan di `guilds/{g}/settings/tools`. Rules: cuma Leader yang bisa nulis; Officer/Member cuma bisa baca.
- **Guild yang dipercaya.** Cuma guild yang Leader-nya owner. Alamat Leader dibaca dari Firebase Auth (Admin SDK), bukan dari dokumen yang bisa ditulis anggota. Jadi bikin guild sendiri ga ngebuka akses.
- **Buka ke semua.** Bisa lewat `config/access.open = true` (dokumen khusus server), atau env `ACCESS_OPEN=1` kalau dokumennya belum ada. Runner tes jalan dalam mode terbuka; flow akses yang nutup sendiri.
- **Tanpa `FIREBASE_SERVICE_ACCOUNT`** (status production per 22 Okt): server ga bisa baca guild atau ngitung jatah antar-instance. App tetap kebuka buat semua yang login, biar tim owner ga kekunci. Alat berbayar cuma buat owner. Batas bulanan cuma kehitung per instance. Owner dapet peringatan di layar Cari bisnis.
- **Pengecekan server.** Layar tertutup cuma tampilan. Tiap route berbayar ngecek sendiri (`mayUse`). Kalau `/api/access` ga bisa dihubungi, app tetap kebuka; route-nya yang tetap nolak.

## 2b. Minta akses & admin (owner, 22 Okt: "gimana caranya user gw juga bisa jadi admin, grant access orang yang iseng apply")

- **Orang luar.** Yang ketahan di layar tertutup bisa ngisi **Minta akses** (siapa, buat apa). Statusnya keliatan di layar itu:
  - **terkirim** → nunggu admin;
  - **ditolak** atau **dicabut** → bisa minta lagi besok.
- **Admin dan owner** buka **Profil → Akses & admin**:
  - permintaan masuk (ada badge jumlahnya);
  - centang **alat berbayar per orang** (Cari bisnis / Cari alamat / Scan AI; kosong = cuma masuk app);
  - **Setujui / Tolak**;
  - daftar yang udah disetujui, dengan **Cabut**.

  Admin ga bisa mutusin permintaannya sendiri.
- **Ngangkat & nyabut admin.** Cuma owner, pakai email akun yang pernah login.
- **Data.** `accessRequests/{uid}` `{ email, name, note, at, status, tools, decidedBy, decidedAt }` dan `accessAdmins/{uid}` `{ email, by, at }`.
  - Dua-duanya khusus server; rules nolak semua browser.
  - Jalurnya cuma lewat `/api/access/request` dan `/api/access/admin`.
  - Butuh `FIREBASE_SERVICE_ACCOUNT` (§5). Tanpa itu, route-nya jawab 503.
- **Siapa boleh apa.**
  - `mayEnter`: owner, admin, yang disetujui, atau anggota guild owner.
  - `mayUse`: owner, yang disetujui dengan alat itu dicentang, atau peran yang diizinin Leader.

## 3. Batas pemakaian (biar tetap di jatah gratis)

| Alat | SKU / penyedia | Gratis/bulan | Batas app/bulan | Per akun/hari |
|---|---|---|---|---|
| Cari bisnis | Google Places Text Search **Enterprise + Atmosphere** (ada ulasan) | 1.000 | **900** (`PLACES_MONTHLY_LIMIT`) | 30 |
| Cari alamat | Google Places Text Search **Pro** | 5.000 | **4.500** (`GEOCODE_MONTHLY_LIMIT`) | 100 |
| Scan AI | x.ai (berbayar, ga ada jatah gratis) | — | **300** (`SCAN_MONTHLY_LIMIT`) | 40 |

- **Penghitung.** Ada di `usage/global_{alat}_{yyyy-mm}`, khusus server, pakai transaksi. Kalau panggilan gagal (Google nolak / ga kehubung), jatahnya dibalikin.
- **Kalau jatah habis.** App berhenti manggil (429), bukan nagih. Cari bisnis nyaranin Import Excel; cari alamat (setelah PRD-013 nyambung) jatuh ke OpenStreetMap gratis.
- **Di layar Cari bisnis:**
  - sisa hari ini & bulan ini kelihatan;
  - kata kunci yang sama ga dipanggil ulang selama hasilnya masih di layar;
  - kalau belum diizinin, tombol Cari mati dan ada keterangannya.

## 4. Keamanan (review 22 Okt)

- **Route API.** Semua route yang dipanggil browser wajib login (`requireUser`).
  - `cron/digest` pakai `CRON_SECRET` (gagal tertutup, timing-safe).
  - `hunt/unfurl` cuma ke host Threads, https, redirect dicek.
  - `places` → baca email: cuma host publik (tanpa IP / localhost).
- **Baru: header dasar.** `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (iframe login Firebase tetap jalan), dan `Referrer-Policy: strict-origin-when-cross-origin`.
- **Rules.** Ditambah `config` (khusus server) dan `settings/tools` (cuma Leader). Ada 6 tes baru; total 149 lolos.
- **Repo.** Ga ada secret yang ke-commit; cuma `.env.local.example`.

## 5. Yang perlu owner lakukan (di luar kode)

1. **Vercel → Settings → Environment Variables → `FIREBASE_SERVICE_ACCOUNT`** (JSON service account project `sales-pal`, mentah atau base64), Production. Tanpa ini pintu undangan & batas bulanan belum jalan penuh (§2).
2. **Key browser Firebase.** `NEXT_PUBLIC_FIREBASE_API_KEY` itu publik. Kalau Places API (New) aktif di project `sales-pal` dan key-nya ga dibatasi, siapa pun bisa manggil Places langsung, ngelewatin semua pagar di sini. Batasi key itu ke API Firebase aja (Identity Toolkit, Token Service, Firestore, Installations), atau pindahin Places ke project Cloud sendiri.
3. **Google Cloud Console → APIs & Services → Credentials → key Places.** Batasi ke **Places API (New)** aja.
4. **Places API (New) → Quotas.** Pasang batas harian `SearchTextRequest` di kira-kira 30/hari, sebagai rem terakhir di sisi Google kalau kode kebobolan.
5. **Billing → Budgets & alerts.** Pasang budget Rp0–Rp50.000 dengan email peringatan.
6. **Vercel env (opsional).** `OWNER_EMAILS` kalau mau nambah owner; `ACCESS_OPEN=1` kalau nanti mau dibuka ke publik.

## 6. Biaya

Rp0. Semua di jatah gratis Google + Firestore. Batas bulanan mastiin tagihan ga nambah. Scan AI tetap berbayar per pakai ke x.ai; batas 300/bulan bisa diturunin lewat env.
