"use client";

import { useState } from "react";
import Link from "next/link";

type FeedEvent = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  link: string | null;
  icon: string | null;
  createdAt: Date;
  category: string;
};

interface ActivityFeedListProps {
  events: FeedEvent[];
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

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  learning: "Learning",
  achievement: "Achievements",
  social: "Social",
};

const CATEGORY_COLORS: Record<string, string> = {
  learning: "#3b82f6",
  achievement: "#d97706",
  social: "#16a34a",
};

export function ActivityFeedList({ events }: ActivityFeedListProps) {
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all" ? events : events.filter((e) => e.category === filter);

  return (
    <div>
      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid",
              borderColor:
                filter === key
                  ? "var(--ypp-purple, #7c3aed)"
                  : "var(--gray-200, #e2e8f0)",
              background:
                filter === key
                  ? "var(--ypp-purple, #7c3aed)"
                  : "white",
              color: filter === key ? "white" : "var(--gray-600, #4a5568)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Events */}
      {filtered.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            No activity yet in this category. Keep exploring the portal!
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((event) => {
            const catColor =
              CATEGORY_COLORS[event.category] || "var(--gray-400)";

            const inner = (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: "white",
                  borderRadius: 8,
                  border: "1px solid var(--gray-200, #e2e8f0)",
                  borderLeft: `3px solid ${catColor}`,
                  transition: "border-color 0.15s",
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>
                  {event.icon || "📌"}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--gray-800, #1a202c)",
                    }}
                  >
                    {event.title}
                  </div>
                  {event.detail && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary, #666)",
                        marginTop: 2,
                      }}
                    >
                      {event.detail}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary, #666)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {relativeTime(event.createdAt)}
                  </span>
                  <span
                    className="pill"
                    style={{
                      fontSize: 10,
                      background: `${catColor}15`,
                      color: catColor,
                      fontWeight: 600,
                    }}
                  >
                    {event.category}
                  </span>
                </div>
              </div>
            );

            if (event.link) {
              return (
                <Link
                  key={event.id}
                  href={event.link}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {inner}
                </Link>
              );
            }
            return <div key={event.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
