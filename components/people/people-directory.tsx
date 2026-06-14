"use client";

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

function subtitle(row: PersonDirectoryRow): string | null {
  if (row.primaryRole === "APPLICANT") return row.applicationStatus;
  if (row.affiliation) return row.affiliation;
  if (row.advisor?.overdue) return "Check-in overdue";
  if (!row.advisor && row.roleSet.includes("STUDENT")) return "No advisor";
  return row.title;
}

/** Simple people list — tap a row to open the 360 preview. */
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
    <DataTableShell>
      <TableV2>
        <thead>
          <tr>
            <TableHeadCell>Name</TableHeadCell>
            <TableHeadCell>Role</TableHeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
                <p className="m-0 text-[13.5px] font-semibold text-ink">{row.name}</p>
                <p className="m-0 truncate text-[12px] text-ink-muted">{row.email}</p>
                {row.flags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.flags.map((flag) => (
                      <StatusBadge key={flag.label} tone={FLAG_TONE[flag.tone]}>
                        {flag.label}
                      </StatusBadge>
                    ))}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <p className="m-0 text-[13px] font-medium text-ink">{roleLabel(row)}</p>
                {subtitle(row) ? (
                  <p className="m-0 text-[12px] text-ink-muted">{subtitle(row)}</p>
                ) : null}
              </TableCell>
            </tr>
          ))}
        </tbody>
      </TableV2>
    </DataTableShell>
  );
}
