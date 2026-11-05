# PRD-023 — Script Intelligence: paham percakapan, pilih script, sesuaikan

- **Status:** Fase 1 dibangun (5 Nov 2026), berbasis aturan (`rules-v1`).
- **Asal:** spec owner "Context-Aware Sales Intelligence" (5 Nov) dan masukan owner: *"susah cocokin scrape thread dengan respons yang oke … suggestion based on informasi gathered yang ngasih context dan auto koreksi ke script yang ada biar relevan"*.
- **Prinsip:** SalesPal bukan cuma ngasih tahu apa yang harus diketik. Ia bantu penjual paham apa yang lagi terjadi, kenapa satu respons masuk akal, dan langkah berikutnya apa. Semua pesan dicek dan dikirim penjual sendiri.

## 1. Keputusan owner (5 Nov)

| # | Keputusan | Akibatnya |
|---|---|---|
| D1 | **Fase 1 tanpa AI** | Analisis, tahap, keberatan, teori, skor, dan penyesuaian pakai aturan yang tertulis, sehingga hasilnya sama untuk input yang sama dan bisa dicek. Rp 0 (PRD-022 §5). AI masuk di Fase 3 dengan kontrak API yang sama. |
| D2 | **Backend Python FastAPI** | `api/index.py`, dideploy Vercel sebagai Python Function di project yang sama. Tidak ada server kedua, jadi tetap Rp 0. Kodenya FastAPI murni, jadi bisa dipindah ke host sendiri. |
| D3 | **Riwayat analisis disimpan** | Koleksi `analyses`: hanya pemilik yang bisa membaca, dengan batas 90 hari dan tombol hapus (§5). |

Keputusan teknis yang diambil saat membangun (bisa diubah):
- Script dikirim **dari app** ke API di setiap analisis, karena app sudah memegang library-nya per ruang kerja. API tidak membaca Firestore dan tidak menyimpan salinan.
- Di guild, riwayat analisis **tidak** bisa dibaca Leader/Officer. Isinya chat prospek, jadi diperlakukan seperti catatan pribadi penjual.

## 2. Pipeline (`api/_intel/`)

| Tahap | File | Isinya |
|---|---|---|
| 1. Parsing | `parse.py` | Ekspor WhatsApp (format sama dengan `lib/waexport.ts`), "Nama: pesan", atau paragraf tanpa nama. Penjual dikenali dari nama yang diisi atau label orang pertama ("Aku", "Saya", "Me"). Kalau tidak jelas, statusnya **ambigu** dan app bertanya, bukan menebak. |
| 2. Pemahaman | `understand.py` | SPIN (situasi, masalah, dampak, hasil yang diharapkan), kebutuhan, tanda mau beli, 7 tipe keberatan, penolakan, pertanyaan yang belum dijawab, janji, kata ragu, dan nada. **Setiap temuan menyimpan nomor pesan dan kutipannya.** Fakta, tafsiran, dan yang belum diketahui dipisah. |
| 3. Tahap | `stage.py` | Intro, Follow-up, Discovery, Proposal, Objection handling, Negosiasi, Closing, Nurturing. Yang menentukan adalah bukti terbaru, jadi tahap bisa mundur. |
| 4. Teori | `frameworks.py` | Kerangka dipilih oleh aturan atas bukti (§3), lengkap dengan konsep, bukti, cara pakai, dan batasnya. |
| 5. Cocok-script | `match.py` | Skor berbobot (§4) dan **mismatch kritis**. |
| 6. Penyesuaian | `adjust.py` | Tujuan dan strategi script dipertahankan. Yang disesuaikan: pembuka, pengakuan keberatan (labeling), satu pertanyaan, dan ajakan. Setelah penolakan tidak ada tawaran. Harga atau slot **tidak pernah dikarang**: penjual diminta mengisinya (`required_edits`). Kalau tidak ada script yang cocok, dibuat respons baru yang ditandai jelas. |
| 7. Rekomendasi | `analyze.py` | Respons, alasan, script yang dipakai, teori, alternatif (script lain dan nada formal/santai), langkah berikutnya, keyakinan, dan batasan. |

