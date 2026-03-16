"use client";

import { useState } from "react";
import Link from "next/link";
import type { CrossLinkData } from "@/lib/cross-links";

interface CrossLinkSectionProps {
  data: CrossLinkData;
}

export default function CrossLinkSection({ data }: CrossLinkSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (data.related.length === 0 && data.connections.length === 0) return null;

  const visibleItems = expanded ? data.related : data.related.slice(0, 4);
  const hasMore = data.related.length > 4;

  return (
    <div style={{ marginTop: 24, marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--gray-700, #374151)",
            margin: 0,
          }}
        >
          Connected across the portal
        </h3>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ypp-purple, #7c3aed)",
              padding: "2px 6px",
            }}
          >
            {expanded ? "Show less" : `Show all ${data.related.length}`}
          </button>
        )}
      </div>

      {/* Connection callouts */}
      {data.connections.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {data.connections.slice(0, 3).map((conn, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                padding: "3px 8px",
                background: "var(--gray-50, #f7fafc)",
                borderRadius: 4,
                color: "var(--text-secondary, #666)",
                borderLeft: "2px solid var(--ypp-purple, #7c3aed)",
              }}
            >
              {conn}
            </span>
          ))}
        </div>
      )}

      {/* Related items */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {visibleItems.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                background: "var(--gray-50, #f7fafc)",
                borderRadius: 8,
                border: "1px solid var(--gray-200, #e2e8f0)",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--ypp-purple, #7c3aed)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--gray-200, #e2e8f0)")
              }
            >
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>
                {item.icon}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--gray-800, #1a202c)",
                    marginBottom: 2,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary, #666)",
                    lineHeight: 1.3,
                  }}
                >
                  {item.description}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
