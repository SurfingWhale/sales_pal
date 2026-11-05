"""Stage 5 — which of the seller's scripts fits this moment (PRD-023 §3.5).

Weighted heuristic from the spec, not a validated model:
  context 30 · stage 25 · prospect intent 20 · communication objective 15 · tone & channel 10.
Each dimension scores 0..1 with its reasons. A critical mismatch (a script
tagged for another type of business, or one that pushes an offer at someone
who said no) drops the script out of the recommendation whatever its score.
"""
from __future__ import annotations

import re

from .understand import Understanding
from .stage import SCRIPT_STAGE

WEIGHTS = {"context": 30, "stage": 25, "intent": 20, "objective": 15, "tone_channel": 10}
STAGE_ORDER = ["intro", "followup", "gali", "offering", "closing", "etb"]

# Kept in step with lib/scriptPick.ts CATEGORY_WORDS (the app's own pick).
CATEGORY_WORDS = {
    "F&B": ["f&b", "makan", "makanan", "minuman", "menu", "resto", "restoran", "rumah makan", "warung", "kuliner", "kafe", "cafe", "kopi", "coffee", "bakery", "kue", "catering", "katering", "food", "dapur"],
    "Retail": ["retail", "toko", "produk", "katalog", "fashion", "baju", "butik", "olshop", "online shop", "e-commerce", "brand", "marketplace"],
    "Health": ["health", "klinik", "dokter", "gigi", "kesehatan", "apotek", "salon", "beauty", "kecantikan", "spa", "skincare", "gym", "fitness"],
    "Property": ["property", "properti", "rumah", "villa", "apartemen", "kost", "perumahan", "interior", "real estate"],
    "Service": ["service", "bengkel", "laundry", "travel", "event", "acara", "wedding", "nikahan", "pernikahan", "prewed", "prewedding", "lamaran", "ulang tahun", "ultah", "wisuda", "seminar", "konser", "gathering", "agency"],
    "Tech": ["tech", "aplikasi", "app", "software", "startup", "saas", "digital"],
    "Education": ["education", "sekolah", "kursus", "les", "bimbel", "kampus", "pelatihan", "training", "akademi"],
}
STOP = {"yang", "dan", "atau", "buat", "untuk", "dengan", "belum", "sudah", "udah", "punya", "soal", "lagi", "kami", "kamu", "mereka", "ini", "itu", "ada", "bisa", "mau", "jadi", "dari", "pakai", "pake", "kak", "halo", "jasa", "open", "boleh", "kirim", "dong", "aja", "nanti", "gimana", "berapa"}

FEATURES = {
    "question": re.compile(r"\?"),
    "offer": re.compile(r"\b(paket|harga|pricelist|price ?list|penawaran|diskon|promo|kisaran)\b", re.I),
    "proof": re.compile(r"\b(portfolio|portofolio|contoh|hasil|testimoni|klien)\b", re.I),
    "close": re.compile(r"\b(slot|jadwal|tahan|dp|booking|deadline|tenggat|amankan)\b", re.I),
    "soft_out": re.compile(r"\b(gapapa|ga apa|nggak apa|kalau (?:udah|belum)|ga maksa|nggak maksa|semoga lancar|kapan pun|santai aja)\b", re.I),
    "formal": re.compile(r"\b(bapak|ibu|anda|saya)\b", re.I),
    "casual": re.compile(r"\b(kak|aku|kamu|gapapa|yuk)\b", re.I),
}
MANY = re.compile(r"\b(dua pilihan|tiga pilihan|beberapa pilihan|pilihan paket|tinggal pilih|pilih (?:yang|salah satu))\b", re.I)

