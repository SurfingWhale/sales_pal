# F. Peta perilaku komponen

Komponen dan **perilaku** yang dimilikinya, termasuk siapa pemilik state-nya. Gunakan peta ini untuk tahu di mana sebuah perubahan harus dibuat.

```
SalesTracker                      pemilik: activeTab, cameFrom, lead terbuka, pageStart, Follow-up beruntun, openDoc
├── jump(tab) / goBack()          lompatan + "‹ Kembali ke …" (PR #115)
├── openLead(lead, start)         buka LeadPage di atas tab mana pun
├── logContact / markContacted    Outreach + Lead.lastContact (sekali per hari), mengembalikan undo
├── markReplied                   Lead.lastReplyAt ⚠ tanpa catch
├── followedUp / nudgedQuote / remindedInvoice   aksi kartu Beranda setelah "Udah"
└── todo[]                        kartu Perlu ditindak (+ inPlace)

Beranda                           pemilik: mode, sheet Lihat semua, pratinjau chat, pertanyaan "udah kekirim?"
├── Kartu (TaskCard)
│   ├── Aksi WA → buka wa.me → tanya "udah kekirim?" → onSent
│   ├── Tunda → nextActionDate +1 ⚠ tanpa feedback
│   ├── Buka → t.open (lead: di tempat; dokumen / prospek: lompatan)
│   └── Chat → pratinjau
└── LeadMap → openLead

Hunting                           pemilik: pane, halaman Kirim (open, spPage), target, waiting, undo, threadId, backTo, queued
├── ProspectList                  pemilik: openId (kontak), focus / leaveTo
│   └── Kontak (.sp-pcontact)
│       ├── ✉ Kirim → afterClose → compose → halaman Kirim
│       ├── 💬 Percakapan → ProspectThread (portal, di atas kontak)
│       └── useOutcome (ProspectOutcome): Dibales, hasil, Kasih data, Kunci
├── Halaman Kirim
│   ├── TemplateBoard             script per tahap (urut judul ⚠), kartu Saran (scriptFit)
│   │   └── pick(t, how) → copy / buka → waiting → confirmSent → recordSend → undo 10 dtk
│   └── "Udah dijawab?" → useOutcome
├── ProspectThread                kirim, ⋯ Status & aksi (act lokal ⚠ beda dari useOutcome)
├── HuntLeads → openLead
├── Campaigns                     kirim massal, undo 5 dtk ⚠
└── ScriptManager (Sheet full)

LeadPage (LeadDetail)             pemilik: editing, writing (ChatPicker), managing, ChatNote
├── NextMessage → ChatPicker      pemilik: teks, langkah (tulis / pilih / kirim), brand (localStorage)
│   └── Kirim di WhatsApp → "udah kekirim?" → logContact → ChatNote + Follow-up kapan?
├── Menu ⋯                        Tandai udah dikontak, Ubah data lead (status → Gugur), Hapus
├── Jadwal → Sheet Langkah berikutnya
└── Riwayat → onOpenDoc → lompatan ke dokumen

Quotes / Invoices                 pemilik: editing, printing, sending (WaSendSheet)
├── DocEditor                     simpan ⚠ setDoc tanpa merge (menghapus data kunci)
├── WaSendSheet                   Buka WA = dicatat (tanpa tanya) ⚠
├── setStatus                     Disetujui / Ditolak ⚠ tanpa feedback dan undo
└── makeInvoice                   ⚠ tanpa penjaga ketuk ganda

ModalA11y (global)                satu entri history per .modal-overlay; Back / Escape menutup yang teratas
Sheet                             portal; onBack opsional (langkah di dalam sheet)
ConfirmSheet / useConfirm         aksi berbahaya selalu punya Batal
FormGuard (useDiscard)            "Buang perubahan?"
```

## Siapa pemilik apa, dan masalahnya

| State | Pemilik sekarang | Masalah |
|---|---|---|
| "Kiriman tertunda" (sudah buka WA, belum dijawab "udah?") | State lokal di **lima** komponen: Hunting, ProspectThread, ChatPicker, Beranda, FollowUpRun | Hilang saat unmount atau reload. Teks dan perilakunya berbeda di tiap tempat (AMB-06, AMB-08) |
| Hasil prospek | `useOutcome` **dan** `ProspectThread.act` | Dua implementasi dengan efek berbeda (AMB-09) |
| Konteks balik | `cameFrom` (SalesTracker), `backTo` + `fromContact` (Hunting), `leaveTo` (ProspectList), `direct` (ChatPicker) | Empat mekanisme untuk satu aturan (AMB-03) |
| Undo | Ditulis ulang di setiap tempat, dengan durasi 5 dtk, 10 dtk, atau sampai ditutup | Tidak ada satu komponen undo (AMB-13) |
| Pilihan script | `rankScripts` (lead), urut judul (Hunting), `suggestForPost` (Saran), mesin Python (Analisis Chat) | Empat otak (PRD-025) |
