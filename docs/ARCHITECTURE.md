# SalesPal: peta codebase

Panduan buat ngerti di mana sesuatu tinggal dan gimana file-filenya nyambung. Ditulis 29 Okt 2026 dari kode di `main`, sampai PR #87. Isinya sudah termasuk PR #86 (biaya produksi dan titik lokasi acara) dan PR #87 (halaman chat prospek baru + tiga perbaikan dialog).

**Cara baca:**
- **[cek]** = dilihat langsung di kode.
- **[duga]** = kesimpulan dari kode, belum dijalankan atau dibaca utuh.
- Nomor baris gampang bergeser, jadi patokannya nama fungsi atau komponen. Cari pakai `grep -n "namaFungsi" file`.

---

## 0. Gambaran besar

SalesPal itu **satu aplikasi Next.js 14** (`app/` router) yang dipasang sebagai PWA.

```
Browser / PWA
  │
  ├─ app/page.tsx ............ landing publik
  ├─ app/login/page.tsx ...... masuk (Firebase Auth)
  └─ app/dashboard/page.tsx .. cek login + akses → <SalesTracker>
                                   │
                                   ├─ 5 "tempat": Beranda · Hunting · Jualan · Tim & Report · Belajar
                                   ├─ komponen layar (components/*.tsx)
                                   ├─ lib/*.ts (logika + akses data)
                                   │     └─ Firestore (langsung dari browser, dijaga firestore.rules)
                                   └─ app/api/*/route.ts (server: kunci rahasia, Google, Threads, push)
```

- **Frontend:** React 18 + Next.js 14. Hampir semua layar adalah *client component* (`"use client"` di baris pertama), artinya jalan di browser, bukan di server. [cek]
- **Data:** Firebase. Browser baca dan tulis Firestore langsung (`lib/firebase.ts`). Yang boleh dan nggak boleh diatur di `firestore.rules`. [cek]
- **Server:** cuma buat yang butuh rahasia atau kuota: `app/api/*` (Google Places, geocode, scan gambar, Threads, push, pricelist untuk situs). [cek]
- **Tidak ada router per layar di dalam app.** Semua layar setelah login ada di satu halaman (`/dashboard`), dan pindah layar = ganti state `activeTab`. [cek]

---

## 1. Entry point: aplikasi mulai dari mana

| Langkah | File | Yang terjadi |
|---|---|---|
| 1 | `app/layout.tsx` (`RootLayout`) | Kerangka HTML untuk **semua** halaman: font, `manifest.json` (biar bisa di-install), skrip kecil yang pasang tema terang/gelap dari `localStorage` sebelum layar digambar (biar nggak kedip). [cek] |
| 2 | `app/page.tsx` | URL `/`: landing publik dengan contoh "slip penawaran" yang bisa diisi. Tombolnya mengarah ke login. [cek] |
| 3 | `app/login/page.tsx` | Masuk pakai Google atau email. Di PWA pakai *redirect* (bukan popup), karena popup di PWA iOS nggak balik ke app. Habis masuk → `?next=` atau `/dashboard`. [cek] |
| 4 | `app/dashboard/page.tsx` (`DashboardPage`) | Tiga hal: (a) `onAuthStateChanged`, kalau belum login → `/login`; (b) tanya `/api/access`, kalau akun belum diundang tampil layar "minta akses" (PRD-015); (c) kalau lolos → `<SalesTracker user={user} />`. [cek] |
| 5 | `components/SalesTracker.tsx` (`SalesTracker`) | Pilih **ruang kerja** (`useSpaceChoice`: Pribadi atau guild), bungkus dengan `SpaceContext.Provider`, lalu render `Tracker`. [cek] |
| 6 | `components/SalesTracker.tsx` (`Tracker`) | "Otak" app: pasang listener data (`onSnapshot`, `useSpaceCollection`), simpan state navigasi (`activeTab`), gambar header + tab + layar aktif, dan pasang `<ModalA11y />` sekali. [cek] |

Istilah:
- **Client component:** komponen React yang jalan di browser.
- **Listener (`onSnapshot`):** langganan ke data Firestore. Begitu data berubah di server, fungsi dipanggil lagi dan layar ikut berubah.
- **Context (`SpaceContext`):** cara React ngasih satu nilai (di sini: ruang kerja aktif) ke semua komponen di bawahnya tanpa dioper satu-satu lewat props.

---

## 2. Struktur halaman (layar)