## 3. Kapan teori dipakai (aturan, bukan hiasan)

| Kondisi di percakapan | Kerangka · konsep | Batas yang ditulis |
|---|---|---|
| Situasi atau masalah belum muncul | SPIN · Situation / Problem / Implication / Need-payoff question (yang pertama kurang) | Satu pertanyaan per pesan. Kalau mereka nanya harga, jawab dulu. |
| Kata ragu atau hipotetis ("mungkin", "tertarik sih") tanpa janji | The Mom Test · perilaku nyata | Kata ramah bukan tanda mau beli. |
| Ada masalah, tapi dampak atau tujuannya tidak disebut | Gap Selling · current → future state | Gap yang tidak disebut jangan dikarang. |
| Ada keberatan | Objections · kenali tipe, klarifikasi | Keberatan bukan undangan untuk membujuk. |
| Ada keberatan atau nada ragu | Never Split the Difference · labeling + calibrated question | Label yang dibuat-buat terbaca manipulatif. |
| Ragu setelah ditawari atau setelah ada tanda mau beli | The JOLT Effect · satu rekomendasi, batasi pilihan, kurangi risiko | Ragu ≠ tidak minat. Jangan berjanji yang tidak bisa ditepati. |
| Tidak dibalas | Fanatical Prospecting · disiplin follow-up | Setelah 3 kali tanpa balasan, berhenti 2 minggu. |
| Proposal, negosiasi, closing | Made to Stick · simple & concrete; Influence · social proof nyata | Tidak ada testimoni, kelangkaan, atau otoritas palsu. |
| Konteks cukup, belum ada keberatan | The Challenger Sale · teach & tailor (opsional) | Tidak dipaksakan ke setiap percakapan. |

Isinya parafrase konsep dari buku-buku di spec. Tidak ada kutipan buku.

## 4. Skor (heuristik awal, belum divalidasi)

| Dimensi | Bobot | Dibaca dari |
|---|---|---|
| Konteks | 30 | Tipe bisnis di percakapan vs tag atau kata di script, dan kata kebutuhan yang sama (kata yang ada di sebagian besar script tidak dihitung). |
| Tahap | 25 | Tahap script vs tahap percakapan (pas = 1, tetangga = 0,5). |
| Maksud prospek | 20 | Nanya harga, keberatan tertentu, tidak dibalas, menolak, siap, atau menjajaki, dicocokkan dengan isi script. |
| Tujuan pesan | 15 | Buka, follow-up, gali, kasih info, tangani keberatan, tutup, atau mundur. |
| Nada & kanal | 10 | Formal/santai dan WA/DM (script khusus Leads atau yang menyebut post Threads). |

- **Mismatch kritis** membuat script gugur apa pun skornya:
  - script ditandai untuk tipe bisnis lain;
  - script masih menawarkan setelah prospek menolak;
  - script langsung menawarkan saat keberatannya *sudah ada vendor / belum butuh / nanti / perlu izin*.
- **Ambang:** di bawah 55% tidak ada script yang direkomendasikan, dan app membuat respons baru.
- **JOLT:** script yang tidak membantu prospek memutuskan diganti satu rekomendasi.

## 5. Data & privasi

- **Endpoint:** `POST /api/script-intelligence/analyze`. Butuh login Firebase (`api/index.py` memverifikasi ID token). Chat maksimal 20.000 karakter dan 200 script. API tidak menyimpan apa pun.
- **Riwayat:** `users/{uid}/analyses` atau `guilds/{g}/analyses` (`lib/space.ts` OWNED). Field: `conversation`, `result`, `seller`, `createdAt`, `expiresAt` (≤ 90 hari), dan `ownerUid` di guild.
  - Rules: di guild hanya penjual pemiliknya yang bisa baca dan hapus, `expiresAt` ≤ `createdAt` + 90 hari, panjang chat ≤ 20.000. Ada 7 tes rules.
  - Disimpan hanya kalau "Simpan ke riwayat" menyala dan speaker sudah jelas.
  - Yang kedaluwarsa dihapus saat riwayat dibuka. Ada tombol hapus per item dan "Hapus semua".
  - **[cek owner]** Supaya penghapusan otomatis berjalan tanpa app dibuka, aktifkan TTL policy Firestore pada field `expiresAt` di Google Cloud Console.
