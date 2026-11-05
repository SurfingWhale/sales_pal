"""Stage 7 — the whole analysis, in the shape of the API contract (PRD-023 §7).

Deterministic: the same conversation and scripts give the same answer. Every
part says what it rests on, and `limitations` says what this can't know.
"""
from __future__ import annotations

from .adjust import adjust, compose, formal
from .frameworks import analyze as frameworks_for
from .match import HANDLES, category_of, score
from .parse import parse
from .stage import STAGES, detect
from .understand import missing as missing_info, understand

MIN_SCORE = 55  # below this no script is recommended; a new reply is offered instead

NEXT = {
    "intro": "Kirim satu pesan pembuka yang nyebut kebutuhannya, satu ajakan kecil.",
    "follow_up": "Follow-up pendek dengan alasan baru; kalau udah 3 kali nggak dibales, berhenti dulu 2 minggu.",
    "discovery": "Tanya satu hal yang belum jelas, tunggu jawabannya sebelum kirim harga.",
    "proposal": "Jawab pertanyaannya dengan angka/contoh nyata, satu rekomendasi, satu langkah berikutnya.",
    "objection_handling": "Akui keberatannya, klarifikasi alasannya, baru kasih info yang relevan (atau kasih jeda).",
    "negotiation": "Klarifikasi budget-nya, tawarkan opsi yang lebih kecil sebelum mikir diskon.",
    "closing": "Kirim cara lanjut yang jelas (DP/booking) dan kunci jadwalnya.",
    "nurturing": "Jangan nawarin lagi sekarang. Catat alasannya, sapa lagi nanti dengan info yang berguna.",
}


def _f(f):
    return {"text": f.text, "evidence": f.evidence, "quote": f.quote}


