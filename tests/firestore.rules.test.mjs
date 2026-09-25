// Tests for firestore.rules, against the Firestore emulator.
//
//   npm i --no-save @firebase/rules-unit-testing firebase
//   firebase emulators:exec --only firestore --project demo-salespal "node tests/firestore.rules.test.mjs"
//
// (The emulator needs Java. Port 8089 — set it in firebase.json's emulators block
// or change `port` below.)
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";

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

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
