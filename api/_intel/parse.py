"""Stage 1 — a pasted conversation as messages (PRD-023 §3.1).

Takes what sellers actually paste:
- a WhatsApp export line: "08/10/26 14.05 - Dita: Boleh kirim pricelist-nya?"
  or "[08/10/26 14.05.33] Dita: …" (same shapes as lib/waexport.ts);
- a copied DM: "Dita: halo kak" / "Aku: halo";
- plain paragraphs with no names (speaker unknown).

A line without a prefix continues the message above it. Who is the seller is
never guessed from tone: it comes from the seller's name, or a first-person
label ("Aku", "Saya", "Me", "You"); otherwise it's reported as unknown.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

WA = re.compile(
    r"^‎?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*([AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?([^:]{1,60}?):\s(.*)$"
)
NAMED = re.compile(r"^\s*([A-Za-z0-9À-ÿ@._' -]{1,40}?)\s*:\s+(.+)$")
SKIP = re.compile(r"<(Media|Media tidak|media omitted)|tidak disertakan|omitted>|pesan ini (telah )?dihapus|this message was deleted", re.I)
SELF = {"aku", "saya", "gue", "gw", "me", "you", "anda (saya)", "seller", "sales", "admin"}


@dataclass
class Message:
    i: int
    name: str            # as written, "" when no name
    text: str
    at: str = ""         # "2026-10-08 14:05" when the export had it
    speaker: str = "unknown"  # seller | prospect | unknown


@dataclass
class Parsed:
    messages: list[Message] = field(default_factory=list)
    names: list[str] = field(default_factory=list)       # distinct speaker names, by first appearance
    seller: str | None = None                             # the name taken as the seller
    ambiguous: bool = False                               # speakers couldn't be told apart


def _when(d: str, m: str, y: str, hh: str, mm: str) -> str:
    year = int(y) + 2000 if len(y) == 2 else int(y)
    return f"{year:04d}-{int(m):02d}-{int(d):02d} {int(hh):02d}:{mm}"


def parse(text: str, seller_name: str | None = None) -> Parsed:
    out = Parsed()
    lines = (text or "").replace("\r\n", "\n").split("\n")
    msgs: list[Message] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            if msgs and msgs[-1].name == "":
                msgs.append(Message(i=len(msgs), name="", text=""))  # a blank line splits unnamed paragraphs
            continue
        m = WA.match(line)
        if m:
            body = m.group(9).strip()
            if SKIP.search(body):
                continue
            msgs.append(Message(i=len(msgs), name=m.group(8).strip(), text=body, at=_when(*m.group(1, 2, 3, 4, 5))))
            continue
        n = NAMED.match(line)
        # "Catatan: …" inside a message is rare; a short label then text is a speaker.
        if n and len(n.group(1).split()) <= 4 and not re.search(r"https?$", n.group(1)):
            msgs.append(Message(i=len(msgs), name=n.group(1).strip(), text=n.group(2).strip()))
            continue
        if msgs and msgs[-1].text:
            msgs[-1].text = f"{msgs[-1].text}\n{line}"
        else:
            if msgs and not msgs[-1].text:
                msgs[-1].text = line
            else:
                msgs.append(Message(i=len(msgs), name="", text=line))
    msgs = [m for m in msgs if m.text.strip()]
    for k, m in enumerate(msgs):
        m.i = k

    names: list[str] = []
    for m in msgs:
        if m.name and m.name not in names:
            names.append(m.name)
    out.names = names

    seller = None
    if seller_name:
        want = seller_name.strip().lower()
        seller = next((n for n in names if n.lower() == want), None) or next((n for n in names if want and want in n.lower()), None)
    if not seller:
        seller = next((n for n in names if n.lower() in SELF), None)
    out.seller = seller

    for m in msgs:
        if not m.name:
            m.speaker = "unknown"
        elif seller:
            m.speaker = "seller" if m.name == seller else "prospect"
        elif len(names) == 1:
            m.speaker = "prospect" if m.name.lower() not in SELF else "seller"
        else:
            m.speaker = "unknown"
    out.ambiguous = any(m.speaker == "unknown" for m in msgs) and len(names) != 1
    out.messages = msgs
    return out