# Words a script uses when it answers a given objection.
HANDLES = {
    "price": re.compile(r"\b(budget|bujet|hemat|cicil|paket (?:kecil|hemat|basic)|sesuai budget|disesuaiin|opsi)\b", re.I),
    "timing": re.compile(r"\b(kapan pun|nanti|kabarin|ingetin|bulan depan|waktunya pas)\b", re.I),
    "trust": re.compile(r"\b(portfolio|portofolio|testimoni|contoh|garansi|revisi|klien)\b", re.I),
    "existing_provider": re.compile(r"\b(cadangan|backup|bandingin|perbandingan|second opinion|selama ini|biasanya)\b", re.I),
    "no_need": re.compile(r"\b(gapapa|ga apa|nggak apa|kalau nanti butuh|semoga lancar)\b", re.I),
    "authority": re.compile(r"\b(diskusi|didiskusiin|bahan|ringkasan|detail(?:nya)?|kirim(?:in)? info)\b", re.I),
    "uncertainty": re.compile(r"\b(rekomendasi|paling pas|paling cocok|satu pilihan|yang aku saranin)\b", re.I),
}


def _norm(s: str) -> str:
    return " " + re.sub(r"[^a-z0-9&]+", " ", (s or "").lower()).strip() + " "


def _has(text: str, word: str) -> bool:
    return f" {re.sub(r'[^a-z0-9&]+', ' ', word.lower()).strip()} " in _norm(text)


def category_of(*texts: str) -> str | None:
    all_ = " ".join(t for t in texts if t)
    best, n = None, 0
    for c, ws in CATEGORY_WORDS.items():
        if _has(all_, c):
            return c
        hits = sum(1 for w in ws if _has(all_, w))
        if hits > n:
            best, n = c, hits
    return best


def _words(s: str) -> set[str]:
    return {w for w in _norm(s).split() if len(w) >= 4 and w not in STOP}


def intent_of(u: Understanding, stage: str) -> str:
    if u.rejected:
        return "rejected"
    if u.prospect_messages == 0 or stage == "follow_up":
        return "no_reply"
    if u.objections:
        return u.objections[-1]["id"]
    if any(s.text == "asks price" for s in u.buying_signals):
        return "asks_price"
    if stage == "closing":
        return "ready"
    return "exploring"


OBJECTIVE = {
    "intro": "open", "follow_up": "follow_up", "discovery": "discover", "proposal": "inform",
    "objection_handling": "handle", "negotiation": "handle", "closing": "close", "nurturing": "step_back",
}


