"use client";

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
  type StatusTone,
} from "@/components/ui-v2";
import type { PersonDirectoryRow } from "@/lib/people/directory";

/**
 * Master People database — table + preview rail (plan §9).
 *
 * Preview-first: clicking a row docks the person's Entity 360 preview on the
 * right (wide screens) or opens the universal 360 drawer (below xl). The
 * full profile at /people/[id] is always one explicit click away from the
 * preview — never the row's default action.
 */

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  APPLICANT: "Applicant",
  CHAPTER_PRESIDENT: "Chapter President",
  HIRING_CHAIR: "Hiring Chair",
  INSTRUCTOR: "Instructor",
  MENTOR: "Mentor",
  PARENT: "Parent",
  STAFF: "Staff",
  STUDENT: "Student",
};

const FLAG_TONE: Record<string, StatusTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  neutral: "neutral",
};

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtJoined(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Role cell context line: the one concrete count that matters per role. */
function roleContext(row: PersonDirectoryRow): string | null {
  if (row.primaryRole === "APPLICANT") return row.applicationStatus;
  const parts: string[] = [];
  if (row.roleSet.includes("INSTRUCTOR")) {
    parts.push(
      row.currentClassCount === 1 ? "1 current class" : `${row.currentClassCount} current classes`
    );
  }
  if (row.adviseeCount > 0) {
    parts.push(`${row.adviseeCount} advisee${row.adviseeCount === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : row.title;
}

export function PeopleDirectory({ rows }: { rows: PersonDirectoryRow[] }) {
  const entity360 = useEntity360();
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    if (selectedId && !rows.some((row) => row.id === selectedId)) {
      setSelectedId(null);
    }
  }, [rows, selectedId]);

  const openRow = (row: PersonDirectoryRow) => {
    if (wide) {
      setSelectedId(row.id);
    } else {
      entity360?.openEntity("person", row.id);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyStateV2
        icon="👥"
        title="No people match this view"
        body="Try a different role filter, clear the search, or check the spelling of the name or email."
      />
    );
  }

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
              <TableHeadCell>Person</TableHeadCell>
              <TableHeadCell>Role</TableHeadCell>
              <TableHeadCell>Affiliation</TableHeadCell>
              <TableHeadCell>Advisor</TableHeadCell>
              <TableHeadCell className="text-right">Joined</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.id === selectedId;
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
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700"
                      >
                        {initialsOf(row.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-ink">
                          {row.name}
                          {row.flags.map((flag) => (
                            <StatusBadge key={flag.label} tone={FLAG_TONE[flag.tone]}>
                              {flag.label}
                            </StatusBadge>
                          ))}
                        </p>
                        <p className="m-0 truncate text-[12px] text-ink-muted">{row.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="m-0 text-[13px] font-medium text-ink">
                      {row.roleSet
                        .map((role) => ROLE_LABELS[role] ?? role)
                        .slice(0, 2)
                        .join(" · ")}
                    </p>
                    {roleContext(row) ? (
                      <p className="m-0 text-[12px] text-ink-muted">{roleContext(row)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[13px] text-ink-muted">
                    {row.affiliation ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.roleSet.includes("STUDENT") ? (
                      row.advisor ? (
                        <div>
                          <p className="m-0 text-[13px] font-medium text-ink">
                            {row.advisor.name}
                          </p>
                          <p
                            className={cn(
                              "m-0 text-[12px]",
                              row.advisor.overdue
                                ? "font-semibold text-danger-700"
                                : "text-ink-muted"
                            )}
                          >
                            {row.advisor.overdue
                              ? `Check-in overdue (due ${fmtDay(row.advisor.nextCheckInISO)})`
                              : row.advisor.nextCheckInISO
                                ? `Next check-in ${fmtDay(row.advisor.nextCheckInISO)}`
                                : row.advisor.lastCheckInISO
                                  ? `Last check-in ${fmtDay(row.advisor.lastCheckInISO)}`
                                  : "No check-in yet"}
                          </p>
                        </div>
                      ) : (
                        <StatusBadge tone="danger">No advisor</StatusBadge>
                      )
                    ) : (
                      <span className="text-[13px] text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-[12.5px] text-ink-muted">
                    {fmtJoined(row.joinedAtISO)}
                  </TableCell>
                </tr>
              );
            })}
          </tbody>
        </TableV2>
      </DataTableShell>

      {selectedId && wide ? (
        <EntityPreviewRail
          type="person"
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
