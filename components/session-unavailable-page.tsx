"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { signOutLegacyBypass } from "@/lib/legacy-auth-actions";

// Auto-retry schedule, in seconds. Most session-resolution failures are
// transient database timeouts that recover within a few seconds; if all of
// these pass without recovering, the problem is very unlikely to be transient
// and we stop looping so the user gets a real next step instead of a spinner.
const RETRY_DELAYS = [5, 10, 20];

export default function SessionUnavailablePage({
  reason = "unavailable",
}: {
  /** "unavailable" = database blip (retryable). "missing" = no portal profile
   *  linked to this sign-in, which no amount of retrying will fix. */
  reason?: "unavailable" | "missing";
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [attempt, setAttempt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RETRY_DELAYS[0]);

  const profileMissing = reason === "missing";
  const autoRetriesExhausted = profileMissing || attempt >= RETRY_DELAYS.length;

  useEffect(() => {
    if (autoRetriesExhausted || isRefreshing) return;

    if (secondsLeft <= 0) {
      // Refresh, then arm the next (longer) countdown. If the refresh works the
      // layout renders the app and this component unmounts; if it doesn't, we
      // keep counting down instead of freezing on "0s".
      startRefresh(() => router.refresh());
      setAttempt((n) => n + 1);
      setSecondsLeft(RETRY_DELAYS[Math.min(attempt + 1, RETRY_DELAYS.length - 1)]);
      return;
    }

    const t = window.setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft, attempt, autoRetriesExhausted, isRefreshing, router]);

  function handleRetryNow() {
    setAttempt(0);
    setSecondsLeft(RETRY_DELAYS[0]);
    startRefresh(() => router.refresh());
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
          {profileMissing
            ? "Your account isn't set up yet"
            : "We couldn't load your account"}
        </h1>
        <p style={{ color: "#555", lineHeight: 1.5 }}>
          {profileMissing
            ? "Your sign-in worked, but this email has no active portal profile linked to it. An admin needs to create your profile — or link it to this email — before you can get in."
            : "Your sign-in is valid, but we couldn't reach the database to load your profile. This is usually a brief hiccup."}
        </p>
        <p style={{ color: "#888", fontSize: "0.875rem" }}>
          {isRefreshing
            ? "Retrying…"
            : profileMissing
              ? "Retrying won't change this. Sign out and back in if you have another email, or contact the portal team."
              : autoRetriesExhausted
                ? "Still not loading. Try again, or sign out and sign back in — if it keeps happening, contact the portal team."
                : `Retrying automatically in ${secondsLeft}s…`}
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
            disabled={isRefreshing}
          >
            {isRefreshing ? "Retrying…" : "Retry now"}
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