### URL yang ada [cek]

| URL | File | Isi |
|---|---|---|
| `/` | `app/page.tsx` | Landing publik |
| `/login` | `app/login/page.tsx` | Masuk |
| `/dashboard` | `app/dashboard/page.tsx` | **Seluruh aplikasi** setelah login |
| `/insights` | `app/insights/page.tsx` | Insight untuk ruang kerja yang dipilih (PRD-007 §2.5) |
| `/join?g=…&c=…` | `app/join/page.tsx` | Gabung guild dari link undangan |
| `/share?text=…` | `app/share/page.tsx` | Pintu GET ke Hunting untuk link yang dibagikan |
| `/share-target` (POST) | `app/share-target/route.ts` | Target share sheet Android (biasanya dijawab service worker duluan) |
| `/threads/callback` | `app/threads/callback/page.tsx` | Balik dari login Threads |

### Di dalam `/dashboard`: 5 tempat, tiap tempat punya tab [cek]

Definisinya di `SECTIONS` (`components/SalesTracker.tsx`):

| Tempat | Tab | Komponen yang digambar |
|---|---|---|
| Beranda | Dashboard | `components/Beranda.tsx` (+ `BerandaReport`, `BerandaLearn`) |
| Hunting | Hunting | `components/Hunting.tsx` |
| Jualan | Leads · Penawaran · Invoice · Paket | Leads digambar langsung di `SalesTracker` (+ `LeadPanel`/`LeadPage` dari `components/LeadDetail.tsx`) · `components/Quotes.tsx` · `components/Invoices.tsx` · `components/Services.tsx` |
| Tim & Report | Dashboard tim · Guild · Report Klien · Log aktivitas · Outreach · Rejection Log | `TeamDashboard.tsx` · `GuildHub.tsx` · `SalesReport.tsx` + `ClientHub.tsx` · `ActivityLog` · `TeamLogs.tsx` |
| Belajar | Script Library · Simulator · AI Playbook | `ScriptLibrary.tsx` · `SalesSimulator` · (di dalam `SalesTracker`) |

### Cara pindah layar [cek]

- State: `const [activeTab, setActiveTab] = useState(...)` di `Tracker`.
- Klik tab atau tempat → `setActiveTab("Penawaran")`, lalu bagian render memilih layar dengan pola `{activeTab === "Penawaran" && <Quotes … />}`.
- Lompatan dari layar lain lewat fungsi kecil: `gotoInvoices`, `gotoHunting`, `gotoScripts`, atau `setActiveTab(...)` di dalam callback.
- URL ikut berperan sekali saat buka: `?hunt` → Hunting, `?guild` → Guild, `?share` → pilih lead untuk file yang dibagikan. Setelah dibaca, URL dibersihkan (`history.replaceState`).
- **Tombol Back di HP** nggak ganti tab. Back menutup dialog paling atas (`components/ModalA11y.tsx`) atau keluar dari halaman orang di Hunting (`history.state.spPage === "kirim"`).

---

## 3. Struktur komponen

### Kerangka (layout)

| Komponen | File | Peran |
|---|---|---|
| `RootLayout` | `app/layout.tsx` | HTML, font, tema, manifest |
| `SalesTracker` → `Tracker` | `components/SalesTracker.tsx` | Header (ruang kerja, lonceng, profil), baris tempat, sub-tab, area layar, overlay global |
| `ModalA11y` | `components/ModalA11y.tsx` | Dipasang sekali; bikin semua `.modal-overlay` jadi dialog yang bener (fokus, Escape, ×, Back) |
| `QuickPitch` | `components/QuickPitch.tsx` | Tombol melayang + template pitch |

### Potongan UI yang dipakai ulang

| Komponen | File | Dipakai buat |
|---|---|---|
| `Icon` | `components/Icon.tsx` | Semua ikon (SVG) |
| `ui.ts` (`btnPrimary`, `btnMuted`, `chip`, `inputStyle`, `label`, `modalBox`, `card`) | `components/ui.ts` | Gaya tombol, kolom, kartu |
| `ConfirmSheet` / `useConfirm` | `components/ConfirmSheet.tsx` | "Yakin hapus?", bottom sheet konfirmasi |
| `useDiscard` | `components/FormGuard.tsx` | "Buang perubahan?" sebelum nutup form yang udah diisi |
| `Sheet` | `components/Sheet.tsx` | Bottom sheet lewat portal (lokasi, edit lead, dll.) |
| `PlaceEditor` | `components/PlaceEditor.tsx` | Atur titik: cari alamat, tempel link Maps, GPS, geser pin (lead dan acara) |
| `GeoPicker` / peta | `components/GeoMap.tsx` | Peta MapLibre (dimuat belakangan, butuh WebGL) |
| `DocEditor` | `components/DocEditor.tsx` | Satu form untuk penawaran **dan** invoice |
| `PrintSheet` | `components/PrintSheet.tsx` | Pratinjau dan PDF penawaran/invoice |

