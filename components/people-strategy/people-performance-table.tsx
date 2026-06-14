"use client";

import {
  Button,
  DataTableShell,
  StatusBadge,
  TableCell,
  TableHeadCell,
  TableV2,
} from "@/components/ui-v2";
import {
  checkInCellStatus,
  deriveNextAction,
  feedbackCellStatus,
  quarterlyCellStatus,
  workloadCellStatus,
} from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

/**
 * People & Performance table — calm, real data, one action per row.
 *
 * Columns: Person · Role/Dept · Feedback · Check-in · Workload · Quarterly ·
 * Action. Every cell is a plain-English fact ("3 in, 2 waiting", "Missing May",
 * "4 active, 1 overdue") — no dense metrics, no synthetic score, no vague badge.
 * The row's single action button comes from the shared Next Action helper, so
 * the table, the needs-action list, and the drawer always agree.
 */
export function PeoplePerformanceTable({
  rows,
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
  onOpenPerson,
  onRunAction,
}: {
  rows: PeoplePerformanceRow[];
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
  onOpenPerson: (row: PeoplePerformanceRow) => void;
  onRunAction: (row: PeoplePerformanceRow) => void;
}) {
  return (
    <DataTableShell>
      <TableV2>
        <thead>
          <tr>
            <TableHeadCell>Person</TableHeadCell>
            <TableHeadCell>Feedback</TableHeadCell>
            <TableHeadCell>Check-in</TableHeadCell>
            <TableHeadCell>Workload</TableHeadCell>
            {quarterlyEnabled ? <TableHeadCell>Quarterly</TableHeadCell> : null}
            <TableHeadCell className="text-right"> </TableHeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <TableCell
                colSpan={quarterlyEnabled ? 6 : 5}
                className="py-10 text-center text-ink-muted"
              >
                No one matches this view.
              </TableCell>
            </tr>
          ) : (
            rows.map((row) => {
              const name = row.name || row.email;
              const feedback = feedbackCellStatus(row.facts);
              const checkIn = checkInCellStatus(row.facts, monthShortLabel);
              const workload = workloadCellStatus(row.facts);
              const quarterly = quarterlyCellStatus(row.facts, quarterlyEnabled);
              const action = deriveNextAction(row.facts, { monthLabel, quarter });
              const roleLine = [row.role, ...row.departments].filter(Boolean).join(" · ");

              return (
                <tr key={row.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenPerson(row)}
                      className="block text-left text-[13.5px] font-semibold text-ink hover:underline"
                    >
                      {name}
                    </button>
                    {roleLine ? (
                      <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{roleLine}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={feedback.tone}>{feedback.text}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={checkIn.tone}>{checkIn.text}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={workload.tone}>{workload.text}</StatusBadge>
                  </TableCell>
                  {quarterlyEnabled ? (
                    <TableCell>
                      <StatusBadge tone={quarterly.tone}>{quarterly.text}</StatusBadge>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRunAction(row)}
                    >
                      {action.actionLabel}
                    </Button>
                  </TableCell>
                </tr>
              );
            })
          )}
        </tbody>
      </TableV2>
    </DataTableShell>
  );
}
