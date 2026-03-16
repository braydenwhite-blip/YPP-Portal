"use client";

import Link from "next/link";
import type { ActivityEventData } from "@/lib/activity-events";

interface ActivityFeedWidgetProps {
  events: ActivityEventData[];
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function ActivityFeedWidget({ events }: ActivityFeedWidgetProps) {
  if (events.length === 0) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>
          Recent Activity
        </h3>
        <p style={{ color: "var(--text-secondary, #666)", fontSize: 13, margin: 0 }}>
          Your activity will appear here as you explore the portal.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          Recent Activity
        </h3>
        <Link
          href="/activity-feed"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ypp-purple, #7c3aed)",
            textDecoration: "none",
          }}
        >
          View all →
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {events.slice(0, 8).map((event) => (
          <div key={event.id}>
            {event.link ? (
              <Link
                href={event.link}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 4px",
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: 6,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--gray-50, #f7fafc)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {event.icon || "📌"}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "var(--gray-700, #374151)",
                  }}
                >
                  {event.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary, #666)",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {relativeTime(event.createdAt)}
                </span>
              </Link>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 4px",
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {event.icon || "📌"}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "var(--gray-700, #374151)",
                  }}
                >
                  {event.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary, #666)",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {relativeTime(event.createdAt)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