- **Script baru:** "Simpan sebagai script baru" selalu membuat dokumen baru. Script lama tidak pernah ditimpa.

## 6. UI

Belajar → **Analisis Chat** (`components/ChatAnalysis.tsx`):
- **Input:** tempel chat, nama kamu di chat, nada, kanal, Simpan ke riwayat.
- **Ringkasan:** tahap dan alasannya, situasi, perhatian utama, yang belum diketahui.
- **Script:** nama, %, rincian skor per dimensi, yang kurang cocok, chip teori.
- **Balasan:** bisa diedit, dengan daftar *wajib kamu isi*, apa yang disesuaikan, Copy, Balikin saran, Analisis ulang, alternatif, langkah berikutnya, dan Simpan sebagai script baru.
- **Analisis lengkap (dilipat):** fakta dengan kutipan, kebutuhan, tanda mau beli, pertanyaan terbuka, keberatan, tafsiran, tiap teori (cara pakai, dasar, batas), semua skor script, dan batasan.
- **Riwayat:** buka lagi, hapus, hapus semua.

Bagian kecil dari ide yang sama juga sudah jalan di Hunting: **Saran** (`lib/scriptFit.ts`, kartu "Saran buat …" di `TemplateBoard`) menyesuaikan script ke post Threads yang di-scrape.

## 7. Fase

| Fase | Isi | Status |
|---|---|---|
| 1 | MVP aturan: tempel → analisis → tahap → cocok-script dengan skor dan alasan → penyesuaian → Copy. Riwayat dengan masa simpan. | ✅ 5 Nov |
| 2 | Metadata script: `scenario`, `objective`, `ctaType`, `tone`, `frameworks` (konsep spesifik), `contraindications`, `version` + riwayat versi; editor di Script Management. | Rencana |
| 3 | AI (setelah budget dibuka): analisis dan penulisan ulang lewat model dengan kunci di server, jatah bulanan, dan output terstruktur yang divalidasi. Skor aturan tetap terpisah dari penjelasan AI. | Menunggu keputusan budget dan penyedia |
| 4 | Evaluasi: feedback per saran (cocok/tidak), reply rate per script dari log Hunting. Tanpa klaim sebab-akibat sebelum sampelnya cukup. | Rencana |

## 8. Tes

- `tests/intel/test_engine.py` (pytest, 13 kasus), dijalankan di CI `native`. Isinya:
  - parsing WA dan speaker ambigu;
  - "sudah punya fotografer" → keberatan, diakui, ditanya, tanpa pitch;
  - pertanyaan harga → wajib isi harga asli;
  - tidak dibalas → follow-up dengan jalan keluar;
  - penolakan → tanpa tawaran;
  - script bertanda tipe lain → kritis;
  - discovery → satu pertanyaan SPIN;
  - setiap temuan punya bukti;
  - ragu setelah ditawari → JOLT;
  - kontrak API dan login.
- Flow `analisis chat` (`tests/flows/flows.mjs`): melewati Next.js, rewrite, FastAPI (uvicorn), dan emulator auth. Isinya: speaker ditanya, objection handling tanpa pitch, harga wajib diisi, riwayat disimpan, dibuka, dan dihapus.

## 9. Batasan yang diketahui

- Aturan dan kata kunci bahasa Indonesia chat. Kalimat yang tidak lazim, sarkasme, atau konteks panjang bisa terlewat.
- Bobot dan ambang adalah heuristik awal.
- Penyesuaian hanya menambah, membuang, atau merapikan kalimat; belum menulis ulang gaya bahasa (itu Fase 3).
- Python Function di Vercel sudah dicek di preview deploy (5 Nov): `GET /api/script-intelligence/health` → `{"ok":true,"engine":"rules-v1"}`, dilayani `/api` (Next.js + Python di project yang sama). Kalau suatu saat perlu dipindah, rencana B adalah host FastAPI terpisah dengan `SCRIPT_INTEL_ORIGIN` mengarah ke URL-nya.
