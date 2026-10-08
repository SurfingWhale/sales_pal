# PRD-005 — Funnel Hulu ke Hilir (Konten → Lead → Lunas → Report)

- **Status:** Draft → menunggu ACC
- **Tanggal:** 2026-10-08
- **Sumber:** deep research (5 topik: metrik engagement, akses API sosmed, atribusi lead WhatsApp, model funnel, reporting agency). Laporan lengkap + angka klien disimpan **lokal** (`reports/`, di-gitignore) karena repo ini public.
- **Terkait:** `lib/report.ts`, `components/LeadSources.tsx`, `components/Insights.tsx`, `inbound_leads` (standar leads di `SurfingWhale/creative-hub`).

---

## 1. Masalah

Sekarang agency bikin **dua laporan bulanan terpisah** buat klien SMB (contoh: toko aksesoris otomotif yang jualan lewat IG/TikTok/FB dan closing di WhatsApp):

1. **Ringkasan penjualan** — tanggal, nama customer, nominal. **Ga ada kolom sumber.**
2. **Report sosmed** — views, engagement, ER, reach, top/bottom konten. **Ga ada kolom hasil.**

Dua laporan itu **ga punya kunci yang sama**, jadi ga ada satu pun angka konversi yang bisa ditarik. Kalau penjualan turun di bulan konten jalan normal, ga ada yang bisa jawab kenapa.

Cacat lain yang ketemu di laporan contoh:
- **Reach > views.** Ga mungkin secara definisi Meta (views ngitung tayangan berulang, reach ngitung orang unik) → reach-nya dijumlah lintas post/platform. **Reach ga boleh dijumlah.**
- **Semua metrik "▲100%"** karena belum ada bulan pembanding. Itu bug tampilan, bukan temuan.
- **Rata-rata nilai deal ga mewakili deal mana pun** — deal-nya kebagi dua kelompok (tiket besar vs kecil). Turunnya omzet satu bulan ternyata didorong **ukuran deal**, bukan jumlah deal.
- **6 vs 7 deal per bulan itu noise statistik** (interval 95% untuk 6 kejadian ≈ 2–13). Perbandingan bulan-ke-bulan mentah menyesatkan.
- **ER 1,10% (dibagi views) di bawah norma video pendek** (IG ±3%, TikTok ±4% dengan pembagi yang sama), wajar untuk Facebook. Poster statis FB yang nyeret angka blended ke bawah.

**Insight inti:** solusinya bukan analitik sosmed yang lebih canggih, tapi **satu field wajib + lima timestamp**: tiap chat punya *sumber pertama* yang dikunci, tiap deal nyatet kapan jadi lead → qualified → penawaran → won → lunas. Begitu itu ada, dua laporan otomatis nyambung, dan API platform tinggal ngotomatisasi bagian atas funnel.

---

## 2. Tujuan / Non-tujuan

**Tujuan**
- G1: Setiap transaksi **lunas** bawa sumber yang mendatangkan customer-nya (atau "unknown" yang terhitung).
- G2: Funnel per klien dari **views → engagement → chat/lead → penawaran → won → lunas**, dengan konversi antar tahap.
- G3: **Satu report bulanan otomatis** menggantikan dua PDF manual, dengan aturan tampilan yang ga menyesatkan.
- G4: Metrik engagement yang benar: tiap rate nyebut pembaginya; reach ga dijumlah.

**Non-tujuan**
- Bukan inbox WhatsApp (bukan saingan Qontak/Kommo). SalesPal nyatet sumber & tahap, bukan isi chat.
- Bukan multi-touch attribution model yang rumit — skala 25–30 deal/kuartal ga butuh itu.
- Bukan auto-post / auto-DM.

---

## 3. Model metrik (4 tingkat)

Simpan **angka mentah**, hitung saat dibaca. Tiap label rate wajib nyebut rumusnya.

