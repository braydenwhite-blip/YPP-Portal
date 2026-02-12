"use client";

import { useState } from "react";
import { joinChallenge } from "@/lib/challenge-gamification-actions";

export function JoinDailyChallengeButton({ challengeId }: { challengeId: string }) {
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    try {
      await joinChallenge(challengeId);
      setJoined(true);
    } catch {}
    setLoading(false);
  }

  if (joined) {
    return <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Joined!</span>;
  }

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="button primary small"
      style={{ marginTop: 8 }}
    >
      {loading ? "..." : "Join"}
    </button>
  );
}
