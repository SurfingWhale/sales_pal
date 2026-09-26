// Leads the websites send (creative-hub standards/leads.md): how an
// `inbound_leads` document becomes a lead in the Leads tab.
//
// Two kinds arrive. A claim comes from the site's offer, with answers and a
// voucher. A member is someone who just made an account on the site, with only
// a name and an email. Both carry the site account, so one person is one lead:
// the member lead is kept, and a later claim upgrades it rather than adding a
// second one.

export interface InboundLead {
  site: string;
  siteUrl?: string;
  offer?: { code: string; kind: string; value: number };
  contact: { name: string; email?: string; whatsapp?: string; business?: string };
  answers?: { need?: string; timing?: string; heardFrom?: string; budget?: string; message?: string };
  attribution?: Record<string, string>;
  account?: { provider?: string; uid?: string; project?: string };
}

// The fields a website lead fills in. Leads carry more (follow-ups), which an
// import leaves alone.
export interface LeadFields {
  name: string; contact: string; source: string; status: string; score: number;
  email: string; phone: string; category: string; notes: string; lastContact: string; value: number;
  accountUid?: string;
}

const SITE_CATEGORY: Record<string, string> = { visufavor: "F&B", "untmd-sports": "Sports", beuntamed: "Photography" };
export const MEMBER_NOTE = "Member baru: daftar di situs, belum klaim penawaran";

export function isMember(l: InboundLead): boolean {
  return !l.offer && !l.answers;
}

// One lead per site account; a lead without an account keeps its own document.
export function leadIdFor(l: InboundLead, docId: string): string {
  const uid = l.account?.uid;
  return uid ? `acct_${l.site}_${uid}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200) : `in_${docId}`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function leadFromInbound(l: InboundLead): LeadFields {
  const a = l.answers || {};
  const t = l.attribution || {};
  const campaign = [t.utm_source, t.utm_campaign].filter(Boolean).join("/");
  const paid = /paid|cpc|ads?|boost/i.test(t.utm_medium || "") || Boolean(t.fbclid || t.gclid || t.ttclid);
  const tag = campaign ? ` · ${campaign}` : "";
  const base = {
    contact: l.contact.name,
    email: l.contact.email || "",
    phone: l.contact.whatsapp || "",
    category: SITE_CATEGORY[l.site] || "Other",
    lastContact: today(),
    ...(l.account?.uid ? { accountUid: l.account.uid } : {}),
  };
  const campaignNote = campaign && `Campaign: ${campaign}${paid ? " (paid)" : ""}`;

  if (isMember(l)) {
    return {
      ...base,
      name: l.contact.business || l.contact.name,
      source: `Member · ${l.site}${tag}`,
      status: "Cold",
      score: 40,
      notes: [MEMBER_NOTE, campaignNote].filter(Boolean).join(" · "),
      value: 0,
    };
  }

  const soon = /this month|bulan ini|asap|secepatnya/i.test(a.timing || "");
  const later = /next month|bulan depan/i.test(a.timing || "");
  return {
    ...base,
    name: l.contact.business || l.contact.name,
    source: `Web · ${l.site}${tag}`,
    status: soon ? "Hot" : "Warm",
    score: Math.min(98, 55 + (soon ? 25 : later ? 12 : 0) + (l.contact.whatsapp ? 10 : 0) + (l.contact.business ? 5 : 0)),
    notes: [
      a.need && `Need: ${a.need}`,
      a.timing && `When: ${a.timing}`,
      a.heardFrom && `Heard from: ${a.heardFrom}`,
      a.message && `Message: ${a.message}`,
      l.offer && `Voucher ${l.offer.code} (${l.offer.value}% ${l.offer.kind})`,
      campaignNote,
    ].filter(Boolean).join(" · "),
    value: parseInt((a.budget || "").replace(/\D/g, "")) || 0,
  };
}

const RANK: Record<string, number> = { Cold: 0, Warm: 1, Hot: 2, Closed: 3 };

// What to write when the lead already exists, or null to leave it as it is.
// A member sign-up never touches an existing lead. A claim fills it in, but
// never moves it backwards: status, score and value only go up, and notes the
// owner wrote are kept after the new ones.
export function mergeInbound(existing: Partial<LeadFields> | null, incoming: LeadFields, member: boolean): LeadFields | null {
  if (!existing) return incoming;
  if (member) return null;
  // A claim from another device may carry no campaign; the one that first
  // brought this person stays, so "Dari mana uangnya" keeps crediting it.
  const campaignOf = (src = "") => src.split(" · ").slice(2).join(" · ");
  const keptCampaign = !campaignOf(incoming.source) && campaignOf(existing.source) ? campaignOf(existing.source) : "";
  const keep = (existing.notes || "").split(" · ").filter(n => n && n !== MEMBER_NOTE && (keptCampaign || !n.startsWith("Campaign: ")) && !incoming.notes.includes(n));
  return {
    ...incoming,
    source: keptCampaign ? `${incoming.source} · ${keptCampaign}` : incoming.source,
    status: (RANK[existing.status || ""] ?? -1) > RANK[incoming.status] ? (existing.status as string) : incoming.status,
    score: Math.max(existing.score || 0, incoming.score),
    value: Math.max(existing.value || 0, incoming.value),
    phone: incoming.phone || existing.phone || "",
    email: incoming.email || existing.email || "",
    notes: [incoming.notes, ...keep].filter(Boolean).join(" · "),
  };
}
