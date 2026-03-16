"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SmartSuggestion } from "@/lib/cross-links";

interface SmartSuggestionCardProps {
  suggestions: SmartSuggestion[];
}

export default function SmartSuggestionCard({
  suggestions,
}: SmartSuggestionCardProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dismissed-suggestions");
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const now = Date.now();
        // Dismiss entries expire after 24 hours
        const valid = Object.entries(parsed).filter(
          ([, ts]) => now - ts < 24 * 60 * 60 * 1000
        );
        setDismissed(new Set(valid.map(([key]) => key)));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = (key: string) => {
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    try {
      const stored = JSON.parse(
        localStorage.getItem("dismissed-suggestions") || "{}"
      );
      stored[key] = Date.now();
      localStorage.setItem("dismissed-suggestions", JSON.stringify(stored));
    } catch {
      // ignore
    }
  };

  const visible = suggestions.filter(
    (s) => !dismissed.has(`${s.href}-${s.title}`)
  );

  if (visible.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      {visible.slice(0, 2).map((suggestion, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            marginBottom: 10,
            background:
              "linear-gradient(135deg, var(--ypp-purple-light, #ede9fe) 0%, var(--pink-50, #fdf2f8) 100%)",
            borderRadius: 10,
            border: "1px solid var(--ypp-purple-border, #ddd6fe)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flex: 1,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>
              {suggestion.icon}
            </span>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--gray-800, #1a202c)",
                  marginBottom: 2,
                }}
              >
                {suggestion.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--gray-600, #4a5568)",
                  marginBottom: 2,
                }}
              >
                {suggestion.description}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ypp-purple, #7c3aed)",
                  fontStyle: "italic",
                }}
              >
                {suggestion.reason}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <Link
              href={suggestion.href}
              className="button primary small"
              style={{
                fontSize: 12,
                whiteSpace: "nowrap",
                textDecoration: "none",
              }}
            >
              Let&apos;s go →
            </Link>
            <button
              onClick={() =>
                handleDismiss(`${suggestion.href}-${suggestion.title}`)
              }
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                fontSize: 14,
                color: "var(--gray-400, #a0aec0)",
                lineHeight: 1,
              }}
              aria-label="Dismiss suggestion"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
