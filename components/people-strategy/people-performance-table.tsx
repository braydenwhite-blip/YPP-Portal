import {
  ButtonLink,
  DataTableShell,
  StatusBadge,
  TableCell,
  TableHeadCell,
  TableV2,
} from "@/components/ui-v2";
import { PersonLink } from "@/components/people-strategy/person-link";
import { buildAttentionLabels } from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

/**
 * Simplified People & Performance table — name, what needs attention, one action.
 */
export function PeoplePerformanceTable({
  rows,
  currentQuarter,
  currentMonthLabel,
}: {
  rows: PeoplePerformanceRow[];
  currentQuarter: string;
  currentMonthLabel: string;
}) {
  return (
    <DataTableShell>
      <TableV2>
        <thead>
          <tr>
            <TableHeadCell>Person</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell className="text-right"> </TableHeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <TableCell colSpan={3} className="py-10 text-center text-ink-muted">
                No one matches this view.
              </TableCell>
            </tr>
          ) : (
            rows.map((row) => {
              const displayName = row.name || row.email;
              const labels = buildAttentionLabels(
                row.facts,
                currentMonthLabel,
                currentQuarter
              );

              return (
                <tr key={row.id}>
                  <TableCell>
                    <PersonLink
                      id={row.id}
                      className="text-[13.5px] font-semibold text-ink hover:underline"
                    >
                      {displayName}
                    </PersonLink>
                    {row.role ? (
                      <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{row.role}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((label) => (
                        <StatusBadge key={label.label} tone={label.tone}>
                          {label.label}
                        </StatusBadge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <ButtonLink
                      href={`/admin/instructors/${row.id}/manage/strategy`}
                      variant="secondary"
                      size="sm"
                    >
                      Open
                    </ButtonLink>
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
