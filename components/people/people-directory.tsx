"use client";

import Link from "next/link";

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
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type { PersonDirectoryRow } from "@/lib/people/directory";

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

function roleLabel(row: PersonDirectoryRow): string {
  return row.roleSet
    .map((role) => ROLE_LABELS[role] ?? role)
    .slice(0, 2)
    .join(" · ");
}

function affiliationLine(row: PersonDirectoryRow): string | null {
  if (row.primaryRole === "APPLICANT") return row.applicationStatus;
  return row.affiliation;
}

function advisorLine(row: PersonDirectoryRow): string | null {
  if (!row.advisor) {
    return row.roleSet.includes("STUDENT") ? "No advisor" : null;
  }
  if (row.advisor.overdue) return `Check-in overdue · ${row.advisor.name}`;
  if (row.advisor.nextCheckInISO) {
    return `Next ${formatMonthDay(new Date(row.advisor.nextCheckInISO))} · ${row.advisor.name}`;
  }
  return row.advisor.name;
}

/** Calm OS people roster — tap a row for 360 preview or open the profile. */
export function PeopleDirectory({ rows }: { rows: PersonDirectoryRow[] }) {
  const entity360 = useEntity360();

  if (rows.length === 0) {
    return (
      <EmptyStateV2
        icon="👥"
        title="No one matches"
        body="Try another filter or clear your search."
      />
    );
  }

  return (
    <DataTableShell className="rounded-[18px] border-line-soft bg-surface/80 shadow-card backdrop-blur">
      <TableV2>
        <thead>
          <tr>
            <TableHeadCell>Person</TableHeadCell>
            <TableHeadCell>Role</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell>Advisor / check-in</TableHeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const primaryFlag = row.flags[0];
            return (
              <tr
                key={row.id}
                onClick={() => entity360?.openEntity("person", row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    entity360?.openEntity("person", row.id);
                  }
                }}
                tabIndex={0}
                className={cn(
                  "cursor-pointer transition-colors duration-100",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400",
                  "hover:bg-surface-soft"
                )}
              >
                <TableCell>
                  <Link
                    href={`/people/${row.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="block text-[13.5px] font-semibold text-ink no-underline hover:text-brand-700"
                  >
                    {row.name}
                  </Link>
                  <p className="m-0 truncate text-[12px] text-ink-muted">{row.email}</p>
                  {affiliationLine(row) ? (
                    <p className="m-0 mt-0.5 text-[11.5px] text-ink-muted">{affiliationLine(row)}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <p className="m-0 text-[13px] font-medium text-ink">{roleLabel(row)}</p>
                  {row.title ? (
                    <p className="m-0 text-[12px] text-ink-muted">{row.title}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.flags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.flags.map((flag) => (
                        <StatusBadge key={flag.label} tone={FLAG_TONE[flag.tone]}>
                          {flag.label}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px] text-ink-muted">All clear</span>
                  )}
                </TableCell>
                <TableCell>
                  {advisorLine(row) ? (
                    <p className="m-0 text-[12.5px] text-ink">{advisorLine(row)}</p>
                  ) : (
                    <span className="text-[12px] text-ink-muted">—</span>
                  )}
                  {primaryFlag && primaryFlag.tone === "danger" ? (
                    <p className="m-0 mt-1 text-[11.5px] font-semibold text-danger-700">
                      {primaryFlag.label}
                    </p>
                  ) : null}
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </TableV2>
    </DataTableShell>
  );
}
