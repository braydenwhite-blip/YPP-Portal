import Link from "next/link";

import { formatDueDateLong } from "@/lib/leadership-action-center/dates";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  effectiveDeadline,
  isActionOverdue,
} from "@/lib/people-strategy/my-actions-selectors";

const OVERDUE = "var(--error-color)";

/** One line per action — title, owner, due date. Nothing else. */
export function ActionSimpleRow({
  item,
  now,
  showOwner = false,
}: {
  item: ActionItemWithRelations;
  now: Date;
  showOwner?: boolean;
}) {
  const overdue = isActionOverdue(item, now);
  const due = effectiveDeadline(item);
  const owner = item.lead?.name ?? item.lead?.email ?? "Unassigned";

  return (
    <Link
      href={`/actions/${item.id}`}
      className="card"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: overdue ? `3px solid ${OVERDUE}` : "3px solid transparent",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
        {showOwner ? (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{owner}</div>
        ) : null}
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: overdue ? OVERDUE : "var(--muted)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {overdue ? "Overdue · " : ""}
        {due ? formatDueDateLong(due) : "No date"}
      </span>
    </Link>
  );
}
