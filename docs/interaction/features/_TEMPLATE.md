# {Feature} — arsitektur interaksi

> Template dan aturan tulis untuk setiap file di `docs/interaction/features/`.
> Hapus blockquote ini di file feature. Urutan bagian **tidak boleh diubah**: alasan dulu, wujud belakangan.

**Kode:** `components/…` · **Artefak lama:** E{n}, D{n}, B{n} · **Pola:** [patterns.md](../patterns.md)#… · **Keputusan:** [decisions.md](../decisions.md)#DEC-…

## 1. Why

- **Masalah yang diselesaikan:** apa yang terjadi di dunia penjual kalau feature ini tidak ada.
- **Kenapa perlu ada di SalesPal** (bukan di WhatsApp, Notion, catatan HP).
- **Yang ingin diselesaikan pengguna di sini**, dalam satu kalimat.
- **Yang BUKAN tugas feature ini.** Batas yang sengaja dijaga, supaya feature tidak menggelembung.

## 2. User goal

Kalimat orang pertama, dalam bahasa penjual. Satu tujuan utama, lalu tujuan sampingan bila ada.

> "Saya ingin …, tanpa …."

Bukan "User dapat menekan tombol X".

## 3. User state

Rantai state yang dialami penjual (bukan state komponen). Untuk setiap state:

| State | Apa yang benar saat ini | Persisten (Firestore / sessionStorage / tidak) | Siapa yang mengubahnya |
|---|---|---|---|

Tandai state yang **hanya ada di kepala penjual** (sistem tidak tahu), misalnya "pesan sudah terkirim di WhatsApp".

## 4. Experience flow

Mermaid `flowchart TD` yang menceritakan perjalanan dari niat sampai selesai, termasuk keluar app dan kembali. Node = momen pengalaman ("Kembali dari WhatsApp"), bukan nama komponen. Setelah diagram, 3–6 kalimat yang menjelaskan apa yang dirasakan penjual di titik-titik penting.

## 5. Decision flow

**Wajib.** Pohon keputusan, untuk penjual **dan** untuk sistem:

```
Pertanyaan?
├── Jawaban → akibat
└── Jawaban → akibat
```

Untuk setiap keputusan: siapa yang memutuskan (penjual / sistem / tidak ada), dan apakah UI membantu keputusan itu. Keputusan yang tidak dibantu UI, atau diputuskan sistem tanpa sepengetahuan penjual, ditandai **⚠ GAP-{fitur}-{n}** dan masuk §12.

## 6. Interaction flow

Baru sekarang soal wujud. Per aksi penting, pakai blok:

```
AKSI        Nama aksi
WHY         kenapa aksi ini ada
STATE       pada state apa aksi ini muncul (dan kapan tidak)
DECISION    keputusan yang dibantu
INTERACTION tap / sheet / layar penuh / handoff eksternal / Back / keyboard
CONSTRAINT  batasan sistem (mis. WhatsApp tidak melapor balik)
CONSEQUENCE apa yang harus dilakukan UI karena batasan itu
FEEDBACK    bagaimana penjual tahu hasilnya
RECOVERY    undo / retry / jalan kembali
```

Aksi kecil boleh dikumpulkan dalam satu tabel. Audit tombol yang sudah ada ([peta tombol](../G-button-map.md), E, D) dipakai sebagai bahan, jangan disalin mentah.

## 7. Component map

Pohon komponen **berdasarkan fungsi dalam model interaksi** (Daftar, Persiapan pesan, Aksi utama, Pemulihan, …), dengan nama file di belakangnya. Jangan cantumkan elemen yang tidak punya fungsi interaksi.

## 8. Navigation map

- Datang dari mana (semua pintu masuk).
- Pergi ke mana, dengan jenis perpindahannya: **Overlay / Navigasi / Lompatan / Eksternal** (README) dan permukaannya (sheet bawah, layar penuh, dialog tengah, tab).
- Bagaimana kembali, dan apakah posisi/scroll/filter/isian dipertahankan.

## 9. Feedback & recovery

Tabel untuk setiap aksi yang mengubah data atau meninggalkan app:

| Aksi | Pending | Sukses | Error | Undo / retry / pemulihan | Masalah |
|---|---|---|---|---|---|

Cari secara sistematis, dan tandai sebagai GAP:
- tanpa feedback;
- feedback **sebelum** tulisan berhasil;
- bisa dibalik tapi tanpa undo;
- gagal tanpa retry;
- perubahan besar tanpa konfirmasi;
- state hilang saat pindah layar atau app.

## 10. Design rationale

Untuk setiap keputusan pola yang penting: **Kenapa pola ini?** Jawaban mengacu ke state dan keputusan di atas, dan ke pola di patterns.md. Kalau polanya saat ini salah, tulis pola yang benar dan rujuk GAP-nya.

## 11. Current implementation

Apa yang benar-benar ada di kode hari ini (6 Nov 2026), ringkas, dengan `file:baris` untuk hal yang tidak jelas dari namanya. Tidak menilai; penilaian ada di §12.

## 12. Known gaps

| ID | Gap | Akibat bagi penjual | Arah perbaikan | Rujukan (AMB / DEC / PR) |
|---|---|---|---|---|

Gap yang sudah diperbaiki di PR #116 ditulis dengan status ✅ dan PR-nya, supaya sejarahnya tidak hilang.

---

### Aturan tulis

- Bahasa Indonesia, istilah dari [GLOSSARY.md](../../../GLOSSARY.md). Kalimat pendek dan aktif. Tidak ada em dash; pakai titik, koma, titik dua, atau kurung.
- **Fakta dari kode, bukan dugaan.** Kalau tidak yakin, baca kodenya. Kalau tetap tidak pasti, tulis "belum diverifikasi".
- Perilaku yang buruk ditulis sebagai GAP, tidak pernah disamarkan sebagai desain.
- Jangan mengusulkan UI baru hanya supaya terlihat lengkap. Usulan selalu menjawab state, keputusan, atau pemulihan tertentu.
- Contoh data netral (mis. "@tokokue", "Bu Sari"), tanpa data pribadi nyata.
