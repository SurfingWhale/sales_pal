"use client";

// Which workspace the header switcher points at (PRD-007 §2.5), remembered per
// device. Lists the guilds where the user sells (Viewers have no sales data).

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Role, isSeller } from "@/lib/guild";
import { Space, personal } from "@/lib/space";

const KEY = "sp-space";
const read = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
const write = (v: string) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

export interface SpaceOption { id: string; name: string; role: Role }

export function useSpaceChoice(uid: string, name: string): { space: Space | null; options: SpaceOption[]; choose: (id: string) => void } {
  const [chosen, setChosen] = useState<string>(() => (typeof window === "undefined" ? "" : read()));
  const [guilds, setGuilds] = useState<{ id: string; name: string }[] | null>(null);
  const [roles, setRoles] = useState<Record<string, Role | null>>({});

  useEffect(() => onSnapshot(collection(db, "users", uid, "guilds"),
    s => setGuilds(s.docs.map(d => ({ id: d.id, name: String(d.data().name || "Guild") }))),
    () => setGuilds([])), [uid]);

  const ids = (guilds || []).map(g => g.id).join(",");
  useEffect(() => {
    if (!ids) return;
    const unsubs = ids.split(",").map(g => onSnapshot(doc(db, "guilds", g, "members", uid),
      s => setRoles(r => ({ ...r, [g]: s.exists() ? (s.data().role as Role) : null })),
      () => setRoles(r => ({ ...r, [g]: null }))));
    return () => unsubs.forEach(u => u());
  }, [ids, uid]);

  const options = useMemo(() => (guilds || [])
    .filter(g => isSeller(roles[g.id] || undefined))
    .map(g => ({ id: g.id, name: g.name, role: roles[g.id] as Role })), [guilds, roles]);

  const space = useMemo<Space | null>(() => {
    if (!chosen || chosen === uid) return personal(uid, name);
    if (guilds === null || !(chosen in roles)) {
      // Still finding out whether the remembered guild is still ours.
      if (guilds !== null && !guilds.some(g => g.id === chosen)) return personal(uid, name);
      return null;
    }
    const o = options.find(x => x.id === chosen);
    return o ? { kind: "guild", id: o.id, name: o.name, role: o.role, me: { uid, name } } : personal(uid, name);
  }, [chosen, uid, name, guilds, roles, options]);

  const choose = (id: string) => { write(id === uid ? "" : id); setChosen(id); };
  return { space, options, choose };
}
