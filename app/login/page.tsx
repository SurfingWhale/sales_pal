"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/dashboard");
    });
    return unsub;
  }, [router]);

  async function handleGoogle() {
    setError(""); setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Google login gagal");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(27,108,242,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: 420,
        background: "#0c0d13",
        border: "1px solid #1e2028",
        borderRadius: 28,
        padding: "44px 40px",
        position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, justifyContent: "center" }}>
          <Image src="/logo.png" alt="SalesPal" width={40} height={40} style={{ borderRadius: 12, objectFit: "contain", background: "#0c1a3a" }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: -1, color: "#f2f3f6" }}>
            SALES<em style={{ color: "#1b6cf2", fontStyle: "normal" }}>PAL</em>
          </span>
        </div>

        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: -1, color: "#fff", marginBottom: 6, textAlign: "center" }}>
          {mode === "login" ? "Welcome back" : "Buat akun baru"}
        </h1>
        <p style={{ fontSize: 13, color: "#5a6270", textAlign: "center", marginBottom: 28 }}>
          {mode === "login" ? "Masuk ke dashboard sales lo" : "Mulai gratis, track lebih banyak deal"}
        </p>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%",
            background: "#fff",
            border: "1px solid #e8ecf4",
            borderRadius: 12,
            padding: "13px 20px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontSize: 14, fontWeight: 600, color: "#111",
            cursor: "pointer", marginBottom: 20,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Lanjutkan dengan Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#1e2028" }} />
          <span style={{ fontSize: 11, color: "#3a4050" }}>atau dengan email</span>
          <div style={{ flex: 1, height: 1, background: "#1e2028" }} />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="Email lo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              background: "#0d1117", border: "1px solid #21262d", borderRadius: 10,
              color: "#e6edf3", padding: "13px 16px", fontSize: 14,
              outline: "none", fontFamily: "inherit",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              background: "#0d1117", border: "1px solid #21262d", borderRadius: 10,
              color: "#e6edf3", padding: "13px 16px", fontSize: 14,
              outline: "none", fontFamily: "inherit",
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: "#ff6b6b", background: "#ff6b6b15", border: "1px solid #ff6b6b30", borderRadius: 8, padding: "10px 14px" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#1b6cf2", color: "#fff", border: "none", borderRadius: 12,
              padding: "14px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", marginTop: 4,
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 4px 20px rgba(27,108,242,0.4)",
            }}
          >
            {loading ? "Loading..." : mode === "login" ? "🚀 Masuk" : "✨ Buat Akun"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#5a6270", marginTop: 20 }}>
          {mode === "login" ? "Belum punya akun? " : "Udah punya akun? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ color: "#1b6cf2", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            {mode === "login" ? "Daftar gratis" : "Masuk"}
          </button>
        </p>
      </div>
    </div>
  );
}
