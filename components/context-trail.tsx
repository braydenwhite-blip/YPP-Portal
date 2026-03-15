"use client";

import Link from "next/link";
import type { ContextTrailItem } from "@/lib/context-trail";

interface ContextTrailProps {
  items: ContextTrailItem[];
}

export default function ContextTrail({ items }: ContextTrailProps) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        marginBottom: 16,
        background: "var(--gray-50, #f7fafc)",
        borderRadius: 8,
        fontSize: 13,
        color: "var(--muted, #666)",
        borderLeft: "3px solid var(--ypp-purple, #7c3aed)",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--ypp-purple, #7c3aed)" }}>
        Your journey
      </span>
      <span style={{ color: "var(--gray-300, #cbd5e0)" }}>|</span>
      {items.map((item, i) => (
        <span key={`${item.type}-${item.href}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {i > 0 && (
            <span style={{ color: "var(--gray-400, #a0aec0)", margin: "0 2px" }}>
              →
            </span>
          )}
          <span>{item.icon}</span>
          <Link
            href={item.href}
            style={{
              color: "var(--ypp-purple, #7c3aed)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            {item.label}
          </Link>
          {item.detail && (
            <span
              style={{
                fontSize: 11,
                color: "var(--gray-500, #a0aec0)",
                fontWeight: 400,
              }}
            >
              ({item.detail})
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
