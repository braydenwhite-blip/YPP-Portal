import Link from "next/link";
import { notFound } from "next/navigation";

import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import { listVisibleActionItems } from "@/lib/people-strategy/action-queries";
import {
  ACTION_STATUS_LABELS,
  ACTION_VISIBILITY_LABELS,
} from "@/lib/people-strategy/constants";
import { formatDueDate } from "@/lib/leadership-action-center/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Items · People Strategy" };

export default async function ActionsIndexPage() {
  // Feature flag: with ENABLE_ACTION_TRACKER off, the route is unreachable.
  if (!isActionTrackerEnabled()) notFound();

  const user = await requirePageRoles([...OFFICER_TIER_ROLES]);
  const items = await listVisibleActionItems(user);

  return (
    <div className="page-shell">
      <div
        className="topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="badge">People Strategy</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Action items
          </h1>
          <p className="page-subtitle">
            Create and edit action items with Lead, Executing, and Input roles.
          </p>
        </div>
        <Link href="/admin/actions/new" className="button small">
          New action
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p>No action items yet. Create the first one to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {items.map((item) => {
            const executors = item.assignments.filter((a) => a.role === "EXECUTING");
            const inputs = item.assignments.filter((a) => a.role === "INPUT");
            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong style={{ fontSize: 15 }}>{item.title}</strong>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    {item.department?.name ?? "—"} ·{" "}
                    {ACTION_STATUS_LABELS[item.status]} ·{" "}
                    {ACTION_VISIBILITY_LABELS[item.visibility]} · Due{" "}
                    {formatDueDate(item.deadlineStart)}
                  </span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    Lead: {item.lead?.name ?? item.lead?.email ?? "—"}
                    {executors.length > 0 && ` · Executing: ${executors.length}`}
                    {inputs.length > 0 && ` · Input: ${inputs.length}`}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/actions/${item.id}`} className="button small">
                    Open
                  </Link>
                  <Link
                    href={`/admin/actions/${item.id}/edit`}
                    className="button outline small"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
