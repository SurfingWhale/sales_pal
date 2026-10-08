// Workspaces (PRD-007 §2.5): the app works either in the user's own space
// (users/{uid}/...) or in a guild's (guilds/{g}/...), picked in the header.
// Every screen reads and writes through these helpers instead of naming
// users/{uid} itself.
//
// In a guild, sales data has an owner: a Member reads and works only their
// own rows, Leader and Officer all of them (firestore.rules). Catalogs —
// packages, pitch templates, business info, the daily DM goal — are shared:
// every seller reads them, Leader and Officer change them.
//
// Stays personal whatever the space: Threads Radar (each person's own token)
// and the website leads (the pipeline owner's).

import { createContext, useContext } from "react";
import { collection, CollectionReference, doc, DocumentData, DocumentReference, query, Query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Role, isManager } from "@/lib/guild";

export interface Space {
  kind: "me" | "guild";
  id: string;                  // uid, or the guild id
  name: string;
  role?: Role;                 // in a guild
  me: { uid: string; name: string };
}

export const OWNED = ["leads", "outreach", "rejections", "hunts", "quotes", "invoices", "clients"] as const;
export const SHARED = ["services", "pitchTemplates", "settings"] as const;
export type SpaceCollection = (typeof OWNED)[number] | (typeof SHARED)[number];

export const personal = (uid: string, name: string): Space => ({ kind: "me", id: uid, name: "Pribadi", me: { uid, name } });

const root = (s: Space) => (s.kind === "me" ? ["users", s.id] : ["guilds", s.id]);

// Path segments under the space, for components that take a path (Pipeline).
export const spacePath = (s: Space, name: SpaceCollection, ...rest: string[]) => [...root(s), name, ...rest];

export function spaceCol(s: Space, name: SpaceCollection, ...rest: string[]): CollectionReference<DocumentData> {
  return collection(db, [...root(s), name, ...rest].join("/"));
}

export function spaceDoc(s: Space, name: SpaceCollection, ...ids: string[]): DocumentReference<DocumentData> {
  return doc(db, [...root(s), name, ...ids].join("/"));
}

// What this person may list: in a guild a Member only their own rows.
export function spaceQuery(s: Space, name: SpaceCollection): Query<DocumentData> {
  const col = spaceCol(s, name);
  const owned = (OWNED as readonly string[]).includes(name);
  return s.kind === "guild" && owned && !isManager(s.role) ? query(col, where("ownerUid", "==", s.me.uid)) : col;
}

// A new row in a guild gets its owner; an edited one keeps the one it had.
export function stamp<T extends object>(s: Space, data: T, existing?: { ownerUid?: string; ownerName?: string } | null): T {
  if (s.kind !== "guild") return data;
  return { ...data, ownerUid: existing?.ownerUid || s.me.uid, ownerName: existing?.ownerName || s.me.name };
}

// Packages, templates, business info and goals: anyone in their own space,
// Leader and Officer in a guild.
export const canEditCatalog = (s: Space) => s.kind === "me" || isManager(s.role);
export const seesEveryone = (s: Space) => s.kind === "guild" && isManager(s.role);

export const SpaceContext = createContext<Space | null>(null);

export function useSpace(): Space {
  const s = useContext(SpaceContext);
  if (!s) throw new Error("useSpace outside SpaceContext");
  return s;
}
