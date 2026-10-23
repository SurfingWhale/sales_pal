# QA Review — Audit alur ulang (Hunting → lead → penawaran → invoice)

- **Tanggal:** 2026-10-23
- **Build:** `main` @ `8c3662a` (PR #70), di branch `flow-audit` (`b8b44a2`, cuma tambah port offset buat runner)
- **Device:** 390×844 phone (Chromium, touch, DPR 2) dan 1280×900 desktop. Firebase emulator (Auth + Firestore), `next dev`. Ga ada yang nyentuh project live.
- **Cara:** semua flow di `tests/flows` jalan dengan screenshot tiap langkah. Ditambah satu flow lokal (ga di-commit): akun dengan 6 prospek, satu per status (baru, intro hari ini, dibales + pikir-pikir, tertarik 30 hari lalu, 3× kirim tanpa jawaban, diem 20 hari). Flow itu jalan dari Beranda → Antrian → Journey → Percakapan → thread → Jangan hubungi → Kasih data → Leads → Log DM.
- **Screenshot:** disimpan lokal, ga masuk repo (repo publik). Nama file di catatan di bawah tetap dicantumin buat referensi.

## Hasil harness

| Device | Hasil | HIG audit |
|---|---|---|
| Phone 390×844 | 21/21 lulus | 0 temuan |
| Desktop 1280×900 | 21/21 lulus | 0 temuan |

Harness hijau. Yang di bawah ini masalah alur, bukan test yang gagal: harness ngecek tombol ada dan bisa diklik, belum ngecek angka di satu layar cocok sama layar lain.

---

## Temuan, urut dari yang paling berat

| # | Alur | Langkah | Masalah | Dampak | Usulan | Severity |
|---|---|---|---|---|---|---|
| 1 | Hunting → Percakapan | Thread → 🚫 Jangan hubungi | Sekali tap, ga ada konfirmasi, ga ada Batal. Riwayat chat langsung dihapus, thread hilang dari layar. DM lama ke orang itu ikut hilang dari Dashboard tim dan Log aktivitas: "DM terkirim" turun 7 → 4, "Prospek baru" 5 → 4. | Salah tap di baris chip yang digeser bikin data hilang permanen. Angka kerja seller minggu lalu ikut berubah. | Tanya dulu, kayak di Journey (alasan + tombol merah Kunci), dan kasih Batal beberapa detik. Hitungan aktivitas jangan baca dari `history` yang bisa dihapus. Simpan jumlah DM di `hunts`, atau sisakan event `sent` tanpa isi pesan. | tinggi |
| 2 | Hunting → Percakapan | Bales orang yang udah bales | Habis kamu kirim balasan, statusnya balik jadi **"Intro terkirim"** dengan "percobaan 1/3". Dia keluar dari filter **Dibales**, grup "Dibales, lanjut", dan Journey "Terhubung", lalu pindah ke "Nunggu". Saran tahap juga mundur dari Closing ke Follow-up. Total 3 pesan tanpa jawaban = "Tidak terhubung", diparkir 60 hari. | Orang yang paling panas malah keluar dari daftar "Dibales". Labelnya bohong. Percakapan yang lagi jalan dihitung kayak cold DM. | Kirim ke orang `terhubung` jangan ubah `contact`. Simpan `lastSentAt` aja. Status "nunggu jawaban" cukup dari `lastSentAt > lastReplyAt`. `attempts` cuma buat yang belum pernah bales. | tinggi |
| 3 | Hunting → Leads | Kasih data → lalu Log DM | Habis "Kasih data", DM terakhir ke orang itu di Log DM malah jadi "✅ Tertarik — jadiin lead biar masuk pipeline" dengan tombol hijau **Jadiin Lead →**. Kalau di-tap, lead kedua kebikin. Dua jalan jadi lead juga hasilnya beda: Kasih data = Hot/85 dan pindah ke ETB. Jadiin Lead = Warm/70, prospek tetap di antrian dan nanti bisa masuk "Siap dibuang". | Lead dobel. Orang yang udah jadi lead masih disuruh di-follow-up atau dibuang. | `syncHunt` waktu convert ikut nulis `leadId` ke hunt. `makeLead` pakai `convertPatch` dan cek `p.leadId` dulu. Cukup satu fungsi "jadi lead" buat dua tombol itu. | tinggi |
| 4 | Antrian, Beranda, Percakapan, Journey | Angka "antrian" | Akun yang sama, 6 prospek. Beranda bilang "4 prospek di antrian". Journey "Antrian 4". Badge tab Percakapan dan filter "Follow-up hari ini" bilang 3. Sheet Antrian isinya 9 nama buat 6 orang, karena satu orang bisa muncul di dua grup. Prospek yang belum pernah disapa kebaca "follow-up" dan "telat sejak (tanggal disimpan)". Orang yang diem 20 hari muncul di Perlu ditindak sebagai "Follow-up · Telat 18 hari", padahal di Percakapan dia "siap dibuang". | Owner ga bisa percaya angka mana pun. "Telat" buat orang yang belum pernah dikirimi bikin panik. | Satu fungsi antrian dipakai semua layar (Beranda, HuntBar, push, Journey, badge). Pisahin "belum disapa" dari "follow-up". Grup di sheet Antrian jangan tumpang tindih. Yang drop-ready keluar dari antrian follow-up. | tinggi |
| 5 | Hunting → Percakapan | Jadiin lead dari chat | Thread ga punya tombol jadi lead / Kasih data. Caranya: tutup thread → tab Journey → cari orangnya → buka baris → "Kasih data →". | Langkah paling penting di siklus ini butuh pindah tab dan nyari lagi. Ini dikerjain tiap hari. | Tambah "Kasih data →" di baris hasil thread, buka sheet yang sama dengan Journey. | tinggi |
| 6 | Beranda → Perlu ditindak | Tap kartu Hunting / Penawaran / Invoice | Kartu Hunting buka Hunting → Kirim dengan Target kosong. Kartu Penawaran/Invoice cuma buka tabnya. Orangnya ga kebuka. | Tiap kartu = cari ulang manual. Antrian yang mestinya "geser-geser selesai" jadi lambat. | `open` bawa id: Hunting buka thread orang itu, Penawaran/Invoice scroll ke dokumennya dan buka. | sedang |
| 7 | Beranda (Jualan) | Judul vs daftar | Akun besar: judul "153 hal perlu ditindak hari ini", di bawahnya "Perlu ditindak 168". | Dua angka beda dengan kata yang sama di satu layar. | Judul dan section pakai angka yang sama. Atau section ditulis "168 (15 dalam 3 hari)". | sedang |
| 8 | Hunting | Siap dibuang | "Siap dibuang" ada di 3 tempat: filter Percakapan, grup di sheet Antrian, filter Journey. Tombol Buang cuma ada di Journey. Tap nama di grup "Siap dibuang" di sheet Antrian buka thread, dan thread ga punya Buang. | Jalan buntu buat tugas yang baru dibikin di PR #70. | Tambah "🗑 Buang" di thread kalau `dropReady`. Tambah "Buang semua" di filter Percakapan. | sedang |
| 9 | Hunting → Antrian | Grup "Belum respon" | Isinya orang yang lagi diparkir "Tidak terhubung" (udah 3× kirim) dan orang yang baru dikirimi tadi pagi. Thread orang yang diparkir nyaranin "● Follow-up" dan composer-nya aktif. | Ngajak kirim pesan ke-4 ke orang yang strateginya bilang istirahat 60 hari. Ngajak dobel kirim ke yang baru disapa. | "Belum respon" = status `belum` aja. `tidak` masuk "Parkir" dan di thread ada catatan "diparkir s.d. …". | sedang |
| 10 | Percakapan → thread | Baca dan bales | Thread kebuka di pesan paling lama. Balasan terbaru ketutup footer. Area chat cuma ±40% sheet di phone. Habis Copy/Kirim, teks tetap di kotak dan tombol tetap aktif, jadi tap kedua kecatat dua kali. | Harus scroll dulu buat liat dia bilang apa. Gampang kecatat dobel. | Scroll ke bawah waktu buka dan habis kirim. Kosongin teks habis kecatat. Chip hasil dan tahap bisa dilipat. | sedang |
| 11 | Phone layout | Tab Hunting, tab Tim, kolom Target | Tab "Percakap…" kepotong dan badge angkanya ga keliatan. Sub-tab Tim jadi "Dashb… Guild Repor… Log ak… Outre… Reject…". Di Kirim, kolom Target menyempit ±110px begitu ada isi, cuma kebaca "@kopi". | Badge follow-up ga keliatan. Tab Tim ga kebaca. Target salah ga ketahuan. | Tab Hunting: label pendek ("Chat") atau badge di luar teks yang dipotong. Tim: scroll horizontal (kayak Jualan di phone) atau 2 baris. Target: tombol Antrian/Tempel pindah ke baris sendiri di bawah 480px. | sedang |
| 12 | Guild | Target bulan & banner | Progress target dan "deal lunas" di banner Guild cuma ngitung `guilds/{g}/deals` ("+ Chat masuk"). Jualan di workspace guild (lead → penawaran → invoice lunas) ga gerakin target. Pipeline Guild tulis "0 Lead" padahal Jualan → Leads guild ada isinya. | Leader liat tim "ga jalan" padahal invoice udah lunas. Ada dua pipeline yang angkanya beda. | `teamMonth` ikut baca invoice/quote di workspace guild. Atau Pipeline Guild nulis jelas kalau dia cuma ngitung Report Klien. | sedang |
| 13 | Masuk / gate undangan | Ditolak atau dicabut | Layar tertutup bilang "Bisa minta lagi besok", tapi form "Minta akses" ga pernah muncul lagi (besoknya juga). Landing bilang "Mulai gratis / Coba gratis", tapi app invite-only. Form email + password masih tampil, padahal login email dimatiin selama invite-only (komentar `app/login/page.tsx:41`). Error-nya baru keluar setelah submit. Kode: `app/dashboard/page.tsx:51, 67-85`; landing `app/page.tsx:164, 194, 270, 281`. | Orang luar mentok. Ekspektasi "gratis" kebentur "masih tertutup". | Tampilin form lagi kalau `refused` udah lewat 24 jam atau `revoked`. CTA landing: "Minta akses". Sembunyiin form email selama ditutup. | sedang |
| 14 | Hunting → Leads | Isi lead hasil Kasih data | Kategori selalu "F&B". Nilai 0 padahal post bilang "budget 2 jt". Lokasi kosong padahal post bilang Jakarta. Jadwal follow-up prospek (`nextAt`) ga kebawa ("Berikutnya: Belum dijadwalkan"). Ga ada link balik ke percakapan. Status Hot, tapi skor "Potensi rendah 30". | Data dari Hunting harus diketik ulang. Lead "Hot" kebaca lemah. | Bawa `context` (need/budget/where) ke field lead, `nextAt` ke `nextActionDate`, simpan `prospectId` dan kasih tombol "Buka percakapan". Kategori ikut kategori bisnis atau dikosongin. | sedang |
| 15 | Penawaran | Tandai ✗ Ditolak | Lead tetap Hot dan tetap muncul di follow-up. Ga masuk Rejection Log. Status "Lost" dipakai di hitungan (`inPlay`), tapi ga bisa dipilih di mana pun. | Pipeline isinya lead yang udah nolak. | Ditolak → tanya alasan, lead jadi Lost, tulis ke Rejection Log. Tambah "Lost" di pilihan status. | sedang |
| 16 | Hunting | DM hari ini / Dibales 7 hr | Tiap balasan di percakapan yang lagi jalan dicatat sebagai DM baru: "DM hari ini" naik, "Dibales 7 hr" turun (33% → 25% habis bales orang yang udah bales). | Rate template sama target harian ketipu. | DM ke orang `terhubung` jangan dihitung ke target dan rate intro. Atau pisahin "intro" sama "balasan". | rendah |
| 17 | Phone layout | Tombol chat melayang | Nutupin angka "Nilai pipeline" di Beranda dan pojok kartu Penawaran dan Log aktivitas. | Angka penting ketutup waktu layar pertama kebuka. | Kasih `padding-bottom` di konten utama setinggi tombol, atau tombolnya mengecil waktu scroll. | rendah |
| 18 | Penawaran | Kirim WA dari draft | Tap langsung nandain "Terkirim" (`components/Quotes.tsx:129-132`) walaupun WhatsApp ditutup tanpa ngirim. | Tanda "terkirim" bisa bohong. Hitungan "nunggu jawaban" mulai dari hari yang salah. | Tampilin toast "Udah kekirim? Ya / Belum" pas balik ke app, atau kasih Batal kayak di Hunting. | rendah |
| 19 | Hunting → thread | Template per tahap | Template bawaan cuma ada buat Intro dan Follow-up (Gali/Penawaran/Closing/ETB = 0). Buat orang yang udah bales, tahap yang disaranin (Closing) kosong: "Belum ada template buat tahap ini", dan chip tahapnya ketutup di kanan. | Pas lagi panas-panasnya, malah harus ngetik dari nol. | Kasih 1 template bawaan per tahap. Scroll chip tahap ke yang disaranin (kayak Balas cepat). | rendah |

---

## Catatan per temuan tinggi

### 1. "Jangan hubungi" sekali tap menghapus riwayat dan angka tim

- Repro: Percakapan → buka @parkir_tiga (3 DM) → geser chip → 🚫 Jangan hubungi. Ga ada sheet konfirmasi. Thread langsung hilang, karena prospek `closed` ga dimuat lagi.
- Dashboard tim sebelum/sesudah: DM terkirim 7 → 4, Prospek baru 5 → 4, Dibales 14% → 25%. Log aktivitas: DM 9, 14, 18 Okt ke orang itu hilang. Yang sisa cuma "Minta ga dihubungi lagi. Riwayat percakapan dihapus."
- Screenshot: `11-thread-parkir-sebelum-dnc.png`, `12-sesudah-dnc-thread-hilang.png`, `10-dashboard-tim-sebelum-dnc.png`, `13-dashboard-tim-sesudah-dnc.png`, `21-log-aktivitas-sesudah-dnc.png`.
- Kode: tombol `components/ProspectThread.tsx:114`. Riwayat diganti di `lib/prospects.ts:363` (`dncPatch`). Thread hilang karena `lib/prospectStore.ts:43` (`closed == false`) dan `components/Hunting.tsx:519-520`. DM yang punya `prospectId` di-skip di `lib/activity.ts:97`, jadi begitu riwayat hilang, DM-nya ga kehitung di mana pun. "Hapus journey" (`ProspectList.tsx:329`) juga kena efek yang sama.

### 2. Bales orang yang udah bales = balik jadi "Intro terkirim"

- Repro: @tanya_harga (bales "pricelist-nya berapa?", Pikir-pikir) → thread → tulis jawaban → Copy. Header jadi "Threads · Intro terkirim". Filter Dibales 2 → 1. Journey: pindah ke "Nunggu", "percobaan 1/3 · follow-up 25 Okt".
- Screenshot: `07-thread-sebelum-balas.png`, `08-thread-sesudah-balas-intro-terkirim.png`, `09-journey-percobaan-1-3.png`.
- Kode: `sentPatch` set `contact: "intro"` dan `attempts` mulai lagi dari 1 (`lib/prospects.ts:284-287`). Filter Dibales `components/Conversations.tsx:37`, grup lanjut `lib/prospects.ts:200`, label `lib/prospects.ts:218`, tahap `lib/templates.ts:41`.

### 3. Lead dobel lewat Log DM habis "Kasih data"

- Repro: lanjutan #2 → Journey → @tanya_harga → Kasih data → isi WA → Simpan jadi Lead. Buka Percakapan → Log kiriman: DM terakhir ke dia ditulis "✅ Tertarik" dengan tombol **Jadiin Lead →**.
- Screenshot: `15-log-dm-jadiin-lead-dobel.png`, `14-lead-dari-hunting.png`.
- Kode: `convert()` manggil `syncHunt` tanpa `leadId` (`components/ProspectList.tsx:156`, `lib/prospectStore.ts:207-212`). Tombol muncul kalau `status === "Tertarik" && !h.leadId` (`components/Hunting.tsx:718`). `makeLead` ga ngecek `p.leadId` dan ga set ETB (`components/Hunting.tsx:410-421`). Bandingin `ProspectList.tsx:142-165`.

### 4. Angka antrian beda di tiap layar

- Akun 6 prospek: Beranda "4 prospek di antrian", Journey "Antrian 4", badge/filter Percakapan 3. Sheet Antrian: @baru_tadi ada di "Follow-up hari ini" dan "Baru, belum disapa". @tanya_harga dan @tertarik_lama ada di "Follow-up hari ini" dan "Dibales, lanjut". Perlu ditindak: @diem_20 "Follow-up · Telat 18 hari", di Percakapan "siap dibuang".
- Screenshot: `01-beranda-antrian-4.png`, `04-journey-antrian-4.png`, `05-percakapan-followup-3.png`, `03-antrian-grup-dobel.png`.
- Kode: Beranda/HuntBar/Perlu ditindak pakai `queue()` = `isDue` (`components/SalesTracker.tsx:718-723, 895, 975`; `lib/prospects.ts:206-208`). Journey "Antrian" = `isDue` (`components/ProspectList.tsx:97`). Badge tab = `queueGroup("due")` tanpa drop-ready (`components/Hunting.tsx:506`). "Baru" jadi due di hari disimpan (`lib/prospects.ts:116`), jadi label "follow-up" / "telat sejak" (`components/Conversations.tsx:80`, `components/ProspectList.tsx:281`). Grup tumpang tindih di `lib/prospects.ts:197-201`.

### 5. Jadi lead ga bisa dari Percakapan

- Isi thread: Dia bales, Tertarik, Nolak, Catatan, Jangan hubungi, Tutup, Copy, Copy & DM. Ga ada Kasih data.
- Screenshot: `07-thread-sebelum-balas.png`.
- Kode: baris hasil di `components/ProspectThread.tsx:109-115`. Sheet convert cuma ada di `components/ProspectList.tsx:337, 390-410`.

---

## Desktop (1280×900)

21/21 lulus. Tab Hunting, Target, dan sub-tab Tim kebaca penuh di desktop, jadi temuan 11 khusus phone. Temuan lain ada di logika, jadi kejadian juga di desktop. Contohnya flow "hunting" di desktop: begitu @kopiflow disimpan (belum dikirimi apa-apa), tab langsung jadi "Percakapan 1" alias "perlu follow-up" (temuan 4).

## Yang dicek dan aman

- Penawaran → Disetujui nutup lead jadi Closed dengan nilai yang disepakati. Invoice DP dari penawaran bawa item dan termin. Pembayaran nerbitin draft.
- Undangan guild (`/join`) jalan tanpa gate. Login → balik ke undangan → Gabung.
- Lokasi lead (alamat → titik → geser di peta) dan Peta 3D di akun 200 lead: kebuka di bawah 8 detik, pin buka kartu dengan Rute.
- Semua dialog di flow punya ×/Tutup dan nutup pakai Escape (flow "dialogs").
- Ga ada `alert/confirm/prompt` browser di semua flow.

---

## Status (23 Okt)

Dibenerin di branch `cycle-fixes`:

| # | Yang berubah |
|---|---|
| 1 | Thread → Jangan hubungi nanya dulu ("Hapus isi percakapan…?" + Batal). Isi pesan tetap dihapus, tapi jejak kirim/bales (waktu + jenis, tanpa kata-kata) tetap ada, jadi angka DM dan Dibales ga turun. |
| 2 | Kirim ke orang yang udah bales ga ngubah `contact`/`attempts`; cuma `lastSentAt` dan riwayat. "Nolak" yang udah lewat parkir tetap mulai ronde baru. |
| 3 | Satu orang satu lead: `syncHunt` nulis `leadId` ke DM log; Jadiin Lead ga muncul kalau orangnya udah lead; Kasih data ngisi lead yang udah ada, bukan bikin baru (`components/ConvertSheet.tsx`, dipakai Journey dan thread). |
| 4 | Satu arti per kata: antrian = belum disapa + follow-up jatuh tempo, tanpa yang siap dibuang (`inQueue`), dipakai Beranda, HuntBar, Perlu ditindak, Journey. Badge Percakapan dan "Follow-up hari ini" = follow-up aja (`followUpDue`), yang belum disapa ga ikut. Grup di sheet Antrian ga tumpang tindih. |
| 5 | Thread punya "Kasih data →". |
| 7 | Seksi Perlu ditindak: "N hari ini · M nanti", sama dengan judul. |
| 8 | Thread punya "🗑 Buang" kalau udah siap dibuang. ("Buang semua" di Percakapan belum.) |
| 9 | "Belum respon" ga lagi isi yang diparkir atau yang baru dikirimi hari ini. |
| 10 | Thread kebuka di pesan terbaru; habis kecatat, kotak pesan kosong dan tombol mati selama nyimpen, jadi ga dobel. |
| 18 | Udah beres di #71 (lembar Kirim lewat WhatsApp + Batal). |

Masih terbuka: 6, 11, 12, 13, 14, 15, 16, 17, 19.

