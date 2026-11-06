# PRD-026: Navigasi balik. Tutup = balik ke tempat asal

- **Status:** audit dan perbaikan P1–P2 dibangun 6 Nov 2026. Sisa ada di §5.
- **Asal:** owner, 6 Nov: *"open leads masa close card dari open chat ke page opening hunting bukan balik ke modals prospect yang di input"*. Owner minta interaction design-nya dibenerin secara agentic: audit, catat yang salah dan yang belum ada, prioritaskan, perbaiki.
- **Bagian dari:** model interaksi [docs/interaction/](../interaction/README.md). PRD ini hanya mencakup dimensi "ke mana tutup mendarat". State, kontrak kirim, feedback, dan Script Chat ada di sana.
- **Dasar penilaian:** Knowledge Inbox owner, *UI Interaction Design: Native Feel & Interaction Quality*. Eksekusinya mengikuti skill `salespal-ui-audit`.

## 1. Prinsip

1. **Tutup itu satu langkah mundur, ke tempat kamu datang.** Tidak ke halaman awal tab dan tidak ke tempat yang tidak kamu buka.
2. **Yang bisa ditumpuk, ditumpuk.** Lembar lead, chat, dan lembar kirim dibuka **di atas** tempat asalnya. Tempat asal tidak ditutup lebih dulu.
3. **Kalau harus pindah tab, tempat asal diingat.** Di tab tujuan ada satu tombol yang menyebut namanya, misalnya "‹ Kembali ke Beranda" atau "‹ Kembali ke Usaha X".
4. **Pilihan sadar menghapus jejak.** Tap nav atau subnav berarti pengguna pindah sendiri, jadi tombol kembali hilang.
5. **Label tutup menyebut tujuannya.** Contoh: "Kembali ke Hunting", bukan "Kembali ke Leads" di semua tempat.

## 2. Cara audit

- **Peta statis:** setiap pintu masuk ke halaman, lembar, atau dialog, beserta ✕, Batal, Escape, dan Back browser. Masing-masing dicatat dengan file:baris, file dan baris yang ditutup, dan tempat mendarat. Ada sekitar 35 jalur.
- **Probe dinamis:** Playwright di akun ukuran produksi (200 lead, 60 prospek, 40 penawaran, 50 invoice). Probe merekam dialog yang terbuka, state Hunting, dan `history` setelah setiap tutup.
- **Keluhan owner terbukti:** kontak prospek → 💬 Percakapan → tutup (✕ maupun Back) → mendarat di Hunting kosong (`dialogs: []`). Sebabnya `ProspectList.tsx` menjalankan `setOpenId(null)` sebelum `onOpen(p)`. Kontak ditutup dulu, dan chat-nya hanya menutup dirinya sendiri.

## 3. Temuan

| # | Jalur | Sebelumnya | Prioritas |
|---|---|---|---|
| N1 | Kontak prospek → 💬 Percakapan → tutup / Back | Mendarat di daftar Prospek. Kontak hilang | **P1 (keluhan owner)** |
| N2 | Beranda → kartu prospek ("Kirim intro", "Follow-up"), pratinjau chat → aksi, Perlu ditindak → baris prospek | `setActiveTab("Hunting")`: Hunting kosong, orangnya tidak terbuka, dan tidak ada jalan balik ke Beranda | **P1** |
| N3 | Beranda → kartu penawaran / invoice | Membuka *daftar* Penawaran / Invoice, bukan dokumennya. Tidak ada jalan balik | **P1** |
| N4 | Lembar lead → Riwayat → penawaran / invoice, atau "Buat penawaran" | Lembar lead dan tab asal hilang. Setelah PDF atau editor ditutup, kamu terdampar di daftar Penawaran | **P1** |
| N5 | Perlu ditindak (sheet) / pratinjau chat → buka lead → tutup lead | Sheet ditutup sebelum lead dibuka, jadi setelah lead ditutup daftarnya hilang | **P1** |
| N6 | Follow-up beruntun → buka lead | Antrean ditutup dan posisinya hilang | **P1** |
| N7 | Tombol baris lead "Balas / Kirim intro / Follow-up" → Pesan → ✕ | Mendarat di lembar lead yang tidak pernah kamu buka. Perlu tutup dua kali | P2 |
| N8 | Halaman kirim dari pencarian / Radar / tempel link → Back | Kontak orang itu ikut terbuka (`backTo = curId` selalu), padahal kamu tidak datang dari sana | P2 |
| N9 | Kontak → ✉ Kirim → menunggu Back dari kontak | Kalau Safari mendaratkan Back setelah 400 ms, halaman kirim terpental ke daftar (race) | P2 |
| N10 | Tutup lembar lead | Label selalu "Kembali ke Leads", juga dari Hunting dan Beranda | P2 |

## 4. Yang dibangun (6 Nov)

