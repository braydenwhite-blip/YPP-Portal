"use client";

/**
 * SortOrder — vertical drag-to-reorder list.
 *
 * Items are presented in their authored order on mount (config.items order).
 * The scorer grades against correctOrder (server-only); authors author items
 * in whatever order they want the learner to start from.
 *
 * onResponseChange is called on mount (with the initial authored order) so the
 * Check button is enabled immediately — the scorer will flag unchanged orders
 * that don't match correctOrder.
 *
 * Keyboard: Space/Enter lifts an item; arrow keys move it while lifted; Space/Enter
 * drops it. This is the dnd-kit KeyboardSensor default with sortableKeyboardCoordinates.
 * Drag: MouseSensor + TouchSensor + KeyboardSensor via dnd-kit.
 * readOnly: drag disabled; items render as static cards.
 *
 * Config shape (client-safe — correctOrder/feedback stripped):
 *   items: { id: string; label: string }[]
 *   partialCredit?: boolean
 *
 * Response shape: { orderedIds: string[] }
 */

import { useEffect, useCallback, useState, useId } from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ClientBeat } from "@/lib/training-journey/types";
import { useJourneyMotion } from "@/components/training/journey/MotionProvider";

// ---------------------------------------------------------------------------
// Config shape (client-safe)
// ---------------------------------------------------------------------------

type SortOrderItem = {
  id: string;
  label: string;
};

type SortOrderConfig = {
  items: SortOrderItem[];
  partialCredit?: boolean;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SortOrderResponse = { orderedIds: string[] };

type Props = {
  beat: ClientBeat & { config: unknown };
  response: SortOrderResponse | null;
  onResponseChange: (next: SortOrderResponse | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// GripIcon — visual affordance for drag handles
// ---------------------------------------------------------------------------

function GripIcon() {
  return (
    <svg
      className="sort-order__grip-icon"
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      {/* 6 dots in 2×3 grid — classic grip */}
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SortableItem sub-component
// ---------------------------------------------------------------------------

type SortableItemProps = {
  id: string;
  label: string;
  index: number;
  total: number;
  readOnly: boolean;
  reduced: boolean;
  hintId: string;
};

function SortableItem({ id, label, index, total, readOnly, reduced, hintId }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: readOnly });

  // Respect reduced-motion: skip the CSS transition on transforms when the
  // user prefers reduced motion.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: reduced ? undefined : transition,
    opacity: isDragging ? 0.45 : 1,
    // Elevate the dragging item visually so it reads as "lifted".
    zIndex: isDragging ? 10 : undefined,
  };

  const className = [
    "sort-order__item",
    isDragging ? "sort-order__item--dragging" : "",
    readOnly ? "sort-order__item--readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-label={`Item ${index + 1} of ${total}: ${label}`}
      aria-describedby={!readOnly ? hintId : undefined}
      className={className}
    >
      {/* Drag handle — gets focus + dnd-kit keyboard listeners */}
      {!readOnly && (
        <button
          type="button"
          className="sort-order__handle"
          aria-label={`Drag handle for "${label}". Press Space or Enter to lift, then arrow keys to move.`}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      )}

      {/* Position badge */}
      <span className="sort-order__position" aria-hidden="true">
        {index + 1}
      </span>

      <span className="sort-order__label">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SortOrder({ beat, response, onResponseChange, readOnly }: Props) {
  const config = beat.config as SortOrderConfig;
  const items = config.items ?? [];
  const { reduced } = useJourneyMotion();
  const hintId = useId();

  // Guard: no items authored.
  if (items.length === 0) {
    return (
      <div className="sort-order sort-order--empty" role="status">
        No items to sort.
      </div>
    );
  }

  const initialOrder = items.map((i) => i.id);

  const [orderedIds, setOrderedIds] = useState<string[]>(
    () => response?.orderedIds ?? initialOrder
  );

  // Emit initial order on mount so Check button is enabled immediately.
  useEffect(() => {
    onResponseChange({ orderedIds });
    // Intentionally runs only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      // Require intentional press to distinguish from scroll.
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setOrderedIds((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        const next = arrayMove(prev, oldIndex, newIndex);
        onResponseChange({ orderedIds: next });
        return next;
      });
    },
    [onResponseChange]
  );

  // Build a label lookup from config items.
  const labelById = new Map(items.map((i) => [i.id, i.label]));

  return (
    <div
      className={["sort-order", readOnly ? "sort-order--readonly" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {!readOnly && (
        <p id={hintId} className="sort-order__hint">
          Drag items or use the handle — press Space/Enter to lift, then arrow
          keys to reorder.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              const label = labelById.get(String(active.id)) ?? String(active.id);
              return `Picked up "${label}". Use arrow keys to move, Space or Enter to drop.`;
            },
            onDragOver({ active, over }) {
              if (!over) return;
              const activeLabel = labelById.get(String(active.id)) ?? String(active.id);
              const overLabel = labelById.get(String(over.id)) ?? String(over.id);
              return `"${activeLabel}" is now over "${overLabel}".`;
            },
            onDragEnd({ active, over }) {
              if (!over) {
                const label = labelById.get(String(active.id)) ?? String(active.id);
                return `Dropped "${label}". No change.`;
              }
              const activeLabel = labelById.get(String(active.id)) ?? String(active.id);
              const overLabel = labelById.get(String(over.id)) ?? String(over.id);
              return `"${activeLabel}" moved to the position of "${overLabel}".`;
            },
            onDragCancel({ active }) {
              const label = labelById.get(String(active.id)) ?? String(active.id);
              return `Reordering cancelled. "${label}" returned to its original position.`;
            },
          },
        }}
      >
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div role="list" className="sort-order__list" aria-label="Items to sort">
            {orderedIds.map((id, index) => (
              <SortableItem
                key={id}
                id={id}
                label={labelById.get(id) ?? id}
                index={index}
                total={orderedIds.length}
                readOnly={readOnly}
                reduced={reduced}
                hintId={hintId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
