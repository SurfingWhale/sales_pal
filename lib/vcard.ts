// Parse a vCard (.vcf) file — what iPhone's Contacts app and iCloud.com export —
// into rows keyed by the lead import fields. One file may hold many contacts.

export interface VCardRow {
  name: string;     // company if the card has one, else the person's name
  contact: string;  // the person's name
  email: string;
  phone: string;
  notes: string;
}

function decodeQP(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

export function parseVCards(text: string): VCardRow[] {
  // Unfold continuation lines (RFC 6350: a line starting with space/tab
  // continues the previous one; quoted-printable uses a trailing "=").
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/=\n/g, "")
    .replace(/\n[ \t]/g, "")
    .split("\n");

  const rows: VCardRow[] = [];
  let card: { fn: string; n: string; org: string; tel: string[]; email: string[]; note: string } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^BEGIN:VCARD$/i.test(line)) {
      card = { fn: "", n: "", org: "", tel: [], email: [], note: "" };
      continue;
    }
    if (/^END:VCARD$/i.test(line)) {
      if (card) {
        const person = card.fn || card.n;
        const company = card.org;
        if (person || company || card.tel.length || card.email.length) {
          rows.push({
            name: company || person,
            contact: person,
            email: card.email[0] || "",
            phone: card.tel[0] || "",
            notes: [card.note, card.tel.length > 1 ? `HP lain: ${card.tel.slice(1).join(", ")}` : ""].filter(Boolean).join(" · "),
          });
        }
      }
      card = null;
      continue;
    }
    if (!card) continue;

    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    let value = line.slice(colon + 1);
    // Property name, minus any "item1." group prefix.
    const prop = head.split(";")[0].replace(/^item\d+\./i, "").toUpperCase();
    if (/ENCODING=QUOTED-PRINTABLE/i.test(head)) value = decodeQP(value);

    switch (prop) {
      case "FN": card.fn = unescape(value); break;
      case "N": {
        // N:Family;Given;Middle;Prefix;Suffix
        const [family = "", given = ""] = value.split(";");
        card.n = unescape([given, family].filter(Boolean).join(" "));
        break;
      }
      case "ORG": card.org = unescape(value.split(";")[0]); break;
      case "TEL": { const t = value.trim(); if (t) card.tel.push(t); break; }
      case "EMAIL": { const m = value.trim(); if (m) card.email.push(m); break; }
      case "NOTE": card.note = unescape(value); break;
    }
  }
  return rows;
}
