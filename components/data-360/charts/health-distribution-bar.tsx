"use client";

/**
 * Data 360 — workflow health distribution bar.
 *
 * A single stacked bar of the concrete, reason-based health statuses the engine
 * produces (BLOCKED / OVERDUE / STALLED / NEEDS_ATTENTION / ON_TRACK). Each
 * segment is clickable into the filtered workflow list — every number drills
 * down. Hand-rolled (not recharts) because it is a one-row proportion bar, not
 * a time series; keeps it light and perfectly on-palette.
 */

import Link from "next/link";

import type { WorkflowHealthStatus } from "@/lib/workflow-engine/health";
import {
  WORKFLOW_HEALTH_LABELS,
  workflowData360DrilldownHref,
} from "@/lib/data-360/workflow-analytics-core";

const SEGMENT_COLOR: Partial<Record<WorkflowHealthStatus, string>> = {
  BLOCKED: "#f87171",
  OVERDUE: "#fb923c",
  STALLED: "#a78bfa",
  NEEDS_ATTENTION: "#fbbf24",
  ON_TRACK: "#34d399",
};

const ORDER: WorkflowHealthStatus[] = [
  "BLOCKED",
  "OVERDUE",
  "STALLED",
  "NEEDS_ATTENTION",
  "ON_TRACK",
];

export function HealthDistributionBar({
  counts,
  chapterId,
  theme = "dark",
}: {
  counts: Record<WorkflowHealthStatus, number>;
  chapterId?: string;
  theme?: "dark" | "light";
}) {
  const total = ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);
  const trackBg = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,20,32,0.06)";
  const textMuted = theme === "dark" ? "#8b94a7" : "#5b6472";

  if (total === 0) {
    return (
      <p className="text-[12px]" style={{ color: textMuted }}>
        No active workflows to score yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: trackBg }}
      >
        {ORDER.map((k) => {
          const n = counts[k] ?? 0;
          if (n === 0) return null;
          const pct = (n / total) * 100;
          return (
            <Link
              key={k}
              href={workflowData360DrilldownHref({
                health: k,
                ...(chapterId ? { chapterId } : {}),
              })}
              prefetch={false}
              title={`${WORKFLOW_HEALTH_LABELS[k]}: ${n}`}
              style={{ width: `${pct}%`, background: SEGMENT_COLOR[k] }}
              className="block h-full transition-opacity hover:opacity-80"
              aria-label={`${WORKFLOW_HEALTH_LABELS[k]}: ${n}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {ORDER.map((k) => {
          const n = counts[k] ?? 0;
          return (
            <Link
              key={k}
              href={workflowData360DrilldownHref({
                health: k,
                ...(chapterId ? { chapterId } : {}),
              })}
              prefetch={false}
              className="flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-70"
              style={{ color: textMuted }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: SEGMENT_COLOR[k], opacity: n === 0 ? 0.3 : 1 }}
              />
              <span className="tabular-nums font-semibold" style={{ color: n > 0 ? undefined : textMuted }}>
                {n}
              </span>
              {WORKFLOW_HEALTH_LABELS[k]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
