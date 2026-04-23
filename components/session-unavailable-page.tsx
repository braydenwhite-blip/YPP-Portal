"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { signOutLegacyBypass } from "@/lib/legacy-auth-actions";

export default function SessionUnavailablePage() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  // Auto-retry once after 5s — most session-resolution failures are
  // transient database timeouts that recover within a few seconds.
  useEffect(() => {
    if (secondsLeft <= 0) {
      router.refresh();
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft, router]);

  async function handleRetryNow() {
    setRetrying(true);
    router.refresh();
  }

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await Promise.allSettled([supabase.auth.signOut(), signOutLegacyBypass()]);
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          padding: "2rem",
          borderRadius: 16,
          background: "rgba(255,255,255,0.7)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: "1.25rem" }}>
          We couldn&apos;t load your account
        </h1>
        <p style={{ color: "#555", lineHeight: 1.5 }}>
          Your sign-in is valid, but we couldn&apos;t resolve your profile
          right now. This is usually a brief database hiccup.
        </p>
        <p style={{ color: "#888", fontSize: "0.875rem" }}>
          Retrying automatically in {secondsLeft}s…
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: "1.5rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="button"
            onClick={handleRetryNow}
            disabled={retrying}
          >
            {retrying ? "Retrying…" : "Retry now"}
          </button>
          <button
            type="button"
            className="button outline"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
