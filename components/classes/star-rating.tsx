"use client";

import { useState } from "react";

/**
 * Star rating used across the class feedback layer. Interactive when `onChange`
 * is supplied (keyboard + pointer), read-only otherwise — the same glyphs render
 * a student's submitted score on instructor/admin surfaces.
 */
export function StarRating({
  value,
  onChange,
  size = 28,
  label,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const readOnly = !onChange;
  const active = hover ?? value;

  return (
    <div
      role={readOnly ? "img" : "radiogroup"}
      aria-label={label ?? `Rating: ${value} out of 5`}
      style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= active;
        if (readOnly) {
          return (
            <span
              key={star}
              aria-hidden="true"
              style={{ fontSize: size, lineHeight: 1, color: filled ? "#f59e0b" : "var(--gray-300, #d1d5db)" }}
            >
              ★
            </span>
          );
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(star)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: size,
              lineHeight: 1,
              color: filled ? "#f59e0b" : "var(--gray-300, #d1d5db)",
              transition: "color 0.12s, transform 0.12s",
              transform: hover === star ? "scale(1.12)" : "none",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
