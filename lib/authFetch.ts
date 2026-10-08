import { auth } from "@/lib/firebase";

// fetch() to SalesPal's own API with the signed-in user's ID token, which the
// routes check (lib/serverAuth.ts) before doing anything.
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth?.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
