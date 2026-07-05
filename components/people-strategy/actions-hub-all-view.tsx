"use client";

import { useEffect, useState } from "react";

import { EntityPreviewRail } from "@/components/operations/entity-preview-rail";
import { useEntity360 } from "@/components/operations/entity-360-context";
import { ActionHubCard } from "@/components/people-strategy/action-hub-card";
import { EmptyStateV2, cn } from "@/components/ui-v2";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  departmentHeaderColor,
  type ActionDepartmentGroup,
} from "@/lib/people-strategy/actions-hub-grouping";

/**
 * All Actions — list + docked action preview (Entity 360 rail).
 * My Actions keeps the compact card list; only this officer-wide view gets
 * the preview-first layout.
 */
export function ActionsHubAllView({
  groups,
  now,
  viewer,
  hasActiveFilters,
}: {
  groups: ActionDepartmentGroup[];
  now: Date;
  viewer: ActionViewer;
  hasActiveFilters: boolean;
}) {
  const entity360 = useEntity360();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wide, setWide] = useState(true);

  const flatItems = groups.flatMap((group) => group.items);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (selectedId && !flatItems.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [flatItems, selectedId]);

  function selectAction(id: string) {
    if (wide) {
      setSelectedId(id);
      return;
    }
    entity360?.openEntity("action", id);
  }

  if (groups.length === 0) {
    return (
      <EmptyStateV2
        icon="✓"
        title={hasActiveFilters ? "No matches" : "All clear"}
        body={
          hasActiveFilters
            ? "Try clearing a filter or searching with different words."
            : "Nothing is open in this view right now."
        }
      />
    );
  }

  return (
    <div
      className={cn(
        "grid items-start gap-5",
        selectedId && wide ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1",
      )}
    >
      <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
        {groups.map((group, groupIndex) => (
          <div key={group.id}>
            <header className="flex items-center justify-between gap-3 border-b border-line-soft bg-[#fafafc] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: departmentHeaderColor(group.slug) }}
                />
                <h2
                  className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.1em]"
                  style={{ color: departmentHeaderColor(group.slug) }}
                >
                  {group.name}
                </h2>
              </div>
              <span className="text-[12px] text-ink-muted">
                {group.items.length} item{group.items.length === 1 ? "" : "s"}
                {group.overdueCount > 0 ? (
                  <span className="font-semibold text-[#e5484d]">
                    {" "}
                    · {group.overdueCount} overdue
                  </span>
                ) : null}
              </span>
            </header>

            {group.items.map((item, itemIndex) => {
              const isLast =
                groupIndex === groups.length - 1 && itemIndex === group.items.length - 1;
              return (
                <ActionHubCard
                  key={item.id}
                  item={item}
                  now={now}
                  viewer={viewer}
                  isLast={isLast}
                  selected={item.id === selectedId}
                  onSelect={() => selectAction(item.id)}
                />
              );
            })}
          </div>
        ))}
      </section>

      {selectedId && wide ? (
        <EntityPreviewRail
          type="action"
          id={selectedId}
          onClose={() => setSelectedId(null)}
          className="xl:sticky xl:top-4"
        />
      ) : null}
    </div>
  );
}
