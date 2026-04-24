"use client";

/**
 * MatchPairs — two-column match-the-pairs interaction.
 *
 * Left column: fixed slots (the "question" side). Each slot shows the left
 * item's label and, once matched, the paired right chip rendered inside it.
 *
 * Right column: draggable chips + a "Choose option" select fallback per slot
 * so pointer, touch, keyboard, and screen-reader users all have a path.
 *
 * dnd-kit pattern:
 *   - Right chips: useDraggable
 *   - Left slots: useDroppable
 *   - On drop: update pair for that leftId; remove rightId from any previous pair.
 *
 * Select fallback: each left slot has a <select> listing unassigned right items
 * plus the currently assigned one. Selecting an option updates pairs the same
 * way the drag handler does.
 *
 * ARIA:
 *   - Left column: role="list", each slot role="listitem"
 *   - Each slot aria-label includes current match state.
 *   - Right chips pool: role="list", chips role="listitem"
 *   - Select fallback: aria-label per slot.
 *
 * Config shape (client-safe — correctPairs/feedback stripped):
 *   leftItems: { id: string; label: string }[]
 *   rightItems: { id: string; label: string }[]
 *   partialCredit?: boolean
 *   hint?: string
 *
 * Response shape: { pairs: { leftId: string; rightId: string }[] }
 * Non-null when: at least one pair is formed.
 * readOnly: drag and select disabled; layout shows matched state only.
 */

import { useState, useCallback, useId } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape (client-safe)
// ---------------------------------------------------------------------------

type PairItem = {
  id: string;
  label: string;
};

