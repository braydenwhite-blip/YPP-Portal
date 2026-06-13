import Link from "next/link";
import { notFound } from "next/navigation";

import ActionItemForm from "@/components/people-strategy/action-item-form";
import { ActionTrackerBack } from "@/components/people-strategy/action-tracker-tabs";
import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
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
  if (!isActionTrackerEnabled()) notFound();

  const { id } = await params;
  const viewer = await requirePageRoles([...OFFICER_TIER_ROLES]);

  const [item, users, departments] = await Promise.all([
    getActionItemById(id, viewer),
    listActionAssignableUsers(),
    listActionDepartments(),
  ]);

  if (!item) notFound();

  const executingUserIds = item.assignments
    .filter((a) => a.role === "EXECUTING")
    .map((a) => a.user.id);
  const inputUserIds = item.assignments
    .filter((a) => a.role === "INPUT")
    .map((a) => a.user.id);

  return (
    <div className="page-shell" style={{ maxWidth: 760 }}>
      <Link
        href={`/actions/${item.id}`}
        style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}
      >
        ← Back to action
      </Link>
      <ActionTrackerBack />

      <div style={{ marginTop: 16 }}>
        <h1 className="page-title" style={{ fontSize: 22 }}>Edit action</h1>
        <p className="page-subtitle">{item.title}</p>
      </div>

      <div className="ps-form-card" style={{ marginTop: 16 }}>
        <ActionItemForm
          variant="simple"
          users={users}
          departments={departments}
          initial={{
            id: item.id,
            title: item.title,
            description: item.description,
            goalCategory: item.goalCategory,
            actionType: item.actionType,
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
