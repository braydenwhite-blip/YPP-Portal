import Link from "next/link";
import { notFound } from "next/navigation";

import ActionItemForm from "@/components/people-strategy/action-item-form";
import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import {
  listActionAssignableUsers,
  listActionDepartments,
} from "@/lib/people-strategy/action-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "New action · People Strategy" };

export default async function NewActionPage() {
  // Feature flag: with ENABLE_ACTION_TRACKER off, the route is unreachable.
  if (!isActionTrackerEnabled()) notFound();

  await requirePageRoles([...OFFICER_TIER_ROLES]);

  const [users, departments] = await Promise.all([
    listActionAssignableUsers(),
    listActionDepartments(),
  ]);

  return (
    <div className="page-shell">
      <div className="topbar">
        <div>
          <p className="badge">People Strategy</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            New action item
          </h1>
          <p className="page-subtitle">
            Assign a Lead, one or more Executors, and any Input partners.
          </p>
        </div>
        <Link href="/admin/actions" className="button outline small">
          Back to actions
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        <ActionItemForm users={users} departments={departments} />
      </div>
    </div>
  );
}