### Contoh konkret: tab Penawaran [cek]

```
Tracker (SalesTracker.tsx)
 └─ {activeTab === "Penawaran" && <Quotes quotes services components templates business leads … />}
      Quotes.tsx
       ├─ daftar kartu penawaran (+ tombol Kirim, ✓ Disetujui, PDF, Revisi, Edit)
       ├─ {editing && <DocEditor kind="quote" initial={draft} onSave={save} … />}
       │     DocEditor.tsx
       │      ├─ Section "Untuk", "Project / acara" (+ Sheet → PlaceEditor buat titik peta)
       │      ├─ Section "Item & rincian", "Biaya produksi · internal", "Harga & pembayaran"…
       │      └─ ConfirmSheet "Buang perubahan?"
       ├─ {printing && <PrintSheet kind="quote" data={q} … />}
       └─ {sending && <SendQuoteSheet …>} → WaSendSheet
```

- **Data turun lewat props.** `Tracker` udah punya `quotes`, `services`, dan seterusnya dari listener, lalu ngoper ke `Quotes`.
- **Aksi naik lewat callback.** `DocEditor` nggak nyimpen sendiri: dia manggil `onSave(draft)`, dan `Quotes.save()` yang nulis ke Firestore.
- Pola ini konsisten di hampir semua layar: induk punya data, anak nampilin, dan anak manggil fungsi induk buat ngubah.

---

## 4. Alur data: "Tambah lead", dari tap sampai Firestore dan balik lagi [cek]

1. **Tombol.** Di tab Leads ada tombol "Tambah lead" (`SalesTracker.tsx`, beberapa tempat: HP, desktop, dan "+ Lead pertama" waktu kosong). Beranda juga lewat prop `onAdd`. Semuanya manggil `setShowAddLead(true)`.
2. **Dialog muncul.** Di render `Tracker`: `{showAddLead && <div className="modal-overlay" onClick={closeAddLead}><form onSubmit={… addLead()}>…}`.
   - Isian form disimpan di state `newLead`.
   - `ModalA11y` otomatis nangkep `.modal-overlay` baru: kasih `role=dialog`, fokus ke kolom pertama, dan Back/Escape = klik luar = `closeAddLead`.
3. **Simpan.** Submit form → `addLead()`:
   - kalau nama kosong → pesan di kolom, berhenti;
   - `const id = \`lead_${Date.now()}\``;
   - `setDoc(spaceDoc(space, "leads", id), stamp(space, {...newLead, lastContact, value}))`.
4. **Ke mana nulisnya.** `spaceDoc` ada di `lib/space.ts`:
   - ruang kerja Pribadi → `users/{uid}/leads/{id}`;
   - guild → `guilds/{g}/leads/{id}`, dan `stamp()` nambahin `ownerUid`/`ownerName` biar ketahuan punya siapa.
5. **Dijaga rules.** `firestore.rules`: `match /users/{uid}/{document=**}` cuma boleh kalau `request.auth.uid == uid`. Di guild, aturan per peran (Member cuma barisnya sendiri).
6. **Balik ke layar.** Nggak ada "refresh". Waktu `Tracker` dibuka, dia udah pasang `onSnapshot(spaceQuery(space, "leads"), snap => setLeads(...))`. Begitu dokumen baru masuk, Firestore memanggil listener itu, `leads` berubah, dan daftar Leads, Beranda, dan peta ikut tergambar ulang.
   - `spaceQuery` (lib/space.ts) membatasi: Member guild cuma dapat `where("ownerUid", "==", uid)`.
7. **Offline.** [duga] Firestore SDK menyimpan tulisan sementara di HP dan mengirimnya saat online, dan listener langsung nampilin data lokal. Ini perilaku bawaan SDK Firestore, bukan kode SalesPal.

