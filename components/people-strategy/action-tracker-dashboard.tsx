import Link from "next/link";
import type { ReactNode } from "react";

import type {
  ActionDepartmentOption,
  ActionItemWithRelations,
  ActionPickerUser,
} from "@/lib/people-strategy/action-queries";
import { canDeleteAction, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { ActionQuickCreate } from "@/components/people-strategy/action-quick-create";
import { ActionTrackerList } from "@/components/people-strategy/action-tracker-list";
import { EmptyStateV2, UrlSyncedSearchInput } from "@/components/ui-v2";

type UserOption = ActionPickerUser;

function buildActionsHref(params: {
  who?: string;
  q?: string;
  initiative?: string;
  create?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params.who && params.who !== "me") qs.set("who", params.who);
  if (params.q) qs.set("q", params.q);
  if (params.initiative) qs.set("initiative", params.initiative);
  if (params.create) qs.set("create", "1");
  const s = qs.toString();
  return s ? `/actions?${s}` : "/actions";
}

/** Filter actions where this person is lead, executing, or input. */
export function filterActionsByPerson(
  items: ActionItemWithRelations[],
  userId: string
): ActionItemWithRelations[] {
  return items.filter(
    (item) =>
      item.leadId === userId ||
      item.assignments.some((a) => a.user.id === userId)
  );
}

function actionAccessShape(item: ActionItemWithRelations) {
  return {
    leadId: item.leadId,
    createdById: item.createdById,
    visibility: item.visibility,
    assignments: item.assignments.map((assignment) => ({
      userId: assignment.user.id,
      role: assignment.role,
    })),
  };
}

function WhoTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  if (active) {
    return (
      <span className="ps-tab" aria-current="page">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="ps-tab">
      {children}
    </Link>
  );
}

export function ActionTrackerDashboard({
  items,
  now,
  officer,
  canCreate,
  assignableUsers,
  departments,
  currentUserId,
  viewer,
  who,
  q,
  initiativeId,
  defaultOpenCreate = false,
  initiativeLink,
}: {
  items: ActionItemWithRelations[];
  now: Date;
  officer: boolean;
  canCreate: boolean;
  assignableUsers: UserOption[];
  departments: ActionDepartmentOption[];
  currentUserId: string;
  viewer: ActionViewer;
  who: string;
  q: string;
  initiativeId?: string;
  defaultOpenCreate?: boolean;
  initiativeLink?: { id: string; goalCategory?: string };
}) {
  const deletableIds = items
    .filter(
      (item) =>
        item.status !== "DROPPED" && canDeleteAction(viewer, actionAccessShape(item))
    )
    .map((item) => item.id);

  const listHref = buildActionsHref({ who, q, initiative: initiativeId });

  return (
    <div className="flex flex-col gap-4">
      {canCreate && assignableUsers.length > 0 ? (
        <ActionQuickCreate
          users={assignableUsers}
          departments={departments}
          currentUserId={currentUserId}
          redirectTo={listHref}
          initiativeLink={initiativeLink}
          defaultOpen={defaultOpenCreate}
        />
      ) : null}

      {officer ? (
        <nav aria-label="Whose actions" className="ps-workspace-nav">
          <div className="ps-tabs m-0">
            <WhoTab
              href={buildActionsHref({ who: "me", q, initiative: initiativeId })}
              active={who === "me"}
            >
              My actions
            </WhoTab>
            <WhoTab
              href={buildActionsHref({ who: "all", q, initiative: initiativeId })}
              active={who === "all"}
            >
              Everyone
            </WhoTab>
          </div>
        </nav>
      ) : null}

      <UrlSyncedSearchInput
        placeholder="Search actions…"
        wrapClassName="w-full"
        aria-label="Search actions"
      />

      {items.length === 0 ? (
        <EmptyStateV2
          icon="✓"
          title={q ? "No matches" : "No actions here"}
          body={
            q
              ? "Try another search."
              : canCreate
                ? initiativeId
                  ? "Add the first action for this initiative above."
                  : "Use Add action above to create one."
                : "Nothing assigned to you yet."
          }
        />
      ) : (
        <ActionTrackerList items={items} nowISO={now.toISOString()} deletableIds={deletableIds} />
      )}
    </div>
  );
}
