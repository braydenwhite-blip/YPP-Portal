"use client";

import { useState } from "react";
import { toggleBadgePin } from "@/lib/challenge-gamification-actions";

export function PinBadgeButton({
  badgeId,
  isPinned,
}: {
  badgeId: string;
  isPinned: boolean;
}) {
  const [pinned, setPinned] = useState(isPinned);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await toggleBadgePin(badgeId);
      setPinned(!pinned);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 11,
        color: pinned ? "var(--ypp-purple)" : "var(--text-secondary)",
        fontWeight: pinned ? 600 : 400,
        marginTop: 4,
        padding: "2px 4px",
      }}
    >
      {loading ? "..." : pinned ? "Pinned" : "Pin to profile"}
    </button>
  );
}
