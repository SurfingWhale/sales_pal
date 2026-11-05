# Prospect and lead detail

- **Code:** prospect: `components/ProspectList.tsx` (`.sp-pcontact`), `components/ProspectThread.tsx`. Lead: `components/LeadDetail.tsx` (`LeadPage`), `components/ChatPicker.tsx` (Pesan).
- **PRD:** 019 §3.4, 021, 022. **Flows:** `journey`, `lead data`, `satu funnel`, `script management`.

## Lead page

- **Primary action:** Tulis pesan, which opens Pesan as a full sheet: script → edit → WhatsApp → Pesannya udah kekirim? → Udah, lanjut ke the next lead.
- **Quick actions:** Mereka bales, Telepon (or Tambah no.), Penawaran, Jadwal.
- **Menu:** Ubah data lead, Ubah profil, Tandai udah dikontak (only while Belum dikontak), Hapus lead.
- A chat is logged only after Udah. Contact outside the app is marked by hand, with Batal.

## Prospect page

Not yet mapped to this spec's level. The next iteration on it must first map its states and transitions here ([protocol](../protocol.md), step 1).

## Open

- One worksheet pattern for prospect and lead (PRD-019 §3.4): not unified yet.
