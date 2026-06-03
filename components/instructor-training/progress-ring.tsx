"use client";

import { useReducedMotion } from "framer-motion";

/**
 * Compact SVG progress ring for the training hero. Animates its stroke to the
 * target percentage with the launchpad easing; under reduced motion it renders
 * the final state immediately (no transition).
 */
export default function ProgressRing({
  pct,
  size = 72,
  stroke = 7,
  label,
  complete = false,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  /** Small text under the percentage (e.g. "2 / 5"). */
  label?: string;
  complete?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const accent = complete ? "var(--success-color, #15803d)" : "var(--ypp-purple-600)";

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Overall training progress"
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ypp-purple-100)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: reduced
              ? "none"
              : "stroke-dashoffset 700ms var(--ease-launchpad), stroke 300ms var(--ease-launchpad)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          lineHeight: 1.05,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 800, color: accent }}>{clamped}%</span>
        {label ? (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.02em" }}>
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
