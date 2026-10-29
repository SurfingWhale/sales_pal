# Inventaris komponen interaktif

Hasil pencarian statis di kode (29 Okt 2026, `main` sampai PR #87): dialog, popover, tooltip, toast, dan sheet. Patokannya nama komponen/state, karena nomor baris gampang bergeser.

**Seberapa lengkap:** semua `.modal-overlay` sudah di-grep (48 overlay JSX di 29 file). File inti dibaca di bagian yang relevan. File lain (TemplateBoard, Services, SitePricing, Campaigns, QuickPitch, Invoices, Quotes, BusinessEditor, WaImport, TeamLogs, dan sebagainya) baru di-grep untuk pola overlay, `role=`, `aria-*`, `title=`, toast, dan `alert/confirm/prompt`. Jadi ini **belum** bisa disebut inventaris yang 100% lengkap.

## Cara kerja dasar

- **Dialog = `.modal-overlay`.** `<div className="modal-overlay" onClick={tutup}>` membungkus satu kotak, dirender kalau state terisi.
- **`components/ModalA11y.tsx`** dipasang sekali di `SalesTracker`. MutationObserver-nya:
  - memberi `role=dialog` + `aria-modal` + label dari baris pertama;
  - memindah fokus masuk, dan balik ke pembuka saat ditutup;
  - menjaga Tab tetap di dalam dialog, dan Escape = klik scrim;
  - menambah tombol × kalau belum ada tombol Tutup/Kembali;
  - mendorong satu entri history per dialog, jadi Back di HP menutup dialog teratas;
  - langkah mundur yang dipicu app sendiri (`sp:back` dari `Hunting.leave()`) ditunggu, tidak dianggap Back pengguna.
- **Penanda di CSS (`app/globals.css`):**
  - `data-own-layout` = tidak ikut padding layar penuh di HP;
  - overlay dengan `flex-end` = bottom sheet;
  - `.print-overlay` / `.sp-leadpage` = halaman penuh tanpa ×.

Singkatan kolom "Tutup":
- **STD** = scrim / Escape / Back.
- **guard** = tidak bisa ditutup selama menyimpan.
- **Discard** = form yang sudah diubah menanyakan "Buang perubahan?" dulu (`useDiscard`, `components/FormGuard.tsx`).
- **auto×** = tombol × dari ModalA11y.

## Modal dan dialog

| Komponen (state) | Didefinisikan | Dibuka dari | Tutup / interaksi | Data |
|---|---|---|---|---|
| Tambah lead (`showAddLead`) | `SalesTracker.tsx` | `setShowAddLead(true)`: tab Leads, Beranda `onAdd` | STD + guard; Simpan → `addLead()` | `setDoc` leads |
| Target closing bulanan (`targetDraft`) | `SalesTracker.tsx` | Beranda "Atur target" → `setClosingTarget` | STD + guard; Simpan → `saveClosingTarget` | `setDoc` settings/hunting |
| Pilih lead untuk file share (`shared`) | `SalesTracker.tsx` | Effect membaca `?share` → `takeSharedFile()` (`lib/share.ts`, dari `public/sw.js`). **Tidak bisa dipicu statis.** | Pilih lead → `openLead`; "+ Lead baru" | `setDoc` leads |
| Import leads (`showImport`) | `SalesTracker.tsx` | Beranda/Leads, LeadFinder | STD; Selesai | parse xlsx/csv/vcf, `/api/scan`, `writeBatch` leads |
| `ProfileSheet` | `components/ProfileSheet.tsx` | Avatar di header (`setShowProfile`) | STD; × sendiri | tema, push, `/api/access`, logout |
| `AvatarPicker`, `AccessAdmin` | `ProfileSheet.tsx`, `AccessAdmin.tsx` | Dari dalam ProfileSheet | Batal/Tutup; scrim/Escape/Back hanya menutup dirinya (diperbaiki di PR #87) | `setDoc` profil; `/api/access/admin` |
| `LeadFinder` | `components/LeadFinder.tsx` | `setShowFinder(true)` | guard; Tutup | `/api/places`; `saveFound` → `writeBatch` leads |
| `FollowUpRun` (`fuRun`) | `components/FollowUpRun.tsx` | `setFuRun(dueLeads)` | STD; Tutup | `updateDoc` leads |
| Target DM harian (`goalDraft`) | `components/Hunting.tsx` | `changeGoal` | STD + guard | `setDoc` settings/hunting |
| Kelola template (`tplManage`) | `Hunting.tsx` | Menu "Tambah" | × sendiri | lewat TemplateBoard |
| Editor template (`editing`) | `components/TemplateBoard.tsx` | Edit / baru / `newRequest` | STD; Batal | `setDoc`/`deleteDoc` pitchTemplates |
| `DefaultsSheet` | `components/DefaultsSheet.tsx` | Menu "Tambah" | STD; Batal | `saveFillDefaults` |
| `ProspectThread` (`threadId`), gaya app chat, layar penuh di HP | `components/ProspectThread.tsx` | `ProspectList` `onOpen` → `setThreadId` | STD; ← "Tutup"; kirim (bulat) / Copy. Escape menutup panel yang terbuka dulu | `recordSend`, `saveProspect` |
| `ConvertSheet` ("Kasih data") | `components/ConvertSheet.tsx` | ProspectThread, `useOutcome().sheet` | guard; Simpan | `setDoc` leads, `saveProspect` |
| Editor komponen | `components/ComponentCatalog.tsx` | "+ Komponen" / edit | guard; Batal. Alat milik sendiri: harga beli / sisa / umur → penyusutan | `setDoc` components |
| Editor paket | `components/Services.tsx` | "+ Paket" / edit | guard; Batal | `setDoc` services + pricelistHistory |
| Kop & logo | `components/BusinessEditor.tsx` | Services, PrintSheet | guard; Batal | `setDoc` settings/business |
| Harga situs | `components/SitePricing.tsx` | Services | guard; Batal | `updateDoc` services, `/api/pricelist/source` |
| Editor kampanye (`draft`) | `components/Campaigns.tsx` | Hunting | STD; Batal | `setDoc` campaigns |
| `QuickPitch` | `components/QuickPitch.tsx` | Tombol melayang | × sendiri | pitchTemplates |
| Pindah ke guild | `components/MoveToGuild.tsx` | GuildHub | guard; Batal | `moveToGuild` |
| Catat pembayaran (`paying`) | `components/Invoices.tsx` | `startPayment` | guard; Batal | `updateDoc` invoices |
| `DocEditor` (penawaran/invoice) | `components/DocEditor.tsx` | Quotes/Invoices `setEditing` | Kalau ada perubahan → ConfirmSheet; ×; Batal | `onSave` → `setDoc` quotes/invoices; quoteTemplates; components |
| `WaSendSheet` | `components/WaSendSheet.tsx` | Invoices `bill`, Quotes kirim/nudge, `SendQuoteSheet` | guard; Selesai | `updateDoc` (bisa di-undo), `sharePdfs` |
| ClientHub: klien, chat masuk, pindah/reassign deal, post, preview import | `components/ClientHub.tsx` | Tombol di ClientHub / GuildHub | Discard / guard | clients, deals, posts |
| GuildHub: bikin guild, karakter, setelan, target tim, serah ketua | `components/GuildHub.tsx` | Tombol di GuildHub | Discard / guard | `foundGuild`, members, targets, `transferLeadership` |
| Form Outreach / Rejection | `components/TeamLogs.tsx` | `onAdd` | Discard / guard | `setDoc` outreach / rejections |

**`ConfirmSheet` / `useConfirm`** (`components/ConfirmSheet.tsx`, bottom sheet lewat portal): dipakai sekitar 25 tempat untuk hapus, buang, batalkan, DNC, putus Threads, kick/keluar guild, dan "Buang perubahan?". Aksinya hanya jalan kalau berhasil; kalau gagal, muncul "Gagal…" di tempat.

## Popover, menu, dropdown

| Komponen | File | Buka | Tutup | Data |
|---|---|---|---|---|
| Lonceng notifikasi (`showBell`) | `SalesTracker.tsx` | Tombol lonceng (`aria-haspopup=dialog`) | Escape, klik di luar, × | `PushToggle` → `/api/push` |
| Menu "⋯" lead (`role=menu`) | `components/LeadDetail.tsx` (`Menu`) | Tombol ⋯ | Klik di luar / Escape | Ubah data, Ubah profil, Hapus |
| `<select>` ruang kerja | `SalesTracker.tsx` | bawaan | bawaan | `chooseSpace` |
| `<select>` Tampilan Prospek | `Hunting.tsx` | bawaan | bawaan | `setProspectFilter` |
| Panel "Status & aksi" (⋯) | `ProspectThread.tsx` (`panel === "menu"`) | ⋯ di header (`aria-expanded`) | Pilih aksi, ketuk chat, Escape, ⋯ lagi | Dia bales, Tertarik, Nolak, Catatan, Kasih data, Buang, Jangan hubungi (tanya dulu) → `saveProspect` |
| Panel Template | `ProspectThread.tsx` (`panel === "pick"`) | Tombol "Template · tahap" di atas kolom tulis | Pilih template (mengisi kolom), ketuk chat, Escape | – |

Disclosure di tempat (bukan overlay): tombol `aria-expanded` dan `<details>` di LeadDetail, Hunting, TemplateBoard, BusinessEditor, LeadFinder, SalesReport, GuildHub, SendQuoteSheet, dan lain-lain.

Tidak ditemukan: `<dialog>`, `popover`, `role=tooltip`, `role=listbox`.

## Tooltip

Tidak ada komponen tooltip. Hanya atribut `title=` bawaan browser, misalnya "Profil & pengaturan" di header, "Tutup (Esc)" di PrintSheet, dan angka bar chart di LeadDetail. Readout hover chart di `TeamDashboard.tsx` (`role=status`) mirip tooltip.

## Toast dan notifikasi

| Komponen | File | Pemicu | Hilang | Data |
|---|---|---|---|---|
| "Tercatat" + Batal / Berikutnya | `Hunting.tsx` (`.sp-toast`) | `logSent` | 10 dtk; Batal → `takeBack` | undo `recordSend` |
| Undo kampanye | `Campaigns.tsx` | `send` | 5 dtk | undo `recordSend` |
| Undo kirim di thread | `ProspectThread.tsx` | `send` | 10 dtk | undo kirim |
| ChatNote "Dicatat: chat hari ini" | `LeadDetail.tsx` | Kirim dari `ChatPicker`, script tipe customer, atau Balas | × / Batal; di HP halaman memberi ruang setinggi catatan (PR #88) | `logContact` |
| Error share (`shareMsg`) | `SalesTracker.tsx` | `?share` gagal | Tap | – |
| Pesan `role=status` / `alert` di tempat | banyak (`setMsg`, `setPasteMsg`, `setOutcomeMsg`) | aksi | diganti aksi berikutnya / timer 1,8–3 dtk | – |
| Web Push | `lib/push.ts`, `public/sw.js`, `app/api/push`, `app/api/cron/digest` | Toggle di lonceng/profil | OS | `/api/push` |
| Notif "Hunting aktif" (Android) | `lib/prospectStore.ts` (`sessionNotice`) ← `HuntBar.tsx` | Sesi hunting | ganti tag | – |

## Sheet, drawer, halaman penuh

| Komponen | File | Buka | Tutup | Data |
|---|---|---|---|---|
| `Sheet` (bottom sheet, portal) | `components/Sheet.tsx` | Lead: profil, ubah lead, **lokasi lead** (`PlaceEditor`), langkah berikutnya, hapus. Penawaran/invoice: **"Titik lokasi acara"** (`DocEditor` `placing`) | Scrim (`stopPropagation`), × "Tutup", Batal | `updateDoc` leads; `venueGeo` di draft |
| `ChatPicker` (isi sheet "Chat ke …") | `components/ChatPicker.tsx` ← `useChatLog().picker` di `LeadDetail.tsx` | Tombol Chat / Chat WhatsApp / Chat di WhatsApp (`choose`) | Scrim, × "Tutup", Kirim di WhatsApp (menutup sheet) | `pitchTemplates` (baca), `useBusiness`; kirim → `onContacted` (log kontak + Outreach) |
| `PlaceEditor` (isi sheet) | `components/PlaceEditor.tsx` | Di dalam Sheet | Pilih hasil / "Pakai titik ini" / GPS → simpan dan tutup | `/api/geocode`, geolocation, `GeoPicker` |
| `WaImport` | `components/WaImport.tsx` | LeadDetail, atau langsung terbuka dari file share | guard; × | `parseWaExport`, `/api/scan` |
| Menu "Tambah" Hunting | `Hunting.tsx` (`addMenu`) | Tombol + | STD; × | ke template / paste / radar / script |
| Preview chat & "Perlu ditindak" | `components/Beranda.tsx` (`chatOf`, `sheet`) | Kartu Beranda | STD; Tutup | – |
| `LeadPage` (layar penuh) | `components/LeadDetail.tsx` | `openLead` (HP) / "Profil lengkap" | Back; "Kembali ke Leads" | `leadActions` → leads |
| Halaman kontak prospek (`.sp-pcontact`) | `components/ProspectList.tsx` (`openId`) | Tap kartu; terbuka lagi setelah Back dari halaman kirim | STD; "Tutup kontak"; ganti tampilan | `useOutcome`, `saveProspect` |
| `PrintSheet` / `ReportShell` (PDF) | `components/PrintSheet.tsx`, `ReportShell.tsx` | Quotes/Invoices "PDF"; TeamDashboard; GuildHub; ClientHub | Tutup | `buildPdf`, `sharePdf` (simpan/bagikan file; tanpa print browser) |
| Halaman kirim Hunting (bukan overlay) | `Hunting.tsx` (`open` + `history.state.spPage`) | `compose`, `toTarget`, cari | Back / Escape → `backToList` | – |

## Yang tidak bisa dipastikan statis

- Picker file share: tergantung share sheet Android dan cache service worker.
- Atribut, tombol ×, dan entri history dari ModalA11y: baru ada saat runtime.
- Judul dan aksi `useConfirm`/`useDiscard`: datang dari pemanggil.
- Pesan `onDone` ConvertSheet dan `makeFiles` WaSendSheet: datang dari pemanggil.

## Temuan

Semua sudah diperbaiki di PR #87:

1. ~~AvatarPicker/AccessAdmin ikut menutup Profil~~: dibungkus `stopPropagation`; flow `navigation` mengeceknya.
2. ~~PDF Dashboard tim terbuka dua lapis~~: blok `ReportShell` yang dobel dihapus.
3. ~~`window.print()` di `PrintSheet.tsx` dan `ReportShell.tsx`~~: dihapus beserta tombol "Cetak" (K4).
4. Tidak ada `alert(`, `confirm(`, `prompt(`, atau `print(` di `app/`, `components/`, dan `lib/`.
