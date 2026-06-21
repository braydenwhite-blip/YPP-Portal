import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getWeeklyOperationalDigestForViewer } from "@/lib/people-strategy/operational-digest-queries";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";
import { deriveOperationsSummary } from "@/lib/people-strategy/operations-summary";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import { loadPeopleStrategyAttention } from "@/lib/people-strategy/needs-attention-queries";
import type { AttentionItem } from "@/lib/people-strategy/needs-attention";
import { NeedsAttentionList } from "@/components/people-strategy/needs-attention-list";
import { StatCard } from "@/components/people-strategy/stat-card";
import {
  OperationsEmptyState,
  OperationsItemList,
  OperationsTimelineList,
} from "@/components/people-strategy/operations-item-card";
import {
  AreaHealthGrid,
  CommandCenterHero,
  CommandCenterSection,
  EntityHealthList,
} from "@/components/people-strategy/command-center-os";
import { StrategicWorkspaceNav } from "@/components/people-strategy/strategic-workspace-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview · Operations" };

/**
 * Command Center — the main 360 view. It answers one question: what matters
 * right now? Top snapshot, then Needs Attention, This Week, Recently Decided,
 * and the top strategic initiatives — all rendered from the ONE shared
 * operations summary (`operations-summary.ts`) with the ONE shared card, so the
 * Command Center, Weekly Execution OS, and Initiatives dashboard never disagree
 * about what "overdue", "loose end", or "at risk" means.
 *
 * Double-gated like the Operations Hub (the tracker reads + the hub flag) and
 * officer-guarded; a scoped officer only ever sees the actions their visibility
 * allows.
 */
