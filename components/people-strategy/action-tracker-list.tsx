"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ActionCard } from "@/components/people-strategy/action-card";
import { deleteActionItems } from "@/lib/people-strategy/action-items-actions";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

export function ActionTrackerList({
  items,
  nowISO,
  deletableIds,
}: {
  items: ActionItemWithRelations[];
  nowISO: string;
  deletableIds: string[];
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowISO), [nowISO]);
  const deletableSet = useMemo(() => new Set(deletableIds), [deletableIds]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectableIds = useMemo(
    () => items.filter((item) => deletableSet.has(item.id)).map((item) => item.id),
    [items, deletableSet]
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0;

  useEffect(() => {
    const visible = new Set(items.map((item) => item.id));
    setSelectedIds((current) =>
      current.filter((id) => deletableSet.has(id) && visible.has(id))
    );
  }, [items, deletableSet]);

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? (current.includes(id) ? current : [...current, id]) : current.filter((x) => x !== id)
    );
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? [...selectableIds] : []);
  }

  function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    const count = selectedIds.length;
    if (
      !window.confirm(
        count === 1
          ? "Remove this action? It will disappear from open lists but stay in history as dropped."
          : `Remove ${count} actions? They will disappear from open lists but stay in history as dropped.`
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await deleteActionItems(selectedIds);
        setSelectedIds([]);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove those actions.");
      }
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      {selectableIds.length > 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--ps-ink-soft, var(--muted))",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) {
                  input.indeterminate = someSelected && !allSelected;
                }
              }}
              onChange={(event) => toggleAll(event.target.checked)}
              disabled={pending}
              aria-label="Select all removable actions"
            />
            Select all
          </label>

          {someSelected ? (
            <div className="data-table-bulk-actions">
              <span>
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                className="button outline small"
                onClick={() => setSelectedIds([])}
                disabled={pending}
              >
                Clear
              </button>
              <button
                type="button"
                className="button small"
                onClick={handleBulkDelete}
                disabled={pending}
                style={{ color: "var(--error-color)", borderColor: "var(--error-color)" }}
              >
                {pending ? "Removing…" : `Remove selected (${selectedIds.length})`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--error-color)" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.map((item) => {
          const selectable = deletableSet.has(item.id);
          return (
            <ActionCard
              key={item.id}
              item={item}
              now={now}
              selectable={selectable}
              selected={selectedIds.includes(item.id)}
              onSelectChange={(checked) => toggleOne(item.id, checked)}
              selectionDisabled={pending}
            />
          );
        })}
      </div>
    </>
  );
}
