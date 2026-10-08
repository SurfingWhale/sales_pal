// Tests for firestore.rules, against the Firestore emulator.
//
//   npm i --no-save @firebase/rules-unit-testing firebase
//   firebase emulators:exec --only firestore --project demo-salespal "node tests/firestore.rules.test.mjs"
//
// (The emulator needs Java. Port 8089 — set it in firebase.json's emulators block
// or change `port` below.)
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, serverTimestamp, Timestamp, writeBatch, query, where } from "firebase/firestore";

const env = await initializeTestEnvironment({ projectId: "demo-salespal", firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 } });
const anon = env.unauthenticatedContext().firestore();
const owner = env.authenticatedContext("owner1", { email: "fauzymuhamad43@gmail.com", email_verified: true }).firestore();
const ownerUnverified = env.authenticatedContext("owner2", { email: "fauzymuhamad43@gmail.com", email_verified: false }).firestore();
const other = env.authenticatedContext("u9", { email: "x@y.com", email_verified: true }).firestore();

const good = () => ({
  v: 1, site: "visufavor", siteUrl: "https://visufavor.vercel.app/",
  offer: { code: "VISU10-7K2QF", kind: "discount", value: 10 },
  contact: { name: "Rani", email: "rani@mail.com", whatsapp: "+62 812 3456 7890", business: "Warung Rani" },
  answers: { need: "Menu photos", timing: "This month", heardFrom: "Instagram" },
  attribution: { utm_source: "instagram", utm_medium: "paid", utm_campaign: "sept-boost", fbclid: "abc", landing: "/", firstSeenAt: "2026-09-24T10:00:00Z" },
  account: { provider: "google.com", uid: "g123", project: "visufavor" },
  createdAt: serverTimestamp(), status: "new",
});
let pass = 0, fail = 0;
const t = async (name, p) => { try { await p; pass++; console.log("  ok  ", name); } catch (e) { fail++; console.log("  FAIL", name, "-", e.message.split("\n")[0]); } };

console.log("public (not signed in to SalesPal):");
await t("adds a valid lead", assertSucceeds(addDoc(collection(anon, "inbound_leads"), good())));
await t("adds with only name + WhatsApp", assertSucceeds(addDoc(collection(anon, "inbound_leads"), { v: 1, site: "untmd-sports", contact: { name: "A", whatsapp: "08123456789" }, createdAt: serverTimestamp(), status: "new" })));
await t("adds a member sign-up (no offer, no answers)", assertSucceeds(addDoc(collection(anon, "inbound_leads"), { v: 1, site: "visufavor", siteUrl: "https://visufavor.vercel.app/", contact: { name: "Rani", email: "rani@mail.com" }, attribution: { utm_source: "instagram", landing: "/" }, account: { provider: "password", uid: "e456", project: "visufavor" }, createdAt: serverTimestamp(), status: "new" })));
await t("cannot read leads", assertFails(getDocs(collection(anon, "inbound_leads"))));
await t("cannot add unknown site", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), site: "evil" })));
await t("cannot add extra field", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), admin: true })));
await t("cannot preset status imported", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), status: "imported" })));
await t("cannot fake createdAt", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), createdAt: Timestamp.fromDate(new Date("2020-01-01")) })));
await t("needs a way to reach them", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), contact: { name: "No contact" } })));
await t("rejects a bad email with no WhatsApp", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), contact: { name: "A", email: "not-an-email" } })));
await t("rejects empty name", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), contact: { name: "", email: "a@b.co" } })));
await t("rejects an oversized message", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), answers: { message: "x".repeat(601) } })));
await t("rejects unknown answer key", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), answers: { password: "x" } })));
await t("rejects discount over 100", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), offer: { code: "X", kind: "discount", value: 500 } })));
await t("rejects unknown attribution key", assertFails(addDoc(collection(anon, "inbound_leads"), { ...good(), attribution: { utm_source: "x", cookie: "y" } })));
await t("cannot write SalesPal user data", assertFails(setDoc(doc(anon, "users", "owner1", "leads", "x"), { name: "x" })));

console.log("another SalesPal account:");
await t("cannot read inbound leads", assertFails(getDocs(collection(other, "inbound_leads"))));
await t("cannot read the owner's leads", assertFails(getDocs(collection(other, "users", "owner1", "leads"))));
await t("can use its own tree", assertSucceeds(setDoc(doc(other, "users", "u9", "leads", "a"), { name: "mine" })));

