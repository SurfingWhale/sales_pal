"""Stage 6 — the chosen script, adjusted to this conversation (PRD-023 §3.6).

Keeps the script's objective and strategy; changes what the conversation
calls for, and lists every change:
- fills its words ({nama}, {kebutuhan}, {bisnis}; same rules as
  lib/templates.ts fillTemplate);
- drops a cold "Halo …!" opening once you're already talking;
- acknowledges the objection first (labeling), then keeps the script's point;
- ends with one discovery question when discovery isn't done, a way out on a
  follow-up, and no offer at all after a clear no;
- leaves out sentences about another kind of business.
What it can't know (a price, a date) it never makes up: it asks you to fill it
in (required_edits). With no fitting script it writes a short new reply from
the same rules, marked as new.
"""
from __future__ import annotations

import re

from .match import CATEGORY_WORDS, FEATURES, category_of, _has

FALLBACK = {"nama": "kak", "kebutuhan": "kebutuhannya"}

LABEL = {
    "price": "Kedengarannya budget-nya lagi dijaga ketat ya.",
    "timing": "Kedengarannya sekarang belum waktu yang pas ya.",
    "trust": "Wajar banget kalau mau lihat buktinya dulu.",
    "existing_provider": "Wajar kalau udah ada yang biasa pegang.",
    "no_need": "Siap, kedengarannya sekarang memang belum perlu.",
    "authority": "Siap, enaknya memang diobrolin dulu sama yang ikut mutusin.",
    "uncertainty": "Kedengarannya masih nimbang-nimbang ya.",
}
CALIBRATED = {
    "price": "Biar pas, kisaran yang lagi kamu siapin berapa?",
    "timing": "Biasanya kapan waktu yang pas buat mulai ngurus ini?",
    "trust": "Contoh hasil yang kayak gimana yang paling ngebantu buat kamu nilai?",
    "existing_provider": "Selama ini sama yang sekarang, ada bagian yang masih pengen kamu benahin?",
    "no_need": "",
    "authority": "Info apa yang paling ngebantu buat dibawa ke diskusinya?",
    "uncertainty": "Bagian mana yang masih bikin ragu?",
}


def fill(body: str, data: dict) -> str:
    def val(k):
        return (data.get(k.lower()) or "").strip()

    out = re.sub(r"([a-zà-ÿ])\{nama\}", r"\1 {nama}", body, flags=re.I)
    for _ in range(6):
        nxt = re.sub(r"\[([^\[\]]*)\]", lambda m: m.group(1) if all(val(k) for k in re.findall(r"\{(\w+)\}", m.group(1))) and re.findall(r"\{(\w+)\}", m.group(1)) else ("" if re.findall(r"\{(\w+)\}", m.group(1)) else "\u0001" + m.group(1) + "\u0002"), out)
        if nxt == out:
            break
        out = nxt
    out = out.replace("\u0001", "[").replace("\u0002", "]")
    out = re.sub(r"\{(\w+)\}", lambda m: val(m.group(1)) or FALLBACK.get(m.group(1).lower(), ""), out)
    return re.sub(r" +([,.!?])", r"\1", re.sub(r"[ \t]{2,}", " ", out)).strip()


BREAK = re.compile(r"(?<=[.!?])\s+|\n+|(?<=[\U0001F300-\U0001FAFF])\s+(?=[A-Z])")


def sentences(t: str) -> list[str]:
    return [x.strip() for x in BREAK.split(t) if x and x.strip()]


def talks_about(s: str) -> list[str]:
    return [c for c, ws in CATEGORY_WORDS.items() if any(len(w) > 2 and _has(s, w) for w in ws)]


