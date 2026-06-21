import Link from "next/link";
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
import { ButtonLink, PageHeaderV2, StatCardV2, type StatusTone } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { MyActionsBoard } from "@/components/people-strategy/my-actions-board";
import { getUserTitle } from "@/lib/user-title";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import {
  EmptySimpleState,
  PrimaryFocusCard,
  SimpleListCard,
  SimpleRow,
  SimpleSurface,
  type SimpleAction,
} from "@/components/command-center/simple";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import {
  getMyActionItems,
  listActionAssignableUsers,
  listActionDepartments,
  listVisibleActionItems,
  type ActionItemWithRelations,
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

const STATUS_TONE: Record<string, StatusTone> = {
  OVERDUE: "danger",
  BLOCKED: "danger",
  IN_PROGRESS: "info",
  NOT_STARTED: "neutral",
  COMPLETE: "success",
  DROPPED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  COMPLETE: "Done",
  DROPPED: "Dropped",
};

function ownerName(item: ActionItemWithRelations): string {
  return item.lead?.name ?? item.lead?.email ?? "Unassigned";
}

/** Map one action to a calm row: what · who · status · when. */
function ActionRowSimple({ item, now }: { item: ActionItemWithRelations; now: Date }) {
  const status = effectiveStatus(item, now);
  const due =
    status === "OVERDUE" ? "Overdue" : `Due ${formatMonthDay(item.deadlineStart)}`;
  return (
    <SimpleRow
      href={`/actions/${item.id}`}
      icon="bolt"
      name={item.title}
      what={ownerName(item)}
      status={{ label: STATUS_LABEL[status] ?? status, tone: STATUS_TONE[status] ?? "neutral" }}
      meta={due}
    />
  );
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
  const createParam = firstParam(params.create) === "1";
  if (createParam) redirect("/actions/new");

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

  const openItems = items.filter(
    (item) => item.status !== "COMPLETE" && item.status !== "DROPPED"
  );
  const topSignal = attentionSignals[0] ?? null;

  // The one obvious lead: the most urgent thing if something's stuck, else the
  // next action by deadline, else an all-clear.
  const createHref = initiativeDef
    ? `/actions/new?initiativeId=${encodeURIComponent(initiativeDef.id)}`
    : "/actions/new";

  const focus = topSignal ? (
    <PrimaryFocusCard
      eyebrow={leadershipView ? "Most urgent" : "Start here"}
      title={topSignal.title}
      reason={`${topSignal.reason}. Next: ${topSignal.nextStep}${
        topSignal.ownerName ? ` · ${topSignal.ownerName}` : ""
      }`}
      icon="bolt"
      ctaLabel="Open action"
      ctaHref={topSignal.href}
    />
  ) : openItems.length > 0 ? (
    <PrimaryFocusCard
      eyebrow="Focus action"
      title={openItems[0].title}
      reason={`${STATUS_LABEL[effectiveStatus(openItems[0], now)] ?? "Open"} · ${ownerName(
        openItems[0]
      )} · due ${formatMonthDay(openItems[0].deadlineStart)}`}
      icon="target"
      ctaLabel="Open action"
      ctaHref={`/actions/${openItems[0].id}`}
    />
  ) : (
    <PrimaryFocusCard
      eyebrow="Actions"
      title="Nothing needs doing right now."
      reason="No open actions in this view. Add one, or switch to another queue."
      icon="check"
      tone="success"
      ctaLabel={canCreate ? "Add an action" : "Open My Queue"}
      ctaHref={canCreate ? createHref : "/work/queue?queue=my"}
    />
  );

  const calm = (
    <SimpleListCard
      title={leadershipView ? "Team's open actions" : "Your open actions"}
      action={
        <Link
          href="/actions/all"
          className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
        >
          View all →
        </Link>
      }
      empty={
        openItems.length === 0 ? (
          <EmptySimpleState>You&apos;re all caught up — nothing open in this view.</EmptySimpleState>
        ) : undefined
      }
    >
      {openItems.slice(0, 5).map((item) => (
        <ActionRowSimple key={item.id} item={item} now={now} />
      ))}
    </SimpleListCard>
  );

  const strip: SimpleAction[] = [
    ...(canCreate
      ? [{ label: "Add action", href: createHref, icon: "bolt", primary: true } as SimpleAction]
      : []),
    {
      label: leadershipView ? "Run leadership queue" : "Clear my queue",
      href: leadershipView ? "/work/queue?queue=leadership" : "/work/queue?queue=my",
      icon: "list",
    },
    { label: "All actions", href: "/actions/all", icon: "layers" },
  ];

  // YPP Portal reskin: the mockup's stat-filter cards for the personal
  // "My Actions" view, with live counts derived from the loaded action items.
  // TODO(reskin): once /actions gains per-bucket filter params (?flag=overdue
  // etc.), point each card at its own filtered slice instead of the queue/all.
  const involvesRole = (item: ActionItemWithRelations, role: string) =>
    (item.assignments ?? []).some((a) => a.role === role && a.user?.id === viewer.id);
  const overdueCount = myItems.filter((i) => effectiveStatus(i, now) === "OVERDUE").length;
  const blockedCount = myItems.filter((i) => effectiveStatus(i, now) === "BLOCKED").length;
  const waitingCount = myItems.filter(
    (i) => i.status !== "COMPLETE" && involvesRole(i, "INPUT")
  ).length;
  const delegatedCount = myItems.filter(
    (i) =>
      i.leadId === viewer.id && i.status !== "COMPLETE" && !involvesRole(i, "EXECUTING")
  ).length;
  const completedCount = myItems.filter((i) => i.status === "COMPLETE").length;

  const statFilters = leadershipView ? null : (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCardV2
        label="Overdue"
        value={overdueCount}
        accent="danger"
        detail={overdueCount ? "Past deadline" : "All clear"}
        href="/work/queue?queue=my"
      />
      <StatCardV2
        label="Blocked"
        value={blockedCount}
        accent="danger"
        detail={blockedCount ? "Waiting on others" : "None"}
        href="/work/queue?queue=my"
      />
      <StatCardV2
        label="Waiting on you"
        value={waitingCount}
        accent="warning"
        detail={waitingCount ? "Input requested" : "None"}
        href="/actions?who=me"
      />
      <StatCardV2
        label="Delegated"
        value={delegatedCount}
        accent="brand"
        detail="You own · others run"
        href={officer ? "/actions/all" : "/actions?who=me"}
      />
      <StatCardV2
        label="Completed"
        value={completedCount}
        accent="success"
        detail="Recently closed"
        href="/actions?who=me"
      />
    </div>
  );

  const focusWithStats = (
    <div className="flex flex-col gap-4">
      {focus}
      {statFilters}
    </div>
  );

  // Personal "My Actions" hero — the YPP Portal redesign: stat-filter cards and
  // executing / delegated / waiting-on-you / deadlines lanes, all on real data.
  // The leadership cross-team view (who=all) keeps the full tracker below.
  if (!leadershipView) {
    return (
      <div className={skin.portalSkin}>
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
      </div>
    );
  }

  return (
    <div className={skin.portalSkin}>
    <SimpleSurface
      maxWidth={820}
      header={
        <div className="flex flex-col gap-4">
          <PageHeaderV2
            eyebrow="Work"
            backHref="/work"
            backLabel="Work"
            title={initiativeDef ? initiativeDef.title : leadershipView ? "All actions" : "Actions"}
            subtitle={
              initiativeDef
                ? "Actions linked to this initiative."
                : leadershipView
                  ? "What needs doing across the team."
                  : "What needs doing."
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {initiativeDef ? (
                  <ButtonLink
                    href={`/operations/initiatives/${initiativeDef.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    Initiative plan
                  </ButtonLink>
                ) : null}
                <CommandModeToggle />
              </div>
            }
          />
          <ActionTrackerTabsV2 active="my" />
        </div>
      }
      focus={focusWithStats}
      calm={calm}
      actions={strip}
      browseLabel="Browse all actions"
      browseHint="The full tracker, attention queue, and data-quality sweep."
    >
      <div className="flex flex-col gap-5">
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
      </div>
    </SimpleSurface>
    </div>
  );
}
