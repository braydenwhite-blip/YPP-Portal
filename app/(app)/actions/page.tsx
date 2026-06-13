import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  getMyActionItems,
  listActionAssignableUsers,
  listActionDepartments,
  listVisibleActionItems,
} from "@/lib/people-strategy/action-queries";
import {
  canCreateAction,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { sortByDeadline } from "@/lib/people-strategy/my-actions-selectors";
import { filterActionsByInitiative } from "@/lib/people-strategy/strategic-initiative-summary";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { initiativePrimaryGoalCategory } from "@/lib/people-strategy/strategic-recommendations";
import {
  ActionTrackerDashboard,
  filterActionsByPerson,
} from "@/components/people-strategy/action-tracker-dashboard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Actions · Action Tracker" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ActionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isActionTrackerEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  const params = (await searchParams) ?? {};
  const qParam = firstParam(params.q)?.trim().toLowerCase() ?? "";
  const viewParam = firstParam(params.view);
  const whoParam = firstParam(params.who) ?? (viewParam === "all" ? "all" : undefined);

  const initiativeParam = firstParam(params.initiative)?.trim() ?? "";
  const initiativeDef = initiativeParam ? getInitiativeDef(initiativeParam) : null;

  const officer = isOfficerTier(viewer);
  const canCreate = canCreateAction(viewer);
  const who = officer ? whoParam ?? "all" : "me";

  const [myItems, allItems, assignableUsers, departments] = await Promise.all([
      getMyActionItems(viewer.id, viewer),
      officer ? listVisibleActionItems(viewer) : Promise.resolve([]),
      canCreate ? listActionAssignableUsers() : Promise.resolve([]),
      canCreate ? listActionDepartments() : Promise.resolve([]),
    ]);

  const now = new Date();

  let items =
    who === "me"
      ? myItems
      : who === "all"
        ? allItems
        : filterActionsByPerson(allItems, who);

  items = sortByDeadline(items);
  items = items.filter((item) => item.status !== "DROPPED");

  if (initiativeDef) {
    items = filterActionsByInitiative(items, initiativeDef.id);
  }

  if (qParam) {
    items = items.filter((item) => item.title.toLowerCase().includes(qParam));
  }

  let whoLabel = "you";
  if (who === "all") {
    whoLabel = "everyone";
  } else if (who !== "me") {
    const person = assignableUsers.find((u) => u.id === who);
    whoLabel = person?.name ?? person?.email ?? "this person";
  }

  const lastUpdated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <ActionCommandBar
        eyebrow={initiativeDef ? "Initiative plan" : "Action Tracker"}
        title={initiativeDef ? initiativeDef.title : "Actions"}
        subtitle={
          initiativeDef
            ? "Work items linked to this initiative — sorted by deadline."
            : officer
              ? "Every open action item — filter by person or initiative."
              : "Everything you lead, are executing, or owe input on — sorted by deadline."
        }
        meta={`${items.length} in view · ${whoLabel}${initiativeDef ? "" : ` · updated ${lastUpdated}`}`}
        actions={
          initiativeDef ? (
            <Link
              href={`/operations/initiatives/${initiativeDef.id}`}
              className="button outline small"
            >
              ← Initiative plan
            </Link>
          ) : null
        }
      />

      <ActionTrackerDashboard
        items={items}
        now={now}
        officer={officer}
        canCreate={canCreate}
        assignableUsers={assignableUsers}
        departments={departments}
        currentUserId={viewer.id}
        viewer={viewer}
        who={who}
        q={qParam}
        initiativeId={initiativeDef?.id}
        initiativeLink={
          initiativeDef
            ? {
                id: initiativeDef.id,
                goalCategory: initiativePrimaryGoalCategory(initiativeDef),
              }
            : undefined
        }
      />
    </div>
  );
}
