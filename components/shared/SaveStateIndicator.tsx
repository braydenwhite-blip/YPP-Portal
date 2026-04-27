"use client";

/**
 * Autosave status chip used by the cockpit's `DraftRationaleField`. One of the
 * five signature micro-interactions in §2.7 of the redesign plan.
 *
 * - idle  → hidden
 * - saving → pulsing purple dot + "Saving…"
 * - saved → green dot + ticker label "Saved 3s ago"
 * - error → amber dot + retry affordance
 */

import { useEffect, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SaveStateIndicatorProps {
  state: SaveState;
  lastSavedAt: string | null;
  onRetry?: () => void;
}

function relative(savedAt: string | null, now: number): string {
  if (!savedAt) return "Saved";
  const diff = Math.max(0, now - new Date(savedAt).getTime());
  if (diff < 5_000) return "Saved just now";
  if (diff < 60_000) return `Saved ${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `Saved ${Math.floor(diff / 60_000)}m ago`;
  return `Saved ${Math.floor(diff / 3_600_000)}h ago`;
}

export default function SaveStateIndicator({
  state,
  lastSavedAt,
  onRetry,
}: SaveStateIndicatorProps) {
  const [, force] = useState(0);
  useEffect(() => {
    if (state !== "saved") return;
    const id = window.setInterval(() => force((n) => n + 1), 10_000);
    return () => window.clearInterval(id);
  }, [state]);

  if (state === "idle") return null;

  const palette = {
    saving: { dot: "var(--ypp-purple-600, #6b21c8)", text: "Saving…" },
    saved: { dot: "#16a34a", text: relative(lastSavedAt, Date.now()) },
    error: { dot: "#d97706", text: "Couldn't save" },
  } as const;

  const cfg = palette[state];

  return (
    <span
      className={`save-state-indicator state-${state}`}
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--ink-muted, #6b5f7a)",
      }}
    >
      <span
        aria-hidden="true"
        className={state === "saving" ? "save-dot pulsing" : "save-dot"}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: cfg.dot,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span>{cfg.text}</span>
      {state === "error" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="save-retry-link"
          style={{
            background: "none",
            border: "none",
            color: "var(--ypp-purple-600, #6b21c8)",
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
            fontSize: 12,
          }}
        >
          Retry
        </button>
      ) : null}
    </span>
  );
}
