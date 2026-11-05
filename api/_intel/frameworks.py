"""Stage 4 — which ideas from the sales books fit this conversation (PRD-023 §3.4).

A framework is chosen by a rule over the evidence, never as decoration. Each
one says which concept applies, the messages that call for it, what to do
with it here, and its limits — including when not to use it. Concepts are
paraphrased from the books named in PRD-023 §2; nothing here quotes them.
"""
from __future__ import annotations

from .understand import Understanding


def _ev(findings) -> list[str]:
    out = []
    for f in findings:
        q = f.quote if hasattr(f, "quote") else f.get("quote", "")
        if q and q not in out:
            out.append(q)
    return out[:3]


def analyze(u: Understanding, stage: str, missing: list[dict]) -> list[dict]:
    out: list[dict] = []
    obj = {o["id"]: o for o in u.objections}

    def add(framework, concept, evidence, application, limitations):
        out.append({"framework": framework, "concept": concept, "supporting_evidence": evidence,
                    "application": application, "limitations": limitations})

    # SPIN: discovery isn't done while situation or problem is missing.
    gaps = [m for m in missing if m["item"] in ("situation", "problem", "implication", "need_payoff")]
    if u.prospect_messages and gaps and stage in ("discovery", "proposal", "follow_up", "intro") and not u.rejected:
        first = gaps[0]
        concept = {"situation": "Situation question", "problem": "Problem question", "implication": "Implication question", "need_payoff": "Need-payoff question"}[first["item"]]
        add("SPIN Selling", concept, _ev(u.needs + u.situation + u.problems) or ["Belum ada cerita soal situasi/masalah mereka."],
            f"Tanya satu dulu: “{first['ask']}” Jangan kirim penawaran sebelum {first['label'].lower()} jelas.",
            "Satu pertanyaan per pesan; rentetan pertanyaan kebaca kayak interogasi. Kalau mereka cuma nanya harga, jawab dulu baru gali.")

    # The Mom Test: polite or hypothetical words are not evidence of a need.
    if u.vague and not u.commitments:
        add("The Mom Test", "Perilaku nyata, bukan niat", _ev(u.vague),
            "Tanya apa yang udah mereka lakuin, bukan apa yang mungkin mereka mau: “Terakhir kali butuh ini, ngerjainnya gimana?” Jangan tanya “Tertarik nggak?”",
            "Kata ramah bukan tanda beli. Kalau mereka udah jelas nanya harga atau tanggal, nggak perlu dipancing lagi.")

    # Gap Selling: a problem with no stated consequence or goal.
    if u.problems and not (u.implications or u.payoffs):
        add("Gap Selling", "Current state → future state", _ev(u.problems),
            "Pahami kondisi sekarang dan hasil yang mereka mau sebelum nawarin; tawaran baru masuk akal kalau gap-nya nyata.",
            "Jangan ngarang gap yang belum mereka sebut. Kalau mereka puas sama kondisi sekarang, hargai itu.")

    # Objections (Blount) + tactical empathy (Voss) on hesitation.
    if obj:
        labels = ", ".join(o["label"] for o in obj.values())
        add("Objections", "Kenali tipe keberatan, klarifikasi dulu", _ev(list(obj.values())),
            f"Keberatan: {labels}. Akui dulu, tanya apa yang sebenarnya jadi perhatian, baru kasih info yang relevan.",
            "Tiap keberatan bukan undangan buat ngebujuk. Kalau alasannya jelas dan wajar, tawarkan jeda, jangan maksa.")
    if obj or u.tone == "ragu":
        add("Never Split the Difference", "Labeling + calibrated question", _ev(list(obj.values()) + u.vague),
            "Sebut perasaan yang kelihatan (“Kedengarannya …”), lalu satu pertanyaan terbuka yang diawali ‘gimana/apa’.",
            "Pakai secukupnya; label yang dibuat-buat kebaca manipulatif.")

    # JOLT: interested but undecided.
    if "uncertainty" in obj and (u.buying_signals or u.seller_offered):
        add("The JOLT Effect", "Kasih satu rekomendasi, batasi pilihan, kurangi risiko", _ev(u.buying_signals + [obj["uncertainty"]]),
            "Mereka tertarik tapi belum mutusin: rekomendasikan satu paket yang paling pas, sebut kenapa, dan tawarkan cara yang menurunkan risiko (mis. DP kecil, revisi jelas).",
            "Ragu ≠ nggak minat; tapi jangan bikin janji yang nggak bisa kamu tepati.")

    # Fanatical Prospecting: no reply.
    if stage == "follow_up" or (u.prospect_messages == 0 and u.seller_unanswered):
        n = u.seller_unanswered
        add("Fanatical Prospecting", "Disiplin follow-up", [f"{n} pesan kamu belum dibales."] if n else ["Belum ada balasan."],
            "Follow-up pendek dengan alasan baru (contoh hasil, info relevan), bukan ‘cuma ngecek’." if n < 3 else "Udah 3 kali tanpa balasan: berhenti dulu, coba lagi 2 minggu lagi lewat kanal lain.",
            "Nggak dibales bukan berarti nolak; tapi lebih dari 3 follow-up beruntun kebaca spam.")

    # Proposal: concrete and credible.
    if stage in ("proposal", "negotiation", "closing"):
        add("Made to Stick", "Simple & concrete", _ev(u.buying_signals),
            "Jawab yang mereka tanya dengan angka/contoh konkret; satu pesan, satu ajakan.",
            "Konkret bukan berarti panjang; buang penjelasan yang nggak ditanya.")
        add("Influence", "Social proof yang nyata", _ev(u.buying_signals),
            "Lampirkan contoh hasil atau klien yang mirip bisnisnya (kalau ada).",
            "Jangan pakai testimoni, kelangkaan slot, atau otoritas yang nggak beneran ada.")

    # Challenger: only once there's enough context to teach something useful.
    if (u.situation or u.problems) and stage in ("discovery", "proposal") and not obj:
        add("The Challenger Sale", "Teach & tailor (opsional)", _ev(u.situation + u.problems),
            "Kalau kamu punya insight relevan buat bisnis mereka (mis. foto menu yang konsisten bikin pesanan online naik), sampaikan singkat sebelum nawarin.",
            "Opsional. Jangan maksa insight provokatif ke setiap percakapan, apalagi yang baru mulai.")
    return out
