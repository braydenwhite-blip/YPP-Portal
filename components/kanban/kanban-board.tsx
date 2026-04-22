"use client";

import { useState, useCallback, useTransition, useMemo, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import "./kanban-board.css";

/* ── Types ─────────────────────────────────────────── */

export type KanbanColumnDef = {
  id: string;
  title: string;
  statuses: string[];
  color: string;
};

export interface KanbanBoardProps<TItem extends { id: string; status: string }> {
  items: TItem[];
  columns: KanbanColumnDef[];
  dragEnabled?: boolean;
  renderCard: (item: TItem, handlers: { onClick: () => void; isDragging?: boolean }) => ReactNode;
  renderDragOverlay: (item: TItem) => ReactNode;
  renderDetailPanel?: (
    item: TItem,
    handlers: {
      onClose: () => void;
      onUpdate: (updated: Partial<TItem> & { id: string }) => void;
    }
  ) => ReactNode;
  onStatusChange?: (
    itemId: string,
    newStatus: string,
    previousStatus: string
  ) => Promise<{ success: boolean; error?: string }>;
  getSearchText: (item: TItem) => string;
  searchPlaceholder?: string;
  emptyColumnLabel?: string;
  toolbarExtra?: ReactNode;
}

/* ── Helpers ──────────────────────────────────────── */

function getColumnForStatus(status: string, columns: KanbanColumnDef[]): string {
  for (const col of columns) {
    if (col.statuses.includes(status)) return col.id;
  }
  return columns[0]?.id ?? "";
}

function getTargetStatusForColumn(columnId: string, columns: KanbanColumnDef[]): string {
  const col = columns.find((c) => c.id === columnId);
  if (!col) return "";
  return col.statuses[0];
}

/* ── Draggable Card Wrapper ──────────────────────── */

function DraggableCard<TItem extends { id: string }>({
  item,
  dragEnabled,
  children,
}: {
  item: TItem;
  dragEnabled: boolean;
  children: (props: { isDragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled: !dragEnabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  if (!dragEnabled) {
    return <>{children({ isDragging: false })}</>;
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children({ isDragging })}
    </div>
  );
}

/* ── Column ──────────────────────────────────────── */

function KanbanColumn<TItem extends { id: string; status: string }>({
  column,
  items,
  dragEnabled,
  emptyLabel,
  renderCard,
}: {
  column: KanbanColumnDef;
  items: TItem[];
  dragEnabled: boolean;
  emptyLabel: string;
  renderCard: (item: TItem, isDragging: boolean) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className={`kanban-column${isOver ? " drag-over" : ""}`} ref={setNodeRef}>
      <div className="kanban-column-header">
        <span className="kanban-column-title" style={{ color: column.color }}>
          {column.title}
        </span>
        <span className="kanban-column-count">{items.length}</span>
      </div>
      <div className="kanban-column-body" data-empty-label={emptyLabel}>
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} dragEnabled={dragEnabled}>
            {({ isDragging }) => renderCard(item, isDragging)}
          </DraggableCard>
        ))}
      </div>
    </div>
  );
}

/* ── Main Board ──────────────────────────────────── */

export default function KanbanBoard<TItem extends { id: string; status: string }>({
  items: initialItems,
  columns,
  dragEnabled = true,
  renderCard,
  renderDragOverlay,
  renderDetailPanel,
  onStatusChange,
  getSearchText,
  searchPlaceholder = "Search…",
  emptyColumnLabel = "No items",
  toolbarExtra,
}: KanbanBoardProps<TItem>) {
  const [items, setItems] = useState(initialItems);
  const [selectedItem, setSelectedItem] = useState<TItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  // Sync when parent passes new items
  useMemo(() => {
    if (initialItems !== items && initialItems.length !== items.length) {
      setItems(initialItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => getSearchText(item).toLowerCase().includes(q));
  }, [items, searchQuery, getSearchText]);

  // Group by column
  const columnItems = useMemo(() => {
    const groups: Record<string, TItem[]> = {};
    for (const col of columns) {
      groups[col.id] = [];
    }
    for (const item of filteredItems) {
      const colId = getColumnForStatus(item.status, columns);
      if (groups[colId]) {
        groups[colId].push(item);
      }
    }
    return groups;
  }, [filteredItems, columns]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback handled by useDroppable isOver
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || !onStatusChange) return;

      const itemId = active.id as string;
      const targetColumnId = over.id as string;
      const column = columns.find((c) => c.id === targetColumnId);
      if (!column) return;

      const item = items.find((a) => a.id === itemId);
      if (!item) return;

      if (column.statuses.includes(item.status)) return;

      const newStatus = getTargetStatusForColumn(targetColumnId, columns);
      const previousStatus = item.status;

      // Optimistic update
      setItems((prev) =>
        prev.map((a) => (a.id === itemId ? { ...a, status: newStatus } : a))
      );

      if (selectedItem?.id === itemId) {
        setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      startTransition(async () => {
        const result = await onStatusChange(itemId, newStatus, previousStatus);
        if (!result.success) {
          setItems((prev) =>
            prev.map((a) => (a.id === itemId ? { ...a, status: previousStatus } : a))
          );
          if (selectedItem?.id === itemId) {
            setSelectedItem((prev) => (prev ? { ...prev, status: previousStatus } : null));
          }
        }
      });
    },
    [items, columns, selectedItem, onStatusChange, startTransition]
  );

  const activeItem = activeId ? items.find((a) => a.id === activeId) : null;

  const handleItemUpdate = useCallback(
    (updated: Partial<TItem> & { id: string }) => {
      setItems((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
      );
      if (selectedItem?.id === updated.id) {
        setSelectedItem((prev) => (prev ? { ...prev, ...updated } : null));
      }
    },
    [selectedItem]
  );

  return (
    <>
      {/* Toolbar */}
      <div className="kanban-toolbar">
        <input
          className="input"
          aria-label="Search board"
          name="kanbanSearch"
          autoComplete="off"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {toolbarExtra}
      </div>

      {/* Board */}
      <div className="kanban-wrapper">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-board">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                items={columnItems[column.id] || []}
                dragEnabled={dragEnabled}
                emptyLabel={emptyColumnLabel}
                renderCard={(item, isDragging) =>
                  renderCard(item, {
                    onClick: () => setSelectedItem(item),
                    isDragging,
                  })
                }
              />
            ))}
          </div>

          <DragOverlay>
            {activeItem ? renderDragOverlay(activeItem) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail panel */}
      {selectedItem && renderDetailPanel && (
        renderDetailPanel(selectedItem, {
          onClose: () => setSelectedItem(null),
          onUpdate: handleItemUpdate,
        })
      )}
    </>
  );
}
