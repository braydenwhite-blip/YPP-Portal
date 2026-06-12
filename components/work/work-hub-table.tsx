"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EntityPreviewRail } from "@/components/operations/entity-preview-rail";
import { useEntity360 } from "@/components/operations/entity-360-context";
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
  const entity360 = useEntity360();
  const [selected, setSelected] = useState<{
    type: Entity360Type;
    id: string;
    rowId: string;
  } | null>(null);
  const [wide, setWide] = useState(true);

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
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Owner</TableHeadCell>
              <TableHeadCell>Due / next step</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Related</TableHeadCell>
              <TableHeadCell className="text-right">Open</TableHeadCell>
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
                    <p className="m-0 max-w-[340px] truncate text-[13.5px] font-semibold text-ink">
                      {row.title}
                    </p>
                    {row.sourceLabel ? (
                      <p className="m-0 max-w-[340px] truncate text-[12px] text-ink-muted">
                        {row.sourceLabel}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone="neutral">{row.kindLabel}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {row.ownerName ? (
                      <span className="text-[13px] text-ink">{row.ownerName}</span>
                    ) : (
                      <StatusBadge tone="warning">Unowned</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="m-0 text-[13px] text-ink">{fmtDue(row.dueISO)}</p>
                    {row.nextStep ? (
                      <p className="m-0 max-w-[220px] truncate text-[12px] text-ink-muted">
                        {row.nextStep}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={TONE_TO_BADGE[row.tone]}>{row.status}</StatusBadge>
                    {row.priorityLabel === "Urgent" || row.priorityLabel === "High" ? (
                      <span className="ml-1.5 text-[11.5px] font-semibold text-ink-muted">
                        {row.priorityLabel}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    {row.entityType && row.entityId && row.entityLabel ? (
                      <EntityChip
                        type={row.entityType}
                        id={row.entityId}
                        label={row.entityLabel}
                      />
                    ) : (
                      <span className="text-[13px] text-ink-muted">—</span>
                    )}
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
          type={selected.type}
          id={selected.id}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
