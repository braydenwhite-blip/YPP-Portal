import Link from "next/link";
import { notFound } from "next/navigation";

import ActionItemForm from "@/components/people-strategy/action-item-form";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import { actionItemDepartments } from "@/lib/people-strategy/action-item-departments";
import {
  getActionItemById,
  listActionAssignableUsers,
  listActionDepartments,
} from "@/lib/people-strategy/action-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit action" };

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
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 pb-12 pt-4">
        <Link
          href={`/actions/${item.id}`}
          className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
        >
          ← Back to action
        </Link>

        <header>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-ink">Edit action</h1>
          <p className="m-0 mt-1 text-[14px] text-ink-muted">{item.title}</p>
        </header>

        <div className="overflow-hidden rounded-[14px] border border-line-card bg-surface p-5 shadow-card sm:p-6">
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
              departmentIds: actionItemDepartments(item).map((dept) => dept.id),
              departmentId: item.departmentId,
              status: item.status,
              priority: item.priority,
              visibility: item.visibility,
              deadlineStart: item.deadlineStart,
              deadlineEnd: item.deadlineEnd,
              leadId: item.leadId,
              chapterId: item.chapterId,
              chapterLabel: item.chapter?.name ?? null,
              executingUserIds,
              inputUserIds,
            }}
          />
        </div>
      </div>
    </div>
  );
}
