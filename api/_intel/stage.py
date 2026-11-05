"""Stage 3 — where the conversation stands now (PRD-023 §3.3).

Not a straight funnel: the latest evidence decides, so a conversation can
step back (a proposal met with "mahal" is in objection handling again).
Each detected stage names the evidence that put it there.
"""
from __future__ import annotations

from .understand import Understanding

STAGES = {
    "intro": "Intro",
    "follow_up": "Follow-up",
    "discovery": "Discovery",
    "proposal": "Proposal",
    "objection_handling": "Objection handling",
    "negotiation": "Negosiasi",
    "closing": "Closing",
    "nurturing": "Nurturing",
}

# The SalesPal stage (lib/templates.ts STAGES) a script for this moment sits in,
# and the ones next to it, for partial credit when matching.
SCRIPT_STAGE = {
    "intro": ("intro", ["followup"]),
    "follow_up": ("followup", ["intro"]),
    "discovery": ("gali", ["followup", "offering"]),
    "proposal": ("offering", ["gali", "closing"]),
    "objection_handling": ("closing", ["gali", "offering"]),
    "negotiation": ("closing", ["offering"]),
    "closing": ("closing", ["offering"]),
    "nurturing": ("etb", ["followup"]),
}


def detect(u: Understanding, messages_total: int) -> dict:
    def last(findings) -> int:
        return max((e for f in findings for e in (f.evidence if hasattr(f, "evidence") else f["evidence"])), default=-1)

    if messages_total == 0:
        return {"stage": "intro", "why": "Belum ada pesan.", "evidence": []}
    if u.prospect_messages == 0:
        stage = "follow_up" if u.seller_unanswered else "intro"
        return {"stage": stage, "why": f"Mereka belum bales ({u.seller_unanswered} pesan kamu belum dijawab)." if u.seller_unanswered else "Belum ada balasan dari mereka.", "evidence": []}
    if u.rejected:
        return {"stage": "nurturing", "why": "Mereka nolak dengan jelas, jadi bukan saatnya nawarin.", "evidence": u.rejected.evidence}
    if u.seller_unanswered >= 1 and u.last_speaker == "seller":
        return {"stage": "follow_up", "why": f"Pesan terakhir dari kamu, {u.seller_unanswered} belum dibales.", "evidence": []}

    marks = {
        "objection_handling": last([o for o in u.objections if o["id"] != "price"]),
        "negotiation": last([o for o in u.objections if o["id"] == "price"]),
        "closing": last([s for s in u.buying_signals if s.text == "asks how to proceed"] + u.commitments),
        "proposal": last([s for s in u.buying_signals if s.text in ("asks price", "asks package / samples", "asks date / availability")]),
        "discovery": last(u.needs + u.situation + u.problems),
    }
    stage, at = max(marks.items(), key=lambda kv: kv[1])
    if at < 0:
        return {"stage": "discovery", "why": "Mereka udah bales, tapi kebutuhannya belum kelihatan.", "evidence": []}
    why = {
        "objection_handling": "Pesan terbaru mereka berisi keberatan.",
        "negotiation": "Mereka lagi bahas harga/budget.",
        "closing": "Mereka nanya cara lanjut (DP/transfer/booking) atau udah janji.",
        "proposal": "Mereka nanya harga, paket, contoh, atau tanggal.",
        "discovery": "Mereka cerita kebutuhan atau situasinya, belum minta penawaran.",
    }[stage]
    return {"stage": stage, "why": why, "evidence": [at]}
