# PRD-020 — Karakter: tipe customer, avatar, lencana peran

- **Status:** Dibangun lewat #56, #58, #59 (15–16 Okt). Dokumen ini catatan, ditulis belakangan. Draf awalnya (10 Okt, "PRD-010 karakter") belum sempat masuk repo, dan nomor 010 sudah dipakai `PRD-010-standar-native`.
- **Konteks:** Profil customer dan profil user dulu monoton: lead pakai inisial di atas gradient, tipe customer pakai ikon garis, avatar user pakai huruf pertama nama, simulator dan script pakai emoji 🦉🦁🐬🐰. Owner bikin satu set karakter 3D clay lewat GPT supaya app punya rasa "game" (guild, PRD-007) tanpa mengganti sistemnya.
- **Terkait:** PRD-001 §3.3 R3.2 (tipe customer itu sistem fungsional, beda dari brand), PRD-007 (peran Leader/Officer/Member/Viewer), PRD-008 (profil customer & tipe customer), `docs/brand-identity.md`, `lib/salespal-data.ts`.

---

## 1. Aset

Sheet sumber 2×2 dari GPT ada di `docs/assets/characters/`, dengan salinan di `~/dev/brand-assets/salespal/` buat diedit di Photoshop.

| Sheet | Isi | Jadi file di app |
|---|---|---|
| `sheet-archetypes.png` | burung hantu, singa, lumba-lumba, kelinci | `public/archetypes/animal-{owl,lion,dolphin,rabbit}.png` |
| `sheet-roles.png` | lencana Leader (mahkota), Officer, Member, Viewer (mata) | `public/guild/badge-{leader,officer,member,viewer}.png` |
| `sheet-avatars-with-role.png` | 4 orang, masing-masing pakai lencana perannya di jas | `public/guild/char-{leader,officer,member,viewer}.png` |
| `sheet-avatars.png` | 4 orang yang sama tanpa lencana | belum dipakai |

Catatan sheet:

- `sheet-archetypes.png` **tidak punya alpha**; pola kotak-kotaknya ikut ke-bake. Potong pakai `--checker`.
- `sheet-avatars.png` dan `sheet-roles.png` punya alpha asli. Bercak merah/kuning di preview cuma sisa warna di piksel transparan, dan hilang waktu export.
- File di app berukuran 256px PNG (#56). `cut-sheets.py` menghasilkan potongan 512px WebP. Hasil potongannya sama, cuma beda ukuran dan format.

Potong ulang (setelah mengedit sheet atau membuat yang baru):

```
python3 -m venv .venv && .venv/bin/pip install pillow numpy scipy
.venv/bin/python -I docs/assets/characters/cut-sheets.py docs/assets/characters/sheet-archetypes.png <out> \
  owl,lion,dolphin,rabbit --checker
```

Urutan nama: kiri-atas, kanan-atas, kiri-bawah, kanan-bawah. Potongan dikelompokkan per komponen, jadi gelembung chat lumba-lumba yang menyeberang garis tengah sheet tetap utuh.

---

## 2. Yang dibangun

### 2.1 Tipe customer (#56)

- `components/AnimalArt.tsx`: `<img>` dekoratif (`alt=""`); nama tipe selalu ada di sebelahnya.
- Gantiin emoji di profil lead (`LeadDetail`), Script Library, Simulator, kartu prospek Hunting (`CustomerContext`), dan pin Peta 3D (#65).

### 2.2 Lencana & karakter peran (#56)

- `RoleBadge` (`GuildHub.tsx`): lencana di label peran, di banner guild, dan di baris anggota. Petanya dari `role`, bukan dari nama peran custom (PRD-007 §2.1).
- Karakter peran jadi avatar default anggota. *Undang orang* memilih peran lewat kartu bergambar, bukan select.
- Lambang guild (crest) tetap identitas guild dan bisa diatur sendiri (warna, simbol, logo PNG), terpisah dari lencana peran.

### 2.3 Avatar (#58, #59)

- **Anggota guild (#58):** `guilds/{g}/members/{uid}.avatar` diisi salah satu dari `AVATARS` (`lib/guild.ts`): 4 karakter peran + 4 hewan. Kalau kosong, yang tampil karakter perannya. `memberShape` di `firestore.rules` cuma menerima nilai dari daftar itu, dan update tetap cuma boleh oleh member yang bersangkutan (ada tesnya).
- **Profil sendiri (#59):** `users/{uid}/settings/profile.avatar`, dipilih di Profil & pengaturan, tampil di tombol profil di header (`MeAvatar`). Kalau kosong, yang tampil inisial.

---

## 3. Beda dari draf 10 Okt

| Draf | Yang dibangun |
|---|---|
| 4 avatar manusia sebagai pilihan avatar (D2) | Orang yang sama, tapi dengan lencana peran di jas (`char-*`). Versi tanpa lencana belum dipakai. |
| Default avatar: foto akun Google, kalau tidak ada karakter acak dari hash `uid` (D1) | Anggota guild: karakter perannya. Profil sendiri: inisial. Foto Google belum dipakai. |
| `sheet-avatars-with-role.png` cuma mockup, lencana jadi overlay | Sheet itu sendiri yang dipotong jadi `char-*`; tidak ada overlay. |
| Satu komponen `CharacterImg`, file 512px WebP di `public/characters/` | `AnimalArt` + `MeAvatar` + `RoleBadge`, file 256px PNG di `public/archetypes/` dan `public/guild/`. |

---

## 4. Aturan

- **Brand:** hewan memakai warna tipenya (`#a78bfa`, `#f59e0b`, `#00ccff`, `#ff6b35`). Biru brand `#005eb0` cuma di lencana. Cakar/macan tetap khusus logo (`docs/brand-identity.md`, PRD-001 R3.2).
- **Ukuran minimum:** karakter 28px, lencana 20px. Di bawah itu tidak terbaca; pakai titik warna atau emoji.
- **Alt text:** kalau nama tipe/peran sudah ada di sebelahnya, `alt=""`. Kalau gambarnya berdiri sendiri: `alt="Tipe customer: Singa"`, `alt="Peran: Officer"`.
- **Tanpa `next/image`.** Repo memakai `<img>` biasa, dan filenya sudah kecil.

---

## 5. Terbuka

- **D1:** foto akun Google sebagai default avatar kalau ada. Belum dibangun.
- **4 avatar manusia tanpa lencana** sebagai pilihan tambahan: perlu menambah `AVATARS`, mengubah rules + tesnya, dan deploy rules.
- **D3:** stiker 6 keberatan (Belum Yakin, Nanti Dulu, Sudah Punya, Lagi Sibuk, Harga Mahal, Di-ghosting) di simulator.

---

## 6. Prompt gaya (kalau butuh karakter baru)

Tempel ini dulu di thread GPT yang sama, lalu minta karakternya satu per satu:

```
Create a character icon for a sales app. Style: soft 3D clay render, rounded chunky shapes,
friendly but professional, bust (head + shoulders), 3/4 front view, centered with 10% padding,
soft studio light from top-left, no ground shadow. Transparent background (real alpha, not a
checkerboard), 1024x1024 PNG, no text, no frame, no circle behind it. Must read at 44px on
light gray (#f4f5f7) and near-black (#0d0f12). Match the attached sheet's style exactly.
```