type MatchPairsConfig = {
  leftItems: PairItem[];
  rightItems: PairItem[];
  partialCredit?: boolean;
  hint?: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Pair = { leftId: string; rightId: string };
type MatchPairsResponse = { pairs: Pair[] };

type Props = {
  beat: ClientBeat & { config: unknown };
  response: MatchPairsResponse | null;
  onResponseChange: (next: MatchPairsResponse | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Draggable right chip
// ---------------------------------------------------------------------------

type RightChipProps = {
  id: string;
  label: string;
  isPlaced: boolean;
  readOnly: boolean;
};

function RightChip({ id, label, isPlaced, readOnly }: RightChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: readOnly || isPlaced,
  });

  // Placed chips are rendered inside the slot, not here.
  if (isPlaced) return null;

  const className = [
    "match-pairs__chip",
    isDragging ? "match-pairs__chip--dragging" : "",
    readOnly ? "match-pairs__chip--readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-label={label}
      className={className}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable left slot
// ---------------------------------------------------------------------------

type LeftSlotProps = {
  leftItem: PairItem;
  pairedRight: PairItem | null;
  allRightItems: PairItem[];
  pairedRightIds: Set<string>;
  onSelectChange: (leftId: string, rightId: string | null) => void;
  readOnly: boolean;
  groupId: string;
};

function LeftSlot({
  leftItem,
  pairedRight,
  allRightItems,
  pairedRightIds,
  onSelectChange,
  readOnly,
  groupId,
}: LeftSlotProps) {
  const { isOver, setNodeRef } = useDroppable({ id: leftItem.id });

  const slotAriaLabel = `Match for: ${leftItem.label}. Currently matched with: ${
    pairedRight ? pairedRight.label : "not yet matched"
  }`;

  const slotClassName = [
    "match-pairs__slot",
    isOver ? "match-pairs__slot--over" : "",
    pairedRight ? "match-pairs__slot--filled" : "",
    readOnly ? "match-pairs__slot--readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Options available in the select: unassigned items + currently assigned one.
  const selectOptions = allRightItems.filter(
    (r) => !pairedRightIds.has(r.id) || r.id === pairedRight?.id
  );

  const selectId = `${groupId}-select-${leftItem.id}`;

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      aria-label={slotAriaLabel}
      className={slotClassName}
    >
      <span className="match-pairs__slot-label">{leftItem.label}</span>

      <div className="match-pairs__slot-drop-area">
        {pairedRight ? (
          // Paired chip rendered inside the slot.
          <div
            className="match-pairs__chip match-pairs__chip--placed"
            aria-label={pairedRight.label}
          >
            {pairedRight.label}
            {!readOnly && (
              <button
                type="button"
                className="match-pairs__chip-remove"
                aria-label={`Remove ${pairedRight.label} from ${leftItem.label}`}
                onClick={() => onSelectChange(leftItem.id, null)}
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <span className="match-pairs__slot-placeholder" aria-hidden="true">
            Drop here
          </span>
        )}
      </div>

      {/* Select fallback for keyboard / mobile users */}
      {!readOnly && (
        <div className="match-pairs__select-wrapper">
          <label htmlFor={selectId} className="sr-only">
            Choose match for {leftItem.label}
          </label>
          <select
            id={selectId}
            className="match-pairs__select"
            value={pairedRight?.id ?? ""}
            aria-label={`Choose option for ${leftItem.label}`}
            onChange={(e) => {
              const val = e.target.value;
              onSelectChange(leftItem.id, val === "" ? null : val);
            }}
          >
            <option value="">— choose —</option>
            {selectOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchPairs({ beat, response, onResponseChange, readOnly }: Props) {
  const config = beat.config as MatchPairsConfig;
  const leftItems = config.leftItems ?? [];
  const rightItems = config.rightItems ?? [];

  const [pairs, setPairs] = useState<Pair[]>(response?.pairs ?? []);

  const groupId = useId();

  // Build lookup maps.
  const rightById = new Map(rightItems.map((r) => [r.id, r]));
  const leftById = new Map(leftItems.map((l) => [l.id, l]));

  // Map leftId → rightId for O(1) slot lookup.
  const pairsByLeft = new Map(pairs.map((p) => [p.leftId, p.rightId]));
  // Set of rightIds currently placed.
  const placedRightIds = new Set(pairs.map((p) => p.rightId));

  const applyPairUpdate = useCallback(
    (leftId: string, rightId: string | null) => {
      setPairs((prev) => {
        // Remove any existing pair for this leftId.
        let next = prev.filter((p) => p.leftId !== leftId);
        if (rightId !== null) {
          // Also remove any pair where this rightId is already placed elsewhere.
          next = next.filter((p) => p.rightId !== rightId);
          next = [...next, { leftId, rightId }];
        }
        const result = next.length > 0 ? next : [];
        onResponseChange(result.length > 0 ? { pairs: result } : null);
        return result;
      });
    },
    [onResponseChange]
  );

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const rightId = String(active.id);
      const leftId = String(over.id);
      // Verify over target is actually a left slot id.
      if (!leftById.has(leftId)) return;
      applyPairUpdate(leftId, rightId);
    },
    [leftById, applyPairUpdate]
  );

  // Build label lookup for announcements.
  const labelById = new Map([
    ...leftItems.map((l) => [l.id, l.label] as [string, string]),
    ...rightItems.map((r) => [r.id, r.label] as [string, string]),
  ]);

  return (
    <div
      className={["match-pairs", readOnly ? "match-pairs--readonly" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {config.hint && (
        <p className="match-pairs__hint">{config.hint}</p>
      )}

      <DndContext
        sensors={sensors}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              const label = labelById.get(String(active.id)) ?? String(active.id);
              return `Picked up ${label}. Drag over a slot and release to match it.`;
            },
            onDragOver({ active, over }) {
              if (!over) return;
              const chipLabel = labelById.get(String(active.id)) ?? String(active.id);
              const slotLabel = labelById.get(String(over.id)) ?? String(over.id);
              return `${chipLabel} is over slot: ${slotLabel}.`;
            },
            onDragEnd({ active, over }) {
              if (!over) {
                const label = labelById.get(String(active.id)) ?? String(active.id);
                return `Dropped ${label}. No match made.`;
              }
              const chipLabel = labelById.get(String(active.id)) ?? String(active.id);
              const slotLabel = labelById.get(String(over.id)) ?? String(over.id);
              return `Matched ${chipLabel} with ${slotLabel}.`;
            },
            onDragCancel({ active }) {
              const label = labelById.get(String(active.id)) ?? String(active.id);
              return `Matching cancelled. ${label} returned to the pool.`;
            },
          },
        }}
      >
        <div
          className="match-pairs__grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
        >
          {/* Left column: droppable slots */}
          <div
            role="list"
            aria-label="Match targets — drop a chip onto each slot"
            className="match-pairs__left-column"
          >
            {leftItems.map((leftItem) => {
              const pairedRightId = pairsByLeft.get(leftItem.id) ?? null;
              const pairedRight = pairedRightId ? (rightById.get(pairedRightId) ?? null) : null;
              return (
                <LeftSlot
                  key={leftItem.id}
                  leftItem={leftItem}
                  pairedRight={pairedRight}
                  allRightItems={rightItems}
                  pairedRightIds={placedRightIds}
                  onSelectChange={applyPairUpdate}
                  readOnly={readOnly}
                  groupId={groupId}
                />
              );
            })}
          </div>

          {/* Right column: draggable chips (unplaced only) */}
          <div
            role="list"
            aria-label="Available options — drag a chip to a slot on the left"
            className="match-pairs__right-column"
          >
            {rightItems.map((rightItem) => (
              <RightChip
                key={rightItem.id}
                id={rightItem.id}
                label={rightItem.label}
                isPlaced={placedRightIds.has(rightItem.id)}
                readOnly={readOnly}
              />
            ))}
            {/* Placeholder when all chips are placed */}
            {rightItems.every((r) => placedRightIds.has(r.id)) && (
              <p className="match-pairs__all-placed" aria-live="polite">
                All options matched.
              </p>
            )}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