Bahasa sederhana: **tombol ngubah state → state munculin form → form manggil fungsi simpan → fungsi nulis ke Firestore → Firestore ngabarin listener → listener ngubah state → layar tergambar ulang.**

Pola yang sama dipakai buat data lain lewat hook `useSpaceCollection(space, "quotes")` (`lib/billing.ts`). Isinya `onSnapshot` + `useState`, dibungkus jadi satu baris.

---

## 5. Peta file

| File | Tanggung jawab | Bergantung ke |
|---|---|---|
| `app/layout.tsx` | Kerangka HTML semua halaman | `globals.css`, Vercel Speed Insights |
| `app/dashboard/page.tsx` | Gerbang: login + akses → app | `lib/firebase`, `lib/authFetch`, `SalesTracker` |
| `components/SalesTracker.tsx` | Kerangka app, navigasi, listener data, dialog global (tambah lead, import, target) | hampir semua komponen; `lib/space`, `lib/billing`, `lib/firebase` |
| `components/ModalA11y.tsx` | Perilaku dialog untuk semua `.modal-overlay` | DOM (MutationObserver), `history` |
| `lib/firebase.ts` | Inisialisasi Firebase (Auth, Firestore, emulator saat tes) | `firebase` SDK, env `NEXT_PUBLIC_FIREBASE_*` |
| `lib/space.ts` | Ruang kerja: path data Pribadi vs guild, `spaceDoc`, `spaceQuery`, `stamp`, `SpaceContext` | `lib/firebase`, `lib/guild` |
| `lib/billing.ts` | Tipe dan hitungan jualan: `Quote`, `Invoice`, `Component`, `CostLine`, total, margin, `useSpaceCollection`, teks WA | `lib/space`, `lib/geo`, `lib/sites` |
| `lib/guild.ts` | Guild, peran, target tim | `lib/firebase` |
| `lib/prospects.ts`, `lib/prospectStore.ts`, `lib/hunting.ts` | Hunting: prospek, tahap, kirim DM, sesi | `lib/space` |
| `lib/geo.ts` | Titik lokasi, baca link Maps, jarak, `mapsUrl`, `routeUrl` | – |
| `lib/pdfDoc.ts`, `lib/agreements.ts` | PDF penawaran/invoice, SPK/NDA | `jspdf`, `lib/billing` |
| `lib/push.ts` | Daftar service worker + Web Push | `public/sw.js`, `/api/push` |
| `lib/serverAuth.ts`, `lib/access.ts` | (server) cek token login, siapa boleh pakai fitur berbayar | `firebase-admin` |
| `components/Hunting.tsx` | Tempat Hunting: Prospek, halaman kirim, sesi | `ProspectList`, `ProspectThread`, `lib/prospectStore` |
| `components/ProspectList.tsx` | Daftar prospek ala Notion + halaman kontak | `ProspectOutcome` (`useOutcome`) |
| `components/ProspectThread.tsx` | Halaman chat satu prospek, gaya app chat: header ← avatar ⋯ (status & aksi), chat, satu baris tulis + pemilih template | `lib/prospects`, `lib/templates`, `ConvertSheet` |
| `components/LeadDetail.tsx` | `LeadPanel` (desktop) dan `LeadPage` (HP) | `Sheet`, `PlaceEditor`, `WaImport` |
| `components/Quotes.tsx`, `Invoices.tsx` | Daftar dan alur penawaran/invoice | `DocEditor`, `PrintSheet`, `WaSendSheet` |
| `components/DocEditor.tsx` | Form penawaran/invoice | `lib/billing`, `Sheet`, `PlaceEditor`, `ConfirmSheet` |
| `components/Services.tsx`, `ComponentCatalog.tsx` | Paket, komponen (termasuk aset dan penyusutan), harga situs | `lib/billing`, `SitePricing` |
| `firestore.rules` | Siapa boleh baca/tulis apa (dideploy utuh saat merge ke main) | – |
| `tests/flows/flows.mjs`, `run.mjs` | Tes klik-semua-alur di emulator + audit HIG | Playwright, Firebase emulator |
| `docs/prd/*.md` | Keputusan produk per fitur | – |

---

## 6. Komponen interaktif (dialog, popover, tooltip, toast, sheet)

Inventaris dari pencarian statis (29 Okt). Detail lengkap per baris ada di `docs/ui-inventory.md`.

