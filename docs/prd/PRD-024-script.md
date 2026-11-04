# PRD-024 — Script sebagai satu sistem

- **Status:** audit dan usulan arsitektur, 5 Nov 2026. Belum ada kode yang diubah. Nunggu keputusan owner (§10).
- **Peran dokumen ini:** satu peta buat semua yang namanya script. Perbaikan berikutnya mengikuti dokumen ini, bukan per tombol.
- **Terkait:** PRD-009 (template per tahap), PRD-019, PRD-022 (Pesan, Script Management), `GLOSSARY.md` (Script, Tahap, Brand, Workflow), MCP PRD (`docs/mcp/`, template hardcoded = WF-003).

## 1. Current state: cara kerja sekarang

Ada **tiga sistem script** yang ga saling kenal:

| Sistem | Disimpan di | Dipakai di | Isinya |
|---|---|---|---|
| Script pesan | Firestore `pitchTemplates` per ruang kerja | Pesan (lead), deck Hunting, Kampanye, thread prospek, Quick Pitch, Script Management | Judul, isi dengan `{placeholder}`, tahap, tipe bisnis, workflow, brand, default, arsip |
| Script keberatan | Hardcoded `lib/salespal-data.ts` (`scriptMatrix`) | Script Library (Belajar), bagian Tipe customer di lembar kerja lead | 4 tipe customer × 6 keberatan × nada santai/formal, `{nama}` saja |
| Template MCP | Hardcoded di `salespal-mcp` | Draft dari agent | Terpisah total (temuan QA WF-003) |

Script pesan punya **tiga editor**: editor kartu di deck Hunting (`TemplateBoard`), Script Management (`ScriptManager`), dan editor Quick Pitch (`QuickPitch`, dengan tipe `Template` sendiri dan contoh bawaan sendiri).

Tidak ada pembuatan script pakai AI. Yang ada AI cuma baca gambar (`/api/scan`), dan itu dimatikan.

## 2. Existing architecture

**Data, `pitchTemplates/{id}`:** `title`, `body`, `stage?`, `categories?`, `workflow?` (`leads | hunting | semua`), `brand?`, `isDefault?`, `archived?`. Script lama tanpa field baru dibaca saat dipakai: `stageOf` dari judul, `workflowOf` dari isi (menyebut DM atau post berarti Hunting), `brandOf` dari nama brand di judul atau isi. Datanya ga ditulis ulang.

**Placeholder, `lib/templates.ts` `VARIABLES`:** `{nama}`, `{kebutuhan}`, `{waktu}`, `{lokasi}`, `{post}`, `{bisnis}`. `fillTemplate` mengisi, membuang `[bagian opsional]` kalau isinya kosong, dan memakai `FALLBACK` (`nama` → "kak", `kebutuhan` → "kebutuhannya").

**Sumber isi placeholder, beda tiap tempat:**

| Tempat | `nama` | `kebutuhan` | `waktu`, `lokasi`, `post` | `bisnis` |
|---|---|---|---|---|
| Pesan (lead) | kontak atau nama lead | `profile.need` | ga diisi | `settings/business` |
| Hunting, Kampanye (`dataFor`) | handle prospek | konteks post, **lalu default ruang kerja** | konteks post atau default | `settings/business` |
| Quick Pitch | yang diketik | ga diisi | ga diisi | ga diisi |
| MCP | — | — | — | nama lead (salah, P1) |

**Pemilihan script:** `rankScripts` (`lib/scriptPick.ts`) memberi skor berdasarkan tag tipe bisnis, kata khas tipe bisnis, dan kata yang sama dengan kebutuhan lead. Tahap dipilih dari posisi lead (`leadStage`) atau prospek (`stageFor`).

**Navigasi:** Script Management adalah satu `Sheet` penuh. Daftar dan editor ada di state yang sama (`editing`). Hunting menulis langkah sendiri ke history (`spPage: "kirim"`, `leave()`, event `sp:back`). Dialog lain lewat `ModalA11y`.

