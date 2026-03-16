"use client";

import Link from "next/link";
import type { ProgressSummaryData } from "@/lib/cross-links";

interface ProgressSummaryStripProps {
  data: ProgressSummaryData;
}

export default function ProgressSummaryStrip({ data }: ProgressSummaryStripProps) {
  if (data.items.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "12px 16px",
        background: "linear-gradient(135deg, var(--ypp-purple-light, #ede9fe) 0%, #f0f4ff 100%)",
        borderRadius: 10,
        border: "1px solid var(--ypp-purple-border, #ddd6fe)",
      }}
    >
      {data.headline && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ypp-purple, #7c3aed)",
            marginBottom: 8,
          }}
        >
          {data.headline}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {data.items.map((item, i) => {
          const content = (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: "rgba(255,255,255,0.7)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {item.icon && <span style={{ fontSize: 14 }}>{item.icon}</span>}
              <span style={{ color: "var(--text-secondary, #666)" }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: "var(--gray-800, #1a202c)" }}>
                {item.value}
              </span>
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={i}
                href={item.href}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {content}
              </Link>
            );
          }
          return content;
        })}
      </div>
    </div>
  );
}
