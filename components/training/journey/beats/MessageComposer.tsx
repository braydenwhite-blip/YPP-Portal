"use client";

/**
 * MessageComposer — rubric-scored snippet-pool builder.
 *
 * Authors define 2–5 pools (e.g. "Opening", "Middle", "Closing"). Each pool
 * has snippets the user picks from. Tags are stripped server-side; the client
 * sees labels only. The server scorer checks that the union of picked snippet
 * tags satisfies the rubric (requiredTags present, bannedTags absent).
 *
 * Pool defaults: minSelections = 1, maxSelections = 1.
 * Single-select pools (max === 1): radio pattern — arrow keys + Space/Enter.
 * Multi-select pools (max > 1): checkbox pattern — Space to toggle, Tab to move.
 *
 * isResponseValid: every pool has >= (minSelections ?? 1) snippets selected.
 * Only then is a non-null response emitted; otherwise null disables Check.
 *
 * Live preview: concatenates selected snippet labels in pool order, space-joined.
 *
 * UX improvements:
 * - Each pool has a prominent section heading (h3) and a "required" indicator.
 * - Selected snippets show a visible selected state: border, checkmark, bg.
 * - The preview panel updates live and is always visible with a placeholder.
 * - On mobile, pools stack vertically; snippets wrap within each pool.
 * - Keyboard: Tab between pools, arrow keys within a radio pool, Enter/Space select.
 */

import { useState, useRef, useCallback, useId } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape (client-safe — tags stripped by serialize.ts)
// ---------------------------------------------------------------------------

type SnippetPool = {
  poolId: string;
  label: string;
  minSelections?: number;
  maxSelections?: number;
  snippets: { id: string; label: string }[];
};

type MessageComposerConfig = {
  snippetPools: SnippetPool[];
};

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

