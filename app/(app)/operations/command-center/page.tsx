import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getWeeklyOperationalDigestForViewer } from "@/lib/people-strategy/operational-digest-queries";
import { getStrategicCommandData } from "@/lib/people-strategy/strategic-project-queries";
import { StrategicCommandSection } from "@/components/people-strategy/strategic-command";
import {
  ActionMeetings360Workboard,
  ActionUrgencyList,
  AreaHealthGrid,
  CommandCenterAllClear,
  CommandCenterHero,
  CommandCenterSection,
  EntityHealthList,
  LeadershipRhythm,
  OperationalDigestStats,
  RecentlyResolvedList,
} from "@/components/people-strategy/command-center-os";
import { StrategicWorkspaceNav } from "@/components/people-strategy/strategic-workspace-nav";

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
    ? await getStrategicCommandData(viewer, { now }).catch(() => null)
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
      <div className="ps-workspace-header">
        <CommandCenterHero
          windowStartISO={digest.window.start.toISOString()}
          generatedAtISO={digest.generatedAt.toISOString()}
          consideredCount={consideredCount}
        />
        <StrategicWorkspaceNav current="command-center" showStrategic={!!strategic} />
      </div>

      {/* This Week at YPP */}
      <section style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <CommandCenterSection title="This week at YPP" hint="A quick executive read across the org">
          <OperationalDigestStats counts={digest.counts} />
        </CommandCenterSection>
      </section>

      {/* Strategic Command (3.0) — the executive cockpit across initiatives + projects */}
      {strategic ? (
        <section style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
          <CommandCenterSection
            title="Strategic command"
            hint={
              <span style={{ display: "inline-flex", gap: 10 }}>
                <Link href="/operations/initiatives" style={{ color: "var(--ypp-purple, #6b21c8)" }}>
                  {strategic.snapshot.initiatives} initiatives →
                </Link>
                <Link href="/operations/projects" style={{ color: "var(--ypp-purple, #6b21c8)" }}>
                  {strategic.snapshot.projects} projects →
                </Link>
              </span>
            }
          >
            <StrategicCommandSection data={strategic} />
          </CommandCenterSection>
        </section>
      ) : null}

      <section style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
        {allClear ? (
          <CommandCenterAllClear
            upcomingMeetings={digest.upcomingMeetings}
            recentlyCompleted={digest.recentlyCompletedActions}
          />
        ) : null}
        <CommandCenterSection
          title="Action + Meetings 360"
          hint={`${digest.counts.decisionsNeedingAction + digest.counts.unconvertedFollowUps} uncaptured`}
        >
          <ActionMeetings360Workboard digest={digest} />
        </CommandCenterSection>
      </section>

      <div
        className="command-center-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 22,
          marginTop: 26,
          alignItems: "start",
        }}
      >
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
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
