import Link from "next/link";

import { ActionCard } from "@/components/people-strategy/action-card";
import { ActionQuickCreate } from "@/components/people-strategy/action-quick-create";
import { EmptyStateV2, RecordSection } from "@/components/ui-v2";
import type {
  ActionDepartmentOption,
  ActionItemWithRelations,
  ActionPickerUser,
} from "@/lib/people-strategy/action-queries";
import { initiativePrimaryGoalCategory } from "@/lib/people-strategy/strategic-recommendations";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

/** The work under one initiative — add actions inline; they stay linked to the plan. */
export function InitiativeActionsPanel({
  initiative,
  actions,
  now,
  canCreate,
  assignableUsers,
  departments,
  currentUserId,
}: {
  initiative: StrategicInitiativeDef;
  actions: ActionItemWithRelations[];
  now: Date;
  canCreate: boolean;
  assignableUsers: ActionPickerUser[];
  departments: ActionDepartmentOption[];
  currentUserId: string;
}) {
  const trackerHref = `/actions?initiative=${encodeURIComponent(initiative.id)}&who=all`;

  return (
    <RecordSection
      title="Actions"
      description={`${actions.length} open — the work that moves this initiative forward.`}
      action={
        <Link
          href={trackerHref}
          className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
        >
          View all →
        </Link>
      }
    >
      {canCreate && assignableUsers.length > 0 ? (
        <ActionQuickCreate
          users={assignableUsers}
          departments={departments}
          currentUserId={currentUserId}
          redirectTo={`/operations/initiatives/${initiative.id}`}
          initiativeLink={{
            id: initiative.id,
            goalCategory: initiativePrimaryGoalCategory(initiative),
          }}
        />
      ) : null}

      {actions.length === 0 ? (
        <EmptyStateV2
          title="No actions yet"
          body="Add one above — it will stay linked to this initiative."
          className="py-8"
        />
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {actions.map((item) => (
            <ActionCard key={item.id} item={item} now={now} />
          ))}
        </div>
      )}
    </RecordSection>
  );
}
