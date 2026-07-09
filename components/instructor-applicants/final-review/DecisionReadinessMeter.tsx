"use client";

/**
 * Conic-gradient SVG ring summarising the four readiness signals.
 * Hover any segment for the specific gap (Phase 2A version surfaces a
 * lightweight tooltip; Phase 3 wires the filter action).
 */

import { useState } from "react";
import {
  type ReadinessSignals,
  readinessPercentage,
  readinessSignalLabel,
} from "@/lib/readiness-signals";
import type { DecisionReadinessCheck } from "@/lib/applications/decision-readiness";
import { readinessPercentFromChecks } from "@/lib/applications/decision-readiness";
import { CheckIcon, AlertTriangleIcon } from "./cockpit-icons";

export interface DecisionReadinessMeterProps {
  /** Stage-aware checklist — matches Application 360 #readiness. */
  checks?: DecisionReadinessCheck[];
  /** Legacy four-signal input for the final-review cockpit. */
  signals?: ReadinessSignals;
  /** e.g. "1 of 3 complete" — shown beside the ring in compact mode. */
  summaryLine?: string;
  compact?: boolean;
}

const LEGACY_SEGMENTS: Array<keyof ReadinessSignals> = [
  "hasSubmittedInterviewReviews",
  "hasMaterialsComplete",
  "hasReviewerRecommendation",
  "hasNoOpenInfoRequest",
];

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const startRad = ((startDeg - 90) * Math.PI) / 180;
  const endRad = ((endDeg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function DecisionReadinessMeter({
  checks,
  signals,
  summaryLine,
  compact = false,
}: DecisionReadinessMeterProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const segments = checks?.length
    ? checks.map((check, idx) => ({
        key: check.label,
        done: check.done,
        complete: check.detail ?? check.label,
        gap: check.detail ?? `${check.label} pending`,
        idx,
      }))
    : signals
      ? LEGACY_SEGMENTS.map((key, idx) => {
          const label = readinessSignalLabel(key);
          return {
            key,
            done: signals[key],
            complete: label.complete,
            gap: label.gap,
            idx,
          };
        })
      : [];

  if (segments.length === 0) return null;

  const completedCount = segments.filter((s) => s.done).length;
  const segmentCount = segments.length;
  const percent = checks?.length
    ? readinessPercentFromChecks(checks)
    : signals
      ? readinessPercentage(signals)
      : 0;
  const degreesPerSegment = 360 / segmentCount;
  const arcGap = Math.min(4, degreesPerSegment * 0.08);
  const ringSize = compact ? 48 : 88;
  const stroke = compact ? 5 : 9;
  const radius = (ringSize - stroke) / 2;
  const cx = ringSize / 2;
  const cy = ringSize / 2;

  return (
    <div
      className={`readiness-meter${compact ? " compact" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 12 : 16,
        padding: compact ? "0" : "8px 12px",
      }}
    >
      <div
        className="readiness-ring"
        style={{ position: "relative", width: ringSize, height: ringSize }}
      >
        <svg width={ringSize} height={ringSize} role="img" aria-label={`Decision readiness: ${completedCount} of ${segmentCount} complete`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(168, 156, 184, 0.28)"
            strokeWidth={stroke}
          />
          {segments.map((segment) => {
            const start = segment.idx * degreesPerSegment + arcGap;
            const end = (segment.idx + 1) * degreesPerSegment - arcGap;
            return (
              <path
                key={String(segment.key)}
                d={describeArc(cx, cy, radius, start, end)}
                fill="none"
                stroke={segment.done ? "#22c55e" : "rgba(168, 156, 184, 0.4)"}
                strokeWidth={stroke}
                strokeLinecap="round"
                style={{
                  transition: "stroke 200ms ease",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredIndex(segment.idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(segment.idx)}
                onBlur={() => setHoveredIndex(null)}
                tabIndex={compact ? -1 : 0}
              >
                <title>{segment.done ? segment.complete : segment.gap}</title>
              </path>
            );
          })}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: compact ? 12 : 16,
            fontWeight: 600,
            color: "var(--ink-default, #1a0533)",
          }}
        >
          {completedCount}/{segmentCount}
        </div>
      </div>
      {!compact ? (
        <ul
          aria-label="Readiness signals"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 13,
            color: "var(--ink-default, #1a0533)",
          }}
        >
          {segments.map((segment) => {
            return (
              <li key={String(segment.key)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    color: segment.done ? "#16a34a" : "#d97706",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {segment.done ? <CheckIcon size={14} /> : <AlertTriangleIcon size={14} />}
                </span>
                <span
                  style={{
                    color: segment.done ? "var(--ink-default, #1a0533)" : "var(--ink-muted, #6b5f7a)",
                  }}
                >
                  {segment.done ? segment.complete : segment.gap}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-muted, #6b5f7a)",
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.2,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--ink-default, #1a0533)" }}>
            {percent === 100 ? "Ready to decide" : "Decision readiness"}
          </span>
          <span>
            {hoveredIndex !== null
              ? segments[hoveredIndex].done
                ? segments[hoveredIndex].complete
                : segments[hoveredIndex].gap
              : summaryLine ?? `${percent}% complete`}
          </span>
        </div>
      )}
    </div>
  );
}
