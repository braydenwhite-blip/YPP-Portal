import Link from "next/link";

import type { ActionItemStatus } from "@prisma/client";

import { effectiveStatus, smartBucket } from "@/lib/people-strategy/action-filters";
import { effectiveDeadline } from "@/lib/people-strategy/my-actions-selectors";
import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";

/**
 * People Strategy Operating System — shared, presentational panel that lists
 * the Action Tracker items linked to one surface (a class / mentorship /
 * person) and offers a "Create action for this …" CTA. Pure server component:
 * it takes already-loaded, already-visibility-filtered actions and renders
 * them, so each calling page owns the data loading + feature-flag + permission
 * gates. Brings its own card so it drops cleanly into any layout.
 */

const STATUS_TONE: Record<ActionItemStatus, string> = {
  NOT_STARTED: "#6b7280",
  IN_PROGRESS: "#1d4ed8",
  BLOCKED: "#854d0e",
  COMPLETE: "#166534",
  OVERDUE: "#991b1b",
  DROPPED: "#6b7280",
};

const SETTLED: ReadonlySet<ActionItemStatus> = new Set<ActionItemStatus>([
  "COMPLETE",
  "DROPPED",
]);

export function LinkedActionsPanel({
  actions,
  now = new Date(),
  createHref = null,
  createLabel = "Create a linked action",
  canCreate = false,
  heading = "Linked actions",
  emptyHint = "No actions are linked to this item yet.",
  limit = 8,
}: {
  actions: ActionItemWithRelations[];
  now?: Date;
  createHref?: string | null;
  createLabel?: string;
  canCreate?: boolean;
  heading?: string;
  emptyHint?: string;
  limit?: number;
}) {
  const withStatus = actions.map((item) => ({
    item,
    status: effectiveStatus(item, now),
  }));
  const openCount = withStatus.filter((a) => !SETTLED.has(a.status)).length;
  const overdueCount = withStatus.filter((a) => a.status === "OVERDUE").length;
  // Strategic attention signals (shared Action Tracker vocabulary): only shown
  // when present, so existing surfaces gain a richer read without disruption.
  const blockedCount = withStatus.filter((a) => a.status === "BLOCKED").length;
  const waitingCount = actions.filter((a) => smartBucket(a, now) === "WAITING").length;
  const shown = withStatus.slice(0, limit);
  const remaining = withStatus.length - shown.length;

  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h2 className="section-title" style={{ margin: 0 }}>
          {heading}
        </h2>
        {actions.length > 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {openCount} open
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
            {blockedCount > 0 ? ` · ${blockedCount} blocked` : ""}
            {waitingCount > 0 ? ` · ${waitingCount} waiting` : ""}
          </span>
        ) : null}
      </div>

      {actions.length === 0 ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
          {emptyHint}
        </p>
      ) : (
        <ul
          style={{
            margin: "10px 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 8,
          }}
        >
          {shown.map(({ item, status }) => {
            const leadName =
              item.lead?.name ?? item.lead?.email ?? "Unassigned lead";
            return (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  borderLeft: `3px solid ${STATUS_TONE[status]}`,
                  paddingLeft: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Link
                    href={`/actions/${item.id}`}
                    style={{ fontSize: 13, fontWeight: 600, color: "inherit" }}
                  >
                    {item.title}
                  </Link>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {leadName} · due {formatMonthDay(effectiveDeadline(item))}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: STATUS_TONE[status],
                    whiteSpace: "nowrap",
                  }}
                >
                  {ACTION_STATUS_LABELS[status]}
                </span>
              </li>
            );
          })}
          {remaining > 0 ? (
            <li style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 13 }}>
              + {remaining} more
            </li>
          ) : null}
        </ul>
      )}

      {canCreate && createHref ? (
        <p style={{ margin: "12px 0 0" }}>
          <Link href={createHref} className="button primary" style={{ fontSize: 13 }}>
            {createLabel}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export default LinkedActionsPanel;