| Tingkat | Metrik | Rumus |
|---|---|---|
| 1 Atensi | views, viewers/reach, avg watch time, net follows | per post per platform; **reach tidak pernah dijumlah** |
| 2 Engagement | **ER_views** (utama) | (likes + comments + shares + saves) ÷ views |
| | ER tanpa saves (gaya TikTok) | (likes + comments + shares) ÷ views |
| | saves/view, shares/view | ditampilkan terpisah (sinyal niat lebih kuat dari likes) |
| | Intent score (heuristik agency) | (1·like + 2·comment + 3·save + 3·share) ÷ views — bobot bisa diatur, **dilabeli heuristik**, cuma dibandingin dalam akun yang sama |
| 3 Aksi | profile visits, link clicks, klik `/go`, **chat WA dimulai** | per post kalau API ngasih, kalau ga per platform-hari |
| 4 Hasil | lead, qualified, penawaran, won, **lunas** | jumlah orang/deal yang nyampe timestamp tahap itu |
| Penghubung | **chat per 1K views**, lead per post, Rp lunas per 1K views (teratribusi) | — |
| Funnel | konversi tahap (basis cohort, + interval Wilson), win rate, penawaran→lunas | — |
| Uang | revenue (Σ pembayaran by `paidAt`), **median** deal + split segmen tiket | won-belum-lunas = piutang, dipisah |
| Kecepatan | waktu ke lunas (median, P75, P90) | `paidAt − firstTouchAt` |
| Ekonomi | CPL, CAC, ROAS, ROI | butuh input biaya; bulan organik = "biaya konten per customer", **bukan CAC = 0** |

**North star = tingkat 3→4** (chat & deal lunas per 1K views), bukan ER. Riset (meta-analisis 86 studi) nunjukin efek sosmed ke **penjualan** lebih besar dari efeknya ke engagement, dan konten fungsional/manfaat produk ngalahin konten diskon doang.

---

## 4. Atribusi: ditangkap di pesan WhatsApp pertama, atau hilang

Trafik TikTok/WhatsApp kebaca "direct" di analytics, jadi atribusi **harus dicatat di SalesPal saat chat pertama**. Tangga metode, dari paling bisa dipercaya:

1. **CTWA referral** (iklan Click-to-WhatsApp) — `ctwa_clid` + ad ID cuma dateng di **pesan pertama**, cuma lewat **Cloud API**. Simpan mentah begitu masuk.
2. **Link `/go/{kode}`** milik SalesPal per post/kampanye — log klik + UTM, lalu redirect ke `wa.me` dengan kode di teks. Kode = kunci join. (UTM ga pernah nyampe ke WhatsApp kecuali halaman kita yang nyatet duluan.) Caption ga bisa diklik → pakai link-in-bio berisi kode + kode diucapin di video ("ketik kode REEL12").
3. **Kode promo per channel** — dicek pas transaksi.
4. **"Dari mana tahu kami?"** — pertanyaan terbuka, simpan verbatim + kategori. Ditampilkan **berdampingan**, ga digabung ke atribusi tercatat.
5. **Tebakan seller** — confidence rendah.

**Aturan:**
- `firstTouch = { channel, medium, campaign, contentId, method, confidence }` — **ditulis sekali, immutable.** Sinyal berikutnya ke `touches[]`.
- Deal mewarisi first touch. Revenue dibukukan by `paidAt`, bisa juga dilihat by cohort tanggal lead.
- Kredit ke **post spesifik** cuma kalau lead nunjuk post itu (kode, ad ID, screenshot); kalau ga, kredit ke platform + bulan.
- Baris **"unknown / dark"** selalu tampil. Persentasenya jadi KPI sendiri — makin kecil = sistem jalan.
- **Soft gate:** tandai lunas wajib pilih sumber ("unknown" boleh, tapi kehitung).

---

## 5. Data model (Firestore)

Customer klien ≠ lead milik agency sendiri (`users/{uid}/leads`). Dicampur = dua-duanya rusak. Jadi namespace per klien:

| Path | Isi |
|---|---|
| `users/{uid}/clients/{c}` | nama, mata uang, segmen tiket, target, zona waktu, input biaya (ad spend, produksi, margin %) |
| `…/clients/{c}/contacts/{id}` | satu orang, dedup by nomor WA (E.164); `firstTouch` immutable, `touches[]`, `heardFromRaw`, `createdAt`, dasar consent |
| `…/clients/{c}/deals/{id}` | `leadAt`, `qualifiedAt`, `quotedAt` (penawaran), `wonAt`, `paidAt` (lunas), `lostAt`/`lostReason`, nilai penawaran, nilai lunas, segmen, `isRepeat`, `attributedSource`, `promoCode` |
| `…/clients/{c}/payments/{id}` | DP & pelunasan; revenue = Σ by `paidAt` |
| `…/clients/{c}/posts/{id}` | platform, externalId, `publishedAt`, format (reel/video/static/carousel/story), kode, permalink |
| `…/clients/{c}/postSnapshots/{postId_yyyymmdd}` | snapshot harian: views, reach, likes, comments, shares, saves, profileVisits, avgWatch, `origin` (api/csv/manual), `metricVersion` |
| `…/clients/{c}/accountDaily/{platform_yyyymmdd}` | total akun harian |
| `…/clients/{c}/links/{code}` + `clicks/{id}` | registry `/go` + log klik (ditulis server) |
| `…/clients/{c}/reports/{yyyy-mm}` | report beku: angka, narasi (bisa diedit), `shareToken`, `publishedAt` |
| **`connections/{id}` (top-level, deny-all)** | token OAuth per akun klien, terenkripsi |

