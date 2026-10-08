// Deals that stopped moving (PRD-007 §2.6): an active deal — not lunas, not
// gugur — whose last step is a week old or more. Read from every Report Klien
// client and from the guild deals the user owns, for the "Perlu Ditindak" panel.

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Deal, STAGE_LABEL } from "@/lib/funnel";
import { today } from "@/lib/billing";
import { STALL_DAYS, stalled } from "@/lib/digest";

export { STALL_DAYS };

export interface Stalled {
  key: string;
  where: "client" | "guild";
  place: string;       // client or guild name
  deal: Deal;
  lastMove: string;    // YYYY-MM-DD
  days: number;
}

export const stalledWhat = (s: Stalled) =>
  `${STAGE_LABEL[s.deal.stage]} di ${s.place}, ${s.days} hari ga gerak`;

// Live list across clients and guilds. Listeners follow the client and guild
// lists, so a new client or a newly joined guild shows up without a reload.
export function useStalledDeals(uid: string): Stalled[] {
  const [byPlace, setByPlace] = useState<Record<string, Stalled[]>>({});

  useEffect(() => {
    const inner = new Map<string, () => void>();
    const drop = (k: string) => {
      inner.get(k)?.();
      inner.delete(k);
      setByPlace(cur => { const n = { ...cur }; delete n[k]; return n; });
    };
    const put = (k: string, where: Stalled["where"], place: string, deals: Deal[]) =>
      setByPlace(cur => ({ ...cur, [k]: stalled(deals, today()).map(s => ({ ...s, key: `${k}_${s.deal.id}`, where, place })) }));

    const follow = (prefix: string, list: { id: string; name: string }[], listen: (id: string, name: string, k: string) => () => void) => {
      const keep = new Set(list.map(x => `${prefix}${x.id}`));
      Array.from(inner.keys()).filter(k => k.startsWith(prefix) && !keep.has(k)).forEach(drop);
      list.forEach(x => {
        const k = `${prefix}${x.id}`;
        if (!inner.has(k)) inner.set(k, listen(x.id, x.name, k));
      });
    };

    const quiet = () => { /* not allowed (left the guild) or offline: show nothing */ };
    const u1 = onSnapshot(collection(db, "users", uid, "clients"), s =>
      follow("c_", s.docs.map(d => ({ id: d.id, name: String(d.data().name || "klien") })), (id, name, k) =>
        onSnapshot(collection(db, "users", uid, "clients", id, "deals"),
          ds => put(k, "client", name, ds.docs.map(d => ({ id: d.id, ...d.data() } as Deal))), quiet)), quiet);
    const u2 = onSnapshot(collection(db, "users", uid, "guilds"), s =>
      follow("g_", s.docs.map(d => ({ id: d.id, name: String(d.data().name || "guild") })), (id, name, k) =>
        onSnapshot(query(collection(db, "guilds", id, "deals"), where("ownerUid", "==", uid)),
          ds => put(k, "guild", name, ds.docs.map(d => ({ id: d.id, ...d.data() } as Deal))), quiet)), quiet);

    return () => { u1(); u2(); inner.forEach(u => u()); inner.clear(); };
  }, [uid]);

  return Object.values(byPlace).flat().sort((a, b) => b.days - a.days);
}
