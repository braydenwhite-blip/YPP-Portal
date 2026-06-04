"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  deleteActionView,
  saveActionView,
} from "@/lib/people-strategy/saved-views-actions";
import type { SavedActionViewDTO } from "@/lib/people-strategy/saved-views";

/**
 * Saved Views bar for the Action Tracker. Renders the viewer's saved filter
 * sets as one-click chips and a "Save current view" affordance. The current
 * filters arrive pre-serialized from the server (`currentQuery`) so a saved
 * view re-applies exactly what's on screen.
 */
export function SavedViewsBar({
  views,
  currentQuery,
  hasActiveFilters,
}: {
  views: SavedActionViewDTO[];
  currentQuery: string;
  hasActiveFilters: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update saved views.");
      }
    });
  }

  function saveCurrent() {
    const name = window.prompt("Name this view (e.g. “My overdue”, “Marketing blocked”)");
    if (!name || !name.trim()) return;
    run(() => saveActionView({ name: name.trim(), query: currentQuery }));
  }

  if (views.length === 0 && !hasActiveFilters) {
    return (
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Tip: filter the list, then save it as a view for one-click access next time.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Saved views:</span>

      {views.length === 0 ? (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>none yet</span>
      ) : (
        views.map((view) => (
          <span key={view.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Link
              href={view.query ? `/actions/all?${view.query}` : "/actions/all"}
              className="button outline small"
              style={{ fontSize: 12 }}
            >
              {view.name}
            </Link>
            <button
              type="button"
              onClick={() => run(() => deleteActionView(view.id))}
              disabled={pending}
              aria-label={`Delete saved view ${view.name}`}
              style={{
                border: "none",
                background: "transparent",
                cursor: pending ? "default" : "pointer",
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))
      )}

      {hasActiveFilters ? (
        <button type="button" onClick={saveCurrent} disabled={pending} className="button small" style={{ fontSize: 12 }}>
          + Save current view
        </button>
      ) : null}

      {error ? <span style={{ fontSize: 11, color: "var(--error-color)" }}>{error}</span> : null}
    </div>
  );
}
