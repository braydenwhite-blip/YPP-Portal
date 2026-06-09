import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicInitiativeDetail } from "@/lib/people-strategy/strategic-initiative-queries";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { buildInitiativeActionPrefill } from "@/lib/people-strategy/strategic-recommendations";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import {
  CommandCenterSection,
  EntityHealthList,
} from "@/components/people-strategy/command-center-os";
import {
  InitiativeSummaryPanel,
  MilestoneList,
  NextStepsPanel,
  OwnershipPanel,
  RecommendationsList,
  RiskPanel,
  StrategicTimelineView,
} from "@/components/people-strategy/strategic-initiatives";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const { initiativeId } = await params;
  const def = getInitiativeDef(initiativeId);
  return { title: def ? `${def.title} · Initiatives` : "Initiative · Operations" };
}

/**
 * Strategic Initiative command center — the 10x detail page. It answers the
 * leadership questions: what is this, why does it exist, who owns it, how
 * healthy is it, what has happened, and what is next — all from derived state.
 */
export default async function StrategicInitiativeDetailPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const { initiativeId } = await params;
  const def = getInitiativeDef(initiativeId);
  const now = new Date();
  const summary = await getStrategicInitiativeDetail(initiativeId, viewer, { now });
  if (!summary || !def) notFound();

  const newActionHref = buildInitiativeActionPrefill(def);

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <ActionCommandBar
        eyebrow={`People Strategy · ${summary.areaLabel}`}
        title={summary.title}
        subtitle={summary.description}
        meta={`${summary.statusLabel} · ${summary.priorityLabel} · owner ${summary.owner ?? "unassigned"}${
          summary.targetDateISO ? ` · target ${new Date(summary.targetDateISO).toLocaleDateString()}` : ""
        }`}
        actions={
          <>
            <Link href={newActionHref} className="button primary small">
              + New action
            </Link>
            <Link href="/operations/initiatives" className="button outline small">
              All initiatives
            </Link>
          </>
        }
      />

      <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
        <Link href="/operations/initiatives" style={{ color: "var(--muted)" }}>← Initiatives</Link>
        <Link href="/operations/strategic-map" style={{ color: "var(--muted)" }}>Strategic Map</Link>
        <Link href="/operations/command-center" style={{ color: "var(--muted)" }}>Command Center</Link>
        <a href="#milestones" style={{ color: "var(--muted)" }}>Milestones</a>
        <a href="#timeline" style={{ color: "var(--muted)" }}>Timeline</a>
      </nav>

      {/* Executive summary */}
      <section style={{ marginTop: 18 }}>
        <CommandCenterSection title="Executive summary" hint={summary.health.label}>
          <InitiativeSummaryPanel initiative={summary} />
        </CommandCenterSection>
      </section>

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
        {/* Left — milestones + history */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
          <div id="milestones">
            <CommandCenterSection
              title="Milestones"
              hint={`${summary.counts.milestonesComplete}/${summary.counts.milestonesTotal} complete`}
            >
              <MilestoneList milestones={summary.milestones} />
            </CommandCenterSection>
          </div>

          <div id="timeline">
            <CommandCenterSection title="Timeline" hint="How we got here">
              <StrategicTimelineView timeline={summary.timeline} />
            </CommandCenterSection>
          </div>
        </div>

        {/* Right — next moves + intelligence */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
          <CommandCenterSection title="Recommended next moves" hint={`${summary.recommendations.length}`}>
            <RecommendationsList recommendations={summary.recommendations} />
          </CommandCenterSection>

          <CommandCenterSection title="Program intelligence">
            <div style={{ display: "grid", gap: 12 }}>
              <RiskPanel risk={summary.risk} />
              <OwnershipPanel ownership={summary.ownership} />
              <NextStepsPanel steps={summary.healthExplanation.suggestedNextSteps} />
            </div>
          </CommandCenterSection>

          <CommandCenterSection title="Related entities" hint="Worst first">
            <EntityHealthList
              entities={summary.relatedEntities.slice(0, 8)}
              emptyHint="No specific classes, partners, or people are linked to this initiative's work yet."
            />
          </CommandCenterSection>
        </div>
      </div>
    </div>
  );
}