type MessageComposerResponse = {
  selections: { poolId: string; snippetIds: string[] }[];
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  beat: ClientBeat & { config: unknown };
  response: MessageComposerResponse | null;
  onResponseChange: (next: MessageComposerResponse | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Hint text helper
// ---------------------------------------------------------------------------

function hintText(min: number, max: number): string {
  if (min === max && min === 1) return "Pick 1 (required)";
  if (min === max) return `Pick ${min} (required)`;
  if (min <= 1) return `Pick up to ${max}`;
  return `Pick ${min}–${max} (required)`;
}

// ---------------------------------------------------------------------------
// CheckIcon — used inside selected snippets
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg
      className="message-composer__check-icon"
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2,7 5.5,10.5 12,3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SingleSelectPool — radio pattern
// ---------------------------------------------------------------------------

type SingleSelectPoolProps = {
  pool: SnippetPool;
  selectedIds: string[];
  onSelect: (poolId: string, snippetId: string) => void;
  readOnly: boolean;
  groupId: string;
  isRequired: boolean;
  isSatisfied: boolean;
};

function SingleSelectPool({
  pool,
  selectedIds,
  onSelect,
  readOnly,
  groupId,
  isRequired,
  isSatisfied,
}: SingleSelectPoolProps) {
  const snippetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const selectedId = selectedIds[0] ?? null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (readOnly) return;
      const snippets = pool.snippets;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = (index + 1) % snippets.length;
        snippetRefs.current[next]?.focus();
        onSelect(pool.poolId, snippets[next].id);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (index - 1 + snippets.length) % snippets.length;
        snippetRefs.current[prev]?.focus();
        onSelect(pool.poolId, snippets[prev].id);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onSelect(pool.poolId, snippets[index].id);
      }
    },
    [readOnly, pool, onSelect]
  );

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${groupId}-heading`}
      aria-required={isRequired}
      className="message-composer__snippets"
    >
      {pool.snippets.map((snippet, index) => {
        const isSelected = selectedId === snippet.id;
        const isFocusable = !readOnly && (isSelected || (selectedId === null && index === 0));

        return (
          <div
            key={snippet.id}
            ref={(el) => { snippetRefs.current[index] = el; }}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={readOnly}
            tabIndex={isFocusable ? 0 : -1}
            className={[
              "message-composer__snippet",
              isSelected ? "message-composer__snippet--selected" : "",
              readOnly ? "message-composer__snippet--readonly" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => { if (!readOnly) onSelect(pool.poolId, snippet.id); }}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {isSelected && <CheckIcon />}
            <span className="message-composer__snippet-label">{snippet.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MultiSelectPool — checkbox pattern
// ---------------------------------------------------------------------------

type MultiSelectPoolProps = {
  pool: SnippetPool;
  max: number;
  selectedIds: string[];
  onToggle: (poolId: string, snippetId: string) => void;
  readOnly: boolean;
  groupId: string;
  isRequired: boolean;
  isSatisfied: boolean;
  overLimitMsg: string | null;
  overLimitRegionId: string;
};

function MultiSelectPool({
  pool,
  max,
  selectedIds,
  onToggle,
  readOnly,
  groupId,
  overLimitMsg,
  overLimitRegionId,
}: MultiSelectPoolProps) {
  const selectedSet = new Set(selectedIds);

  return (
    <div
      role="group"
      aria-labelledby={`${groupId}-heading`}
      className="message-composer__snippets"
    >
      {pool.snippets.map((snippet) => {
        const isChecked = selectedSet.has(snippet.id);
        const isAtMax = selectedIds.length >= max && !isChecked;

        return (
          <button
            key={snippet.id}
            type="button"
            role="checkbox"
            aria-checked={isChecked}
            aria-disabled={readOnly || isAtMax}
            disabled={readOnly}
            className={[
              "message-composer__snippet",
              isChecked ? "message-composer__snippet--selected" : "",
              readOnly ? "message-composer__snippet--readonly" : "",
              isAtMax ? "message-composer__snippet--at-max" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onToggle(pool.poolId, snippet.id)}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
                onToggle(pool.poolId, snippet.id);
              }
            }}
          >
            {isChecked && <CheckIcon />}
            <span className="message-composer__snippet-label">{snippet.label}</span>
          </button>
        );
      })}
      {overLimitMsg && (
        <div
          id={overLimitRegionId}
          aria-live="assertive"
          role="alert"
          className="message-composer__over-limit"
        >
          {overLimitMsg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessageComposer({ beat, response, onResponseChange, readOnly }: Props) {
  const config = beat.config as MessageComposerConfig;
  const pools = config.snippetPools ?? [];

  // Selections: poolId -> string[]
  const [selections, setSelections] = useState<Map<string, string[]>>(() => {
    const init = new Map<string, string[]>();
    for (const pool of pools) {
      const existing = response?.selections.find((s) => s.poolId === pool.poolId);
      init.set(pool.poolId, existing?.snippetIds ?? []);
    }
    return init;
  });

  // Per-pool over-limit flash messages
  const [overLimitMsgs, setOverLimitMsgs] = useState<Map<string, string | null>>(
    () => new Map(pools.map((p) => [p.poolId, null]))
  );

  const overLimitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const baseId = useId();

  // ---------------------------------------------------------------------------
  // Compute validity and emit response
  // ---------------------------------------------------------------------------

  const computeAndEmit = useCallback(
    (nextSelections: Map<string, string[]>) => {
      const isResponseValid = pools.every((pool) => {
        const picked = nextSelections.get(pool.poolId) ?? [];
        return picked.length >= (pool.minSelections ?? 1);
      });

      if (isResponseValid) {
        onResponseChange({
          selections: pools.map((pool) => ({
            poolId: pool.poolId,
            snippetIds: nextSelections.get(pool.poolId) ?? [],
          })),
        });
      } else {
        onResponseChange(null);
      }
    },
    [pools, onResponseChange]
  );

  // ---------------------------------------------------------------------------
  // Single-select handler
  // ---------------------------------------------------------------------------

  const handleSingleSelect = useCallback(
    (poolId: string, snippetId: string) => {
      if (readOnly) return;
      setSelections((prev) => {
        const next = new Map(prev);
        next.set(poolId, [snippetId]);
        computeAndEmit(next);
        return next;
      });
    },
    [readOnly, computeAndEmit]
  );

  // ---------------------------------------------------------------------------
  // Multi-select toggle handler
  // ---------------------------------------------------------------------------

  const handleMultiToggle = useCallback(
    (poolId: string, snippetId: string) => {
      if (readOnly) return;
      const pool = pools.find((p) => p.poolId === poolId);
      if (!pool) return;
      const max = pool.maxSelections ?? 1;

      setSelections((prev) => {
        const current = prev.get(poolId) ?? [];
        const currentSet = new Set(current);

        if (currentSet.has(snippetId)) {
          // Deselect
          currentSet.delete(snippetId);
          const next = new Map(prev);
          next.set(poolId, Array.from(currentSet));
          computeAndEmit(next);
          return next;
        } else {
          // Would exceed max — flash message, do nothing
          if (current.length >= max) {
            const msg = `Maximum ${max} selection${max === 1 ? "" : "s"} for this section`;
            setOverLimitMsgs((prevMsgs) => {
              const nextMsgs = new Map(prevMsgs);
              nextMsgs.set(poolId, msg);
              return nextMsgs;
            });
            // Clear after 2s
            const existing = overLimitTimers.current.get(poolId);
            if (existing) clearTimeout(existing);
            const timer = setTimeout(() => {
              setOverLimitMsgs((prevMsgs) => {
                const nextMsgs = new Map(prevMsgs);
                nextMsgs.set(poolId, null);
                return nextMsgs;
              });
            }, 2000);
            overLimitTimers.current.set(poolId, timer);
            return prev; // no change
          }
          // Add
          currentSet.add(snippetId);
          const next = new Map(prev);
          next.set(poolId, Array.from(currentSet));
          computeAndEmit(next);
          return next;
        }
      });
    },
    [readOnly, pools, computeAndEmit]
  );

  // ---------------------------------------------------------------------------
  // Live preview text
  // ---------------------------------------------------------------------------

  const previewText = pools
    .map((pool) => {
      const ids = selections.get(pool.poolId) ?? [];
      return ids
        .map((id) => pool.snippets.find((s) => s.id === id)?.label ?? "")
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean)
    .join(" ");

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={[
        "message-composer",
        readOnly ? "message-composer--readonly" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-disabled={readOnly}
    >
      {pools.map((pool, poolIndex) => {
        const min = pool.minSelections ?? 1;
        const max = pool.maxSelections ?? 1;
        const isMulti = max > 1;
        const isRequired = min >= 1;
        const selectedIds = selections.get(pool.poolId) ?? [];
        const isSatisfied = selectedIds.length >= min;
        const overLimitMsg = overLimitMsgs.get(pool.poolId) ?? null;
        const overLimitRegionId = `${baseId}-pool-${poolIndex}-overlimit`;
        const poolGroupId = `${baseId}-pool-${poolIndex}`;

        return (
          <section
            key={pool.poolId}
            className={[
              "message-composer__pool",
              isSatisfied ? "message-composer__pool--satisfied" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-labelledby={`${poolGroupId}-heading`}
          >
            {/* Pool heading with required badge */}
            <h3
              id={`${poolGroupId}-heading`}
              className="message-composer__pool-heading"
            >
              {pool.label}
              {isRequired && !isSatisfied && !readOnly && (
                <span
                  className="message-composer__required-badge"
                  aria-label="required"
                >
                  Required
                </span>
              )}
              {isSatisfied && (
                <span
                  className="message-composer__satisfied-badge"
                  aria-label="selection made"
                >
                  <CheckIcon />
                </span>
              )}
            </h3>

            <p className="message-composer__hint" aria-hidden="true">
              {hintText(min, max)}
            </p>

            {isMulti ? (
              <MultiSelectPool
                pool={pool}
                max={max}
                selectedIds={selectedIds}
                onToggle={handleMultiToggle}
                readOnly={readOnly}
                groupId={poolGroupId}
                isRequired={isRequired}
                isSatisfied={isSatisfied}
                overLimitMsg={overLimitMsg}
                overLimitRegionId={overLimitRegionId}
              />
            ) : (
              <SingleSelectPool
                pool={pool}
                selectedIds={selectedIds}
                onSelect={handleSingleSelect}
                readOnly={readOnly}
                groupId={poolGroupId}
                isRequired={isRequired}
                isSatisfied={isSatisfied}
              />
            )}
          </section>
        );
      })}

      {/* Live preview — always rendered to prevent layout shift */}
      <div
        className={[
          "message-composer__preview",
          previewText ? "message-composer__preview--has-content" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-live="polite"
        aria-label="Your message preview"
        aria-atomic="false"
      >
        <p className="message-composer__preview-heading">
          Message preview
        </p>
        <p className="message-composer__preview-text">
          {previewText || (
            <span className="message-composer__preview-placeholder" aria-hidden="true">
              Your composed message will appear here as you make selections above.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
