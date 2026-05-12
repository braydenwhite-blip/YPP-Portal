import Link from "next/link";

import type { ActionItemWithRelations } from "@/lib/leadership-action-center/queries";
import {
  CategoryBadge,
  DueDateBadge,
  OfficerDiscussionBadge,
  PriorityBadge,
  StatusBadge,
} from "./badges";

function ownerLabel(item: ActionItemWithRelations): string {
  if (item.primaryOwner?.name) return item.primaryOwner.name;
  if (item.ownerNames.length > 0) return item.ownerNames.join(", ");
  return "Unassigned";
}

function inputLabel(item: ActionItemWithRelations): string {
  const names: string[] = [];
  for (const link of item.inputNeededFrom) {
    if (link.user.name) names.push(link.user.name);
  }
  for (const name of item.inputNeededNames) names.push(name);
  return names.join(", ");
}

/**
 * Compact card row used by dashboard summary lists. The full table view uses
 * a real `<table>` (`TaskTable`) — this is for the snapshot widgets.
 */
export default function TaskSummaryRow({ item }: { item: ActionItemWithRelations }) {
  const inputs = inputLabel(item);
  const owner = ownerLabel(item);
  return (
    <Link
      href={`/admin/action-center/tasks?focus=${item.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 14px",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        background: "#fff",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{item.title}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
            {owner}
            {inputs && <> · Input from {inputs}</>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <DueDateBadge dueDate={item.dueDate} />
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <CategoryBadge category={item.category} size="small" />
        <StatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
        <OfficerDiscussionBadge
          needs={item.needsOfficerDiscussion}
          date={item.officerDiscussionDate}
        />
      </div>
    </Link>
  );
}