## 3. Product gaps

1. **Brand ≠ nama bisnis.** Script bisa diberi brand Visufavor atau UNTMD Sports, tapi `{bisnis}` selalu diisi satu nama dari `settings/business` ruang kerja. Script UNTMD terkirim dengan nama Visufavor.
2. **Channel ga disimpan.** WhatsApp, DM Instagram, Threads, atau email cuma ditebak dari platform target, bukan bagian dari script.
3. **Nada cuma ada di script keberatan,** ga ada di script pesan.
4. **Konteks bisnis** (Restaurant, Padel, Gym) ga ada. Yang ada cuma tipe bisnis besar (`CATEGORIES`, F&B, dll).
5. **Status cuma arsip.** Belum ada draft.
6. **Tiga editor dengan aturan beda.** Quick Pitch ga kenal brand, workflow, atau tipe bisnis. Editor kartu Hunting ga nampilin semua field Script Management.
7. **Script keberatan ga bisa diedit atau disimpan,** dan ga ikut dicari di Script Management.
8. **Placeholder bisa berbohong.** `kebutuhan` jatuh ke default ruang kerja, jadi pesan ke orang yang belum bilang butuh apa tetap berbunyi seolah dia butuh sesuatu. Fallback "kebutuhannya" bikin kalimat janggal.
9. **Back di editor ngebuang ketikan.** Back atau tap scrim menutup seluruh Script Management, termasuk editor yang belum disimpan, tanpa tanya. Mundur dari editor ke daftar belum ada. Kalau editornya dibuka langsung dari menu Hunting (`startNew`), Batal juga menutup semuanya.
10. **Pratinjau pakai data contoh** (Rina, Sentul), bukan lead yang lagi dikerjain.
11. **Ga ada AI generate.** Ini memang belum dibangun, bukan rusak. Budget Rp 0.

## 4. Root causes

| Masalah | Jenis | Akar |
|---|---|---|
| Brand vs `{bisnis}` (gap 1) | Data model | Brand cuma label di script, bukan entitas yang punya nama, sapaan, dan kontak |
| Channel, nada, konteks (2–4) | Product semantics | Script didefinisikan sebagai teks + tahap. Konteks dianggap isi, bukan identitas |
| Tiga editor (6) | Arsitektur komponen | Tiap fitur bikin editor sendiri sebelum Script Management ada |
| Script keberatan terpisah (7) | Data model | Dataset bawaan yang ga pernah dipindah ke koleksi |
| Placeholder bohong (8) | Product semantics | Satu kata (`kebutuhan`) dipakai buat dua arti: yang dia bilang dan default kita |
| Back ngebuang ketikan (9) | State management | Daftar dan editor dalam satu dialog. Back = tutup dialog. Penjaga perubahan (`useDiscard`) belum dipasang |
| Pratinjau contoh (10) | UI | Editor ga tahu dari mana dia dibuka |

## 5. Proposed Script domain model

Satu koleksi, `pitchTemplates`. Ga ada koleksi baru. Field baru opsional, dan script lama tetap dibaca seperti sekarang.

| Field | Tipe | Sekarang | Usulan |
|---|---|---|---|
| `title` | string | ada | Tetap. Kalau kosong, dibentuk dari konteks: "Intro · WhatsApp · Restaurant" |
| `body` | string | ada | Tetap |
| `stage` | Tahap | ada | Tetap (Intro, Follow-up, Gali kebutuhan, Penawaran, Closing, ETB) |
| `brand` | SiteId | ada | Tetap. **Plus** entitas brand (lihat bawah) |
| `workflow` | leads/hunting/semua | ada | Tetap |
| `channel` | `wa | ig | threads | email | any` | — | **Baru.** Default `any` |
| `categories` | tipe bisnis[] | ada | Tetap (industri) |
| `contexts` | string[] | — | **Baru, opsional.** Konteks bisnis bebas: restaurant, padel, gym |
| `tone` | `santai | formal | any` | — | **Baru.** Default `any`. Nilainya sama dengan script keberatan |
| `objection` | id keberatan | — | **Baru, opsional.** Buat script keberatan yang dipindah ke koleksi |
| `status` | `active | draft | archived` | `archived` boolean | **Ganti bertahap.** `archived: true` dibaca sebagai archived |
| `isDefault` | boolean | ada | Tetap, satu per tahap |

