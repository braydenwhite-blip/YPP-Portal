"use client";

import { useState } from "react";
import Link from "next/link";
import type { NudgeData } from "@/lib/nudge-engine";

interface NudgeBannerProps {
  nudge: NudgeData;
  onDismiss?: (nudgeId: string) => void;
}

export default function NudgeBanner({ nudge, onDismiss }: NudgeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss(nudge.id);
    }
    // Also call server action
    try {
      const res = await fetch("/api/nudges/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudgeId: nudge.id }),
      });
      if (!res.ok) console.error("Failed to dismiss nudge");
    } catch {
      // Silently fail — nudge is hidden locally either way
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        marginBottom: 12,
        background: "linear-gradient(135deg, var(--ypp-purple-light, #f0e6ff) 0%, var(--pink-50, #fdf2f8) 100%)",
        borderRadius: 10,
        border: "1px solid var(--ypp-purple-border, #ddd6fe)",
        fontSize: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
        <span style={{ fontSize: 16 }}>{typeIcon(nudge.type)}</span>
        <div>
          <span style={{ fontWeight: 600, color: "var(--gray-800, #1a202c)" }}>
            {nudge.title}
          </span>
          <span style={{ color: "var(--gray-600, #4a5568)", marginLeft: 6 }}>
            {nudge.body}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {nudge.link && (
          <Link
            href={nudge.link}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ypp-purple, #6b21c8)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Check it out →
          </Link>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            fontSize: 14,
            color: "var(--gray-400, #a0aec0)",
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function typeIcon(type: string): string {
  switch (type) {
    case "BADGE_CLOSE":
      return "🏅";
    case "PATHWAY_PROGRESS":
      return "📚";
    case "MENTEE_UPDATE":
      return "👤";
    case "GOAL_REMINDER":
      return "🎯";
    case "UNLOCK_NEW":
    case "SECTION_UNLOCKED":
      return "🔓";
    case "ENCOURAGEMENT":
      return "⭐";
    case "MILESTONE":
      return "🎉";
    default:
      return "💡";
  }
}