**Cara kerja umum [cek]:**
- Nggak ada UI kit.
- Tiap dialog = `<div className="modal-overlay" onClick={tutup}>` + satu kotak, muncul kalau state-nya terisi (`{editing && …}`).
- `ModalA11y` yang menambahkan `role=dialog`, fokus, Escape, tombol × (kalau belum ada Tutup/Kembali), dan satu langkah history per dialog (Back = tutup).

| Jenis | Yang ada | Catatan |
|---|---|---|
| Modal/dialog | Sekitar 48 overlay di 29 file: Tambah lead, Import, Profil, LeadFinder, editor template, DocEditor, ConvertSheet, editor komponen/paket, editor guild, dan lainnya | Ditutup lewat scrim, Escape, Back, atau tombol sendiri. Banyak yang dijaga waktu menyimpan; form panjang nanya "Buang perubahan?" |
| Konfirmasi | `ConfirmSheet` / `useConfirm` (sekitar 25 tempat) | Aksi baru jalan kalau berhasil; gagal = pesan di tempat |
| Bottom sheet | `Sheet` (lokasi, edit lead, jadwal), `WaImport`, menu "Tambah" Hunting, preview chat Beranda, "Perlu ditindak" | Overlay dengan `alignItems: flex-end` |
| Halaman penuh | `LeadPage`, halaman kontak prospek (`.sp-pcontact`), `PrintSheet`/`ReportShell` (PDF), halaman kirim Hunting (bukan overlay) | |
| Popover/menu | Lonceng notifikasi (`showBell`), menu "⋯" lead (`role=menu`), `<select>` ruang kerja dan tampilan | Tutup saat klik di luar atau Escape |
| Tooltip | Cuma `title=` bawaan browser; tidak ada komponen tooltip | |
| Toast | "Tercatat" + Batal di Hunting (10 dtk), undo kampanye (5 dtk), undo thread, ChatNote di lead, pesan `role=status` | Plus Web Push (`lib/push.ts`, `public/sw.js`) |

**Yang nggak bisa dipastikan statis [duga]:**
- Picker file share (tergantung share sheet Android + service worker).
- Atribut dan tombol yang disuntik `ModalA11y` saat runtime.
- Judul dan aksi `useConfirm`/`useDiscard` dari pemanggilnya.

**Temuan inventaris, sudah diperbaiki di PR #87 [cek]:**
1. Menutup AvatarPicker/AccessAdmin dulu ikut menutup Profil. Sekarang dibungkus `stopPropagation` di `ProfileSheet.tsx`; flow `navigation` mengecek Escape di pemilih foto.
2. PDF di Dashboard tim dulu dirender dua kali. Blok `ReportShell` yang dobel di `TeamDashboard.tsx` sudah dihapus.
3. `window.print()` dan tombol "Cetak" dihapus dari `PrintSheet.tsx` dan `ReportShell.tsx` (standar native K4). PDF disimpan/dibagikan sebagai file, lalu dicetak dari viewer PDF.

---

## 7. Status aplikasi (per 29 Okt 2026)

- **Sudah jalan:**
  - Beranda (3 mode);
  - Hunting dengan Prospek ala Notion + halaman kontak (#78);
  - Leads + peta 3D;
  - Penawaran/Invoice/SPK/NDA + PDF;
  - Paket + komponen + harga ke situs (PRD-017);
  - Guild dan peran;
  - Report klien;
  - akses undangan (PRD-015);
  - Web Push.
- **Baru (PR #86):** biaya produksi internal, aset dengan penyusutan per job, harga minimal, dan titik lokasi acara + link Maps di PDF/WA/SPK.
- **Baru (PR #87):** halaman chat prospek dibuat seperti app chat (masukan owner 29 Okt, "belom natural"), plus tiga temuan inventaris diperbaiki.
- **Catatan terbuka:** tidak ada issue GitHub yang terbuka per 29 Okt. Keputusan owner yang masih menunggu ada di PRD masing-masing (mis. PRD-017 §8).
- **Cara tes:** `npm run test:flows` (dan `DESKTOP=1`), lihat `CLAUDE.md`. CI `native` menjalankan 4 browser sebelum merge.

---

## Latihan kecil

Tanpa buka dokumen ini: kalau kamu klik **PDF** di satu penawaran, sebutkan:
1. state apa di file mana yang berubah;
2. komponen apa yang muncul, dan di file mana;
3. apakah ada yang ditulis ke Firestore.

Jawabannya bisa dicek di `components/Quotes.tsx` (cari `setPrinting`) dan `components/PrintSheet.tsx`.
