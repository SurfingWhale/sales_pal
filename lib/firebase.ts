import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only initialize on client — prevents SSG prerender crash with placeholder env vars
function getFirebaseApp() {
  if (typeof window === "undefined") return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

const app = getFirebaseApp();

// Persistence order matters for PWAs: IndexedDB survives iOS "Add to Home Screen"
// standalone mode far better than localStorage (which iOS isolates/evicts), so the
// session is restored on every launch instead of forcing a re-login.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFirebaseAuth(): any {
  if (!app) return null;
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialized (e.g. Next.js Fast Refresh re-run) — reuse the instance.
    return getAuth(app);
  }
}

export const auth = getFirebaseAuth();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = app ? getFirestore(app) : (null as any);
export const googleProvider = typeof window !== "undefined" ? new GoogleAuthProvider() : (null as any); // eslint-disable-line @typescript-eslint/no-explicit-any
