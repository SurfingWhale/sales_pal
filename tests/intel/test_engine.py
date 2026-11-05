"""Script Intelligence rules (api/_intel): real-shaped chats, expected readings."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "api"))

from _intel.analyze import run
from _intel.parse import parse

SCRIPTS = [
    {"id": "cold", "stage": "intro", "title": "Cold DM — Tawarin Jasa", "body": "Halo {nama}! Aku fotografer makanan freelance 📸 Foto menu yang aesthetic bisa naikin order online. Boleh aku kirim portfolio + paket harga?"},
    {"id": "gali", "stage": "gali", "title": "Gali kebutuhan", "body": "Makasih udah bales, {nama}! Biar aku siapin yang pas:[ {kebutuhan}-nya] buat apa, kira-kira berapa banyak, dan budget-nya di kisaran berapa?"},
    {"id": "offer", "stage": "offering", "title": "Penawaran — dua pilihan", "body": "Siap {nama}! Aku ada dua pilihan paket, aku kirim detail + contoh hasilnya ya. Tinggal pilih yang paling cocok."},
    {"id": "fu", "stage": "followup", "title": "Follow-up — ga maksa", "body": "Hai {nama}, nyambung soal foto kemarin. Masih nyari? Kalau udah dapet juga gapapa, semoga lancar ya 🙌"},
    {"id": "wed", "stage": "intro", "title": "Intro wedding", "body": "Halo {nama}! Aku pegang dokumentasi wedding.", "categories": ["Service"]},
]


def test_parse_wa_export_and_seller():
    p = parse("08/10/26 14.05 - Dita: Halo kak, ada pricelist?\n08/10/26 14.07 - Raka: Ada kak\nini lanjutannya", seller_name="Raka")
    assert [m.speaker for m in p.messages] == ["prospect", "seller"]
    assert p.messages[1].text.endswith("ini lanjutannya") and p.messages[0].at == "2026-10-08 14:05"


def test_speakers_ambiguous_without_seller():
    p = parse("Dita: halo\nRaka: halo juga")
    assert p.ambiguous and p.seller is None


def test_existing_provider_is_objection_not_offer():
    r = run("Aku: Halo kak, aku fotografer makanan, boleh kirim portfolio?\nDita: Kami sudah punya fotografer langganan kak", SCRIPTS)
    assert r["detected_stage"]["id"] == "objection_handling"
    assert any(o["id"] == "existing_provider" for o in r["objections"])
    text = r["recommended_adjustment"]["text"]
    assert text.startswith("Wajar kalau udah ada yang biasa pegang.")
    assert "?" in text  # a calibrated question, not a pitch
    assert any(t["framework"] == "Objections" for t in r["theoretical_analysis"])


def test_price_question_requires_a_real_answer():
    r = run("Aku: Halo kak\nDita: Halo, buat foto menu 20 item berapa ya harganya?", SCRIPTS)
    assert r["detected_stage"]["id"] == "proposal"
    best = r["script_matches"][0]
    assert best["script_id"] == "offer"
    assert set(best["score_breakdown"]) == {"context", "stage", "intent", "objective", "tone_channel"}


def test_no_reply_follow_up_with_way_out():
    r = run("Aku: Halo kak, aku fotografer makanan. Boleh kirim contoh?\nAku: Hai kak, nyambung yang kemarin ya", SCRIPTS, prospect_name="Dita")
    assert r["detected_stage"]["id"] == "follow_up"
    assert r["recommended_adjustment"]["from_script"]["script_id"] == "fu"
    assert "gapapa" in r["recommended_adjustment"]["text"]


def test_rejection_never_offers():
    r = run("Aku: Halo kak, mau ditawarin paket foto?\nDita: ga usah kak, ga tertarik", SCRIPTS)
    assert r["detected_stage"]["id"] == "nurturing"
    text = r["recommended_adjustment"]["text"]
    assert "paket" not in text and "harga" not in text


def test_tagged_script_for_other_business_is_critical():
    r = run("Aku: Halo\nDita: aku lagi butuh foto menu buat resto baru", SCRIPTS)
    wed = next(m for m in r["script_matches"] if m["script_id"] == "wed")
    assert wed["critical"]
    assert r["recommended_adjustment"]["from_script"] is None or r["recommended_adjustment"]["from_script"]["script_id"] != "wed"


def test_discovery_asks_one_spin_question():
    r = run("Aku: Halo kak\nDita: iya kak, kami lagi butuh foto produk", SCRIPTS)
    assert r["detected_stage"]["id"] == "discovery"
    assert any(t["framework"] == "SPIN Selling" for t in r["theoretical_analysis"])
    assert r["recommended_adjustment"]["text"].count("?") >= 1


def test_every_finding_has_evidence():
    r = run("Aku: Halo\nDita: kami sudah punya fotografer tapi hasilnya beda-beda, jadi feed-nya kurang rapi", SCRIPTS)
    for f in r["explicit_facts"] + r["expressed_needs"]:
        assert f["evidence"] and f["quote"]


def test_existing_provider_gets_a_clarifying_reply_not_a_pitch():
    r = run("Aku: Halo kak, aku fotografer makanan, boleh kirim portfolio?\nDita: Kami sudah punya fotografer langganan kak", SCRIPTS)
    cold = next(m for m in r["script_matches"] if m["script_id"] == "cold")
    assert cold["critical"]
    text = r["recommended_adjustment"]["text"]
    assert "paket" not in text and "portfolio" not in text and text.endswith("?")


def test_undecided_after_options_gets_one_recommendation():
    r = run("Aku: ini dua paketnya ya kak\nDita: hmm bagus sih, tapi kayaknya mau pikir-pikir dulu, bingung pilih yang mana", SCRIPTS)
    assert any(t["framework"] == "The JOLT Effect" for t in r["theoretical_analysis"])
    rec = r["recommended_adjustment"]
    assert rec["from_script"] is None and "JOLT" in rec["why"] and "saranin" in rec["text"]
    assert rec["required_edits"]  # the package and the risk reducer are the seller's to fill


def test_price_question_without_a_figure_must_be_answered():
    r = run("Aku: Halo kak\nDita: Halo, buat foto menu 20 item berapa ya harganya?", SCRIPTS)
    assert any("harga" in e for e in r["recommended_adjustment"]["required_edits"])


def test_api_contract_and_sign_in():
    from fastapi.testclient import TestClient
    import index
    c = TestClient(index.app)
    assert c.post("/api/script-intelligence/analyze", json={"conversation_text": "Dita: halo"}).status_code == 401
    index._verify = lambda a: "uid_test"
    r = c.post("/api/script-intelligence/analyze", headers={"Authorization": "Bearer x"},
               json={"conversation_text": "Aku: Halo\nDita: berapa harganya?", "scripts": SCRIPTS})
    assert r.status_code == 200
    body = r.json()
    for k in ["detected_stage", "conversation_summary", "explicit_facts", "inferred_context", "expressed_needs", "objections",
              "missing_information", "buying_signals", "theoretical_analysis", "script_matches", "recommended_adjustment",
              "alternative_responses", "next_action", "confidence", "limitations"]:
        assert k in body
    assert c.post("/api/script-intelligence/analyze", headers={"Authorization": "Bearer x"}, json={"conversation_text": ""}).status_code == 422