| # | Perbaikan | Di mana |
|---|---|---|
| N1 | Chat dibuka **di atas** kontak lewat portal ke `<body>`, sehingga ModalA11y menganggapnya dialog teratas. Kontak tetap terbuka di bawahnya, jadi ✕ dan Back kembali ke kontak | `ProspectList.tsx` (tanpa `setOpenId(null)`), `ProspectThread.tsx` (`createPortal`) |
| N2 | Prospek dari Beranda langsung membuka **kontak orangnya** di Hunting (`focus`). Tombol balik di kontak berbunyi "‹ Beranda", dan menutupnya kembali ke Beranda | `SalesTracker.tsx` (`huntFocus`, `jump`), `Hunting.tsx` (`focus`), `ProspectList.tsx` (`leaveTo`) |
| N3 | Penawaran / invoice dari Beranda membuka **dokumennya** (`openDoc`), dengan "‹ Kembali ke Beranda". Kartu deal macet, coba lagi, dan "Tertarik" juga mendapat tombol kembali | `SalesTracker.tsx` |
| N4 | "‹ Kembali ke {nama lead}" membuka lagi tab asal dan lembar lead-nya | `SalesTracker.tsx` (`cameFrom.leadId`, `goBack`) |
| N5 | Aksi yang membuka lead (`inPlace`) tidak menutup sheet / pratinjau. Lembar lead (portal) menumpuk di atasnya | `Beranda.tsx`, `SalesTracker.tsx` |
| N6 | Antrean tetap terbuka di bawah lembar lead | `SalesTracker.tsx` |
| N7 | Pesan yang dibuka langsung dari tombol kartu: menutupnya juga menutup lembar lead. "Tulis pesan" di dalam lembar tetap kembali ke lembar | `LeadDetail.tsx` (`useChatLog` `direct`) |
| N8 | `backTo` hanya diisi kalau halaman kirim dibuka dari kontak | `Hunting.tsx` (`fromContact`) |
| N9 | Menunggu Back mendarat sampai 1,5 detik (sebelumnya 0,4) | `ProspectList.tsx` `afterClose` |
| N10 | Label tutup lembar lead: "Kembali ke Beranda / Hunting / Leads / …", sesuai tab asal | `LeadDetail.tsx` `backLabel` |

**Tombol "Kembali ke …":** `.sp-return`, di atas isi tab. Tingginya 44pt, teks memakai `--brand-text` dan `--fs-body`. Tombol ini hilang begitu pengguna memilih tab sendiri lewat nav atau subnav.

## 5. Yang belum ada (berikutnya, urut prioritas)

| # | Masalah | Rencana | Prioritas |
|---|---|---|---|
| R1 | Pindah tab tidak menambah entri `history`. Back di tab kedua langsung keluar app (PWA) atau mundur ke halaman sebelum login | Satu tumpukan navigasi app: perpindahan tab mendorong `history.state.spTab`, dan Back kembali ke tab sebelumnya. Harus akur dengan ModalA11y dan `spPage` Hunting, jadi perlu dites di WebKit | P2 |
| R2 | Daftar Prospek ↔ halaman kirim saling *menggantikan*. Scroll daftar dan `limit` (30) hilang, dan kartu di luar 30 tidak bisa di-scroll-kan ke layar | Sembunyikan daftar (`hidden`), jangan unmount. Simpan posisi scroll | P2 |
| R3 | Pesan (ChatPicker): langkah "pilih script" dan "udah kekirim?" tidak punya Back sendiri. Back menutup Pesan, dan di langkah "sent" Back menutup tanpa bertanya | `Sheet onBack` per langkah, dan "Udah?" ditanyakan dulu | P2 |
| R4 | Pratinjau chat prospek di Beranda ditutup sebelum pindah ke Hunting | Setelah kembali ke Beranda, buka lagi pratinjaunya | P3 |
| R5 | Tab Leads di Hunting di-unmount saat pindah pane (`limit` hilang) | `hidden` seperti Kirim / Performa | P3 |
| R6 | Membuka lead dari pencarian Hunting mengosongkan kata cari | Biarkan `q`. Tutup lead kembali ke hasil cari | P3 |
| R7 | "Lead ini udah ada" (Tambah lead) menutup form tambah | Tumpuk lembar lead di atas form | P3 |
| R8 | Peta: tombol "Atur lokasi" hanya membuka lembar lead | Buka langsung sheet lokasinya | P3 |

## 6. Tes

- **Flow baru `navigasi balik`** di akun ukuran produksi. Setiap langkah memeriksa tempat mendarat, bukan sekadar dialog yang tertutup:
  1. Kontak → Percakapan → ✕ → kontak. Lalu Back → kontak.
  2. Tombol kartu lead → Pesan → ✕ → daftar, tanpa lembar lead.
  3. Beranda → kartu prospek → kontaknya di Hunting ("Tutup kontak, kembali ke Beranda") → Beranda.
  4. Perlu ditindak → lead → "Kembali ke Beranda" → daftar masih terbuka.
  5. Lembar lead → Riwayat → Q-BIG-012 → "Kembali ke Usaha Contoh 012" → lembar lead, di tab Leads.
- Full suite di phone dan desktop. CI `native` juga menjalankan WebKit (iPhone 12 dan Safari).
