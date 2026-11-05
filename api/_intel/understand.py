"""Stage 2 — what the prospect said, with the words that show it (PRD-023 §3.2).

Every finding carries the message it came from. Three kinds are kept apart:
- facts: said outright ("budget-nya max 2 jt");
- inferred: a reasonable reading, named as such ("sensitive to price");
- unknown: what the conversation hasn't told yet (SPIN: situation, problem,
  implication, need-payoff).

Indonesian chat as people type it; rules, not a model, so a reading can be
checked against its evidence and tuned.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .parse import Message

# ---- what a sentence says ---------------------------------------------------

NEED = re.compile(r"\b(butuh|perlu|cari|nyari|nyariin|lagi cari|mau bikin|pengen|pengin|ingin|mau (?:foto|video|desain|bikin|pasang|order)|looking for|need)\b", re.I)
SITUATION = re.compile(r"\b(sekarang (?:kami|kita|aku|saya)|selama ini|biasanya|udah (?:pakai|ada|punya)|sudah (?:pakai|ada|punya)|kami (?:punya|pakai|jual)|kita (?:punya|pakai|jual)|toko kami|bisnis (?:kami|saya)|usaha (?:kami|saya)|cabang|outlet|tim (?:kami|internal)|sendiri (?:fotonya|motoin|foto))\b", re.I)
PROBLEM = re.compile(r"\b(masalah|kendala|susah|ribet|repot|kurang (?:bagus|menarik|rapi|jelas)|jelek|belum (?:punya|ada)|ga ada|gak ada|nggak ada|tidak ada|sepi|turun|anjlok|komplain|keluhan|lama|lambat|ga konsisten|beda-beda|ketinggalan)\b", re.I)
IMPLICATION = re.compile(r"\b(jadi(?:nya)? (?:sepi|turun|rugi|ga laku|kurang laku|kalah)|rugi|kehilangan|kalah sama|ga laku|kurang laku|omzet|penjualan turun|dampak(?:nya)?|gara-gara)\b", re.I)
PAYOFF = re.compile(r"\b(biar|supaya|agar|pengen (?:jadi|lebih)|target(?:nya)?|harapannya|kalau (?:bisa|ada) .{0,30}(?:pasti|bakal|jadi))\b", re.I)
QUESTION = re.compile(r"\?|\b(berapa|gimana|bagaimana|kapan|apa aja|apakah|bisa ga|bisa gak|bisa nggak|ada ga|ada gak|ada nggak|mana)\b", re.I)
COMMIT = re.compile(r"\b(nanti (?:aku|saya|kami) kabarin|aku kabarin|saya kabari|besok (?:aku|saya) (?:transfer|kabarin|kirim)|oke deal|deal ya|siap(?:,| )? (?:kak|ya)|jadi ya|fix ya)\b", re.I)
VAGUE = re.compile(r"\b(mungkin|kayaknya|kayanya|sepertinya|sih|kapan-kapan|lihat nanti|liat nanti|tertarik sih|boleh juga|bisa jadi|siapa tau)\b", re.I)

BUYING = [
    ("asks price", re.compile(r"\b(harga(?:nya)?|berapa|pricelist|price ?list|rate ?card|biaya(?:nya)?|tarif)\b", re.I)),
    ("asks package / samples", re.compile(r"\b(paket(?:nya)?|portfolio|portofolio|contoh(?: hasil)?|katalog)\b", re.I)),
    ("asks date / availability", re.compile(r"\b(tanggal|kosong ga|kosong gak|available|slot|jadwal(?:nya)?|bisa (?:tanggal|hari|minggu))\b", re.I)),
    ("asks how to proceed", re.compile(r"\b(dp|down ?payment|transfer|invoice|cara (?:order|pesan|booking)|booking|kontrak|spk)\b", re.I)),
]

OBJECTIONS = [
    ("price", "Harga", re.compile(r"\b(mahal|kemahalan|kemurahan|over ?budget|budget(?:nya)? (?:terbatas|kurang|tipis|mepet|ga cukup|gak cukup|nggak cukup)|diskon|nego|bisa kurang|turunin)\b", re.I)),
    ("timing", "Waktu", re.compile(r"\b(nanti (?:aja|dulu|ya)|belum (?:sekarang|waktunya)|lain kali|next time|bulan depan aja|tahun depan|lagi ga dulu|lagi gak dulu|lagi nggak dulu|ditunda)\b", re.I)),
    ("trust", "Kepercayaan", re.compile(r"\b(ragu|takut|bisa dipercaya|testimoni|review(?:nya)?|beneran|amanah|pernah ketipu|garansi)\b", re.I)),
    ("existing_provider", "Sudah ada vendor", re.compile(r"\b(sudah punya|udah punya|udah ada|sudah ada|langganan|fotografer sendiri|vendor lain|tim internal|sendiri aja|dikerjain sendiri|udah pakai|sudah pakai)\b", re.I)),
    ("no_need", "Belum butuh", re.compile(r"\b(ga butuh|gak butuh|nggak butuh|tidak butuh|ga perlu|gak perlu|nggak perlu|tidak perlu|belum perlu|belum butuh|ga dulu|gak dulu|nggak dulu)\b", re.I)),
    ("authority", "Perlu persetujuan", re.compile(r"\b(tanya (?:bos|atasan|owner|suami|istri|partner|tim|keluarga)|diskusi(?:in)? dulu|ngobrol dulu sama|izin dulu|keputusan(?:nya)? (?:di|ada di)|bukan saya yang (?:putusin|mutusin))\b", re.I)),
    ("uncertainty", "Belum yakin", re.compile(r"\b(pikir-pikir|dipikir|mikir dulu|belum yakin|masih bingung|bingung|lihat dulu|liat dulu|bandingin dulu|banding(?:in)?)\b", re.I)),
]
REJECT = re.compile(r"\b(ga usah|gak usah|nggak usah|tidak usah|stop|jangan (?:chat|hubungi|dm)|ga minat|gak minat|nggak minat|tidak minat|tidak tertarik|ga tertarik|gak tertarik)\b", re.I)

POSITIVE = re.compile(r"(makasih|terima kasih|mantap|keren|bagus|wah|siap|oke|ok\b|boleh|🙏|😊|😍|👍)", re.I)
HESITANT = re.compile(r"\b(hmm+|emm+|kayaknya|mungkin|sebenernya|sebenarnya|tapi)\b", re.I)
NEGATIVE = re.compile(r"\b(kecewa|kesel|males|ribet|ga jelas|spam|ganggu)\b", re.I)


@dataclass
class Finding:
    text: str
    evidence: list[int] = field(default_factory=list)   # message indexes
    quote: str = ""


@dataclass
class Understanding:
    situation: list[Finding] = field(default_factory=list)
    problems: list[Finding] = field(default_factory=list)
    implications: list[Finding] = field(default_factory=list)
    payoffs: list[Finding] = field(default_factory=list)
    needs: list[Finding] = field(default_factory=list)
    buying_signals: list[Finding] = field(default_factory=list)
    objections: list[dict] = field(default_factory=list)   # {id,label,quote,evidence}
    rejected: Finding | None = None
    questions_open: list[Finding] = field(default_factory=list)  # prospect asked, seller hasn't answered
    commitments: list[Finding] = field(default_factory=list)
    vague: list[Finding] = field(default_factory=list)
    tone: str = "netral"
    seller_unanswered: int = 0      # seller messages after the prospect's last one
    seller_offered: bool = False    # the seller already sent options / a price
    prospect_messages: int = 0
    last_speaker: str = "unknown"


def _quote(s: str, n: int = 140) -> str:
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def _sentences(text: str) -> list[str]:
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n+", text) if x.strip()]


def understand(messages: list[Message]) -> Understanding:
    u = Understanding()
    theirs = [m for m in messages if m.speaker == "prospect"]
    # Speakers unknown: read everything, the caller lowers confidence.
    if not theirs and all(m.speaker == "unknown" for m in messages):
        theirs = list(messages)
    u.prospect_messages = len(theirs)
    u.last_speaker = messages[-1].speaker if messages else "unknown"

    # Seller messages after the prospect's last word: unanswered follow-ups.
    last_theirs = max((m.i for m in theirs), default=-1)
    u.seller_unanswered = sum(1 for m in messages if m.speaker == "seller" and m.i > last_theirs)
    u.seller_offered = any(m.speaker == "seller" and re.search(r"\b(paket(?:nya)?|harga(?:nya)?|pricelist|pilihan|opsi|rp\s?\d|\d+\s?(?:rb|ribu|jt|juta|k)\b)", m.text, re.I) for m in messages)

    pos = neg = hes = 0
    for m in theirs:
        for s in _sentences(m.text):
            f = Finding(text=_quote(s), evidence=[m.i], quote=_quote(s))
            if NEED.search(s): u.needs.append(f)
            if SITUATION.search(s): u.situation.append(f)
            if PROBLEM.search(s): u.problems.append(f)
            if IMPLICATION.search(s): u.implications.append(f)
            if PAYOFF.search(s): u.payoffs.append(f)
            if COMMIT.search(s): u.commitments.append(f)
            if VAGUE.search(s): u.vague.append(f)
            for label, rx in BUYING:
                if rx.search(s):
                    u.buying_signals.append(Finding(text=label, evidence=[m.i], quote=_quote(s)))
            for oid, olabel, rx in OBJECTIONS:
                if rx.search(s):
                    u.objections.append({"id": oid, "label": olabel, "quote": _quote(s), "evidence": [m.i]})
            if REJECT.search(s) and not u.rejected:
                u.rejected = f
        pos += len(POSITIVE.findall(m.text)); neg += len(NEGATIVE.findall(m.text)); hes += len(HESITANT.findall(m.text))
        # A question of theirs counts as open until a seller message follows it.
        if QUESTION.search(m.text) and not any(x.speaker == "seller" and x.i > m.i for x in messages):
            u.questions_open.append(Finding(text=_quote(m.text), evidence=[m.i], quote=_quote(m.text)))

    if u.rejected or neg > pos:
        u.tone = "negatif"
    elif hes > 0 and hes >= pos:
        u.tone = "ragu"
    elif pos > 0:
        u.tone = "positif"
    # The same objection said twice is one objection, with both pieces of evidence.
    merged: dict[str, dict] = {}
    for o in u.objections:
        if o["id"] in merged:
            merged[o["id"]]["evidence"] += o["evidence"]
        else:
            merged[o["id"]] = dict(o)
    u.objections = list(merged.values())
    return u


def missing(u: Understanding) -> list[dict]:
    """SPIN, in order: what hasn't come up yet, and a question that would bring it out."""
    out = []
    if not u.situation:
        out.append({"item": "situation", "label": "Situasi sekarang", "why": "Belum ada cerita gimana mereka ngerjain ini sekarang.",
                    "ask": "Selama ini kebutuhan ini biasanya ditangani gimana?"})
    if not u.problems:
        out.append({"item": "problem", "label": "Masalahnya", "why": "Belum ada yang bilang apa yang kurang atau bikin repot.",
                    "ask": "Dari cara yang sekarang, bagian mana yang paling bikin repot?"})
    if u.problems and not u.implications:
        out.append({"item": "implication", "label": "Dampaknya", "why": "Masalahnya udah kesebut, dampaknya ke bisnis belum.",
                    "ask": "Kalau itu dibiarin, pengaruhnya ke penjualan atau kerjaan sehari-hari gimana?"})
    if (u.problems or u.needs) and not u.payoffs:
        out.append({"item": "need_payoff", "label": "Hasil yang diharapkan", "why": "Belum ada gambaran hasil yang mereka mau.",
                    "ask": "Kalau ini beres, hasil yang paling kamu harapin apa?"})
    if not any(s.text == "asks date / availability" for s in u.buying_signals):
        out.append({"item": "timing", "label": "Kapan butuhnya", "why": "Waktu/tanggal belum disebut.", "ask": "Rencananya buat kapan?"})
    return out
