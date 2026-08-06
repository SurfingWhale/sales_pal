"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import SalesTracker from "@/components/SalesTracker";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.replace("/login");
    });
    return unsub;
  }, [router]);

  if (user === undefined) {
    return (
      <div style={{ background: "var(--app-bg, #f0f2f5)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: "3px solid var(--app-border, #d0d7de)", borderTopColor: "#005eb0", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 12, color: "var(--app-muted, #57606a)", fontFamily: "monospace" }}>Loading...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return <SalesTracker user={user} />;
}
