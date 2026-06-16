import { notFound } from "next/navigation";

import {
  InitiativeHubByOwner,
  InitiativeHubList,
} from "@/components/people-strategy/initiative-hub";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { InitiativeUnblockQueue } from "@/components/queue";
import {
  ButtonLink,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  StatCardV2,
  type StatusTone,
} from "@/components/ui-v2";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import {
  PrimaryFocusCard,
  SimpleListCard,
  SimpleRow,
  SimpleSurface,
  type SimpleAction,
} from "@/components/command-center/simple";
import { requireOfficer } from "@/lib/authorization";
import { queueItemFromInitiativeCard, rankQueueItems } from "@/lib/queue";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import {
  deriveInitiativeAttention,
  nextOpenMilestone,
  primaryNextStep,
} from "@/lib/people-strategy/strategic-initiative-attention";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";
import {
  selectUpcomingMilestones,
  type InitiativeSummary,
} from "@/lib/people-strategy/strategic-initiative-summary";
import { isTerminalStatus } from "@/lib/people-strategy/strategic-initiatives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Initiatives · Work" };

const VIEWS = ["active", "attention", "owner", "completed", "all"] as const;
type View = (typeof VIEWS)[number];

function parseView(value: string | undefined): View {
  return VIEWS.includes(value as View) ? (value as View) : "active";
}

const HEALTH_TONE: Record<string, StatusTone> = {
  healthy: "success",
  drifting: "info",
  at_risk: "warning",
  critical: "danger",
  completed: "neutral",
  archived: "neutral",
};

/** One initiative as a calm row: name · owner · next step · stage · milestone. */
function InitiativeRowSimple({ initiative }: { initiative: InitiativeSummary }) {
  const next = nextOpenMilestone(initiative);
  return (
    <SimpleRow
      href={initiative.href}
      icon="flag"
      name={initiative.title}
      what={initiative.owner ?? "Unassigned"}
      related={primaryNextStep(initiative)}
      status={{ label: initiative.statusLabel, tone: HEALTH_TONE[initiative.health.level] ?? "neutral" }}
      meta={
        next?.targetDateISO
          ? `${next.behindSchedule ? "Milestone overdue" : "Milestone"} ${formatMonthDay(new Date(next.targetDateISO))}`
          : null
      }
    />
  );
}

