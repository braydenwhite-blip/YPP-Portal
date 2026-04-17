"use client";

import { useState, useEffect } from "react";

interface Milestone {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
}

const MESSAGES: Record<string, { emoji: string; title: string; body: string }> = {
  ABOVE_AND_BEYOND_FIRST: {
    emoji: "🏆",
    title: "First Above & Beyond!",
    body: "You hit the top rating for the first time. Keep pushing — this is what great looks like.",
  },
  GOAL_COMPLETED: {
    emoji: "✅",
    title: "Goal completed!",
    body: "You finished a goal. That effort compounds.",
  },
  TENURE_6_MONTHS: {
    emoji: "🎉",
    title: "6-month anniversary",
    body: "Half a year in the program. Consistency is a superpower.",
  },
  TENURE_12_MONTHS: {
    emoji: "🌟",
    title: "1-year anniversary",
    body: "A full year of growth. You should be proud.",
  },
};

interface MilestoneToastProps {
  milestones: Milestone[];
}

export function MilestoneToast({ milestones }: MilestoneToastProps) {
  const [queue, setQueue] = useState<Milestone[]>(milestones);
  const [current, setCurrent] = useState<Milestone | null>(milestones[0] ?? null);
  const [visible, setVisible] = useState(milestones.length > 0);

  // Auto-dismiss after 6s
  useEffect(() => {
    if (!visible || !current) return;
    const timer = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(timer);
  }, [current, visible]);

  function dismiss() {
    const remaining = queue.slice(1);
    setQueue(remaining);
    if (remaining.length > 0) {
      setCurrent(remaining[0]);
    } else {
      setVisible(false);
      setCurrent(null);
    }
  }

  if (!visible || !current) return null;

  const msg = MESSAGES[current.kind] ?? {
    emoji: "🎯",
    title: "Achievement unlocked",
    body: "You hit a new milestone.",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        background: "var(--ypp-purple-900, #1e1b4b)",
        color: "#fff",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        maxWidth: 320,
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
        animation: "slideInRight 0.3s ease",
      }}
    >
      <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{msg.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 2 }}>{msg.title}</div>
        <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>{msg.body}</div>
        {queue.length > 1 && (
          <div style={{ fontSize: "0.75rem", marginTop: 4, opacity: 0.65 }}>
            {queue.length - 1} more
          </div>
        )}
      </div>
      <button
        onClick={dismiss}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.7, fontSize: "1rem", padding: 0 }}
        aria-label="Dismiss"
      >
        ×
      </button>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
