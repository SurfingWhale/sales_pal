# PRD-026 — Filter pills: pil yang nyatu jadi satu bar

- **Status:** dibangun, nunggu review. Dipakai di satu tempat dulu: Log aktivitas.
- **Terkait:** PRD-009 (Log aktivitas), PRD-010 (standar native, K1–K10), `docs/standards/design.md`.

## 1. Apa ini

Brief owner: pil filter yang rasanya kayak Spotify, tapi multi-pilih. Bukan redesign, cuma satu interaksi.

1. **Default:** pil netral sejajar, ga ada yang kepilih, ga ada ×.
2. **Pilih satu:** pil berubah bentuk dan warna, pindah ke depan. × kebuka dari tepi pil itu, jadi bar.
3. **Pilih lagi:** pil kedua nyambung ke ujung bar yang sama. Yang pertama tetap kepilih, pil lain tetap kelihatan.
4. **Lepas satu:** pil balik ke tempat aslinya, jadi netral lagi. Yang lain tetap aktif, barnya merapat.
5. **×:** semua lepas sekaligus, × nutup masuk ke pil, fokus pindah ke pil pertama.

Komponennya `components/FilterPills.tsx` (bisa dipakai ulang), gayanya di `app/globals.css` bagian "Filter pills".

## 2. Dipakai di mana, dan kenapa di situ

Brief butuh multi-pilih beneran, dan pil lain harus tetap kelihatan. Di app ini cuma Log aktivitas ("Jenis kerjaan", state `kinds`) yang filternya memang begitu. Prospek, Leads, dan Invoice semuanya pilih-satu. Ikut kebawa ke Dashboard tim karena di sana pakai `ActivityLog` yang sama.

## 3. Cara kerjanya

- **Gerak:** FLIP manual pakai Web Animations API. Posisi awal dibaca pas tap, posisi akhir dibaca setelah React selesai, lalu selisihnya dimainkan. Tap di tengah gerak mulai dari posisi yang sedang terlihat, dan ga ada transform yang nyangkut.
- **Durasi:** maksimal 220 ms (K9). Pegasnya cuma overshoot kecil di `cubic-bezier`, bukan solver.
- **Reduce Motion:** dicek di JS, karena aturan CSS global ga nyampe ke `el.animate()`. Statusnya tetap berubah, ga ada yang gerak.
- **Target sentuh:** digambar 32 px di dalam target 44 px, di semua layar. Isian warnanya `span` sendiri, jadi tombolnya tetap target dan bebas digeser.
- **Baris di HP:** satu baris, geser ke samping, nempel tepi layar. Kalau baris lagi kegeser, geseran scroll jadi bagian dari gerak yang sama. Swipe vertikal dari baris tetap nge-scroll halaman.
- **Aksesibilitas:** `button aria-pressed` di `role="group"`, label tetap. × tombol saudara dengan `aria-label` sendiri, bukan di dalam pil. Urutan Tab = urutan DOM = urutan di layar, jadi urutan DOM yang diubah, bukan CSS `order`. Fokus dibalikin setelah React mindahin pil. Jumlah hasil lewat `role="status"` yang selalu terpasang.
- **Warna:** biru brand `#005eb0` dengan label putih (6,51:1). Di mode gelap isian itu cuma 2,95:1 lawan `--app-bg`, jadi tepi bar pakai `--brand-text` (8,85:1). Di mode terang `--brand-text` sama dengan isiannya, jadi aturannya satu buat dua tema.

## 4. Putusan library gerak

Dinilai pakai K1–K10 (lihat `docs/standards/native.md`), prinsipnya diambil, kodenya ditulis ulang di stack sendiri.

