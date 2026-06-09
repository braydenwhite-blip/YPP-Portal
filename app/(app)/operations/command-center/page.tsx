import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getWeeklyOperationalDigestForViewer } from "@/lib/people-strategy/operational-digest-queries";
import { getStrategicDashboardData } from "@/lib/people-strategy/strategic-initiative-queries";
import { StrategicInitiativesSection } from "@/components/people-strategy/strategic-initiatives";
import {
  ActionUrgencyList,
  AreaHealthGrid,
  CommandCenterAllClear,
  CommandCenterHero,
  CommandCenterSection,
  DecisionFollowThroughCard,
  EmptyCard,
  EntityHealthList,
  LeadershipRhythm,
  MeetingFollowThroughCard,
  NeedsAttentionList,
  OperationalDigestStats,
  RecentlyResolvedList,
} from "@/components/people-strategy/command-center-os";

export const dynamic = "force-dynamic";
export const metadata = { title: "Command Center · Operations" };

/**
 * Leadership Command Center — the page a YPP leader opens every week. It sits
 * ABOVE the Action Tracker + Meetings Tracker and answers, from real digest
 * state: what's urgent, what's stuck, what's due, which areas need attention,
 * what to review first, and which decisions never became execution.
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
  const digest = await getWeeklyOperationalDigestForViewer(viewer, { now });
  // Strategic layer (Phase II) — only loaded when the flag is on, so the
  // existing Command Center is byte-for-byte unchanged when it is off.
  const strategic = isStrategicInitiativesEnabled()
    ? await getStrategicDashboardData(viewer, { now }).catch(() => null)
    : null;
  const consideredCount =
    digest.counts.overdueActions + digest.counts.dueSoonActions + digest.counts.recentlyCompletedActions;

  const allClear =
    digest.recommendedReviewOrder.length === 0 &&
    digest.counts.overdueActions === 0 &&
    digest.counts.criticalEntities === 0 &&
    digest.counts.warningEntities === 0;

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <CommandCenterHero
        windowStartISO={digest.window.start.toISOString()}
        generatedAtISO={digest.generatedAt.toISOString()}
        consideredCount={consideredCount}
      />

      <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
        <Link href="/operations" style={{ color: "var(--muted)" }}>Operations Hub</Link>
        <Link href="/operations/weekly-review" style={{ color: "var(--muted)" }}>Weekly Review</Link>
        {strategic ? (
          <Link href="/operations/initiatives" style={{ color: "var(--muted)" }}>Initiatives</Link>
        ) : null}
        {strategic ? (
          <Link href="/operations/strategic-map" style={{ color: "var(--muted)" }}>Strategic Map</Link>
        ) : null}
        <Link href="/actions/command-center" style={{ color: "var(--muted)" }}>Action Tracker</Link>
        <Link href="/actions/meetings" style={{ color: "var(--muted)" }}>Meetings</Link>
      </nav>

      {/* This Week at YPP */}
      <section style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <CommandCenterSection title="This week at YPP" hint="A quick executive read across the org">
          <OperationalDigestStats counts={digest.counts} />
        </CommandCenterSection>
      </section>

      {/* Strategic Initiatives (Phase II) — the executive read above actions */}
      {strategic ? (
        <section style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
          <CommandCenterSection
            title="Strategic initiatives"
            hint={
              <Link href="/operations/initiatives" style={{ color: "var(--ypp-purple, #6b21c8)" }}>
                Open all {strategic.stats.total} →
              </Link>
            }
          >
            <StrategicInitiativesSection
              needingAttention={strategic.needingAttention}
              fastestMoving={strategic.fastestMoving}
              recentMilestones={strategic.recentMilestones}
              upcomingMilestones={strategic.upcomingMilestones}
              strategicRisks={strategic.strategicRisks}
              leadershipPriorities={strategic.leadershipPriorities}
            />
          </CommandCenterSection>
        </section>
      ) : null}

      <div
        className="command-center-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: 22,
          marginTop: 26,
          alignItems: "start",
        }}
      >
        {/* Left column — what to act on */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
          {allClear ? (
            <CommandCenterAllClear
              upcomingMeetings={digest.upcomingMeetings}
              recentlyCompleted={digest.recentlyCompletedActions}
            />
          ) : (
            <CommandCenterSection
              title="Needs attention"
              hint={`${digest.recommendedReviewOrder.length} ranked`}
            >
              <NeedsAttentionList items={digest.recommendedReviewOrder} />
            </CommandCenterSection>
          )}

          <CommandCenterSection
            title="Meetings needing follow-through"
            hint="Open follow-ups, decisions, or no action yet"
          >
            {digest.meetingsNeedingFollowThrough.length === 0 ? (
              <EmptyCard>Every recent meeting has produced action or has no open follow-ups. 🎉</EmptyCard>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {digest.meetingsNeedingFollowThrough.map((m) => (
                  <MeetingFollowThroughCard key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </CommandCenterSection>

          <CommandCenterSection
            title="Decisions to convert into action"
            hint="Decided recently, not yet owned"
          >
            {digest.decisionsNeedingAction.length === 0 ? (
              <EmptyCard>Every recent decision has a linked action. Decisions are turning into execution. ✅</EmptyCard>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {digest.decisionsNeedingAction.map((d) => (
                  <DecisionFollowThroughCard key={d.id} decision={d} />
                ))}
              </div>
            )}
          </CommandCenterSection>
        </div>

        {/* Right column — the operating picture */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
          <CommandCenterSection title="Leadership rhythm">
            <LeadershipRhythm />
          </CommandCenterSection>

          <CommandCenterSection title="Critical & drifting" hint="Worst first">
            <EntityHealthList
              entities={[...digest.criticalEntities, ...digest.staleEntities].slice(0, 8)}
              emptyHint="No part of YPP is critical or drifting right now."
            />
          </CommandCenterSection>

          <CommandCenterSection title="Operational health by area">
            <AreaHealthGrid rows={digest.areaHealth} />
          </CommandCenterSection>

          <CommandCenterSection title="Due & overdue actions">
            <ActionUrgencyList actions={digest.urgentActions} />
          </CommandCenterSection>

          <CommandCenterSection title="Recently resolved" hint="Momentum, not just problems">
            <RecentlyResolvedList actions={digest.recentlyCompletedActions} />
          </CommandCenterSection>
        </div>
      </div>
    </div>
  );
}
