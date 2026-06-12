"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EntityPreviewRail } from "@/components/operations/entity-preview-rail";
import { useEntity360 } from "@/components/operations/entity-360-context";
import {
  cn,
  DataTableShell,
  EmptyStateV2,
  StatusBadge,
  TableCell,
  TableHeadCell,
  TableV2,
} from "@/components/ui-v2";
import type { PartnerDirectoryRow } from "@/lib/partners-directory";

/**
 * Master Partner database — table + preview rail (plan §10).
 *
 * Relationship-operations columns only: who owns it, who we talk to, what's
 * linked, when we last talked, and what happens next. Concrete stuck reasons
 * ride the row; there is no "partner health" column, ever. Row click docks
 * the Partner 360 preview (wide) or opens the universal drawer (narrow).
 */

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function stageTone(group: PartnerDirectoryRow["stageGroup"]): "info" | "success" | "neutral" {
  if (group === "won") return "success";
  if (group === "active") return "info";
  return "neutral";
}

export function PartnerDirectory({
  rows,
  actionTrackerEnabled,
  canManagePartners,
}: {
  rows: PartnerDirectoryRow[];
  /** Gates the action/meeting quick actions in the preview rail. */
  actionTrackerEnabled: boolean;
  /** Admin-only partner management route access. */
  canManagePartners: boolean;
}) {
  const entity360 = useEntity360();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (selectedId && !rows.some((row) => row.id === selectedId)) {
      setSelectedId(null);
    }
  }, [rows, selectedId]);

  const openRow = (row: PartnerDirectoryRow) => {
    if (wide) {
      setSelectedId(row.id);
    } else {
      entity360?.openEntity("partner", row.id);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyStateV2
        icon="🤝"
        title="No partners match this view"
        body={
          canManagePartners
            ? "Try a different view or type filter, clear the search, or add the organization from the partner admin."
            : "Try a different view or type filter, or clear the search."
        }
      />
    );
  }

  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div
      className={cn(
        "grid items-start gap-5",
        selectedId && wide ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"
      )}
    >
      <DataTableShell>
        <TableV2>
          <thead>
            <tr>
              <TableHeadCell>Partner</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Primary contact</TableHeadCell>
              <TableHeadCell>Relationship lead</TableHeadCell>
              <TableHeadCell className="text-center">Classes</TableHeadCell>
              <TableHeadCell>Stage</TableHeadCell>
              <TableHeadCell>Last interaction</TableHeadCell>
              <TableHeadCell>Next step</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.id === selectedId;
              const followUpOverdue = row.stuck.includes("Follow-up is overdue");
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
                  aria-selected={selected}
                  className={cn(
                    "cursor-pointer transition-colors duration-100",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400",
                    selected ? "bg-brand-50" : "hover:bg-surface-soft"
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-100 text-[11px] font-bold text-brand-700"
                      >
                        {initialsOf(row.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[13.5px] font-semibold text-ink">
                          {row.name}
                        </p>
                        {row.location ? (
                          <p className="m-0 truncate text-[12px] text-ink-muted">
                            {row.location}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-ink-muted">
                    {row.typeLabel ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.primaryContact ? (
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[13px] font-medium text-ink">
                          {row.primaryContact.name}
                        </p>
                        {row.primaryContact.title ? (
                          <p className="m-0 truncate text-[12px] text-ink-muted">
                            {row.primaryContact.title}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[13px] text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.lead ? (
                      <span className="text-[13px] font-medium text-ink">{row.lead.name}</span>
                    ) : (
                      <StatusBadge tone="danger">No lead</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-[13px] text-ink">
                    {row.classCount > 0 ? row.classCount : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={stageTone(row.stageGroup)}>{row.stageLabel}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-ink-muted">
                    {fmtDay(row.lastContactedISO)}
                  </TableCell>
                  <TableCell>
                    {row.nextFollowUpISO ? (
                      <p
                        className={cn(
                          "m-0 text-[12.5px]",
                          followUpOverdue
                            ? "font-semibold text-danger-700"
                            : "font-medium text-ink"
                        )}
                      >
                        {followUpOverdue ? "Overdue: " : "Follow up "}
                        {fmtDay(row.nextFollowUpISO)}
                      </p>
                    ) : row.nextOpenRequest ? (
                      <p className="m-0 truncate text-[12.5px] font-medium text-ink">
                        {row.nextOpenRequest.title}
                      </p>
                    ) : row.stuck.length > 0 ? (
                      <StatusBadge tone="warning">{row.stuck[0]}</StatusBadge>
                    ) : (
                      <span className="text-[12.5px] text-ink-muted">—</span>
                    )}
                    {row.openRequestCount > 0 ? (
                      <p className="m-0 mt-0.5 text-[11.5px] font-semibold text-warning-700">
                        {row.openRequestCount} open request{row.openRequestCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </TableCell>
                </tr>
              );
            })}
          </tbody>
        </TableV2>
      </DataTableShell>

      {selectedId && wide ? (
        <EntityPreviewRail
          type="partner"
          id={selectedId}
          onClose={() => setSelectedId(null)}
          quickActions={
            <>
              {actionTrackerEnabled ? (
                <>
                  <Link
                    href={`/actions/new?relatedType=PARTNER&relatedId=${selectedId}`}
                    className="inline-flex h-8 items-center justify-center rounded-[8px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-brand-800 transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50"
                  >
                    Create action
                  </Link>
                  <Link
                    href={`/actions/meetings?new=1&relatedType=PARTNER&relatedId=${selectedId}`}
                    className="inline-flex h-8 items-center justify-center rounded-[8px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-brand-800 transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50"
                  >
                    Schedule meeting
                  </Link>
                </>
              ) : null}
              {selectedRow && canManagePartners ? (
                <Link
                  href={`/admin/partners/${selectedId}#relationship-ops`}
                  className="inline-flex h-8 items-center justify-center rounded-[8px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-brand-800 transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50"
                >
                  Add contact / request
                </Link>
              ) : null}
            </>
          }
        />
      ) : null}
    </div>
  );
}