**Brand jadi entitas kecil:** `settings/brands` per ruang kerja, isinya `{ [siteId]: { name, greeting? } }`. Isian awalnya dari `settings/business` yang sekarang. `{bisnis}` diisi dari brand script itu, dan baru jatuh ke `settings/business` kalau brand-nya kosong.

**Placeholder dengan sumber yang tegas:**

| Placeholder | Sumber satu-satunya | Kalau kosong |
|---|---|---|
| `{nama}` | Lead: kontak, lalu nama. Prospek: nama, lalu handle | Sapaan netral, tanpa nama |
| `{kebutuhan}` | Yang **dia** bilang: `profile.need` lead, atau konteks post prospek | Bagian `[...]` hilang. Ga pernah pakai default ruang kerja |
| `{tawaran}` | **Baru.** Default ruang kerja, yang dulu masuk ke `kebutuhan` | Bagian hilang |
| `{waktu}`, `{lokasi}`, `{post}` | Konteks prospek, lalu field lead kalau ada | Bagian hilang |
| `{bisnis}` | Brand script, lalu `settings/business` | Bagian hilang |

Script lama yang memakai `{kebutuhan}` sebagai tawaran ditandai di Script Management ("isi ini butuh kebutuhan orangnya"), bukan diubah diam-diam.

## 6. Proposed Script feature map

| Bagian | Komponen | Tanggung jawab |
|---|---|---|
| Domain | `lib/templates.ts`, `lib/scriptPick.ts` | Satu tipe `Script`, pembacaan field lama, `fillTemplate`, sumber placeholder (`fillFor(lead | prospect, script, brands)`), skor pemilihan |
| Kelola | `ScriptManager` | Satu-satunya tempat bikin, edit, duplikat, arsip, cari, dan filter. Editornya diekstrak jadi `ScriptEditor` yang dipakai di mana pun |
| Pakai | `ChatPicker` (Pesan) | Satu-satunya tempat memakai script buat satu orang: pilih, isi, edit, kirim, konfirmasi. Hunting dan Quick Pitch membuka panel yang sama |
| Belajar | `ScriptLibrary` | Membaca script keberatan dari koleksi, `objection` terisi, bukan dari file |
| Massal | `Campaigns` | Satu script ke banyak prospek, isi lewat `fillFor` |
| Agent | `salespal-mcp` | Membaca `pitchTemplates` lewat `fillFor` yang sama, ga punya template sendiri |

Yang hilang: editor di `TemplateBoard` dan editor serta contoh bawaan di `QuickPitch`. Keduanya membuka `ScriptEditor`.

## 7. Proposed user workflow

**Bikin atau ubah:**

1. Buka Script pesan (dari Hunting, dari Pesan lewat Kelola, atau dari Quick Pitch).
2. Isi konteks dulu: brand, tahap, channel, workflow, tipe bisnis, konteks, nada. Judul terisi sendiri dari konteks, tapi bisa diganti.
3. Tulis isi. Tombol sisipkan cuma nampilin placeholder yang sumbernya ada buat workflow itu.
4. Pratinjau pakai lead atau prospek yang sedang dibuka. Kalau dibuka dari daftar, pakai data contoh yang jelas ditandai "contoh".
5. Simpan, atau simpan sebagai draft. Status draft ga muncul di Pesan.

**Pakai buat satu orang (sudah jalan untuk lead, PRD-022):** Pesan → script yang cocok sudah masuk → edit → kirim → konfirmasi Udah → orang berikutnya.

**Navigasi:**

