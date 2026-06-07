"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type HubLinkView = {
  href: string;
  label: string;
  description?: string;
  icon: string;
  category: string;
};

const CATEGORY_ORDER = ["My Chapter", "Leadership", "Network", "Admin"];

/**
 * Searchable, category-grouped grid of chapter tools. Pure presentation over a
 * pre-filtered (role-aware) link list passed from the server page — the search
 * is a client-side convenience for finding a tool fast in a long hub.
 */
export default function ChapterHubLinks({ links }: { links: HubLinkView[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return links;
    return links.filter((l) =>
      `${l.label} ${l.description ?? ""} ${l.category}`.toLowerCase().includes(q),
    );
  }, [links, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, HubLinkView[]>();
    for (const link of filtered) {
      const arr = map.get(link.category) ?? [];
      arr.push(link);
      map.set(link.category, arr);
    }
    const known = CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c)!] as const,
    );
    const extra = [...map.keys()]
      .filter((c) => !CATEGORY_ORDER.includes(c))
      .map((c) => [c, map.get(c)!] as const);
    return [...known, ...extra];
  }, [filtered]);

  return (
    <div>
      <div className="ps-filter-bar" style={{ marginTop: 20 }}>
        <div className="ps-filter-search" style={{ flex: "1 1 320px" }}>
          <input
            className="ps-filter"
            type="search"
            placeholder="Search chapter tools…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search chapter tools"
          />
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
          {filtered.length} {filtered.length === 1 ? "tool" : "tools"}
        </span>
      </div>

      {grouped.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="psuite-empty">
            <span className="psuite-empty-icon" aria-hidden="true">
              🔍
            </span>
            <p className="psuite-empty-title">No tools match “{query}”</p>
            <p className="psuite-empty-text">
              Try a different search — or clear it to see everything in your hub.
            </p>
          </div>
        </div>
      ) : (
        grouped.map(([category, items]) => (
          <section key={category} style={{ marginTop: 24 }}>
            <h2 className="ps-section-title">{category}</h2>
            <div className="grid two psuite-reveal" style={{ marginTop: 12, alignItems: "stretch" }}>
              {items.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="card ps-action-card psuite-hub-card"
                  style={{
                    textDecoration: "none",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <span className="psuite-hub-icon" aria-hidden="true">
                    {link.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="ps-action-card-title"
                      style={{ fontWeight: 800, color: "var(--ps-ink)", marginBottom: 4 }}
                    >
                      {link.label}
                    </div>
                    {link.description ? (
                      <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.4 }}>
                        {link.description}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