def score(scripts: list[dict], u: Understanding, stage: str, convo_text: str, channel: str = "", tone: str = "") -> list[dict]:
    theirs = category_of(convo_text)
    want_stage, near = SCRIPT_STAGE[stage]
    intent = intent_of(u, stage)
    objective = OBJECTIVE[stage]
    asked = set()
    for f in u.needs + u.problems + u.situation:
        asked |= _words(f.quote)
    # A word most scripts say tells them apart from nothing.
    bodies = [f"{s.get('title', '')} {s.get('body', '')}" for s in scripts]
    common = {w for w in asked if len(scripts) > 1 and sum(1 for b in bodies if _has(b, w)) * 2 > len(scripts)}
    asked -= common
    wants_formal = tone == "formal"

    out = []
    for s in scripts:
        if s.get("archived"):
            continue
        body = s.get("body", "")
        text = f"{s.get('title', '')} {body}"
        has = {k: bool(rx.search(body)) for k, rx in FEATURES.items()}
        dims: dict[str, dict] = {}
        reasons: list[str] = []
        mismatches: list[str] = []
        critical: list[str] = []

        # Context: their kind of business, and the words of their need.
        tags = s.get("categories") or []
        ctx = 0.5
        if theirs and theirs in tags:
            ctx = 1.0; reasons.append(f"ditandai buat {theirs}")
        elif theirs and tags:
            ctx = 0.0; critical.append(f"ditandai buat {', '.join(tags)}, percakapan ini soal {theirs}")
        elif theirs:
            said = [w for w in CATEGORY_WORDS.get(theirs, []) if _has(body, w)]
            other = [c for c, ws in CATEGORY_WORDS.items() if c != theirs and any(len(w) > 3 and _has(body, w) for w in ws)]
            if said:
                ctx = 0.85; reasons.append(f"nyebut {', '.join(said[:2])}")
            elif other:
                ctx = 0.15; mismatches.append(f"ngomongin {', '.join(other)}, mereka {theirs}")
        shared = [w for w in asked if _has(text, w)]
        if shared:
            ctx = min(1.0, ctx + 0.1 * len(shared)); reasons.append(f"nyambung ke “{', '.join(shared[:3])}”")
        dims["context"] = {"score": round(ctx, 2)}

        # Stage.
        st = s.get("stage") or "intro"
        if st == want_stage:
            sv = 1.0; reasons.append("tahapnya pas")
        elif st in near:
            sv = 0.5
        else:
            sv = 0.0
            if st in STAGE_ORDER and want_stage in STAGE_ORDER and abs(STAGE_ORDER.index(st) - STAGE_ORDER.index(want_stage)) >= 2:
                mismatches.append(f"script tahap {st}, percakapan butuh {want_stage}")
        dims["stage"] = {"score": sv}

        # Prospect intent.
        if intent == "rejected":
            iv = 1.0 if has["soft_out"] and not has["offer"] else 0.0
            if has["offer"] or has["close"]:
                critical.append("mereka udah nolak, script ini masih nawarin")
        elif intent == "no_reply":
            iv = 1.0 if (has["soft_out"] or len(body) < 220) else 0.4
        elif intent in HANDLES:
            iv = 1.0 if HANDLES[intent].search(body) else (0.3 if has["offer"] and intent != "price" else 0.4)
            if iv == 1.0:
                reasons.append("jawab keberatannya")
            if intent in ("no_need", "existing_provider", "timing", "authority") and (has["offer"] or has["close"]):
                critical.append("keberatannya perlu diklarifikasi dulu, script ini langsung nawarin")
            if intent == "uncertainty" and MANY.search(body):
                iv = 0.0
                mismatches.append("mereka bingung milih, script ini nambah pilihan (JOLT: kasih satu rekomendasi)")
        elif intent == "asks_price":
            iv = 1.0 if has["offer"] else 0.3
            if not has["offer"]:
                mismatches.append("mereka nanya harga, script ini nggak nyinggung harga/paket")
        elif intent == "ready":
            iv = 1.0 if has["close"] else 0.5
        else:  # exploring
            iv = 1.0 if has["question"] else 0.5
        dims["intent"] = {"score": iv, "intent": intent}

        # Communication objective for this moment.
        ov = {
            "open": 1.0 if has["question"] else 0.6,
            "follow_up": 1.0 if (has["soft_out"] or has["proof"]) else 0.5,
            "discover": 1.0 if has["question"] and not has["offer"] else (0.5 if has["question"] else 0.2),
            "inform": 1.0 if (has["offer"] or has["proof"]) else 0.3,
            "handle": 1.0 if any(rx.search(body) for rx in HANDLES.values()) and has["question"] else 0.5,
            "close": 1.0 if has["close"] else 0.4,
            "step_back": 1.0 if has["soft_out"] else 0.1,
        }[objective]
        dims["objective"] = {"score": ov, "objective": objective}

        # Tone and channel.
        tv = 1.0
        if wants_formal and has["casual"] and not has["formal"]:
            tv = 0.4; mismatches.append("nadanya santai, kamu minta formal")
        elif tone == "santai" and has["formal"] and not has["casual"]:
            tv = 0.5
        wf = s.get("workflow") or ""
        if channel == "dm" and wf == "leads":
            tv -= 0.3; mismatches.append("script buat Leads (bukan DM)")
        if channel == "wa" and wf == "hunting" and re.search(r"\bpost(?:ingan)?\b|\bthreads\b", body, re.I):
            tv -= 0.3; mismatches.append("script ngomongin post Threads")
        dims["tone_channel"] = {"score": round(max(0.0, tv), 2)}

        total = round(sum(WEIGHTS[k] * dims[k]["score"] for k in WEIGHTS))
        out.append({
            "script_id": s.get("id", ""), "script_name": s.get("title", ""), "stage": st,
            "relevance_score": total,
            "score_breakdown": {k: {"weight": WEIGHTS[k], **dims[k], "points": round(WEIGHTS[k] * dims[k]["score"], 1)} for k in WEIGHTS},
            "matching_reasons": reasons, "mismatches": mismatches, "critical": critical,
        })
    out.sort(key=lambda m: (bool(m["critical"]), -m["relevance_score"], m["script_name"]))
    return out
