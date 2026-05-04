"use client";

/**
 * Zone 2 from §12.5.2 — the compact pre-commit preview line shown above the
 * decision buttons when the chair's pending action carries unacknowledged
 * HIGH_RISK warnings. Encourages slow-down without blocking.
 */

import type { FinalReviewWarning } from "@/lib/final-review-warnings";
import { AlertOctagonIcon } from "./cockpit-icons";

export interface DockRiskPreviewProps {
  warnings: FinalReviewWarning[];
  acknowledgements: Record<string, boolean>;
  onClick?: () => void;
}

export default function DockRiskPreview({
  warnings,
  acknowledgements,
  onClick,
}: DockRiskPreviewProps) {
  const unacked = warnings.filter(
    (w) => w.severity === "HIGH_RISK" && !acknowledgements[w.key]
  );
  if (unacked.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="dock-risk-preview"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid rgba(239, 68, 68, 0.4)",
        background: "rgba(239, 68, 68, 0.08)",
        color: "#b91c1c",
        fontSize: 12,
        fontWeight: 600,
        cursor: onClick ? "pointer" : "default",
        alignSelf: "flex-start",
      }}
    >
      <AlertOctagonIcon size={14} />
      <span>
        {unacked.length} risk{unacked.length === 1 ? "" : "s"} to acknowledge before committing
      </span>
    </button>
  );
}
