import { notFound, redirect } from "next/navigation";

import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
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
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
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
export const metadata = { title: "My actions · Work" };

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
  const createOpen = firstParam(params.create) === "1";

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

  // Unified, action-shaped Needs Attention — wired straight into the work hub.
  // A member sees their personal triage feed; an officer browsing everyone's
  // queue sees the leadership "what's stuck" feed plus the data-quality sweep.
  const leadershipView = officer && who !== "me";
  const attentionSignals = leadershipView
    ? leadershipActionAttention(items, now)
    : personalActionAttention(myItems, viewer.id, now);
  const dataQualityFlags = who === "all" ? actionDataQuality(allItems, now) : [];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <PageHeaderV2
        eyebrow="Work"
        backHref="/work"
        backLabel="Work"
        title={
          initiativeDef ? initiativeDef.title : leadershipView ? "All actions" : "My actions"
        }
        subtitle={
          initiativeDef
            ? "Actions linked to this initiative."
            : leadershipView
              ? "Everything stuck, owned, and in motion across the team."
              : officer
                ? "Add an action below, or switch to everyone’s queue."
                : "Everything you lead, execute, or owe input on."
        }
        actions={
          initiativeDef ? (
            <ButtonLink
              href={`/operations/initiatives/${initiativeDef.id}`}
              variant="secondary"
              size="sm"
            >
              Initiative plan
            </ButtonLink>
          ) : (
            <ButtonLink href="/actions/all" variant="ghost" size="sm">
              All actions →
            </ButtonLink>
          )
        }
      />

      <ActionTrackerTabsV2 active="my" />

      {/* Queue mode — clear loops one at a time instead of scanning a table. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-brand-200 bg-gradient-to-br from-brand-50 to-surface p-4 shadow-card">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-700">
            Queue mode
          </p>
          <p className="m-0 text-[15px] font-bold text-ink">
            {leadershipView ? "Run the leadership queue" : "Clear my queue"}
          </p>
          <p className="m-0 text-[12.5px] text-ink-muted">
            Triage one loop at a time — Resolve, Delegate, Discuss, or Defer.
          </p>
        </div>
        <ButtonLink
          href={leadershipView ? "/work/queue?queue=leadership" : "/work/queue?queue=my"}
          variant="primary"
          size="md"
        >
          {leadershipView ? "Run leadership queue →" : "Clear my queue →"}
        </ButtonLink>
      </div>

      <p className="m-0 text-[12.5px] text-ink-muted">
        {items.length} {items.length === 1 ? "action" : "actions"}
        {qParam ? ` · “${qParam}”` : ""}
      </p>

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

      {dataQualityFlags.length > 0 ? (
        <ActionDataQualityPanel flags={dataQualityFlags} />
      ) : null}

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
        defaultOpenCreate={createOpen}
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
    </div>
  );
}