| Aksi | Hasil |
|---|---|
| Back atau Batal di editor yang dibuka dari daftar | Balik ke daftar, posisi scroll tetap |
| Back atau Batal di editor yang dibuka langsung | Balik ke tempat asal (Hunting, Pesan) |
| Ada perubahan yang belum disimpan | Ditanya dulu: Buang perubahan? (`useDiscard`) |
| Simpan | Balik ke asal dengan script itu terpilih |
| Tutup ✕ | Keluar dari Script pesan, dengan pertanyaan yang sama kalau ada perubahan |

## 8. Integration map

| Dengan | Hubungan |
|---|---|
| Leads | Pesan memilih tahap dari posisi lead, tipe bisnis dari kategori lead, dan placeholder dari data lead. Memakai script ga mengubah lead, kecuali konfirmasi kirim yang menulis kontak dan Outreach |
| Hunting | Deck Hunting membaca script `workflow` hunting dan semua. Tahap dari prospek, placeholder dari konteks post |
| Brand | Script menyimpan brand. Brand menentukan `{bisnis}` dan filter brand di Pesan (diingat per HP) |
| Outreach | Baris Outreach dan hunt menyimpan id dan judul script, supaya "Pesan mana yang works" dihitung per script |
| Agent MCP | Membaca koleksi yang sama dan `fillFor` yang sama. Approval terikat ke teks yang sudah diisi |

## 9. Product invariants

1. Satu koleksi script per ruang kerja, satu tipe data, satu editor.
2. Tiap script punya tahap, brand (boleh "semua"), workflow, dan channel. Script lama dibaca, bukan ditulis ulang.
3. Placeholder cuma diisi dari sumbernya sendiri. Kosong berarti bagian itu hilang, bukan diisi tebakan.
4. Ga ada yang mengarang kebutuhan, budget, atau minat orang, baik app, AI, maupun agent.
5. Mengedit satu script ga mengubah script lain. Duplikat membuat id baru tanpa status default.
6. Memakai script ga mengubah lead. Yang mengubah cuma konfirmasi kirim.
7. Back mundur satu langkah, dan ga pernah membuang ketikan tanpa tanya.
8. Script yang disimpan selalu bisa ditemukan di Script Management, termasuk yang diarsipkan.
9. Script keberatan dan template agent berasal dari koleksi yang sama.
10. Script berstatus draft atau archived ga pernah ditawarkan di Pesan, Hunting, atau agent.

## 10. Implementation roadmap

| Urutan | Isi | Bergantung pada | Ukuran |
|---|---|---|---|
| 1 | Navigasi editor: daftar ↔ editor jadi dua langkah, `useDiscard`, balik ke asal | — | Kecil |
| 2 | `fillFor`: satu sumber placeholder, `{kebutuhan}` ga jatuh ke default, `{tawaran}` baru | — | Kecil |
| 3 | Entitas brand (`settings/brands`) dan `{bisnis}` per brand. Juga P1 MCP | 2 | Sedang |
| 4 | Satu editor: ekstrak `ScriptEditor`, buang editor `TemplateBoard` dan `QuickPitch` | 1 | Sedang |
| 5 | Field `channel`, `tone`, `contexts`, `status`, dengan filter dan judul otomatis | 4 | Sedang |
| 6 | Script keberatan pindah ke koleksi (isian awal sekali, bisa diedit) | 5 | Sedang |
| 7 | Pratinjau pakai lead atau prospek yang sedang dibuka | 4 | Kecil |
| 8 | Outreach dan hunt menyimpan id script | — | Kecil |
| 9 | AI generate | Budget, keputusan owner | Ditunda |

**Keputusan yang perlu dari owner:**

1. Brand jadi entitas kecil (`settings/brands`) dengan nama per brand: setuju?
2. `{kebutuhan}` dibagi dua jadi `{kebutuhan}` (yang dia bilang) dan `{tawaran}` (default kita): setuju?
3. Script keberatan dipindah ke koleksi dan bisa diedit, atau tetap bawaan yang cuma bisa dibaca?
4. AI generate ditunda sampai ada budget: setuju?