def run(conversation_text: str, scripts: list[dict], seller_name: str | None = None, business_context: str | None = None,
        tone_preference: str | None = None, channel: str | None = None, prospect_name: str | None = None) -> dict:
    p = parse(conversation_text, seller_name)
    u = understand(p.messages)
    st = detect(u, len(p.messages))
    stage = st["stage"]
    miss = missing_info(u)
    theory = frameworks_for(u, stage, miss)
    matches = score(scripts, u, stage, conversation_text, channel or "", tone_preference or "")

    them = prospect_name or next((m.name for m in p.messages if m.speaker == "prospect" and m.name), "")
    need = u.needs[-1].quote if u.needs else ""
    data = {"nama": them.split()[0] if them else "", "kebutuhan": "", "bisnis": business_context or ""}

    usable = [m for m in matches if not m["critical"]]
    best = usable[0] if usable and usable[0]["relevance_score"] >= MIN_SCORE else None
    # JOLT: undecided after an offer. A script that doesn't help them decide
    # (re-asking discovery, more options) gives way to one recommendation.
    jolt = any(t["framework"] == "The JOLT Effect" for t in theory)
    jolt_skip = None
    if best and jolt:
        body = next(s for s in scripts if s.get("id") == best["script_id"]).get("body", "")
        if not HANDLES["uncertainty"].search(body):
            jolt_skip, best = best, None
    if best:
        src = next(s for s in scripts if s.get("id") == best["script_id"])
        rec = adjust(src.get("body", ""), data, u, stage, miss, conversation_text)
        rec["from_script"] = {"script_id": best["script_id"], "script_name": best["script_name"]}
        why = f"Pakai “{best['script_name']}” ({best['relevance_score']}%): " + ("; ".join(best["matching_reasons"]) or "paling dekat buat tahap ini") + "."
    else:
        rec = compose(data, u, stage, miss)
        rec["from_script"] = None
        if jolt_skip:
            why = (f"“{jolt_skip['script_name']}” ({jolt_skip['relevance_score']}%) nggak bantu mereka mutusin; mereka butuh satu rekomendasi (JOLT). "
                   "Ini respons baru dari aturan yang sama. Bisa disimpan jadi script baru.")
        else:
            why = ("Nggak ada script yang cocok" + (f" (tertinggi {usable[0]['relevance_score']}%, di bawah {MIN_SCORE}%)" if usable else "") +
                   "; ini respons baru dari aturan yang sama. Bisa disimpan jadi script baru.")
    rec["why"] = why
    if tone_preference == "formal":
        rec["text"] = formal(rec["text"])

    alternatives = []
    for m in usable[1:3]:
        src = next(s for s in scripts if s.get("id") == m["script_id"])
        a = adjust(src.get("body", ""), data, u, stage, miss, conversation_text)
        alternatives.append({"label": f"Dari “{m['script_name']}” ({m['relevance_score']}%)", "text": a["text"], "script_id": m["script_id"]})
    alternatives.append({"label": "Nada formal" if tone_preference != "formal" else "Nada santai",
                         "text": formal(rec["text"]) if tone_preference != "formal" else rec["text"]})

    # Confidence: how much the reading rests on.
    evidence = len(u.needs) + len(u.problems) + len(u.situation) + len(u.objections) + len(u.buying_signals)
    conf = 0.35 + min(0.4, 0.08 * evidence) + (0.15 if not p.ambiguous else -0.15) + (0.1 if best else 0)
    conf = round(max(0.1, min(0.95, conf)), 2)

    limitations = [
        "Dibaca pakai aturan dan kata kunci bahasa Indonesia, bukan AI; kalimat yang nggak biasa bisa kelewat.",
        "Bobot skor (30/25/20/15/10) heuristik awal, belum divalidasi dengan data hasil.",
    ]
    if p.ambiguous:
        limitations.insert(0, "Siapa penjual dan siapa prospek belum jelas: pilih nama kamu supaya hasilnya akurat.")
    if not u.prospect_messages:
        limitations.append("Belum ada pesan dari prospek, jadi kebutuhannya belum bisa dibaca.")

    inferred = []
    if any(o["id"] == "price" for o in u.objections) or any(s.text == "asks price" for s in u.buying_signals):
        inferred.append({"text": "Harga jadi pertimbangan utama", "basis": "mereka nyinggung harga/budget"})
    if u.tone == "ragu":
        inferred.append({"text": "Masih ragu", "basis": "banyak kata ragu (kayaknya, mungkin, tapi)"})
    cat = category_of(conversation_text)
    if cat:
        inferred.append({"text": f"Bisnisnya kemungkinan {cat}", "basis": "kata-kata khas tipe bisnis di percakapan"})

    return {
        "detected_stage": {"id": stage, "label": STAGES[stage], "why": st["why"], "evidence": st["evidence"]},
        "conversation_summary": {
            "messages": len(p.messages), "prospect_messages": u.prospect_messages, "seller_unanswered": u.seller_unanswered,
            "speakers": p.names, "seller": p.seller, "ambiguous_speakers": p.ambiguous, "tone": u.tone,
            "situation": u.situation[-1].quote if u.situation else "",
            "main_concern": (u.objections[-1]["label"] + ": " + u.objections[-1]["quote"]) if u.objections else (need or ""),
        },
        "messages": [{"i": m.i, "name": m.name, "speaker": m.speaker, "text": m.text, "at": m.at} for m in p.messages],
        "explicit_facts": [_f(f) for f in (u.situation + u.problems + u.implications + u.payoffs)],
        "inferred_context": inferred,
        "expressed_needs": [_f(f) for f in u.needs],
        "objections": u.objections,
        "missing_information": miss,
        "buying_signals": [_f(f) for f in u.buying_signals],
        "open_questions": [_f(f) for f in u.questions_open],
        "commitments": [_f(f) for f in u.commitments],
        "theoretical_analysis": theory,
        "script_matches": matches[:6],
        "recommended_adjustment": rec,
        "alternative_responses": alternatives,
        "next_action": NEXT[stage],
        "confidence": conf,
        "limitations": limitations,
        "engine": "rules-v1",
    }
