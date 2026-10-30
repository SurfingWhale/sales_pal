# PRD-019 — QA 28 Okt: satu kolom cari, lembar kerja prospek, kirim yang dicatat setelah dikonfirmasi, WA Bisnis, tab Tim, profil bisnis guild

- **Status:** Rencana, 29 Okt. Semua keputusan D1–D7 udah dijawab owner 29–30 Okt. Sebagian §3.4 dan §3.6 udah dibangun sesi lain (#78, #85, #87, #88); sisanya belum.
- **Tanggal:** 2026-10-29
- **Konteks:** Owner nguji versi live di iPhone 28 Okt (Notion: SalesPAL → Sales PAL Iterasi → "QA-3 Test", 5 screenshot). Ada sembilan temuan di lima tempat: Beranda, Hunting, Jualan → Leads, Tim, Guild. Bagian 1 isinya fakta yang udah dicek di kode `main` `b1b400b`. Rekomendasi ditandai **[usul]**, yang belum pasti ditandai **[cek]**. Peta file: `docs/ARCHITECTURE.md`, daftar dialog/sheet: `docs/ui-inventory.md`.
- **Terkait:** PRD-009 (journey prospek; **D1 "Copy = kirim" diganti §3.5**), PRD-011 §5 #2–3 (Profil bisnis, belum dibangun), PRD-012 (Cari bisnis), PRD-013 (Peta 3D), PRD-015 (kuota Google), PRD-016 (batas WA), PRD-018 §3 (header nempel), PRD-010 dan `docs/standards/design.md`.

---

## 0. Ringkasan

| # | Temuan owner | Kondisi di `main` | Bagian | Fase |
|---|---|---|---|---|
| 1 | Pin peta "terasa sangat AI" | Ikon garis gambar tangan, lencana skor di semua pin, belum ada cluster | §3.1 | 4 |
| 2 | Cari klien baru dan hunt harusnya satu saklar, ketik "f" langsung muncul | Dua kartu terpisah, Beranda belum punya kolom cari | §3.2 | 2 |
| 3 | Mau fokus satu jenis (restoran) per hari | Ada **dua** sistem kategori yang ga nyambung, belum ada filter | §3.3 | 2 |
| 4 | Tap kartu prospek harusnya buka lembar kerja dengan ✕ | Halaman kontak layar penuh udah ada (#78), tapi pesan ada di layar kedua (Percakapan) | §3.4 | 1 |
| 5 | Copy pesan yang salah langsung kecatat dan history geser | Copy = kirim (PRD-009 D1), "Berikutnya" ada di toast, Follow-up lompat ke mode lain | §3.5 | 1 |
| 6 | Chat di lead cuma buka WA, bukan WA bisnis | Pilih script per tahap udah ada (#88). App WA-nya masih dipilih HP | §3.6 | 3 |
| 7 | Leads ga bisa difilter per kategori buat chat satu-satu | Belum ada filter kategori. Log chat per lead udah ada (#85) | §3.7 | 2 |
| 8 | Tab atas di Tim kepotong dan ga nyaman | 6 tab di satu segmented control | §3.8 | 1 |
| 9 | Guild ga punya info bisnis dan nomor WA bisnis | `settings/business` ada, editornya ga bisa dibuka dari Guild | §3.9 | 3 |

---

## 1. Temuan (kutipan owner + kondisi kode)

### 1.1 Beranda: peta
> "Fitur peta kurang maksimal, icon node titik-titiknya terasa sangat AI. Mungkin perlu dicari SVG, atau gimana mekanisme icon itu bisa disusun dengan baik."

- `components/GeoMap.tsx`: tiap lead dirender sebagai satu elemen DOM `.sp-pin` (44×50, muka bulat 40px). Ikonnya dari 8 path SVG yang digambar tangan, satu per keluarga kategori (`FAMILIES`). Lencana skor nempel di **semua** pin, dan label disaring manual di JS (`declutter()`).
- Di screenshot: kira-kira 20 pin numpuk di satu kecamatan, hampir semuanya cangkir oranye dengan lencana "26" atau "20". Semua skor itu di bawah garis kejar (60), jadi lencananya cuma bikin rame. Pin yang bentuknya sama semua dan saling numpuk inilah yang kebaca "AI".
- Clustering emang udah dicatat sebagai sisa kerjaan di PRD-013 §6.

### 1.2 Beranda: cari
> "Mode search baik search new client dan mode hunt sebaiknya digabung jadi satu switching button, dan bisa muncul open search query, misal ngetik f abis itu muncul semua data dengan nama tempat f."
> "Cluster search kaya search restaurant, data bisa grouping juga, jadi kalo gw mau fokus di hari itu nawarin restaurant jadi lebih mudah."

- Kartu "Hunting hari ini" (Mulai hunting) dan kartu "Cari calon klien" di `components/Beranda.tsx` masih terpisah. "Cari bisnis" buka `LeadFinder` (Google Places, jatah 900/bulan, PRD-015).
- Beranda belum punya kolom cari. Buat nyari lead harus ke Jualan → Leads, dan buat nyari prospek harus ke Hunting → Prospek.
- Ada **dua sistem kategori yang ga nyambung**:
  - `CATEGORIES` di `lib/leadEdit.ts` (7 tipe: F&B, Retail, Health, Property, Service, Tech, Education). Dipakai form Ubah data lead, tag "Buat tipe bisnis" di template, dan `categoryOf()` + `CATEGORY_WORDS` di `lib/scriptPick.ts` (#88).
  - `FAMILIES` di `GeoMap.tsx` (8 keluarga warna peta: kuliner, kecantikan, olahraga & kebugaran, kesehatan, penginapan, sekolah, toko, jasa).
  - Di `CATEGORY_WORDS`, gym, salon, dan spa masuk **Health**, sedangkan "yoga" ga ada di daftar mana pun. Akibatnya `categoryOf("Studio Yoga")` = `null`.

### 1.3 Hunting: kartu prospek
> "Tumpukan hunting leads itu, ketika card prospect-nya di-tap, jadi open pop-up page dengan ✕ di atas, semacam lembar kerja lengkap dengan history approach."

Dibangun setelah QA (sesi lain, 28–29 Okt):
- **#78:** tap kartu buka **halaman kontak layar penuh** (`ProspectList.tsx`, `role="dialog"`, tombol "‹ Prospek", link profil, garis tahap, riwayat, tombol aksi).
- **#87:** Percakapan (`ProspectThread.tsx`) jadi **chat layar penuh** di HP: kembali / avatar / status / ⋯ (hasil di balik ⋯), chat, dan satu baris composer dengan pemilih template.

Sisa masalahnya:
- Satu orang masih punya **dua layar**. Halaman kontak isinya riwayat + tombol, Percakapan isinya riwayat + composer. Buat kirim pesan, owner harus tap "💬 Percakapan" dulu.
- Tombol "↻ Follow-up / ✉ Kirim intro" di halaman kontak (`ProspectList.tsx:297`) masih manggil `onCompose`, yang mindahin Hunting ke **mode composer Kirim** (lihat §1.4).
- Tombol-tombolnya masih emoji (💬 ↻ 📝 🗑 ✉ ↩). Ini melanggar `design.md` §Ikon ("Emoji bukan ikon").

### 1.4 Hunting: kirim dan follow-up
> "Issue-nya ketika follow-up diklik dia buka mode lain. Balik ke hunting prospect, terus gw mau chat, paste script-nya bergeser ke next chat. Journey ini rentan gagal karena bisa aja pas gw klik follow-up chat ke-skip."

> D3, owner menjelaskan 29 Okt: *"Gw misal mau follow-up terus mau gw ganti pesan yang gw copy-nya, nah karena ga sesuai dan udah ke-tap, jadinya langsung ke-record, keganti ke slide berikutnya, padahal gw belum selesai paste ke DM. Jadinya seakan-akan gw udah ngelakuin itu dan history-nya udah auto geser."*

- **Copy langsung dicatat sebagai kirim** (PRD-009 D1). Ini berlaku di composer Hunting (`pick` → `logSent`) dan di Percakapan (`ProspectThread.tsx` `send()` → `onSend` → `recordSend`). Akibatnya begitu Copy di-tap:
  - riwayat langsung nambah,
  - `attempts` naik,
  - composer di Percakapan dikosongin (`setText("")`, `setTpl(null)`),
  - tahap yang disarankan maju.

  Padahal pesannya belum ditempel, dan owner masih mau ganti. Batal 5 detik ga cukup, karena owner udah pindah ke Threads.
- **Pindah orang tanpa diminta.** Toast "Tercatat … [Batal] [Berikutnya →]" ada tepat di atas nav (`Hunting.tsx:768`), dan header juga punya Berikutnya. Sekali salah tap = orang berikutnya.
- **Follow-up lompat mode.** Dari halaman kontak, `onCompose` → `compose()` (`Hunting.tsx:511`) mindahin ke composer Kirim dengan antrian "Dari antrian … · N lagi · Selesai" (screenshot 3).
- **Tahap ga dicatat.** `recordSend` (`lib/prospectStore.ts`) selalu nambah hitungan `intros` di sesi. Label status tetap **"Intro terkirim"** (`lib/prospects.ts:244`) walaupun udah percobaan 2/3 (screenshot 3).

### 1.5 Jualan → Leads
> "Di bagian kontak, ketika open leads ga bisa pilih opsi chat yang mau dilakukan dan nge-direct chat ke WA bisnis, since chat button cuma buka WA kontak."
> "Di bagian search leads ga ada fitur search dan filter dropdown untuk kategori, kaya misal gw ga bisa search leads yang masuk kategori yoga atau restaurant, sehingga gw ga bisa massive chat satu-satu."

Dibangun setelah QA:
- **#88:** tiga tombol Chat di lead buka **"Chat ke …"** (`components/ChatPicker.tsx`). Tahap yang cocok udah ditandai, script diurutkan sama `rankScripts` (tipe bisnis, kata kebutuhan), teks bisa diedit, lalu **Kirim di WhatsApp**.
- **#85:** Chat WhatsApp, Kirim WA, dan Balas nyatet kontak hari ini + satu baris **Outreach**, dengan Batal dan satu tap buat follow-up berikutnya.

Sisa masalahnya:
- Link kirimnya masih `waLink()` → `wa.me` (`ChatPicker.tsx:110`, `LeadDetail.tsx:724`, `:743`). App WhatsApp yang kebuka dipilih HP. Di iPhone owner, itu WA pribadi.
- Kolom cari Leads udah ada, dan `matches()` di `lib/leadQuery.ts` ikut nyari di kategori. Tapi **belum ada filter kategori**, dan belum ada cara chat beruntun dari hasil filter. Kategori juga ga seragam (§1.2).

### 1.6 Tim
> "Header atas buat fitur button terasa tidak nyaman, selain tulisannya ke-crop, perpindahan atas button menu di bagian ini terasa tidak nyaman."

- Tim punya 6 sub-tab (`SalesTracker.tsx:67`: Dashboard tim, Guild, Report Klien, Log aktivitas, Outreach, Rejection Log) di satu segmented control tanpa geser (`.sp-subnav`, grid `1fr`). Di layar 390pt, tiap tab cuma dapet sekitar 58pt, jadi labelnya jadi "Dashb…", "Repor…", "Log ak…", "Outre…", "Reject…".
- Di dalam Guild ada baris tab kedua (Pipeline · Report Tim · Aktivitas · Anggota, `GuildHub.tsx`) yang isinya ngulang Dashboard tim dan Log aktivitas.

### 1.7 Guild
> "Di bagian guild ga ada informasi buat set bisnisnya apa, jadi entitasnya ga bisa kedefinisi dengan baik."
> "Gw ga bisa cantumin no WA bisnis dan ga bisa nawarin jasa dengan flawless, selalu buka WA private gw, padahal gw maunya share WA bisnis gw."

- Identitas bisnis udah ada per ruang kerja di `{ruang}/settings/business` (`Business`, `lib/billing.ts:229`: name, tagline, logo, address, phone, email, rekening, S&K, default dokumen). Masalahnya, editornya (`BusinessEditor.tsx`) cuma bisa dibuka dari Kop dan Paket. **Guild ga nunjukin dan ga bisa ngubahnya.** Ini PRD-011 §5 #2–3 yang belum dibangun.
- `phone` cuma satu kolom, ga dibedain antara WA bisnis dan nomor pribadi. Template cuma punya `{bisnis}` (nama), belum ada variabel nomor atau link WA (`lib/templates.ts`).

---

## 2. Tujuan / Non-tujuan

**Tujuan**
- G1: Satu orang = **satu lembar kerja**. Riwayat, pesan berikutnya, dan hasil ada di satu layar yang bisa ditutup.
- G2: **Ga ada yang kecatat sebelum lu bilang udah kekirim.** Ga pernah pindah ke orang lain tanpa diminta. Tiap kiriman kecatat sesuai tahap yang dipilih.
- G3: Satu kolom cari di Beranda: data sendiri kecari tiap ketik huruf, bisnis baru di Google cukup satu saklar.
- G4: **Satu** daftar tipe bisnis (`lib/categories.ts`), dipakai bareng sama peta, cari, Leads, script, dan antrian.
- G5: Chat dari lead dan prospek sebisa mungkin kebuka di **WhatsApp Business**.
- G6: Guild punya **Profil bisnis**, termasuk nomor WA bisnis yang bisa dipakai di template.
- G7: Tab Tim kebaca utuh di iPhone 12, tanpa label yang kepotong.

**Non-tujuan**
- Ga ada blast WA otomatis. "Chat satu-satu" artinya SalesPal nyiapin pesannya per lead, dan user sendiri yang mencet kirim (ToS WA, PRD-016).
- Ga milih akun pengirim WA dari web. Itu ga mungkin (§3.6). Yang bisa diatur cuma app mana yang kebuka.
- Belum ada foto tempat di pin (Places Photos berbayar, PRD-013 §6).

---

## 3. Solusi [usul]

### 3.1 Peta: pin yang kebaca (Fase 4)

1. **Cluster bawaan MapLibre.** Pakai `GeoJSON source { cluster: true, clusterRadius: 50, clusterMaxZoom: 15 }`. Cluster digambar sebagai lingkaran berangka, warnanya ngikutin tipe bisnis terbanyak di dalamnya (`clusterProperties`). Tap cluster → `getClusterExpansionZoom` → zoom masuk. Ini sekaligus nutup sisa PRD-013 §6.
2. **Pin pakai symbol layer, bukan DOM.** Glyph SDF didaftarin pakai `map.addImage(id, img, { sdf: true })`, terus diwarnai lewat `icon-color` per tipe. Nama pakai `text-field` + `text-optional: true`, dan tabrakan label diurus MapLibre, jadi `declutter()` bisa dibuang. Hit area: `queryRenderedFeatures` dengan kotak 44×44 di titik tap (PRD-010).
3. **Glyph: Maki (D1, disetujui owner).** Set ikon POI dari Mapbox, lisensi CC0, dibikin khusus buat peta ukuran 15px (`restaurant`, `cafe`, `fitness-centre`, `beauty-salon`, `hospital`, `lodging`, `school`, `shop`, `suitcase`, …). SVG yang dipakai aja disimpan di `public/map-icons/`, terus dirasterisasi sekali waktu peta dimuat. Glyph diambil dari `lib/categories.ts` (§3.3), dan `FAMILIES` di `GeoMap.tsx` dihapus. `design.md` §Ikon ditambah pengecualian: "glyph peta = Maki (isi), cuma di peta". **[cek]** lisensi CC0 di repo Maki waktu ngambil file.
4. **Kurangi isi tiap pin.** Pin = lingkaran 28px warna tipe, glyph putih, cincin putih. Lencana skor cuma muncul di pin yang layak dikejar (cincin biru) atau yang lagi dipilih. Karakter clay tipe customer pindah ke kartu yang muncul waktu pin ditap.
5. Ada legenda kecil yang bisa dibuka buat ngasih tau arti warna (tipe bisnis).

### 3.2 Beranda: satu kolom cari, dua mode (Fase 2)

Kartu paling atas di Beranda jadi satu kolom cari + saklar **[Data saya | Bisnis baru]** (D2, disetujui), dengan **Mulai hunting** di kartu yang sama. Kartu "Cari calon klien" dihapus.

- **Data saya** (bawaan): tiap ketik huruf langsung keluar hasil dari lead + prospek di ruang kerja aktif. Yang cocok di awal kata ditaruh paling atas ("f" → "Fit Hub", "Kopi Fajar"), baru yang mengandung huruf itu. Hasil dikelompokkan: **Lead · Prospek · Tipe bisnis**. Hasil tipe bisnis bentuknya chip ("F&B · 34") yang langsung nyaring kayak §3.3. Semuanya lokal: gratis dan ga makan kuota. Matcher lead (`matches` di `lib/leadQuery.ts`) dan prospek (`ProspectList.tsx`) disatukan di `lib/search.ts`. Tap hasil → buka detail lead atau lembar kerja prospek (§3.4). Peta di bawahnya ikut nyaring ke hasil.
- **Bisnis baru**: pakai kolom yang sama. Enter atau tombol "Cari di Google Maps" buka `LeadFinder` (PRD-012) dengan query udah keisi. Sebelum nembak Google, tampilkan dulu yang udah ada di data sendiri ("3 udah jadi lead kamu"), biar kuota ga kebuang buat bisnis yang udah dikenal. Sisa jatah bulan ini ditulis di bawah tombol (PRD-015).
- Pilihan saklar diingat per HP pakai `localStorage` (dibungkus try/catch, tetap jalan kalau kosong).

### 3.3 Satu daftar tipe bisnis + fokus per hari (Fase 2)

- **Satu sumber: `lib/categories.ts`.** Isinya daftar `{ id, label, words, color, glyph, parent? }`. `CATEGORIES` di `lib/leadEdit.ts` dan `CATEGORY_WORDS` + `categoryOf()` di `lib/scriptPick.ts` pindah ke file ini dan di-re-export, jadi kode yang manggil ga berubah. `FAMILIES` di `GeoMap.tsx` dihapus, dan warna + glyph Maki (§3.1) diambil dari daftar yang sama.
- **D7 (disetujui owner 30 Okt): tambah dua tipe.** **Sport** (olahraga & kebugaran: gym, fitness, yoga, pilates, padel, renang, futsal, lari) dan **Beauty** (salon, spa, skincare, barber, nail). Sekarang dua-duanya nyampur di Health, padahal peta udah misahin, dan contoh owner ("yoga") belum kebaca sama sekali.
  - Kata-katanya dipindah dari Health.
  - Lead lama yang tersimpan "Health" tetap "Health". Kalau ada kategori Google aslinya, `categoryOf` tetap bisa baca dari situ.
  - Biar script yang ditandai Health ga tiba-tiba hilang buat lead Sport/Beauty, kedua tipe baru punya `parent: "Health"`, dan `rankScripts` nganggap tag induk juga cocok.
- **Tipe bisnis per lead** = `categoryOf(lead.category, lead.name, profile.need)`. Teks kategori aslinya (misalnya "Studio Yoga" dari Google) tetap disimpan dan dipakai buat nyaring lebih sempit.
- **Fokus hari ini.** Di bawah kolom cari ada baris chip `Semua · F&B 34 · Sport 12 · …`. Pilih satu → peta, Kejar sekarang, Perlu ditindak, daftar Leads, dan antrian Hunting semuanya nyaring ke tipe itu. Di setiap tempat itu ada chip "Fokus: F&B ✕" biar keliatan lagi disaring.
- Fokus berlaku **per hari** (`{ type, on: today }` di `localStorage`). Besoknya otomatis balik ke Semua.
- Satu tipe bisa dipersempit ke kategori aslinya lewat sheet (F&B → Restoran / Kafe).

### 3.4 Prospek: satu lembar kerja (Fase 1, sisa dari #78 + #87)

- **Halaman kontak dan Percakapan digabung jadi satu layar.** Tap kartu langsung buka `ProspectThread` (chat layar penuh dari #87). Isi halaman kontak (#78) pindah ke situ:
  - Ringkasan (ID, percobaan, kampanye) dan konteks (butuh apa, kapan, di mana) jadi kepala yang bisa dilipat di atas chat.
  - Hasil, Dibales, Catatan, Buang, dan Hapus ada di ⋯, kayak yang udah ada.
  - Composer ada di bawah.
- Tombol "Kirim intro / Follow-up / Kirim pesan" ga manggil `onCompose` lagi, jadi ga lompat ke composer Hunting (`ProspectList.tsx:297`). Fokusnya langsung pindah ke composer di layar yang sama, dengan tahap yang cocok udah kepilih.
- Jalan keluar tetap "‹ Prospek", Back browser, swipe, dan Escape (udah ada, #82). Ini udah nutup permintaan "✕ di atas".
- Semua tombol pakai ikon dari `Icon.tsx`, bukan emoji.

### 3.5 Kirim dicatat setelah dikonfirmasi; ga lompat, ga ke-skip (Fase 1)

**Aturan baru, menggantikan PRD-009 D1 (D3, jawaban owner 29 Okt):** Copy atau buka DM/WA **ga lagi** dihitung kirim. Pesan baru kecatat setelah user bilang udah kekirim.

1. **Pilih atau ganti template** cuma ngisi composer. Ga ada yang dicatat.
2. **Copy / Copy & DM / Kirim WA** cuma nyalin teks (dan buka app tujuan). Composer pindah ke status **"Draf tersalin · belum dicatat"** (warna kuning). Teks, template, dan tahap **tetap di tempat**. Riwayat ga berubah, `attempts` ga naik, tahap ga maju.
3. **Konfirmasi**, lewat salah satu dari dua jalan:
   - tombol **Udah kekirim** di composer, atau
   - waktu balik ke SalesPal setelah buka DM/WA (`visibilitychange` → `visible`), muncul sheet kecil: "Pesan ke @x udah kekirim?" dengan pilihan **[Udah kirim]** dan **[Belum, ganti pesan]**.
4. **Udah kirim** → baru jalan `recordSend`. Riwayat nambah, percobaan dan label diperbarui, composer kosong. Masih ada Batal 5 detik.
5. **Belum, ganti pesan** atau Copy template lain → draf diganti. Ga ada yang dicatat.
6. Draf yang belum dikonfirmasi disimpan per prospek di `localStorage` (`draft:<prospectId>`), jadi nutup layar atau pindah app ga ngilangin draf. Kartu prospek nunjukin "Draf belum dicatat".
7. **Pindah orang cuma lewat ‹ › di header.** "Berikutnya" dibuang dari toast (`Hunting.tsx:768`) dan ga ada perpindahan otomatis. Orang yang dilewati tanpa kirim **tetap di antrian** dengan tanda "dilewati". Di akhir antrian ada ringkasan: N terkirim · N dilewati, plus tombol **Ulang yang dilewati**.
8. **Antrian follow-up** (Diem 7+, Follow-up hari ini, hasil filter) dibuka di lembar kerja §3.4 dengan ‹ ›. Composer Kirim di Hunting cuma dipakai buat target baru dari tempel link.
9. **Tahap dicatat.** `Send.stage` (`intro | followup | gali | offering | closing | etb | manual`) disimpan ke event `sent` dan ke `hunts.stage`. Aturan `attempts` ga berubah: kiriman apa pun ke orang yang belum jawab tetap dihitung percobaan. Hitungan sesi dipisah jadi `intros` (percobaan 1) dan `followups` (percobaan 2+).
10. **Label sesuai kenyataan.** "Intro terkirim" cuma buat percobaan 1. Percobaan berikutnya jadi "Follow-up 1 terkirim", "Follow-up 2 terkirim". Riwayat nulis "Follow-up #2 · <judul template>".
11. Aturan yang sama dipakai di **Chat lead** (`ChatPicker`, #88). "Kirim di WhatsApp" buka WA, lalu catatan kontak + Outreach (#85) baru ditulis setelah dikonfirmasi. `WaSendSheet` (penawaran dan invoice) ga ikut berubah, karena langkah keduanya (PDF) udah jadi konfirmasi.

Harganya satu tap tambahan per pesan. Owner milih ini daripada data yang salah (D3).

### 3.6 Leads: chat lewat WA Bisnis (Fase 3)

**A. Pilih pesan: udah dibangun** (#88 `ChatPicker`, #85 log Outreach). Yang tersisa cuma ikut aturan konfirmasi §3.5 #11.

**B. WhatsApp mana yang kebuka** (fakta, dicek 29 Okt):
- Link web ga bisa milih **akun pengirim**. Yang ngirim selalu akun di app yang kebuka.
- **Android:** bisa dipaksa buka WA Business pakai intent: `intent://send?phone=62…&text=…#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=<wa.me…>;end` (paket `com.whatsapp.w4b`). Sumbernya forum developer, bukan dokumen resmi WhatsApp. **[cek]** di HP Android beneran.
- **iPhone:** belum ketemu setelan default atau skema URL resmi khusus WA Business. Kalau dua app terpasang, iOS buka WhatsApp biasa dulu, baru nawarin pindah ke WhatsApp Business. Artinya di iPhone, SalesPal **ga bisa menjamin** WA Business yang kebuka.
- **iPhone owner (D4):** WhatsApp biasa dan WhatsApp Business dua-duanya terpasang, dan owner setuju dites. Spike-nya di awal Fase 3: satu halaman tes dengan 4 tombol (`wa.me`, `api.whatsapp.com/send`, `whatsapp://send?text=tes`, kandidat skema WA Business), dibuka di Safari dan di PWA terpasang di iPhone owner. Hasil tiap tombol (app mana yang kebuka, teksnya ikut atau ga) dicatat di sini sebelum `waOpen` ditulis.
- [usul] Tambah setelan per user **"Kirim lewat: WhatsApp · WhatsApp Business"** di `users/{uid}/settings/prefs.waApp`. Satu fungsi `waOpen(phone, text)` di `lib/billing.ts` gantiin `waLink` di semua tombol kirim (`ChatPicker`, `LeadDetail`, `ProspectThread`, `Hunting`, `WaSendSheet`, `FollowUpRun`, `LeadFinder`): Android pakai intent, iPhone pakai hasil spike. Kalau di iPhone ga ada yang langsung buka WA Business, kasih tahu terus terang di setelan: "Di iPhone, WhatsApp yang kebuka dipilih iOS. Kalau dua-duanya terpasang, pilih Buka di WhatsApp Business."

**C. Bagikan nomor WA bisnis.** Variabel template `{wa_bisnis}` dan `{link_wa}` (§3.9) bikin prospek ngehubungin nomor bisnis, bukan nomor pribadi. Ini jalan di semua HP.

### 3.7 Leads: filter tipe bisnis + chat satu-satu (Fase 2)

- Tombol **Tipe bisnis** di toolbar Leads buka sheet: pilih tipe (§3.3) → kategori asli di dalamnya, masing-masing ada jumlahnya, bisa pilih lebih dari satu. Bisa digabung dengan tampilan (`VIEWS`, termasuk "Belum dihubungi" dari #85) dan urutan yang udah ada. Toolbar nempel waktu scroll (PRD-018 §3).
- **Chat satu-satu** buat hasil filter: tombol "Chat N lead ini" buka satu lead per layar.
  - Pakai `ChatPicker` yang udah ada, jadi tiap lead dapet script yang paling cocok sama tipe bisnisnya. Template bisa dikunci sekali di awal.
  - Tiap lead: **Kirim di WhatsApp** → konfirmasi (§3.5) → ‹ ›.
  - Di akhir ada ringkasan. Lead tanpa nomor dilewati dan dihitung ("4 tanpa nomor → Lengkapi").
- **Diukur, bukan dibatasi (D6).** Ga ada batas atau peringatan. Tiap kiriman yang dikonfirmasi nulis baris `outreach` + `lastContact`, sama kayak #85. Karena `lib/activity.ts` udah baca `outreach`, chat ini otomatis masuk **Log aktivitas harian**, heat map, dan hitungan per orang di Dashboard tim. Header antrian nampilin "Chat WA hari ini: 12" sebagai catatan, bukan batas.

### 3.8 Tim: tab yang kebaca (Fase 1)

- Tim tinggal **4 tab**: **Dashboard · Guild · Klien · Log**. Log nyatuin Log aktivitas + Outreach + Rejection jadi satu daftar dengan chip filter (Semua · Aktivitas · Outreach · Ditolak).
- Tab di dalam Guild jadi **Pipeline · Anggota · Profil bisnis** (§3.9). Report Tim pindah ke Dashboard (filter "Lihat: Semua tim / per orang" dan PDF laporan udah ada di sana), Aktivitas pindah ke Log (D5, disetujui).
- Aturan baru di `design.md`: segmented control di HP maksimal 4 item. Kalau lebih, pakai tab geser dengan label utuh.
- Tinggi tab bar ga berubah waktu ganti tab, dan tab bar nempel di atas waktu scroll (`--sp-head`, #82; PRD-018 §3).

### 3.9 Guild: Profil bisnis + WA bisnis (Fase 3, = PRD-011 §5 #2–3 yang dipersempit)

- Tab **Profil bisnis** di Guild, juga bisa dibuka dari pemilih ruang kerja di header (jadi Pribadi juga punya). Isinya: **Identitas** (nama, tagline, tipe bisnis dari §3.3, logo; satu sumber dengan lambang guild, PRD-011 §2 #5b) · **Kontak** (WA bisnis, Instagram, website, email, area layanan) · **Rekening** · **S&K & default dokumen** (yang udah ada di `BusinessEditor`).
- Banner guild nampilin tagline · tipe bisnis · WA bisnis. Kalau masih kosong, tampil "Lengkapi profil bisnis" (khusus Leader/Officer).
- Field baru (opsional) di `settings/business`: `waBusiness`, `category`, `instagram`, `website`, `area`. Kalau `waBusiness` kosong, pakai `phone` yang lama, jadi ga perlu migrasi.
- Variabel template baru di `VARIABLES` + `dataFor` (`lib/templates.ts`): `{wa_bisnis}`, `{link_wa}` (`wa.me/<waBusiness>`), `{ig}`, `{website}`. Variabel ini juga diisi di `ChatPicker` (yang sekarang pakai `useBusiness`). Kop penawaran dan invoice pakai `waBusiness`.
- Yang boleh ngubah: Leader/Officer, karena `settings` = katalog dan rules-nya udah begitu. Member dan Viewer cuma baca.

---

## 4. Data & rules

| Apa | Di mana | Ubah `firestore.rules`? |
|---|---|---|
| `stage` di event `sent` + `hunts.stage` | owned (`prospects`, `hunts`) | Tidak, `hunts` ga dibatasi bentuknya |
| `counts.followups` | `huntSessions` | Tidak |
| Draf belum dicatat | `localStorage` `draft:<prospectId>` per HP | — |
| `waBusiness, category, instagram, website, area` | `{ruang}/settings/business` (katalog) | Tidak |
| `waApp` | `users/{uid}/settings/prefs` (per user, dipakai di semua ruang kerja) | Tidak, `users/{uid}/settings` udah tercakup |
| Chat WA dari lead (sheet Chat + chat satu-satu) | `outreach` + `leads.lastContact` (udah ada, #85) | Tidak |
| Fokus tipe bisnis, saklar cari | `localStorage` per HP | — |
| Tipe Sport / Beauty | nilai baru di `leads.category` dan `pitchTemplates.categories` | Tidak |

Ga ada koleksi baru, jadi daftar koleksi di `CLAUDE.md` ga berubah.

---

## 5. Fase

| Fase | Isi | Kenapa urutannya begini |
|---|---|---|
| 1 | §3.5 kirim setelah konfirmasi + ga lompat + tahap dicatat, §3.4 satu lembar kerja, §3.8 tab Tim, emoji → ikon | Data yang kecatat padahal belum kekirim itu keluhan paling tajam. Ini kerjaan UI + satu field, tanpa layanan baru |
| 2 | §3.3 `lib/categories.ts` + fokus, §3.7 filter + chat satu-satu, §3.2 kolom cari | Ketiganya pakai daftar tipe bisnis yang sama |
| 3 | §3.9 Profil bisnis + variabel WA, §3.6 B setelan WA app | Nunggu spike D4 di iPhone owner |
| 4 | §3.1 cluster + symbol layer + Maki | Paling gede secara teknis. Glyph-nya diambil dari §3.3 |

---

## 6. Tes (`tests/flows/flows.mjs`)

- **Ubah** "journey: shared post, intro, answer, data to ETB, DNC, session bar":
  - Copy intro → riwayat **belum** berubah dan composer nunjukin "Draf tersalin".
  - Ganti template → Copy lagi → masih belum ada yang kecatat.
  - Udah kekirim → riwayat nambah satu event dengan `stage`.
  - Sheet `visibilitychange` jalan (event di-dispatch di tes).
  - Follow-up kecatat "Follow-up 1 terkirim". Toast ga punya Berikutnya, › pindah orang, dan yang dilewati muncul di ringkasan.
- **Ubah** "hunting: paste a link, log DMs, statuses, lead, goal": log DM baru ada setelah konfirmasi.
- **Ubah** "lead data: edit status and value, a chat counts as contact, gugur to the rejection log": kontak + Outreach baru ditulis setelah konfirmasi.
- **Ubah** "cari bisnis: maps results to leads, template to import": masuk dari kolom cari Beranda mode Bisnis baru.
- **Ubah** "navigation reaches every place and tab": Tim punya 4 tab, dan tiap label `scrollWidth <= clientWidth` (ga kepotong).
- **Baru** "beranda cari": ketik "k" → lead dan prospek muncul, chip F&B nyaring peta dan Kejar sekarang. Fokus hilang kalau tanggal diganti.
- **Baru** "leads tipe bisnis": filter Sport → Chat 3 lead → `window.open` di-stub, cek URL tiap lead (`wa.me`, atau intent kalau user agent Android) → konfirmasi → 3 baris `outreach`, Log aktivitas hari ini +3. Ringkasan "1 tanpa nomor".
- **Baru** "profil bisnis": Leader ngisi WA bisnis → `{link_wa}` keisi di `ChatPicker` dan template Hunting. Member ga bisa ngedit.
- **Ubah** "akun besar": Peta 3D (`stubMap`) nampilin cluster berangka, tap cluster → zoom masuk.
- Unit: `categoryOf("Studio Yoga") === "Sport"`. `rankScripts` nawarin script bertag Health buat lead Sport.
- Semua langkah tetap lewat audit HIG + axe (PRD-010) di iPhone 12 dan Safari.

---

## 7. Keputusan owner

| # | Pertanyaan | Jawaban owner (29 Okt) |
|---|---|---|
| D1 | Glyph peta: Maki (isi, CC0) atau tetap ikon garis `Icon.tsx`? | **Maki.** Pengecualian ditulis di `design.md` §Ikon |
| D2 | Label saklar cari "Data saya \| Bisnis baru"? | **Boleh** |
| D3 | "Ganti tipe follow-up, hasilnya ga sesuai" maksudnya apa? | **Copy yang belum jadi langsung kecatat dan history geser** (kutipan di §1.4) → §3.5: kirim dicatat setelah dikonfirmasi, menggantikan PRD-009 D1 |
| D4 | Di iPhone, WhatsApp biasa + WhatsApp Business dua-duanya terpasang? Boleh dites? | **Iya, dua-duanya; boleh dites** (spike di awal Fase 3, §3.6 B) |
| D5 | Report Tim → Dashboard, Aktivitas → Log? | **Boleh** |
| D6 | Batas chat satu-satu? | **Ga ada batas.** Dicatat di Log aktivitas harian sebagai ukuran (§3.7) |
| D7 | Tambah tipe bisnis **Sport** dan **Beauty** (dipisah dari Health), dengan script Health tetap kepakai? | **Boleh** (30 Okt). Sport dan Beauty masuk `lib/categories.ts` dengan `parent: "Health"` |

---

## 8. Risiko

- **Satu tap tambahan per pesan** (§3.5). Sheet `visibilitychange` ngurangin beban buat yang langsung balik ke app. Kalau owner lupa konfirmasi, draf tetap keliatan di kartu, jadi ga ada yang hilang diam-diam. Tapi hitungan percobaan bisa telat sehari kalau konfirmasinya ditunda.
- **Gabung halaman kontak + Percakapan** ngubah kerjaan #78 dan #87 yang baru masuk. Flow yang nunggu "contact page" (`Kontak …`) perlu disesuaikan.
- **Symbol layer** bikin karakter clay ga tampil lagi di pin (pindah ke kartu). Ini perubahan dari PRD-013 §3. Ikut D1 (Maki): glyph dan karakter ga ditumpuk di satu pin.
- **Intent Android** bisa beda-beda per browser (Samsung Internet, in-app browser). Fallback-nya `wa.me` lewat `S.browser_fallback_url`.
- **Tipe baru (D7)** bisa bikin script yang cuma ditandai Health ilang dari lead Sport/Beauty. Ini dicegah aturan `parent` di `rankScripts`, dan ada unit test buat itu.