**Kenapa token ga boleh di bawah `users/{uid}`:** rule live `match /users/{uid}/{document=**}` bikin semua yang di situ **kebaca dari browser** user. Token platform harus di koleksi top-level `allow read, write: if false`, cuma diakses Admin SDK dari route server & Vercel Cron.

**Aturan model:** satu contact per orang lintas platform (repeat order = deal baru `isRepeat`, ga masuk CAC customer baru); lead yang gugur disimpan + alasan (penyebut konversi jujur); **konversi versi platform ga pernah dijumlah sama revenue lunas SalesPal.**

Nama metrik platform disimpan di **tabel mapping config**, bukan hard-code — Meta udah dua kali ganti/hapus metrik dalam 8 bulan (impressions & page fans dihapus Nov 2025; unique reach Page/post dihapus Jun 2026, ga ada pengganti setara). `metricVersion` dipakai buat nandain patahan seri.

**Wajib per CLAUDE.md:** tiap koleksi baru masuk daftar coverage `firestore.rules` + `tests/firestore.rules.test.mjs` sebelum deploy. Perubahan shape `inbound_leads` (mis. nambah `ctwaClid`) → standar leads di `creative-hub` dulu.

**UU PDP (27/2022):** klien = controller, SalesPal = processor (butuh kontrak). Simpan field sumber + potongan pesan pertama, **bukan log chat**. Hapus `ctwa_clid` setelah event CAPI terkirim. Sediain export & hapus per customer.

---

## 6. Integrasi & batasannya

| Sumber | Yang didapat | Gerbang / batasan |
|---|---|---|
| Instagram (API with Instagram Login; `instagram_business_basic`, `instagram_business_manage_insights`) | views, reach, likes, comments, shares, saved, profile_visits per media; views/reach/follows per akun | **Advanced Access = App Review + Business Verification** buat akun yang bukan punya agency; data user cuma 90 hari; ga ada webhook insight (harus polling) |
| Facebook Page (`pages_read_engagement`) | media views, follows, reactions | gerbang review sama; tanpa unique reach sejak Jun 2026 |
| TikTok API for Business (Organic/Accounts) | reach, views, engagement, watch time | akun klien harus Business + Analytics nyala; approval app; **kelayakan Indonesia belum terkonfirmasi**. Sementara: Display API (views/likes/comments/shares/followers) atau CSV |
| Threads (`threads_manage_insights`) | views, likes, replies, reposts, quotes, shares | token 60 hari, kalau lewat harus login ulang |
| WhatsApp Cloud API via **coexistence** + CAPI Business Messaging | CTWA referral, `ctwa_clid`, event Purchase bernilai Rp | Cloud API only; pesan pertama only; tarif per pesan; **klaim "service message ga gratis lagi per 1 Okt 2026" belum terkonfirmasi Meta** |
| Fallback A: CSV dari Meta Business Suite / TikTok Studio | metrik utama | layout kolom suka berubah → mapper toleran (pola Import XLS yang udah ada) |
| Fallback B: Metricool API | multi-platform, approval diurus vendor | ±US$45–67/bln untuk 15 brand (harga sumbernya beda-beda) |

**Konsekuensi arsitektur:** retensi pendek (IG 90 hari, TikTok ±60 hari, Story 24 jam) → **snapshot harian via Vercel Cron itu wajib**, bukan opsional. Narik histori pas bikin report bakal gagal. Mode Development Meta cukup buat pilot (klien ditambah jadi tester) sambil Business Verification + App Review jalan paralel.

---

## 7. Report: harus nolak ngomong yang datanya ga dukung

Aturan tampilan, **dipaksa oleh engine**, bukan diserahin ke feeling:
- Ga ada pembanding → "— (bulan dasar)", **bukan ▲100%**.
- < ~10 kejadian → "basis kecil", tampil X → Y tanpa persen.
- Rate berubah dalam **poin persen**: 1,2% → 1,5% = +0,3 pp, bukan +25%.
- Pembanding default = **rata-rata 3 bulan terakhir**, bukan bulan lalu.
- Revenue dipecah **jumlah deal × ukuran deal per segmen** (biar efek mix kelihatan).
- Cohort yang lebih muda dari P75 waktu-ke-lunas → abu-abu "belum matang".
- Reach per platform, ga pernah dijumlah. Tiap label ER nyebut rumusnya.
- Interval Wilson di konversi tahap dengan n kecil.

