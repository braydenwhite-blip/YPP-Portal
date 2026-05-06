"use client";

/**
 * Prev/next + counter + sibling dropdown trigger for the chair queue.
 * (§6.5 of the redesign plan.)
 */

import { useState } from "react";
import Link from "next/link";
import type { QueueSibling } from "@/lib/final-review-queries";
import QueueSiblingDropdown from "./QueueSiblingDropdown";
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon } from "./cockpit-icons";

export interface QueueNavigatorProps {
  currentId: string;
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
  siblings: QueueSibling[];
  routeBuilder: (id: string) => string;
}

export default function QueueNavigator({
  currentId,
  prevId,
  nextId,
  position,
  total,
  siblings,
  routeBuilder,
}: QueueNavigatorProps) {
  const [open, setOpen] = useState(false);

  if (total <= 0) return null;

  const arrowStyle = (disabled: boolean) => ({
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: disabled ? "transparent" : "var(--cockpit-surface, #fff)",
    border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
    color: disabled ? "var(--ink-faint, #a89cb8)" : "var(--ink-default, #1a0533)",
    cursor: disabled ? "not-allowed" : "pointer",
    pointerEvents: disabled ? ("none" as const) : ("auto" as const),
  });

  return (
    <div
      className="queue-navigator"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, position: "relative" }}
    >
      {prevId ? (
        <Link
          href={routeBuilder(prevId)}
          prefetch
          aria-label="Previous applicant"
          style={arrowStyle(false)}
        >
          <ArrowLeftIcon size={18} />
        </Link>
      ) : (
        <span aria-label="No previous applicant" aria-disabled="true" style={arrowStyle(true)}>
          <ArrowLeftIcon size={18} />
        </span>
      )}
      <button
        type="button"
        className="queue-counter"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          background: "var(--cockpit-surface-strong, #faf8ff)",
          border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--ink-default, #1a0533)",
          cursor: "pointer",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {position} of {total}
        <ChevronDownIcon size={14} />
      </button>
      {nextId ? (
        <Link
          href={routeBuilder(nextId)}
          prefetch
          aria-label="Next applicant"
          style={arrowStyle(false)}
        >
          <ArrowRightIcon size={18} />
        </Link>
      ) : (
        <span aria-label="No next applicant" aria-disabled="true" style={arrowStyle(true)}>
          <ArrowRightIcon size={18} />
        </span>
      )}
      <QueueSiblingDropdown
        siblings={siblings}
        currentId={currentId}
        open={open}
        onClose={() => setOpen(false)}
        routeBuilder={routeBuilder}
      />
    </div>
  );
}