| Yang dinilai | Putusan | Alasan |
|---|---|---|
| Framer Motion (`layout`, `layoutId`, `AnimatePresence`) | **ga dipasang, konsepnya diambil** | Runtime baru cuma buat satu interaksi, dan budget Rp 0. `layout` jadi FLIP manual, `layoutId` jadi kunci React yang stabil di barisan datar, `AnimatePresence` jadi × yang tetap terpasang dan keluar lewat animasi |
| View Transitions API | **ga dipakai** | Safari belum punya `Element.startViewTransition` dan `view-transition-group`, chip keluar dari clip baris, halaman beku selama transisi |
| `linear()` buat pegas | **ga dipakai** | Harus dicek dukungannya dulu di iOS lama; `cubic-bezier` overshoot cukup buat 220 ms |

## 5. Beda dari brief

| Brief | Yang dibangun | Kenapa |
|---|---|---|
| Warna hijau | Biru brand | Brief juga bilang jangan ubah identitas visual, identitas yang menang |
| Pakai Framer Motion / shared layout | FLIP manual | §4 |
| Pegas | Overshoot `cubic-bezier`, maksimal 220 ms | K9 |
| Ga nyebut soal "Semua" | Chip "Semua" **dihapus** | Keadaan default brief = ga ada yang kepilih, dan × udah jadi jalan keluarnya. Total pindah ke baris status ("15 aktivitas", "4 dari 15 aktivitas") |
| Konsep "content transition" | Crossfade 180 ms di daftar aja, heat map dan angka langsung ganti | Cukup buat ngasih tau isinya berubah, tanpa bikin satu layar gerak semua |

Beda dari Spotify: di klip Ripplix (Apple Watch) × berdiri sendiri dan cuma satu filter yang kelihatan aktif. "Nyatu jadi satu bar" tafsiran kita atas brief, bukan tiruan.

## 6. Referensi yang dicek

**Resmi Spotify:**
- Newsroom 5 Sep 2025: Smart Filters di Your Library. Ga nyebut pil, multi-pilih, atau gerak.
- Support "Sort and filter": filter bisa digabung di desktop, pilihannya disimpan. Ga nyebut cara hapus atau ×.

**Bukan terbitan Spotify, jangan dianggap resmi:**
- Blog Figma soal Encore: struktur design system (fondasi + subsistem per platform), tombol disatukan lewat variabel. Ga bahas chip atau gerak.
- Ripplix "Smartwatch Filter Deck" dan "Filter Pill Tabs": kata Ripplix direkam dari aplikasi asli, dan ini paling deket sama brief. Halamannya ga nampilin entri ini kalau dibaca biasa; deskripsi diambil dari HTML mentah dan 12 frame per klip diambil dari videonya. Yang kelihatan cuma gambar diam: × bulat terpisah di kiri, pil hijau yang lebarnya ngikutin label. Durasi dan easing ga bisa dibaca dari situ.
- Andrea Carrasco: studi independen, nyatakan sendiri bukan karya Spotify. Chip ganti tampilan, bukan ganti label. Nilai radius dan durasi ga ditulis.
- `code.jiangshu.ai` (iOS dan web): rekonstruksi, nyatakan ga berafiliasi. Radius pil 500/9999, ease-out 0,25 dtk. Ga bahas gerak chip.
- Hudngo: konsep pribadi 2019, studi kasusnya masih "coming soon", jadi ga ada detail filter yang bisa dipakai.

## 7. Uji

Flow `filter pills: stack, merge into one bar, reverse, clear` di `tests/flows/flows.mjs`. Tap dihentikan di frame pertama buat mastiin ga ada pil yang loncat, termasuk tap di tengah gerak dan tap pas baris kegeser. Juga: tap ganda, 320 px, keempat pil kepilih, keyboard, Reduce Motion, mode gelap.

**Belum bisa dipastikan otomatis:**
- VoiceOver dan iPhone beneran. WebKit di sini cuma simulasi profil iPhone 12.
- Swipe vertikal di WebKit: driver-nya ga punya gestur sentuh, jadi di sana cuma `touch-action` yang dicek. Gestur beneran diuji di Chromium.
- Rasa geraknya sendiri. Yang diukur posisi dan durasi; "enak" atau enggak tetap harus owner yang coba.
