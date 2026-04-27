"use client";

/**
 * Floating list of remaining queued applicants. Sortable + filterable.
 * Lets the chair jump non-sequentially through the queue. (§6.6)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { QueueSibling } from "@/lib/final-review-queries";
import RecommendationBadge from "@/components/instructor-applicants/shared/RecommendationBadge";
import { XIcon } from "./cockpit-icons";

export interface QueueSiblingDropdownProps {
  siblings: QueueSibling[];
  currentId: string;
  open: boolean;
  onClose: () => void;
  routeBuilder: (id: string) => string;
}

type SortKey = "daysInQueue-desc" | "daysInQueue-asc" | "chapter" | "recommendation";

function sortSiblings(items: QueueSibling[], key: SortKey): QueueSibling[] {
  const arr = [...items];
  switch (key) {
    case "daysInQueue-desc":
      return arr.sort((a, b) => (b.daysInQueue ?? 0) - (a.daysInQueue ?? 0));
    case "daysInQueue-asc":
      return arr.sort((a, b) => (a.daysInQueue ?? 0) - (b.daysInQueue ?? 0));
    case "chapter":
      return arr.sort((a, b) =>
        (a.chapterName ?? "").localeCompare(b.chapterName ?? "") ||
        a.displayName.localeCompare(b.displayName)
      );
    case "recommendation": {
      const order: Record<string, number> = {
        ACCEPT: 0,
        ACCEPT_WITH_SUPPORT: 1,
        HOLD: 2,
        REJECT: 3,
      };
      return arr.sort((a, b) => {
        const ar = a.recommendation ? order[a.recommendation] ?? 9 : 9;
        const br = b.recommendation ? order[b.recommendation] ?? 9 : 9;
        return ar - br;
      });
    }
  }
}

export default function QueueSiblingDropdown({
  siblings,
  currentId,
  open,
  onClose,
  routeBuilder,
}: QueueSiblingDropdownProps) {
  const [sortKey, setSortKey] = useState<SortKey>("daysInQueue-desc");
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const sorted = sortSiblings(siblings, sortKey);
    if (!query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        (s.chapterName ?? "").toLowerCase().includes(q)
    );
  }, [siblings, sortKey, query]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="queue-sibling-dropdown"
      role="listbox"
      aria-label="Queued applicants"
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 8px)",
        width: 360,
        maxHeight: 480,
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(59, 15, 110, 0.18)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search applicants…"
          aria-label="Filter queue"
          style={{
            flex: 1,
            padding: "6px 10px",
            border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort"
          style={{
            padding: "6px 10px",
            border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
            borderRadius: 8,
            fontSize: 12,
            background: "#fff",
          }}
        >
          <option value="daysInQueue-desc">Oldest first</option>
          <option value="daysInQueue-asc">Newest first</option>
          <option value="chapter">By chapter</option>
          <option value="recommendation">By recommendation</option>
        </select>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close queue"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-muted, #6b5f7a)",
            padding: 2,
          }}
        >
          <XIcon size={16} />
        </button>
      </div>
      <div
        style={{ overflowY: "auto", flex: 1 }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "20px 12px",
              fontSize: 13,
              color: "var(--ink-muted, #6b5f7a)",
              textAlign: "center",
            }}
          >
            No queued applicants match.
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {filtered.map((sibling) => {
              const isCurrent = sibling.id === currentId;
              return (
                <li key={sibling.id} role="option" aria-selected={isCurrent}>
                  <Link
                    href={routeBuilder(sibling.id)}
                    onClick={onClose}
                    prefetch
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      textDecoration: "none",
                      color: "inherit",
                      background: isCurrent ? "var(--ypp-purple-50, #f3ecff)" : "transparent",
                      borderTop: "1px solid var(--cockpit-line, rgba(71,85,105,0.08))",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, var(--ypp-purple-500, #8b3fe8), var(--ypp-purple-600, #6b21c8))",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {sibling.displayName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase() ?? "")
                        .join("")}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink-default, #1a0533)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sibling.displayName}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 11,
                          color: "var(--ink-muted, #6b5f7a)",
                        }}
                      >
                        {sibling.chapterName ?? "Chapter unknown"}
                        {sibling.daysInQueue !== null
                          ? ` · ${sibling.daysInQueue}d in queue`
                          : ""}
                      </span>
                    </span>
                    <RecommendationBadge recommendation={sibling.recommendation} size="sm" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
