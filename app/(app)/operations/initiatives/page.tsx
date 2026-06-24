import { notFound } from "next/navigation";

import { InitiativesHub } from "@/components/people-strategy/initiatives-hub";
import { InitiativesHubAnalytics } from "@/components/people-strategy/initiatives-hub-analytics";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { InitiativeUnblockQueue } from "@/components/queue";
import { FilterBar, FilterChipLink, PageHeaderV2, StatCardV2 } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { requireOfficer } from "@/lib/authorization";
import { queueItemFromInitiativeCard, rankQueueItems } from "@/lib/queue";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { deriveInitiativeAttention } from "@/lib/people-strategy/strategic-initiative-attention";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";
import {
  selectUpcomingMilestones,
  type InitiativeSummary,
} from "@/lib/people-strategy/strategic-initiative-summary";
import {
  summarizeInitiativeAreas,
  summarizeInitiativeHealth,
} from "@/lib/people-strategy/initiatives-hub-grouping";
import { isTerminalStatus } from "@/lib/people-strategy/strategic-initiatives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Initiatives · Work" };

const VIEWS = ["active", "attention", "owner", "completed", "all"] as const;
type View = (typeof VIEWS)[number];

function parseView(value: string | undefined): View {
  return VIEWS.includes(value as View) ? (value as View) : "active";
}

const EMPTY: Record<View, { title: string; body: string }> = {
  active: {
    title: "No active initiatives",
    body: "Completed and archived initiatives live under the Completed tab.",
  },
  attention: {
    title: "Nothing needs attention",
    body: "Every initiative has a clear owner, an open next action, and no overdue or blocked work. 🎉",
  },
  owner: {
    title: "No initiatives yet",
    body: "Initiatives are the priorities your actions and meetings ladder up to.",
  },
  completed: {
    title: "No completed initiatives yet",
    body: "Initiatives appear here once all their work is done.",
  },
  all: {
    title: "No initiatives yet",
    body: "Initiatives are the priorities your actions and meetings ladder up to.",
  },
};

/** Initiatives hub — the plan, in the same shape as the Actions and Meetings hubs. */
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

  // Initiative cleanup queue — drifting initiatives in the canonical loop model.
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

  // The set shown for the active view drives both the analytics and the groups.
  const shown: InitiativeSummary[] =
    view === "attention"
      ? needingAttention
      : view === "completed"
        ? completed
        : view === "active"
          ? active
          : initiatives;
  const groupBy = view === "owner" ? "owner" : "health";
  const breakdown = summarizeInitiativeHealth(shown);
  const bars = summarizeInitiativeAreas(shown);

  return (
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pb-12 pt-4">
        <PageHeaderV2
          eyebrow="Work"
          backHref="/work?view=initiatives"
          backLabel="Work"
          title="Initiatives"
          subtitle="What we’re moving forward. Open one to see its next move."
        />
        <ActionTrackerTabsV2 active="initiatives" />

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

        <InitiativesHubAnalytics breakdown={breakdown} bars={bars} />

        {cleanupItems.length > 0 ? <InitiativeUnblockQueue items={cleanupItems} /> : null}

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

        <InitiativesHub
          initiatives={shown}
          groupBy={groupBy}
          emptyTitle={EMPTY[view].title}
          emptyBody={EMPTY[view].body}
        />
      </div>
    </div>
  );
}
