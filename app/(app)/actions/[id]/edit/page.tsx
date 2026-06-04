import Link from "next/link";
import { notFound } from "next/navigation";

import ActionItemForm from "@/components/people-strategy/action-item-form";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled, isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import { isCpoOrBoard } from "@/lib/people-strategy/action-permissions";
import {
  getActionItemById,
  listActionAssignableUsers,
  listActionDepartments,
} from "@/lib/people-strategy/action-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit action · Action Tracker" };

export default async function EditActionInTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Feature flag: with ENABLE_ACTION_TRACKER off, the route is unreachable.
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requirePageRoles([...OFFICER_TIER_ROLES]);

  const [item, users, departments] = await Promise.all([
    getActionItemById(id, viewer),
    listActionAssignableUsers(),
    listActionDepartments(),
  ]);

  // Null when missing or the viewer cannot see it (access-denied convention).
  if (!item) notFound();

  const executingUserIds = item.assignments
    .filter((a) => a.role === "EXECUTING")
    .map((a) => a.user.id);
  const inputUserIds = item.assignments
    .filter((a) => a.role === "INPUT")
    .map((a) => a.user.id);

  const showPeople = isPeopleDashboardEnabled() && isCpoOrBoard(viewer);

  return (
    <div className="page-shell">
      <Link
        href={`/actions/${item.id}`}
        style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}
      >
        ← Back to action
      </Link>
      <ActionTrackerTabs showPeople={showPeople} />

      <div className="topbar" style={{ marginTop: 16 }}>
        <div>
          <p className="badge">Action Tracker</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Edit action item
          </h1>
          <p className="page-subtitle">{item.title}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        <ActionItemForm
          users={users}
          departments={departments}
          initial={{
            id: item.id,
            title: item.title,
            description: item.description,
            goalCategory: item.goalCategory,
            departmentId: item.departmentId,
            status: item.status,
            priority: item.priority,
            visibility: item.visibility,
            deadlineStart: item.deadlineStart,
            deadlineEnd: item.deadlineEnd,
            leadId: item.leadId,
            executingUserIds,
            inputUserIds,
          }}
        />
      </div>
    </div>
  );
}
