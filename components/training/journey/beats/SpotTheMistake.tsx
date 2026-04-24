"use client";

/**
 * SpotTheMistake — click-span in a passage with an accessible alternate list.
 *
 * Sighted users click highlighted spans in the passage text.
 * Screen-reader users operate the sibling <ul> where each <li> contains
 * a <button> for the same target — both share the same click handler.
 *
 * Passage is split by target {start, end} character indices. Text segments
 * between targets are rendered as plain text nodes; targets are wrapped in
 * <button class="target-span"> elements.
 *
 * Config shape (client-safe — correctTargetId stripped):
 *   passage: string
 *   targets: { id: string; start: number; end: number; label: string }[]
 *   hint?: string
 *
 * Response shape: { clickedTargetId: string }
 * Non-null when: any target is selected.
 *
 * readOnly disables all target buttons.
 */

import { useState, useCallback } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

type SpotTarget = {
  id: string;
  start: number;
  end: number;
  label: string;
};

type SpotTheMistakeConfig = {
  passage: string;
  targets: SpotTarget[];
  hint?: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SpotTheMistakeProps = {
  beat: ClientBeat & { config: unknown };
  response: { clickedTargetId: string } | null;
  onResponseChange: (next: { clickedTargetId: string } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Passage segment types
// ---------------------------------------------------------------------------

type TextSegment = { kind: "text"; text: string };
type TargetSegment = { kind: "target"; target: SpotTarget };
type Segment = TextSegment | TargetSegment;

function buildSegments(passage: string, targets: SpotTarget[]): Segment[] {
  // Sort targets by start position.
  const sorted = [...targets].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const target of sorted) {
    if (target.start > cursor) {
      segments.push({ kind: "text", text: passage.slice(cursor, target.start) });
    }
    segments.push({ kind: "target", target });
    cursor = target.end;
  }

  if (cursor < passage.length) {
    segments.push({ kind: "text", text: passage.slice(cursor) });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpotTheMistake({
  beat,
  response,
  onResponseChange,
  readOnly,
}: SpotTheMistakeProps) {
  const config = beat.config as SpotTheMistakeConfig;
  const { passage, targets } = config;

  const [selectedId, setSelectedId] = useState<string | null>(
    response?.clickedTargetId ?? null
  );

  const handleSelect = useCallback(
    (id: string) => {
      if (readOnly) return;
      setSelectedId(id);
      onResponseChange({ clickedTargetId: id });
    },
    [readOnly, onResponseChange]
  );

  const segments = buildSegments(passage ?? "", targets ?? []);

  return (
    <div className="spot-the-mistake">
      {/* Passage with clickable inline targets */}
      <p
        className="spot-the-mistake__passage"
        aria-label="Passage — click the highlighted phrase that contains a mistake"
      >
        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return <span key={i}>{seg.text}</span>;
          }
          const isSelected = selectedId === seg.target.id;
          return (
            <button
              key={seg.target.id}
              type="button"
              className={[
                "target-span",
                isSelected ? "target-span--selected" : "",
                readOnly ? "target-span--readonly" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={seg.target.label}
              aria-pressed={isSelected}
              disabled={readOnly}
              onClick={() => handleSelect(seg.target.id)}
            >
              {passage.slice(seg.target.start, seg.target.end)}
            </button>
          );
        })}
      </p>

      {/* Accessible alternate list for screen-reader users */}
      <ul
        className="spot-the-mistake__alt-list"
        aria-label="Clickable phrases in this passage"
      >
        {(targets ?? []).map((target) => {
          const isSelected = selectedId === target.id;
          return (
            <li key={target.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-disabled={readOnly}
                disabled={readOnly}
                className={[
                  "spot-the-mistake__alt-option",
                  isSelected ? "spot-the-mistake__alt-option--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleSelect(target.id)}
              >
                {target.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
