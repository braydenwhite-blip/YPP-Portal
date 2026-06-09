import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicInitiativeDossier } from "@/lib/people-strategy/strategic-initiative-queries";
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
import {
  DependencyPanel,
  ExecutionGraphView,
  InitiativeCharterPanel,
  KnowledgeBasePanel,
  OperatingReviewTabs,
  RoadmapView,
  ScenariosPanel,
  WorkstreamBoard,
  DecisionCenterPanel,
} from "@/components/people-strategy/strategic-initiatives-os";

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

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "#charter", label: "Architecture" },
  { href: "#workstreams", label: "Workstreams" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#milestones", label: "Milestones" },
  { href: "#decisions", label: "Decisions" },
  { href: "#scenarios", label: "Scenarios" },
  { href: "#dependencies", label: "Dependencies" },
  { href: "#reviews", label: "Reviews" },
  { href: "#knowledge", label: "Knowledge" },
  { href: "#graph", label: "Execution graph" },
];

/**
 * Strategic Initiative command center — the living-program detail page. It runs
 * the whole initiative as an operating business unit: its architecture (charter),
 * workstreams, roadmap, decision center, scenarios, dependencies, operating
 * reviews, knowledge base, and the full execution graph — all derived state.
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
  const dossier = await getStrategicInitiativeDossier(initiativeId, viewer, { now });
  if (!dossier || !def) notFound();

  const summary = dossier.summary;
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
            <Link href="/operations/portfolio" className="button outline small">
              Portfolio
            </Link>
            <Link href="/operations/initiatives" className="button outline small">
              All initiatives
            </Link>
          </>
        }
      />

      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
        <Link href="/operations/initiatives" style={{ color: "var(--muted)" }}>← Initiatives</Link>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} style={{ color: "var(--muted)" }}>{l.label}</a>
        ))}
      </nav>

      {/* Executive summary */}
      <section style={{ marginTop: 18 }}>
        <CommandCenterSection title="Executive summary" hint={summary.health.label}>
          <InitiativeSummaryPanel initiative={summary} />
        </CommandCenterSection>
      </section>

      {/* Phase A — Architecture / charter */}
      <section id="charter" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Initiative architecture" hint="Mission · purpose · success · stakeholders">
          <InitiativeCharterPanel charter={dossier.profile.charter} />
        </CommandCenterSection>
      </section>

      {/* Phase B — Workstreams */}
      <section id="workstreams" style={{ marginTop: 26 }}>
        <CommandCenterSection
          title="Workstreams"
          hint={`${dossier.workstreams.length} program${dossier.workstreams.length === 1 ? "" : "s"}`}
        >
          <WorkstreamBoard workstreams={dossier.workstreams} />
        </CommandCenterSection>
      </section>

      {/* Phase E — Roadmap */}
      <section id="roadmap" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Roadmap" hint="Sequencing by phase and horizon">
          <RoadmapView roadmap={dossier.roadmap} />
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
        {/* Left — milestones + timeline */}
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

      {/* Phase C — Decision Center */}
      <section id="decisions" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Decision center" hint={`${dossier.decisionCenter.stats.followThroughRate}% follow-through`}>
          <DecisionCenterPanel center={dossier.decisionCenter} />
        </CommandCenterSection>
      </section>

      {/* Phase F — Scenarios */}
      <section id="scenarios" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Scenarios" hint="Best · expected · stretch · risk">
          <ScenariosPanel board={dossier.scenarios} />
        </CommandCenterSection>
      </section>

      {/* Phase G — Dependencies */}
      <section id="dependencies" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Dependencies" hint="What we wait on, what we unblock">
          <DependencyPanel view={dossier.dependencies} />
        </CommandCenterSection>
      </section>

      {/* Phase H — Operating reviews */}
      <section id="reviews" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Operating reviews" hint="Weekly · monthly · quarterly">
          <OperatingReviewTabs reviews={dossier.reviews} />
        </CommandCenterSection>
      </section>

      {/* Phase D — Knowledge base */}
      <section id="knowledge" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Knowledge base" hint="Institutional memory">
          <KnowledgeBasePanel kb={dossier.profile.knowledge} />
        </CommandCenterSection>
      </section>

      {/* Phase J — Execution graph */}
      <section id="graph" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Execution graph" hint="Initiative → workstream → milestone → decision → meeting → action → outcome">
          <ExecutionGraphView graph={dossier.executionGraph} />
        </CommandCenterSection>
      </section>
    </div>
  );
}