console.log("owner:");
const ref = await addDoc(collection(anon, "inbound_leads"), good());
await t("reads inbound leads", assertSucceeds(getDocs(collection(owner, "inbound_leads"))));
await t("marks one imported", assertSucceeds(updateDoc(doc(owner, "inbound_leads", ref.id), { status: "imported", importedAt: serverTimestamp(), importedBy: "owner1" })));
await t("cannot rewrite the lead's contact", assertFails(updateDoc(doc(owner, "inbound_leads", ref.id), { contact: { name: "changed", email: "a@b.co" } })));
await t("cannot set an unknown status", assertFails(updateDoc(doc(owner, "inbound_leads", ref.id), { status: "whatever" })));
await t("unverified owner email cannot read", assertFails(getDocs(collection(ownerUnverified, "inbound_leads"))));
await t("deletes a lead", assertSucceeds(deleteDoc(doc(owner, "inbound_leads", ref.id))));
await t("uses own SalesPal tree", assertSucceeds(setDoc(doc(owner, "users", "owner1", "leads", "l1"), { name: "PT X" })));

console.log("server-only collections:");
await t("owner cannot read the token vault", assertFails(getDoc(doc(owner, "connections", "owner1_threads"))));
await t("owner cannot write a token", assertFails(setDoc(doc(owner, "connections", "owner1_threads"), { token: "x" })));
await t("another account cannot read the vault", assertFails(getDocs(collection(other, "connections"))));
await t("no browser reads or writes push subscriptions", assertFails(getDocs(collection(owner, "pushSubs"))));
await t("no browser stores a push subscription", assertFails(setDoc(doc(other, "pushSubs", "x"), { uid: "u9", endpoint: "https://push.example/1" })));
await t("nobody reads usage quotas", assertFails(getDoc(doc(owner, "usage", "owner1_scan_2026-10-08"))));
await t("nobody resets their quota", assertFails(setDoc(doc(other, "usage", "u9_scan_2026-10-08"), { count: 0 })));


