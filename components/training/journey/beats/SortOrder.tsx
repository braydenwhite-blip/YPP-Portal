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
 * Keyboard: arrow keys move focused item up/down; Space/Enter lift/drop.
 * Drag: MouseSensor + TouchSensor + KeyboardSensor via dnd-kit.
 * readOnly: drag disabled; items render as static cards.
 *
 * Config shape (client-safe — correctOrder/feedback stripped):
 *   items: { id: string; label: string }[]
 *   partialCredit?: boolean
 *
 * Response shape: { orderedIds: string[] }
 */

import { useEffect, useCallback, useState } from "react";
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
// SortableItem sub-component
// ---------------------------------------------------------------------------

type SortableItemProps = {
  id: string;
  label: string;
  index: number;
  total: number;
  readOnly: boolean;
};

function SortableItem({ id, label, index, total, readOnly }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: readOnly });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
      aria-label={`Item ${index + 1} of ${total}: ${label}${readOnly ? "" : " (use arrow keys to reorder)"}`}
      className={className}
    >
      <span className="sort-order__handle" aria-hidden="true">
        ≡
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
    useSensor(TouchSensor),
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
        <p className="sort-order__hint" aria-live="polite">
          Use arrow keys to reorder
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
              return `Picked up item: ${label}. Use arrow keys to move, Space or Enter to drop.`;
            },
            onDragOver({ active, over }) {
              if (!over) return;
              const activeLabel = labelById.get(String(active.id)) ?? String(active.id);
              const overLabel = labelById.get(String(over.id)) ?? String(over.id);
              return `${activeLabel} is now over ${overLabel}.`;
            },
            onDragEnd({ active, over }) {
              if (!over) {
                const label = labelById.get(String(active.id)) ?? String(active.id);
                return `Dropped ${label}. No change.`;
              }
              const activeLabel = labelById.get(String(active.id)) ?? String(active.id);
              const overLabel = labelById.get(String(over.id)) ?? String(over.id);
              return `${activeLabel} was placed after ${overLabel}.`;
            },
            onDragCancel({ active }) {
              const label = labelById.get(String(active.id)) ?? String(active.id);
              return `Reordering cancelled. ${label} returned to its original position.`;
            },
          },
        }}
      >
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div role="list" className="sort-order__list">
            {orderedIds.map((id, index) => (
              <SortableItem
                key={id}
                id={id}
                label={labelById.get(id) ?? id}
                index={index}
                total={orderedIds.length}
                readOnly={readOnly}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