def adjust(body: str, data: dict, u, stage: str, missing: list[dict], convo_text: str) -> dict:
    changes: list[dict] = []
    required: list[str] = []
    parts = sentences(fill(body, data))
    if not parts:
        parts = [fill(body, data)]
    theirs = category_of(convo_text)
    talking = u.prospect_messages > 0

    # A cold opening reads odd mid-conversation.
    if talking and stage != "intro" and re.match(r"^(halo|hai|hi|hello)\b[^.!?]*[!.]$", parts[0], re.I) and len(parts) > 1:
        changes.append({"kind": "drop", "note": f"pembuka “{parts[0]}” (kalian udah ngobrol)"})
        parts = parts[1:]

    # Sentences about another kind of business.
    if theirs:
        kept = []
        for i, s in enumerate(parts):
            about = talks_about(s)
            if i == 0 or not about or theirs in about:
                kept.append(s); continue
            changes.append({"kind": "drop", "note": f"“{s[:60]}”: soal {'/'.join(about)}, percakapan ini {theirs}"})
        if len(kept) >= 1:
            parts = kept

    # After a clear no: no offer, a kind way out.
    if u.rejected:
        before = len(parts)
        parts = [s for s in parts if not (FEATURES["offer"].search(s) or FEATURES["close"].search(s))]
        if len(parts) < before:
            changes.append({"kind": "drop", "note": "kalimat yang nawarin (mereka udah nolak)"})
        if not any(FEATURES["soft_out"].search(s) for s in parts):
            parts.append("Makasih udah ngabarin ya, kalau nanti butuh aku ada di sini 🙏")
            changes.append({"kind": "add", "note": "penutup yang ngasih jalan keluar"})

    # Objection: acknowledge first, then the script's point; one calibrated question.
    obj = u.objections[-1]["id"] if u.objections else None
    if obj and not u.rejected:
        # "Kedengarannya … ya. Siap Dita!" reads off: the label is the opening now.
        if parts and re.match(r"^(siap|oke|ok|baik|sip)\b[^.!?]{0,30}!$", parts[0], re.I) and len(parts) > 1:
            parts = parts[1:]
        parts.insert(0, LABEL[obj])
        changes.append({"kind": "add", "note": f"akui keberatannya dulu ({u.objections[-1]['label']})"})
        q = CALIBRATED.get(obj)
        if q and not any("?" in s for s in parts):
            parts.append(q)
            changes.append({"kind": "add", "note": "satu pertanyaan terbuka soal keberatannya"})

    # Their question, still open: the reply must answer it.
    for f in u.questions_open[-2:]:
        # Answered only with a real figure: "aku kirim detail paketnya" isn't a price.
        if re.search(r"\b(harga|berapa|pricelist|biaya)\b", f.quote, re.I) and not re.search(r"\brp\s?\d|\d+\s?(?:rb|ribu|jt|juta|k)\b", " ".join(parts), re.I):
            required.append(f"Jawab dulu pertanyaannya: “{f.quote}” (isi harga/paket yang beneran).")
        elif re.search(r"\b(tanggal|kosong|jadwal|kapan|slot)\b", f.quote, re.I):
            required.append(f"Cek kalender lalu jawab: “{f.quote}” (jangan janji slot yang belum pasti).")

    # Discovery not done: end with one question that brings out what's missing.
    if stage in ("discovery", "intro") and not u.rejected and missing and not any("?" in s for s in parts):
        parts.append(missing[0]["ask"])
        changes.append({"kind": "add", "note": f"satu pertanyaan buat tahu {missing[0]['label'].lower()} (SPIN)"})

    # Follow-up: a way out, so it doesn't read like pressure.
    if stage == "follow_up" and not any(FEATURES["soft_out"].search(s) for s in parts):
        parts.append("Kalau belum sekarang juga gapapa ya.")
        changes.append({"kind": "add", "note": "jalan keluar biar nggak kebaca maksa"})

    return {"text": " ".join(parts).strip(), "changes": changes, "required_edits": required}


def compose(data: dict, u, stage: str, missing: list[dict]) -> dict:
    """No script fits: a short new reply from the same rules."""
    nama = data.get("nama") or "kak"
    need = data.get("kebutuhan") or ""
    obj = u.objections[-1]["id"] if u.objections else None
    required: list[str] = []
    if u.rejected or stage == "nurturing":
        text = f"Siap {nama}, makasih udah ngabarin. Kalau nanti butuh, aku ada di sini ya 🙏"
    elif obj == "uncertainty" and (u.seller_offered or u.buying_signals):
        # JOLT: one recommendation, its reason, less risk; nothing promised.
        text = f"{LABEL[obj]} Kalau aku boleh saranin, [paket yang paling pas] paling cocok buat {need or 'kebutuhan kamu'} karena [alasannya]. [Cara ngurangin risiko yang beneran kamu tawarin, mis. revisi atau DP.] {CALIBRATED[obj]}"
        required.append("Isi satu paket yang kamu rekomendasikan dan alasannya.")
        required.append("Isi cara ngurangin risiko yang memang berlaku (jangan janji yang nggak ada), atau hapus kalimatnya.")
    elif obj:
        text = " ".join(x for x in [LABEL[obj], CALIBRATED.get(obj, "")] if x)
    elif stage == "follow_up":
        text = f"Hai {nama}{', nyambung soal ' + need if need else ''}. Kalau masih dicari, aku kirim contoh yang mirip ya. Kalau belum sekarang juga gapapa."
    elif stage in ("proposal", "negotiation"):
        text = f"Siap {nama}! Buat {need or 'kebutuhan kamu'}, aku saranin [paket yang paling pas + harganya]. Mau aku kirim contoh hasilnya juga?"
        required.append("Isi paket dan harga yang beneran sebelum kirim.")
    elif stage == "closing":
        text = f"Siap {nama}! Buat lanjut, [cara DP/booking]. Habis itu jadwalnya aku kunci ya."
        required.append("Isi cara DP/booking yang beneran.")
    else:
        ask = missing[0]["ask"] if missing else "Boleh cerita sedikit kebutuhannya?"
        text = f"Makasih udah cerita, {nama}. {ask}"
    return {"text": text, "changes": [{"kind": "add", "note": "respons baru (nggak ada script yang cocok)"}], "required_edits": required}


FORMAL = [(r"\baku\b", "saya"), (r"\bkamu\b", "Anda"), (r"\bgapapa\b", "tidak apa-apa"), (r"\bnggak\b|\bngga\b|\bga\b|\bgak\b", "tidak"),
          (r"\budah\b", "sudah"), (r"\baja\b", "saja"), (r"\bbanget\b", "sekali"), (r"\bkak\b", "Kak"), (r"\bbikin\b", "membuat"), (r"\bkirimin\b", "kirimkan")]


def formal(text: str) -> str:
    out = text
    for a, b in FORMAL:
        out = re.sub(a, b, out, flags=re.I)
    return out