export default async function CommandCenterOsPage() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const showStrategic = isStrategicInitiativesEnabled();
  // The People Strategy attention queue (mentors, kickoffs, check-ins,
  // provisional decisions, escalations) is CPO/Board/SUPER_ADMIN data — only the
  // Leadership/Board tier sees it; scoped officers keep the action-only view.
  const showPeopleAttention = isLeadershipOrBoard(viewer);
  const [digest, initiatives, peopleAttention] = await Promise.all([
    getWeeklyOperationalDigestForViewer(viewer, { now }),
    showStrategic
      ? getStrategicInitiativesOverview(viewer, { now }).catch(() => [])
      : Promise.resolve([]),
    showPeopleAttention
      ? loadPeopleStrategyAttention(now).catch(() => [] as AttentionItem[])
      : Promise.resolve([] as AttentionItem[]),
  ]);

  const summary = deriveOperationsSummary({ digest, initiatives, now });
  const snap = summary.snapshot;
  const consideredCount =
    digest.counts.overdueActions + digest.counts.dueSoonActions + digest.counts.recentlyCompletedActions;

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <div className="ps-workspace-header">
        <CommandCenterHero
          windowStartISO={digest.window.start.toISOString()}
          generatedAtISO={digest.generatedAt.toISOString()}
          consideredCount={consideredCount}
        />
        <StrategicWorkspaceNav current="command-center" showStrategic={showStrategic} />
      </div>

      {/* Top snapshot — the executive read in one strip. */}
      <section style={{ marginTop: 18 }}>
        <CommandCenterSection title="Top snapshot" hint="What matters right now">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Open actions" value={snap.openActions} icon="layers" tone="accent" href="/actions/all" />
            <StatCard label="Overdue" value={snap.overdueActions} icon="alert" tone={snap.overdueActions > 0 ? "danger" : "default"} href="/actions/all?status=OVERDUE" />
            <StatCard label="Blocked" value={snap.blockedActions} icon="flag" tone={snap.blockedActions > 0 ? "warning" : "default"} href="/actions/all?status=BLOCKED" />
            <StatCard label="Due this week" value={snap.dueThisWeek} icon="calendar" href="/actions/all?preset=due_soon" />
            <StatCard label="Loose ends" value={snap.looseEnds} icon="inbox" tone={snap.looseEnds > 0 ? "warning" : "default"} href="/operations/weekly-execution" />
            <StatCard label="Communications" value={snap.communicationsNeeded} icon="users" tone={snap.communicationsNeeded > 0 ? "warning" : "default"} href="/operations/weekly-execution" />
            {showStrategic ? (
              <StatCard label="Initiatives at risk" value={snap.initiativesAtRisk} icon="target" tone={snap.initiativesAtRisk > 0 ? "warning" : "default"} href="/operations/initiatives" />
            ) : null}
          </div>
        </CommandCenterSection>
      </section>

      <div className="ps-stack" style={{ marginTop: 26, display: "grid", gap: 26 }}>
        <CommandCenterSection
          title="Needs attention"
          hint="Overdue, blocked, ownerless, open follow-ups, at-risk initiatives"
        >
          <OperationsItemList
            items={summary.needsAttention}
            empty={
              <OperationsEmptyState title="Nothing needs leadership attention right now.">
                No overdue or blocked actions, no open follow-ups, and no initiatives at risk. Open Weekly
                Execution to plan the week, or review the initiatives below.
              </OperationsEmptyState>
            }
          />
        </CommandCenterSection>

        {showPeopleAttention ? (
          <CommandCenterSection
            title="People needs attention"
            hint="Missing mentors, kickoffs, check-ins, provisional decisions, escalations"
          >
            <NeedsAttentionList
              items={peopleAttention}
              limit={12}
              emptyHint="No people-strategy items need attention right now — mentors are assigned, kickoffs and check-ins are current, and nothing is escalated."
            />
          </CommandCenterSection>
        ) : null}

        <div
          className="command-center-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <CommandCenterSection title="This week" hint="Due soon, meetings, milestones">
            <OperationsItemList
              items={summary.thisWeek}
              empty={
                <OperationsEmptyState>
                  Nothing is due and no meetings are scheduled this week. A quiet week is a good week
                  to move an initiative forward.
                </OperationsEmptyState>
              }
            />
          </CommandCenterSection>

          <CommandCenterSection title="Recently decided" hint="Momentum, not just problems">
            <OperationsItemList
              items={summary.recentlyDecided}
              empty={
                <OperationsEmptyState>
                  Decisions, completed actions, and meeting outputs will show here as the week
                  progresses.
                </OperationsEmptyState>
              }
            />
          </CommandCenterSection>
        </div>

        {showStrategic ? (
          <CommandCenterSection
            title="Strategic initiatives"
            hint={
              <Link href="/operations/initiatives" style={{ color: "var(--ypp-purple, #6b21c8)" }}>
                All initiatives →
              </Link>
            }
          >
            <OperationsItemList
              items={summary.initiativesNeedingAttention}
              limit={5}
              columns
              empty={
                <OperationsEmptyState title="No initiatives need leadership attention right now.">
                  Every initiative has an owner, a next step, and no overdue or blocked work. See the
                  full portfolio under Initiatives.
                </OperationsEmptyState>
              }
            />
          </CommandCenterSection>
        ) : null}

        <div
          className="command-center-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <CommandCenterSection title="Operational health by area">
            <AreaHealthGrid rows={digest.areaHealth} />
          </CommandCenterSection>

          <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
            <CommandCenterSection title="Critical & drifting" hint="Worst first">
              <EntityHealthList
                entities={[...digest.criticalEntities, ...digest.staleEntities].slice(0, 6)}
                emptyHint="No part of YPP is critical or drifting right now."
              />
            </CommandCenterSection>

            <CommandCenterSection title="Recent timeline" hint="Actions, meetings, decisions">
              <OperationsTimelineList
                items={summary.recentTimeline}
                empty={
                  <OperationsEmptyState>
                    Recent actions, meetings, and decisions will appear here as work happens.
                  </OperationsEmptyState>
                }
              />
            </CommandCenterSection>
          </div>
        </div>
      </div>
    </div>
  );
}
