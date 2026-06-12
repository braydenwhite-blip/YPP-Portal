"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EntityPreviewRail } from "@/components/operations/entity-preview-rail";
import { useEntity360 } from "@/components/operations/entity-360-context";
import { EntityActionRowCapture } from "@/components/work/entity-action-row-capture";
import {
  cn,
  DataTableShell,
  EmptyStateV2,
  EntityChip,
  StatusBadge,
  TableCell,
  TableHeadCell,
  TableV2,
  type StatusTone,
} from "@/components/ui-v2";
import type { Entity360Type } from "@/lib/operations/entity-360";
import type { WorkHubRow } from "@/lib/work/work-hub-rows";

/**
 * Work Hub — the unified work table + preview rail (plan §15).
 *
 * Preview-first: clicking a row docks its own 360 preview (action / meeting /
 * partner / applicant / person / mentorship) on the right at xl widths, or
 * opens the universal 360 drawer below that. The full record stays one
 * explicit click away ("Open"), and the related entity is an EntityChip into
 * ITS preview — relationships are visible on every row.
 */

const TONE_TO_BADGE: Record<WorkHubRow["tone"], StatusTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  success: "success",
  neutral: "neutral",
};

function fmtDue(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WorkHubTable({ rows }: { rows: WorkHubRow[] }) {
  const router = useRouter();
  const entity360 = useEntity360();
  const [selected, setSelected] = useState<{
    type: Entity360Type;
    id: string;
    rowId: string;
  } | null>(null);
  const [wide, setWide] = useState(true);
  // Bumped after an inline capture saves so the docked preview refetches.
  const [previewVersion, setPreviewVersion] = useState(0);

  // Below xl the rail has no room — fall back to the universal 360 drawer.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Keep the selection valid when filters change the row set.
  useEffect(() => {
    if (selected && !rows.some((row) => row.id === selected.rowId)) {
      setSelected(null);
    }
  }, [rows, selected]);

  const selectedRow = selected
    ? (rows.find((row) => row.id === selected.rowId) ?? null)
    : null;

  const openRow = (row: WorkHubRow) => {
    if (!row.previewType || !row.previewId) return;
    if (wide) {
      setSelected({ type: row.previewType, id: row.previewId, rowId: row.id });
    } else {
      entity360?.openEntity(row.previewType, row.previewId);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyStateV2
        icon="✅"
        title="No work matches this view"
        body="Nothing here needs a move right now — switch tabs, clear the filter, or broaden the search."
      />
    );
  }

  return (
    <div
      className={cn(
        "grid items-start gap-5",
        selected && wide ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"
      )}
    >
      <DataTableShell>
        <TableV2>
          <thead>
            <tr>
              <TableHeadCell>Work</TableHeadCell>
              <TableHeadCell>Owner / due</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Next step</TableHeadCell>
              <TableHeadCell className="text-right">Action</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.id === selected?.rowId;
              return (
                <tr
                  key={row.id}
                  onClick={() => openRow(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openRow(row);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={cn(
                    "cursor-pointer transition-colors duration-100",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400",
                    isSelected ? "bg-brand-50" : "hover:bg-surface-soft"
                  )}
                >
                  <TableCell>
                    <div className="flex max-w-[420px] flex-col gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <StatusBadge tone="neutral">{row.kindLabel}</StatusBadge>
                        <p className="m-0 min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                          {row.title}
                        </p>
                      </div>
                      <div
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.entityType && row.entityId && row.entityLabel ? (
                          <EntityChip
                            type={row.entityType}
                            id={row.entityId}
                            label={row.entityLabel}
                          />
                        ) : null}
                        {row.sourceLabel ? <span>{row.sourceLabel}</span> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {row.ownerName ? (
                        <span className="text-[13px] font-semibold text-ink">
                          {row.ownerName}
                        </span>
                      ) : (
                        <StatusBadge tone="warning">Needs owner</StatusBadge>
                      )}
                      <span className="text-[12px] text-ink-muted">
                        {row.dueISO ? `Due ${fmtDue(row.dueISO)}` : "No due date"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={TONE_TO_BADGE[row.tone]}>{row.status}</StatusBadge>
                    {row.priorityLabel === "Urgent" || row.priorityLabel === "High" ? (
                      <span className="ml-1.5 text-[11.5px] font-semibold text-ink-muted">
                        {row.priorityLabel}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p className="m-0 max-w-[240px] text-[12.5px] leading-5 text-ink-muted">
                      {row.nextStep ?? "Open the preview to decide the next move."}
                    </p>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Link
                      href={row.quickActionHref ?? row.href}
                      className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {row.quickActionLabel ?? "Open"} →
                    </Link>
                  </TableCell>
                </tr>
              );
            })}
          </tbody>
        </TableV2>
      </DataTableShell>

      {selected && wide ? (
        <EntityPreviewRail
          key={`${selected.type}:${selected.id}:${previewVersion}`}
          type={selected.type}
          id={selected.id}
          onClose={() => setSelected(null)}
          quickActions={
            selectedRow?.capture ? (
              <EntityActionRowCapture
                actionId={selectedRow.capture.actionId}
                blockedReason={selectedRow.capture.blockedReason}
                completionNote={selectedRow.capture.completionNote}
                completionOutcome={selectedRow.capture.completionOutcome}
                nextFollowUpAt={selectedRow.capture.nextFollowUpISO}
                onCaptured={() => {
                  // Re-pull the server rows AND remount the rail's fetch.
                  router.refresh();
                  setPreviewVersion((v) => v + 1);
                }}
              />
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
