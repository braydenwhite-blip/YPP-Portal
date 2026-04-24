"use client";

/**
 * ConceptReveal — tabbed panel component.
 *
 * Each panel is a tab button (role="tab"). Clicking a tab marks it visited.
 * When ALL panels have been visited, emits a non-null response. Until then, null.
 *
 * Response shape: { visitedPanelIds: string[] }
 * Non-null when: visitedPanelIds.length === config.panels.length (all visited).
 *
 * Keyboard: ArrowRight / ArrowLeft move focus between tabs within the tablist.
 * readOnly disables all tab buttons.
 */

import { useState, useCallback, useRef } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape (client-safe — panels only)
// ---------------------------------------------------------------------------

type Panel = {
  id: string;
  title: string;
  body: string;
};

type ConceptRevealConfig = {
  panels: Panel[];
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ConceptRevealProps = {
  beat: ClientBeat & { config: unknown };
  response: { visitedPanelIds: string[] } | null;
  onResponseChange: (next: { visitedPanelIds: string[] } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConceptReveal({
  beat,
  response,
  onResponseChange,
  readOnly,
}: ConceptRevealProps) {
  const config = beat.config as ConceptRevealConfig;
  const panels = config.panels ?? [];

  // Initialize visited set from existing response (supports resume).
  const [visitedIds, setVisitedIds] = useState<Set<string>>(
    () => new Set(response?.visitedPanelIds ?? [])
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabClick = useCallback(
    (panel: Panel, index: number) => {
      if (readOnly) return;

      setActiveIndex(index);
      setVisitedIds((prev) => {
        const next = new Set(prev);
        next.add(panel.id);
        // Emit non-null only when all panels have been visited.
        if (next.size === panels.length) {
          onResponseChange({ visitedPanelIds: panels.map((p) => p.id) });
        } else {
          onResponseChange(null);
        }
        return next;
      });
    },
    [readOnly, panels, onResponseChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (index + 1) % panels.length;
        tabRefs.current[next]?.focus();
        handleTabClick(panels[next], next);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (index - 1 + panels.length) % panels.length;
        tabRefs.current[prev]?.focus();
        handleTabClick(panels[prev], prev);
      }
    },
    [panels, handleTabClick]
  );

  const activePanel = panels[activeIndex];
  const tabPanelId = `concept-reveal-panel-${beat.id}`;

  return (
    <div className="concept-reveal">
      <div
        role="tablist"
        aria-label={beat.title}
        className="concept-reveal__tablist"
      >
        {panels.map((panel, index) => {
          const isActive = index === activeIndex;
          const isVisited = visitedIds.has(panel.id);

          return (
            <button
              key={panel.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              aria-selected={isActive}
              aria-controls={tabPanelId}
              id={`concept-reveal-tab-${beat.id}-${panel.id}`}
              className={[
                "concept-reveal__tab",
                isActive ? "concept-reveal__tab--active" : "",
                isVisited ? "concept-reveal__tab--visited" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleTabClick(panel, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={readOnly}
              aria-disabled={readOnly}
              tabIndex={isActive ? 0 : -1}
            >
              {panel.title}
              {isVisited && !isActive && (
                <span className="concept-reveal__tab-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activePanel && (
        <div
          id={tabPanelId}
          role="tabpanel"
          aria-labelledby={`concept-reveal-tab-${beat.id}-${activePanel.id}`}
          className="concept-reveal__panel"
          tabIndex={0}
        >
          <h3 className="concept-reveal__panel-title">{activePanel.title}</h3>
          <p className="concept-reveal__panel-body">{activePanel.body}</p>
        </div>
      )}

      {panels.length > 0 && visitedIds.size < panels.length && (
        <p className="concept-reveal__progress" aria-live="polite">
          {visitedIds.size} of {panels.length} tabs visited
        </p>
      )}
    </div>
  );
}
