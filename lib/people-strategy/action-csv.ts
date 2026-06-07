import type { ActionItemWithRelations } from "./action-queries";
import { effectiveStatus } from "./action-filters";
import { effectiveDeadline } from "./my-actions-selectors";
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  ACTION_VISIBILITY_LABELS,
} from "./constants";

/**
 * People Strategy — Action Tracker CSV serialization.
 *
 * Mirrors the local-helper convention used by the existing export routes
 * (`app/api/admin/action-center/export.csv/route.ts` etc.) — there is no shared
 * CSV util in the repo, so we keep the same small `csvEscape`/`csvRow` shape.
 * Takes an already-filtered list so the file matches the on-screen view.
 */

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvEscape).join(",");
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function assigneeNames(
  item: ActionItemWithRelations,
  role: "EXECUTING" | "INPUT"
): string {
  return item.assignments
    .filter((a) => a.role === role)
    .map((a) => a.user.name ?? a.user.email)
    .filter((name): name is string => Boolean(name))
    .join("; ");
}

const CSV_HEADERS = [
  "Title",
  "Department",
  "Status",
  "Priority",
  "Visibility",
  "Deadline",
  "Completed",
  "Lead",
  "Executing",
  "Input",
  "Officer Meeting",
  "Flagged",
  "Comments",
  "Created",
];

/** Build a CSV string for the given (already filtered + sorted) action items. */
export function toActionItemsCsv(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): string {
  const rows: string[] = [csvRow(CSV_HEADERS)];
  for (const item of items) {
    rows.push(
      csvRow([
        item.title,
        item.department?.name ?? "Unassigned",
        ACTION_STATUS_LABELS[effectiveStatus(item, now)],
        ACTION_PRIORITY_LABELS[item.priority],
        ACTION_VISIBILITY_LABELS[item.visibility],
        formatDate(effectiveDeadline(item)),
        formatDate(item.completedAt),
        item.lead?.name ?? item.lead?.email ?? "",
        assigneeNames(item, "EXECUTING"),
        assigneeNames(item, "INPUT"),
        item.officerMeetingId ? "Yes" : "No",
        item.flaggedAt ? "Yes" : "No",
        item.comments.length,
        formatDate(item.createdAt),
      ])
    );
  }
  return rows.join("\n") + "\n";
}

/** Filename used for the download. */
export function actionItemsCsvFilename(now: Date = new Date()): string {
  return `ypp-action-tracker-${now.toISOString().slice(0, 10)}.csv`;
}