/** Initiatives hub — the plan. Open one to see its milestones, actions, and meetings. */
export default async function StrategicInitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const sessionUser = await requireOfficer().catch(() => null);
  if (!sessionUser) notFound();

  const viewer = {
    id: sessionUser.id,
    roles: sessionUser.roles,
    primaryRole: sessionUser.primaryRole,
    adminSubtypes: sessionUser.adminSubtypes,
  };

  const view = parseView((await searchParams).view);
  const now = new Date();
  const initiatives = await getStrategicInitiativesOverview(viewer, { now });

  // Derive the executive reads once.
  const active = initiatives.filter((i) => !isTerminalStatus(i.status));
  const completed = initiatives.filter((i) => isTerminalStatus(i.status));
  const needingAttention = initiatives.filter(
    (i) => deriveInitiativeAttention(i, now).length > 0
  );
  const blocked = initiatives.filter((i) =>
    deriveInitiativeAttention(i, now).some((r) => r.key === "blocked")
  );
  const dueSoonMilestones = selectUpcomingMilestones(initiatives, now, 14);
  const recentlyActive = active.filter((i) => i.momentum.recentlyCompleted > 0);

  // Initiative Cleanup Queue — drifting initiatives folded into the canonical
  // loop model (same mapping the Work Hub uses), so this surface leads with the
  // next operational move instead of a wall of progress bars.
  const healthTone: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
    healthy: "success",
    drifting: "info",
    at_risk: "warning",
    critical: "danger",
    completed: "neutral",
    archived: "neutral",
  };
  const cleanupItems = rankQueueItems(
    active
      .map((s) =>
        queueItemFromInitiativeCard({
          id: s.id,
          title: s.title,
          statusLabel: s.statusLabel,
          healthLabel: s.health.label,
          healthTone: healthTone[s.health.level] ?? "neutral",
          healthReasons: s.healthExplanation.reasons.slice(0, 3),
          owner: s.ownership.ownerName,
          openActions: s.counts.openActions,
          overdueActions: s.counts.overdueActions,
          progressLabel: `${s.progress.percent}% of milestones`,
          nextStep: s.recommendations[0]?.title ?? null,
          targetDateISO: s.targetDateISO,
          pastTargetDate: s.pastTargetDate,
          flagship: s.priority === "flagship" || s.priority === "high",
          href: s.href,
        })
      )
      .filter((item): item is NonNullable<typeof item> => item !== null),
    now
  );

  const base = "/operations/initiatives";
  const href = (v: View) => (v === "active" ? base : `${base}?view=${v}`);

  // The one obvious lead: the initiative most at risk, else the next one to move.
  const focusInit = blocked[0] ?? needingAttention[0] ?? active[0] ?? null;
  const focus = focusInit ? (
    <PrimaryFocusCard
      eyebrow={
        blocked.length > 0
          ? "Most at risk"
          : needingAttention.length > 0
            ? "Needs attention"
            : "Focus initiative"
      }
      title={focusInit.title}
      reason={`${focusInit.owner ?? "No owner"} · ${focusInit.statusLabel}. Next: ${primaryNextStep(
        focusInit
      )}`}
      icon="flag"
      ctaLabel="Open initiative"
      ctaHref={focusInit.href}
    />
  ) : (
    <PrimaryFocusCard
      eyebrow="Initiatives"
      title="No active initiatives."
      reason="Completed and archived initiatives live under the Completed view."
      icon="check"
      tone="success"
      ctaLabel="View all"
      ctaHref={href("all")}
    />
  );

  const calm = (
    <SimpleListCard
      title="Active initiatives"
      action={
        needingAttention.length > 0 ? (
          <a
            href={href("attention")}
            className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
          >
            {needingAttention.length} need attention →
          </a>
        ) : undefined
      }
    >
      {active.slice(0, 5).map((i) => (
        <InitiativeRowSimple key={i.id} initiative={i} />
      ))}
    </SimpleListCard>
  );

  const strip: SimpleAction[] = [
    {
      label: "Needs attention",
      href: href("attention"),
      icon: "bolt",
      primary: needingAttention.length > 0,
    },
    { label: "By owner", href: href("owner"), icon: "users" },
    { label: "All initiatives", href: href("all"), icon: "layers" },
  ];

  return (
    <SimpleSurface
      maxWidth={1040}
      header={
        <div className="flex flex-col gap-4">
          <PageHeaderV2
            eyebrow="Work"
            backHref="/work?view=initiatives"
            backLabel="Work"
            title="Initiatives"
            subtitle="What we’re moving forward. Open one to see its next move."
            actions={<CommandModeToggle />}
          />
          <ActionTrackerTabsV2 active="initiatives" />
        </div>
      }
      focus={focus}
      calm={calm}
      actions={strip}
      browseLabel="Browse all initiatives"
      browseHint="Full tracker — metrics, filters, the cleanup queue, and every view."
    >
      <div className="flex flex-col gap-6">
        {cleanupItems.length > 0 ? <InitiativeUnblockQueue items={cleanupItems} /> : null}

        {/* Executive header — calm by default, loud only when work demands it. */}
        <div className="flex flex-wrap gap-3">
          <StatCardV2 label="Active initiatives" value={active.length} href={href("active")} />
          <StatCardV2
            label="Due soon"
            value={dueSoonMilestones.length}
            detail="milestones ≤ 14 days"
            href={href("attention")}
            tone={dueSoonMilestones.length > 0 ? "attention" : "default"}
          />
          <StatCardV2
            label="Blocked"
            value={blocked.length}
            detail={blocked.length > 0 ? "need a path forward" : "none"}
            href={href("attention")}
            tone={blocked.length > 0 ? "attention" : "default"}
          />
          <StatCardV2
            label="Recently active"
            value={recentlyActive.length}
            detail="wins in last 14 days"
            href={href("all")}
          />
        </div>

        <FilterBar aria-label="Initiative views">
          <FilterChipLink href={href("active")} active={view === "active"} count={active.length}>
            Active
          </FilterChipLink>
          <FilterChipLink href={href("attention")} active={view === "attention"} count={needingAttention.length}>
            Needs attention
          </FilterChipLink>
          <FilterChipLink href={href("owner")} active={view === "owner"}>
            By owner
          </FilterChipLink>
          <FilterChipLink href={href("completed")} active={view === "completed"} count={completed.length}>
            Completed
          </FilterChipLink>
          <FilterChipLink href={href("all")} active={view === "all"} count={initiatives.length}>
            All
          </FilterChipLink>
        </FilterBar>

        {view === "owner" ? (
          <InitiativeHubByOwner initiatives={initiatives} now={now} />
        ) : view === "active" ? (
          <InitiativeHubList
            initiatives={active}
            now={now}
            empty={{
              title: "No active initiatives",
              body: "Completed and archived initiatives live under the Completed tab.",
            }}
          />
        ) : view === "attention" ? (
          <InitiativeHubList
            initiatives={needingAttention}
            now={now}
            empty={{
              title: "Nothing needs attention",
              body: "Every initiative has a clear owner, an open next action, and no overdue or blocked work. 🎉",
            }}
          />
        ) : view === "completed" ? (
          <InitiativeHubList
            initiatives={completed}
            now={now}
            empty={{
              title: "No completed initiatives yet",
              body: "Initiatives appear here once all their work is done.",
            }}
          />
        ) : (
          <InitiativeHubList
            initiatives={initiatives}
            now={now}
            empty={{
              title: "No initiatives yet",
              body: "Initiatives are the priorities your actions and meetings ladder up to.",
            }}
          />
        )}
      </div>
    </SimpleSurface>
  );
}
