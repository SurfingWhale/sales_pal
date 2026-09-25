# PRD-002 — Hunting Mode

- **Status:** Built 2026-09-25 (tab Hunting, `components/Hunting.tsx`, `lib/hunting.ts`)
- **Tanggal:** 2026-09-19
- **Konteks:** User berburu klien (mis. jasa foto makanan) lewat **Threads / IG DM**. Udah ada **Quick Pitch** (FAB + template + kirim WA). Hunting Mode = naikin ini jadi satu section utuh buat "mode berburu".

---

## 1. Masalah & insight utama

**Kekhawatiran user (penting):** *"takut gw malah sibuk catetin leads tanpa eval message — apakah udah oke apa belum."*

Artinya: fitur jangan cuma jadi **gudang lead**. Kalau cuma nyatet nama + status, user malah kerja administratif tanpa tau **pesan mana yang works**. 

**Insight desain:** setiap outreach harus **ke-link ke (a) template yang dipakai** dan **(b) hasilnya**. Dari situ sistem bisa ngitung **response rate / win rate per template** → user tau pitch mana yang perlu dibuang/diperbaiki. Ini yang bikin Hunting Mode = alat **evaluasi pesan**, bukan cuma pencatatan.

---

## 2. Tujuan / Non-tujuan

**Tujuan**
- Section "Hunting Mode" khusus buat sesi berburu (Threads/IG/WA).
- Quick-paste teks yang **fully custom** (extend Quick Pitch).
- Log hasil outreach **super cepat** (1-tap): terkirim → dibales / ditolak / ghosting / tertarik.
- **Eval otomatis:** response rate & win rate **per template**, biar ketauan pesan mana yang oke.

**Non-tujuan**
- Bukan ganti CRM Leads yang udah ada (bisa nyambung, tapi Hunting Mode fokus kecepatan + eval).
- Bukan auto-DM/auto-post ke Threads/IG (ga mungkin & melanggar ToS).

---

## 3. Rancangan fitur

### 3.1 Section "Hunting Mode" (tab baru)
Layout ringkas buat dipakai sambil scroll Threads/IG:
- **Target cepat:** field nama target (auto isi `{nama}` di template).
- **Deck template** (dari Quick Pitch): tap → Copy / Kirim WA.
- **Log 1-tap:** setelah kirim, tombol status cepat — `📤 Terkirim` · `💬 Dibales` · `✅ Tertarik` · `❌ Ditolak` · `👻 Ghosting`.

### 3.2 Simpan chat / outcome (jawab "save chat misal ditolak")
Tiap entry hunting nyimpen: target, platform (Threads/IG/WA), **template yang dipakai**, status, catatan singkat opsional (mis. alasan nolak), tanggal. Ringan — bukan transkrip penuh, tapi cukup buat belajar.

### 3.3 Evaluasi pesan (inti — jawab kekhawatiran user)
Dari data di atas, tampilin:
- **Per template:** dikirim X · dibales Y (**response rate %**) · tertarik Z (**win rate %**).
- **Highlight:** "Template A response 40%, Template C cuma 5% → pertimbangin revisi C."
- Optional: alasan penolakan yang paling sering (dari catatan) → insight objection.

### 3.4 Nyambung ke Leads
Kalau outcome = "Tertarik", 1-tap **"Jadiin Lead"** → masuk ke Lead Database (status Warm/Hot). Jadi hunting → CRM mulus, tanpa dobel input.

---

## 4. Prinsip biar ga jadi beban admin
- Logging **maksimal 1-2 tap**, ga ada form panjang.
- Catatan itu **opsional**.
- Eval **otomatis** ke-generate — user ga perlu ngitung apa-apa.
- Default cepat: kirim → status → next. Kalau males log pun, quick-paste tetap jalan.

---

## 5. Data (Firestore)
- `users/{uid}/pitchTemplates` — udah ada (Quick Pitch).
- `users/{uid}/hunts` — { target, platform, templateId, status, note, createdAt }.
- Eval dihitung client-side dari `hunts` (group by templateId).

---

## 6. Keputusan (diambil 2026-09-25, bisa diubah)
- **D1:** Tab baru **Hunting**, tepat setelah Dashboard. Quick Pitch (FAB) tetap ada buat kirim cepat tanpa log.
- **D2:** Threads / IG / WA / Lainnya. Sumber lead ikut: Threads, DM IG, WhatsApp, Lainnya.
- **D3:** 5 status di atas. "Dibales" dihitung dari Dibales + Tertarik + Ditolak (ditolak = tetap dibaca & dijawab).
- **D4:** Manual, 1 tap **Jadiin Lead** (status Warm, value 0). DM yang Tertarik tapi belum jadi lead muncul di **Perlu Ditindak**.

Tambahan di luar draft: target DM harian (default 20, `settings/hunting.dailyGoal`), filter **Follow-up** buat DM yang 2+ hari belum dibales, dan saran otomatis setelah ≥ 5 DM per template.

## 7. Fase eksekusi (kalau di-ACC)
1. Extend Quick Pitch → template punya `id` stabil + kategori (udah setengah jalan).
2. Hunting Mode tab: target + deck + log 1-tap → tulis ke `hunts`.
3. Panel eval per template (response/win rate).
4. "Jadiin Lead" bridge ke Leads.