**Narasi:** dari template tetap (penggerak terbesar, konten terbaik/terburuk, sumber revenue terbaik, porsi "unknown"). Rewrite AI opsional, **selalu bisa diedit sebelum dikirim** (AI cenderung milih angka relatif yang "kedengeran wah" dan buang syaratnya).

**Isi report gabungan (gantiin 2 PDF):**
1. Ringkasan 3–5 baris, kabar baik dulu
2. KPI vs target & rata-rata 3 bulan: Rp lunas, deal lunas, lead baru, chat per 1K views, ER_views
3. Funnel views → lunas, dengan patahan grain (konten vs orang) + bar interval
4. Revenue per sumber pertama, termasuk baris unknown
5. Tabel konten per platform & format: post, views, lead, lead/post, Rp lunas
6. Top & bottom konten
7. Kerjaan bulan ini
8. Next action, target dihitung mundur lewat funnel (deal lunas yang dibutuhin ÷ rate penawaran→lunas = penawaran yang dibutuhin, dst.)
9. Definisi

**Pengiriman:** halaman `reports/{yyyy-mm}` beku di balik share token, dirender route server (Admin SDK, rules tetap tertutup) + print-to-PDF dari browser + link `wa.me` berisi URL report yang dikirim manual sama owner. (Kirim WhatsApp otomatis butuh template di luar jendela 24 jam.)

**Posisi produk:** tool Indonesia (Qontak, Kommo, SleekFlow, Barantum) kuat di inbox & pipeline, tapi ga ada yang bikin report klien yang **gabungin performa sosmed + revenue lunas**. Agency yang numpuk tool sosmed + CRM WA + Jurnal tetep join data manual. Itu celah SalesPal.

---

## 8. Rollout (ngikutin gesekan approval)

| Fase | Isi | Butuh |
|---|---|---|
| **0 — sekarang** | namespace `clients/{c}`; contacts/deals/payments dengan timestamp tahap; picker sumber 1-tap + "dari mana tahu kami?" verbatim; soft gate lunas; report gabungan dengan semua aturan tampilan; **back-fill transaksi yang ada** dengan sumber (tanya/ingat tiap pembeli) | ga ada approval eksternal; rules + flow tests |
| **1 — +1 bulan** | redirect `/go/{kode}` + link-in-bio; kode promo per channel; import CSV Meta & TikTok (mapper toleran); snapshot harian manual/CSV | route Vercel, Admin SDK |
| **2 — +2–3 bulan** | snapshot API Instagram/Facebook/Threads via cron (klien sebagai tester dulu), lalu Advanced Access | Business Verification + App Review |
| **3 — pas iklan jalan** | WhatsApp coexistence di Cloud API, tangkap CTWA referral, CAPI Purchase bernilai Rp, ROAS per iklan; TikTok Business API | WABA, tarif 2026 terkonfirmasi, approval app TikTok |

Fase 0 udah nyelesein masalah inti **tanpa izin platform apa pun**.

---

## 9. Risiko & yang belum terkonfirmasi

- **Manusia, bukan teknis:** kode dihapus customer dari teks prefill, seller lupa tag → baris unknown bakal gede di awal. Itu sebabnya porsi unknown dijadiin KPI.
- **Tarif WhatsApp 1 Okt 2026** — klaim vendor, belum dari Meta.
- **CAPI:** event apa aja yang diterima & apakah deal > 7 hari setelah klik masih keatribusi — belum terkonfirmasi. Deal tiket besar bisa lebih lama dari seminggu → CAPI = laporan ROAS per iklan, **bukan sumber kebenaran**.
- **TikTok Business API** buat developer/akun Indonesia — belum terkonfirmasi.
- **Benchmark:** beberapa angka dari sumber sekunder; **ga ada benchmark konversi chat→lunas Indonesia yang kredibel** → target = baseline klien sendiri (rata-rata bergulir).
- **Batas bulan di data contoh** perlu dicek — sebagian transaksi numpuk di beberapa hari di awal & akhir periode; pastiin bukan salah tanggal sebelum report bulan-ke-bulan dipercaya.

---

## 10. Keputusan terbuka (buat user)

- **D1:** Fase 0 dikerjain sekarang? (rekomendasi: ya — ga butuh approval apa pun)
- **D2:** Klien pertama yang di-pilot: klien aksesoris otomotif?
- **D3:** Segmen tiket: pakai batas Rp5 juta (besar vs kecil), atau angka lain?
- **D4:** Report dikirim ke klien (perlu white-label/logo agency) atau internal dulu?
- **D5:** Koordinasi dengan session lain: PRD ini nyentuh Leads/report yang lagi mereka garap — siapa yang pegang Fase 0?