console.log("guilds:");
const G = "g1";
const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@x.com`, email_verified: true }).firestore();
const L = as("lead"), O = as("offi"), M = as("memb"), M2 = as("memb2"), V = as("view"), X = as("outsider");
const me = (uid, role, inviteCode) => ({ uid, name: uid, email: `${uid}@x.com`, role, joinedAt: Date.now(), ...(inviteCode ? { inviteCode } : {}) });
const found = (db, g, uid) => { const b = writeBatch(db); b.set(doc(db, "guilds", g), { name: "Tim Uji", leaderUid: uid, titles: {}, createdAt: Date.now() }); b.set(doc(db, "guilds", g, "members", uid), me(uid, "leader")); return b.commit(); };
const week = () => Date.now() + 7 * 86400000;
const deal = (owner, channel = "TikTok") => ({ ownerUid: owner, contactName: "C", phone: "", stage: "lead", leadAt: "2026-10-08", firstTouch: { channel, method: "self_report", at: "2026-10-08" } });

await t("anyone signed in founds a guild as its leader", assertSucceeds(found(L, G, "lead")));
await t("cannot found a guild for someone else", assertFails((() => { const b = writeBatch(X); b.set(doc(X, "guilds", "g2"), { name: "x", leaderUid: "lead", titles: {}, createdAt: 1 }); b.set(doc(X, "guilds", "g2", "members", "outsider"), me("outsider", "leader")); return b.commit(); })()));
await t("cannot take over an existing guild as leader", assertFails(setDoc(doc(X, "guilds", G, "members", "outsider"), me("outsider", "leader"))));
await t("outsider cannot read the guild", assertFails(getDoc(doc(X, "guilds", G))));
await t("outsider cannot create an invite", assertFails(setDoc(doc(X, "guilds", G, "invites", "badinv"), { role: "member", guildName: "x", createdBy: "outsider", createdAt: 1, expiresAt: week() })));
await t("leader invites an officer", assertSucceeds(setDoc(doc(L, "guilds", G, "invites", "inv-off"), { role: "officer", guildName: "Tim Uji", createdBy: "lead", createdAt: 1, expiresAt: week() })));
await t("leader invites members and a viewer", assertSucceeds(Promise.all([
  setDoc(doc(L, "guilds", G, "invites", "inv-mem"), { role: "member", guildName: "Tim Uji", createdBy: "lead", createdAt: 1, expiresAt: week() }),
  setDoc(doc(L, "guilds", G, "invites", "inv-view"), { role: "viewer", guildName: "Tim Uji", createdBy: "lead", createdAt: 1, expiresAt: week() }),
  setDoc(doc(L, "guilds", G, "invites", "inv-old"), { role: "member", guildName: "Tim Uji", createdBy: "lead", createdAt: 1, expiresAt: Date.now() - 1000 }),
])));
await t("an invite is readable by its code", assertSucceeds(getDoc(doc(X, "guilds", G, "invites", "inv-mem"))));
await t("outsiders cannot list invites", assertFails(getDocs(collection(X, "guilds", G, "invites"))));
await t("officer joins with the officer invite", assertSucceeds(setDoc(doc(O, "guilds", G, "members", "offi"), me("offi", "officer", "inv-off"))));
await t("member joins with the member invite", assertSucceeds(setDoc(doc(M, "guilds", G, "members", "memb"), me("memb", "member", "inv-mem"))));
await t("second member joins too", assertSucceeds(setDoc(doc(M2, "guilds", G, "members", "memb2"), me("memb2", "member", "inv-mem"))));
await t("viewer joins with the viewer invite", assertSucceeds(setDoc(doc(V, "guilds", G, "members", "view"), me("view", "viewer", "inv-view"))));
await t("cannot take a higher role than the invite gives", assertFails(setDoc(doc(X, "guilds", G, "members", "outsider"), me("outsider", "officer", "inv-mem"))));
await t("cannot join with an expired invite", assertFails(setDoc(doc(X, "guilds", G, "members", "outsider"), me("outsider", "member", "inv-old"))));
await t("cannot join without an invite", assertFails(setDoc(doc(X, "guilds", G, "members", "outsider"), me("outsider", "member"))));
await t("officer cannot invite another officer", assertFails(setDoc(doc(O, "guilds", G, "invites", "inv-o2"), { role: "officer", guildName: "x", createdBy: "offi", createdAt: 1, expiresAt: week() })));
await t("officer invites a member", assertSucceeds(setDoc(doc(O, "guilds", G, "invites", "inv-o3"), { role: "member", guildName: "x", createdBy: "offi", createdAt: 1, expiresAt: week() })));
await t("member cannot list invites", assertFails(getDocs(collection(M, "guilds", G, "invites"))));
await t("members read the guild and the roster", assertSucceeds(getDocs(collection(V, "guilds", G, "members"))));

await t("member logs a deal of their own", assertSucceeds(setDoc(doc(M, "guilds", G, "deals", "d1"), deal("memb"))));
await t("member cannot log a deal for someone else", assertFails(setDoc(doc(M, "guilds", G, "deals", "d2"), deal("memb2"))));
await t("member sees their own deals", assertSucceeds(getDocs(query(collection(M, "guilds", G, "deals"), where("ownerUid", "==", "memb")))));
await t("member cannot see the whole pipeline", assertFails(getDocs(collection(M, "guilds", G, "deals"))));
await t("second member cannot read the first one's deal", assertFails(getDoc(doc(M2, "guilds", G, "deals", "d1"))));
await t("viewer cannot read deals", assertFails(getDoc(doc(V, "guilds", G, "deals", "d1"))));
await t("viewer cannot log a deal", assertFails(setDoc(doc(V, "guilds", G, "deals", "d3"), deal("view"))));
await t("leader sees every deal", assertSucceeds(getDocs(collection(L, "guilds", G, "deals"))));
await t("officer logs a deal for a member", assertSucceeds(setDoc(doc(O, "guilds", G, "deals", "d4"), deal("memb2", "Ga tau"))));
await t("member moves their deal along", assertSucceeds(updateDoc(doc(M, "guilds", G, "deals", "d1"), { stage: "quoted", quotedAt: "2026-10-09" })));
await t("member cannot rewrite a known source", assertFails(updateDoc(doc(M, "guilds", G, "deals", "d1"), { firstTouch: { channel: "Instagram", method: "self_report", at: "2026-10-08" } })));
await t("an unknown source can still be filled in", assertSucceeds(updateDoc(doc(M2, "guilds", G, "deals", "d4"), { firstTouch: { channel: "Facebook", method: "seller_guess", at: "2026-10-08" } })));
await t("member cannot hand their deal to someone else", assertFails(updateDoc(doc(M, "guilds", G, "deals", "d1"), { ownerUid: "memb2" })));
await t("officer edits any deal", assertSucceeds(updateDoc(doc(O, "guilds", G, "deals", "d1"), { note: "dicek officer" })));

await t("member cannot promote themselves", assertFails(updateDoc(doc(M, "guilds", G, "members", "memb"), { role: "officer" })));
await t("member updates their own name", assertSucceeds(updateDoc(doc(M, "guilds", G, "members", "memb"), { name: "Andri" })));
await t("officer cannot make someone an officer", assertFails(updateDoc(doc(O, "guilds", G, "members", "memb2"), { role: "officer" })));
await t("officer moves a member to viewer and back", assertSucceeds(updateDoc(doc(O, "guilds", G, "members", "memb2"), { role: "viewer" }).then(() => updateDoc(doc(O, "guilds", G, "members", "memb2"), { role: "member" }))));
await t("leader cannot crown a second leader without handing over", assertFails(updateDoc(doc(L, "guilds", G, "members", "memb"), { role: "leader" })));
await t("member cannot set targets", assertFails(setDoc(doc(M, "guilds", G, "targets", "2026-10_memb"), { revenue: 1 })));
await t("officer sets a target", assertSucceeds(setDoc(doc(O, "guilds", G, "targets", "2026-10_memb"), { uid: "memb", month: "2026-10", revenue: 50000000, deals: 4 })));
await t("viewer reads targets and reports", assertSucceeds(getDocs(collection(V, "guilds", G, "targets"))));
await t("an invite may carry the guild's title for the role", assertSucceeds(setDoc(doc(L, "guilds", G, "invites", "inv-title"), { role: "member", roleTitle: "Closer", guildName: "Tim Uji", createdBy: "lead", createdAt: 1, expiresAt: week() })));
await t("an invite cannot carry other fields", assertFails(setDoc(doc(L, "guilds", G, "invites", "inv-extra"), { role: "member", guildName: "Tim Uji", createdBy: "lead", createdAt: 1, expiresAt: week(), admin: true })));
const act = (who, what, extra = {}) => ({ who, whoName: who, what, at: Date.now(), ...extra });
await t("member logs their own activity", assertSucceeds(setDoc(doc(M, "guilds", G, "activities", "a1"), act("memb", "deal_created", { ref: "d1", refName: "Bu Sari" }))));
await t("cannot log an activity as someone else", assertFails(setDoc(doc(M, "guilds", G, "activities", "a2"), act("memb2", "deal_created"))));
await t("outsider cannot log an activity", assertFails(setDoc(doc(X, "guilds", G, "activities", "a3"), act("outsider", "joined"))));
await t("an activity cannot carry other fields", assertFails(setDoc(doc(M, "guilds", G, "activities", "a4"), act("memb", "deal_created", { amount: 9 }))));
await t("officer logs a reassignment about a member", assertSucceeds(setDoc(doc(O, "guilds", G, "activities", "a5"), act("offi", "deal_reassigned", { about: "memb2" }))));
await t("activities cannot be edited", assertFails(updateDoc(doc(M, "guilds", G, "activities", "a1"), { what: "deal_paid" })));
await t("activities cannot be deleted, even by the leader", assertFails(deleteDoc(doc(L, "guilds", G, "activities", "a1"))));
await t("leader reads the whole log", assertSucceeds(getDocs(collection(L, "guilds", G, "activities"))));
await t("member cannot read the whole log", assertFails(getDocs(collection(M, "guilds", G, "activities"))));
await t("member reads what they did", assertSucceeds(getDocs(query(collection(M, "guilds", G, "activities"), where("who", "==", "memb")))));
await t("member reads what concerns them", assertSucceeds(getDocs(query(collection(M2, "guilds", G, "activities"), where("about", "==", "memb2")))));
await t("member cannot read another's entry", assertFails(getDoc(doc(M2, "guilds", G, "activities", "a1"))));
await t("viewer cannot read the log", assertFails(getDocs(collection(V, "guilds", G, "activities"))));
// Guild as a workspace (PRD-007 §2.5)
const lead = (owner, extra = {}) => ({ name: "Warung Uji", status: "Warm", ownerUid: owner, ownerName: owner, ...extra });
await t("member logs a lead of their own in the guild", assertSucceeds(setDoc(doc(M, "guilds", G, "leads", "l1"), lead("memb"))));
await t("member cannot log a lead for someone else", assertFails(setDoc(doc(M, "guilds", G, "leads", "l2"), lead("memb2"))));
await t("a guild lead needs an owner", assertFails(setDoc(doc(M, "guilds", G, "leads", "l3"), { name: "x" })));
await t("member lists their own leads", assertSucceeds(getDocs(query(collection(M, "guilds", G, "leads"), where("ownerUid", "==", "memb")))));
await t("member cannot list every lead", assertFails(getDocs(collection(M, "guilds", G, "leads"))));
await t("another member cannot read it", assertFails(getDoc(doc(M2, "guilds", G, "leads", "l1"))));
await t("viewer cannot read guild leads", assertFails(getDocs(query(collection(V, "guilds", G, "leads"), where("ownerUid", "==", "view")))));
await t("outsider cannot add a guild lead", assertFails(setDoc(doc(X, "guilds", G, "leads", "l4"), lead("outsider"))));
await t("officer lists every lead", assertSucceeds(getDocs(collection(O, "guilds", G, "leads"))));
await t("member works their lead", assertSucceeds(updateDoc(doc(M, "guilds", G, "leads", "l1"), { status: "Hot" })));
await t("member cannot give their lead away", assertFails(updateDoc(doc(M, "guilds", G, "leads", "l1"), { ownerUid: "memb2" })));
await t("officer hands a lead to another member", assertSucceeds(updateDoc(doc(O, "guilds", G, "leads", "l1"), { ownerUid: "memb2", ownerName: "memb2" })));
await t("the new owner reads it", assertSucceeds(getDoc(doc(M2, "guilds", G, "leads", "l1"))));
await t("the old owner no longer can", assertFails(getDoc(doc(M, "guilds", G, "leads", "l1"))));
await t("member logs a quote and a hunt of their own", assertSucceeds(Promise.all([
  setDoc(doc(M, "guilds", G, "quotes", "q1"), { number: "Q-1", ownerUid: "memb", ownerName: "memb" }),
  setDoc(doc(M, "guilds", G, "hunts", "h1"), { target: "@x", ownerUid: "memb", ownerName: "memb" }),
])));
await t("member reads the team's packages", assertSucceeds(getDocs(collection(M, "guilds", G, "services"))));
await t("member cannot change the packages", assertFails(setDoc(doc(M, "guilds", G, "services", "s1"), { name: "x", price: 1 })));
await t("officer sets a package", assertSucceeds(setDoc(doc(O, "guilds", G, "services", "s1"), { name: "Foto Menu", price: 1500000 })));
await t("leader sets the business info", assertSucceeds(setDoc(doc(L, "guilds", G, "settings", "business"), { name: "Tim Uji" })));
await t("member cannot change the business info", assertFails(setDoc(doc(M, "guilds", G, "settings", "business"), { name: "x" })));
await t("viewer cannot read the packages", assertFails(getDocs(collection(V, "guilds", G, "services"))));
await t("no one writes an unknown guild collection", assertFails(setDoc(doc(L, "guilds", G, "secrets", "x"), { ownerUid: "lead" })));
await t("member adds a client and logs a chat under it", assertSucceeds(setDoc(doc(M, "guilds", G, "clients", "c1"), { name: "Toko", ownerUid: "memb", ownerName: "memb" })
  .then(() => setDoc(doc(M, "guilds", G, "clients", "c1", "deals", "cd1"), deal("memb")))));
await t("another member cannot read that client's chats", assertFails(getDocs(collection(M2, "guilds", G, "clients", "c1", "deals"))));
await t("officer reads that client's chats", assertSucceeds(getDocs(collection(O, "guilds", G, "clients", "c1", "deals"))));
await t("member cannot freeze a report",assertFails(setDoc(doc(M, "guilds", G, "reports", "2026-10"), { x: 1 })));
await t("leader cannot leave without handing over", assertFails(deleteDoc(doc(L, "guilds", G, "members", "lead"))));
await t("officer cannot remove the leader", assertFails(deleteDoc(doc(O, "guilds", G, "members", "lead"))));
await t("leader hands the guild to the officer", assertSucceeds((() => { const b = writeBatch(L); b.update(doc(L, "guilds", G), { leaderUid: "offi" }); b.update(doc(L, "guilds", G, "members", "offi"), { role: "leader" }); b.update(doc(L, "guilds", G, "members", "lead"), { role: "officer" }); return b.commit(); })()));
await t("the old leader, now officer, cannot invite officers", assertFails(setDoc(doc(L, "guilds", G, "invites", "inv-l2"), { role: "officer", guildName: "x", createdBy: "lead", createdAt: 1, expiresAt: week() })));
await t("a member leaves", assertSucceeds(deleteDoc(doc(M2, "guilds", G, "members", "memb2"))));
await t("having left, they cannot read the guild", assertFails(getDoc(doc(M2, "guilds", G))));
await t("the new leader removes a member", assertSucceeds(deleteDoc(doc(O, "guilds", G, "members", "memb"))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
