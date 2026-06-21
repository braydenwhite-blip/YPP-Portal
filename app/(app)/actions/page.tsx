import { notFound, redirect } from "next/navigation";

import {
  ActionTrackerDashboard,
  filterActionsByPerson,
} from "@/components/people-strategy/action-tracker-dashboard";
import {
  ActionAttentionPanel,
  ActionDataQualityPanel,
} from "@/components/people-strategy/action-attention-panel";
import {
  actionDataQuality,
  leadershipActionAttention,
  personalActionAttention,
} from "@/lib/people-strategy/action-attention";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { MyActionsBoard } from "@/components/people-strategy/my-actions-board";
import { AllActionsBoard } from "@/components/people-strategy/all-actions-board";
import { getUserTitle } from "@/lib/user-title";
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

export const dynamic = "force-dynamic";
export const metadata = { title: "Actions · Work" };

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
  const whoParam = firstParam(params.who);
  if (firstParam(params.create) === "1") redirect("/actions/new");

  const initiativeParam = firstParam(params.initiative)?.trim() ?? "";
  const initiativeDef = initiativeParam ? getInitiativeDef(initiativeParam) : null;

  const officer = isOfficerTier(viewer);
  const canCreate = canCreateAction(viewer);
  const who = officer ? whoParam ?? "me" : "me";

  const [myItems, allItems, assignableUsers, departments] = await Promise.all([
    getMyActionItems(viewer.id, viewer),
    officer ? listVisibleActionItems(viewer) : Promise.resolve([]),
    canCreate ? listActionAssignableUsers() : Promise.resolve([]),
    canCreate ? listActionDepartments() : Promise.resolve([]),
  ]);

  const now = new Date();

  let items =
    who === "me" ? myItems : who === "all" ? allItems : filterActionsByPerson(allItems, who);
  items = sortByDeadline(items).filter((item) => item.status !== "DROPPED");
  if (initiativeDef) items = filterActionsByInitiative(items, initiativeDef.id);
  if (qParam) items = items.filter((item) => item.title.toLowerCase().includes(qParam));

  // Unified, action-shaped Needs Attention. A member sees their personal triage
  // feed; an officer browsing everyone's queue sees the leadership "what's stuck"
  // feed plus the data-quality sweep.
  const leadershipView = officer && who !== "me";
  const attentionSignals = leadershipView
    ? leadershipActionAttention(items, now)
    : personalActionAttention(myItems, viewer.id, now);
  const dataQualityFlags = who === "all" ? actionDataQuality(allItems, now) : [];

  const createHref = initiativeDef
    ? `/actions/new?initiativeId=${encodeURIComponent(initiativeDef.id)}`
    : "/actions/new";

  // The YPP Portal redesign hero (My Actions personal lanes, or the All Actions
  // leadership lane board), then the full tracker inline below it.
  const board = leadershipView ? (
    <AllActionsBoard
      items={allItems}
      now={now}
      activeLane={firstParam(params.lane)}
      createHref={createHref}
    />
  ) : (
    <MyActionsBoard
      items={myItems}
      userId={viewer.id}
      now={now}
      userName={session.user.name ?? "You"}
      userTitle={getUserTitle({
        primaryRole: viewer.primaryRole,
        adminSubtypes: viewer.adminSubtypes,
      })}
    />
  );

  return (
    <div className={skin.portalSkin}>
      {board}

      {/* Full tracker — combined inline so nothing is hidden: the needs-attention
          queue, the data-quality sweep, and the complete create / filter / table
          surface (export, batch-assign, board & table views). */}
      <section className="mx-auto mt-9 flex w-full max-w-[1180px] flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line-card" />
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            Full tracker
          </span>
          <span className="h-px flex-1 bg-line-card" />
        </div>

        <ActionAttentionPanel
          title={leadershipView ? "What's stuck" : "Needs your attention"}
          subtitle={
            leadershipView
              ? "Overdue, blocked, ownerless, escalated, and stale work across the team."
              : "Overdue, blocked, due soon, and waiting on you — handle these first."
          }
          signals={attentionSignals}
          emptyHint={
            leadershipView
              ? "Nothing is stuck right now. ✓"
              : "You're all caught up — nothing needs you right now. ✓"
          }
        />

        {dataQualityFlags.length > 0 ? <ActionDataQualityPanel flags={dataQualityFlags} /> : null}

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
          defaultOpenCreate={false}
          showQuickCreate={false}
          showAttentionBoard={false}
          initiativeLink={
            initiativeDef
              ? {
                  id: initiativeDef.id,
                  goalCategory: initiativePrimaryGoalCategory(initiativeDef),
                }
              : undefined
          }
        />
      </section>
    </div>
  );
}
