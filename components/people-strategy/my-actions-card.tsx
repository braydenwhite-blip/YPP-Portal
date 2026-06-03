import Link from "next/link";

import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import { getMyActionItems } from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  effectiveDeadline,
  isActionOverdue,
  sortByDeadline,
  summarizeMyActions,
} from "@/lib/people-strategy/my-actions-selectors";

const OVERDUE_ACCENT = "var(--error-color)";

/**
 * Compact "My Actions" queue card for the unified home dashboard. Async server
 * component: it self-gates on the ENABLE_ACTION_TRACKER flag and renders
 * nothing when the flag is off or the viewer has no actions, so it can be
 * dropped into any home surface without extra branching. Reuses the `.card`
 * pattern and the shared My Actions selectors.
 */
export default async function MyActionsCard({ viewer }: { viewer: ActionViewer }) {
  if (!isActionTrackerEnabled()) return null;

  const items = sortByDeadline(await getMyActionItems(viewer.id, viewer));
  if (items.length === 0) return null;

  const now = new Date();
  const summary = summarizeMyActions(items, viewer.id, now);
  const top = items.slice(0, 3);

  return (
    <Link
      href="/actions"
      className="card"
      style={{ display: "block", padding: "18px 20px", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>My Actions</h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{summary.total} total</span>
      </div>

      <div style={{ display: "flex", gap: 14, margin: "10px 0 4px", flexWrap: "wrap" }}>
        {summary.overdue > 0 ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: OVERDUE_ACCENT }}>
            {summary.overdue} overdue
          </span>
        ) : null}
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{summary.inProgress} in progress</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{summary.executing} executing</span>
        {summary.needsInput > 0 ? (
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{summary.needsInput} need your input</span>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {top.map((item) => {
          const overdue = isActionOverdue(item, now);
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 13,
                paddingLeft: 8,
                borderLeft: overdue ? `3px solid ${OVERDUE_ACCENT}` : "3px solid var(--border)",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </span>
              <span style={{ color: overdue ? OVERDUE_ACCENT : "#64748b", whiteSpace: "nowrap", fontWeight: overdue ? 600 : 400 }}>
                {formatDueDate(effectiveDeadline(item))}
              </span>
            </div>
          );
        })}
      </div>

      <span className="button small" style={{ marginTop: 14, pointerEvents: "none" }}>
        Open My Actions
      </span>
    </Link>
  );
}
