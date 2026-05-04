"use client";

/**
 * Conic-gradient SVG ring summarising the four readiness signals.
 * Hover any segment for the specific gap (Phase 2A version surfaces a
 * lightweight tooltip; Phase 3 wires the filter action).
 */

import { useMemo, useState } from "react";
import {
  type ReadinessSignals,
  readinessPercentage,
  readinessSignalLabel,
} from "@/lib/readiness-signals";
import { CheckIcon, AlertTriangleIcon } from "./cockpit-icons";

export interface DecisionReadinessMeterProps {
  signals: ReadinessSignals;
  compact?: boolean;
}

const SEGMENTS: Array<keyof ReadinessSignals> = [
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
  signals,
  compact = false,
}: DecisionReadinessMeterProps) {
  const [hoveredSegment, setHoveredSegment] = useState<keyof ReadinessSignals | null>(null);
  const completedCount = useMemo(
    () => SEGMENTS.filter((key) => signals[key]).length,
    [signals]
  );
  const percent = readinessPercentage(signals);
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
        <svg width={ringSize} height={ringSize} role="img" aria-label={`Decision readiness: ${completedCount} of 4 signals met`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(168, 156, 184, 0.28)"
            strokeWidth={stroke}
          />
          {SEGMENTS.map((key, idx) => {
            const start = idx * 90 + 4;
            const end = (idx + 1) * 90 - 4;
            const complete = signals[key];
            return (
              <path
                key={key}
                d={describeArc(cx, cy, radius, start, end)}
                fill="none"
                stroke={complete ? "#22c55e" : "rgba(168, 156, 184, 0.4)"}
                strokeWidth={stroke}
                strokeLinecap="round"
                style={{
                  transition: "stroke 200ms ease",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredSegment(key)}
                onMouseLeave={() => setHoveredSegment(null)}
                onFocus={() => setHoveredSegment(key)}
                onBlur={() => setHoveredSegment(null)}
                tabIndex={compact ? -1 : 0}
              >
                <title>{readinessSignalLabel(key).title}</title>
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
          {completedCount}/4
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
          {SEGMENTS.map((key) => {
            const label = readinessSignalLabel(key);
            const ok = signals[key];
            return (
              <li key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    color: ok ? "#16a34a" : "#d97706",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {ok ? <CheckIcon size={14} /> : <AlertTriangleIcon size={14} />}
                </span>
                <span style={{ color: ok ? "var(--ink-default, #1a0533)" : "var(--ink-muted, #6b5f7a)" }}>
                  {ok ? label.complete : label.gap}
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
            {hoveredSegment
              ? signals[hoveredSegment]
                ? readinessSignalLabel(hoveredSegment).complete
                : readinessSignalLabel(hoveredSegment).gap
              : `${percent}% complete`}
          </span>
        </div>
      )}
    </div>
  );
}
