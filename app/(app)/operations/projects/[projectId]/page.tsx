import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getProjectDef } from "@/lib/people-strategy/strategic-project-registry";
import { getStrategicProjectDossier } from "@/lib/people-strategy/strategic-project-queries";
import { CommandCenterSection, EmptyCard } from "@/components/people-strategy/command-center-os";
import { StrategicWorkspaceHeader } from "@/components/people-strategy/strategic-workspace-nav";
import { DecisionCenterPanel } from "@/components/people-strategy/strategic-initiatives-os";
import {
  ProjectActionIntelligencePanel,
  ProjectBlockersPanel,
  ProjectBriefPanel,
  ProjectConfidencePanel,
  ProjectDependencyPanel,
  ProjectExecutionSpine,
  ProjectHeaderPanel,
  ProjectMeetingIntelligencePanel,
  ProjectNextMovesPanel,
  ProjectReviewCard,
  ProjectWhatMattersPanel,
} from "@/components/people-strategy/strategic-projects";
import { TouchpointTimelineView } from "@/components/people-strategy/touchpoint-timeline";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const def = getProjectDef(projectId);
  return { title: def ? `${def.title} · Projects` : "Project · Operations" };
}

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "#brief", label: "Brief" },
  { href: "#spine", label: "Execution" },
  { href: "#timeline", label: "Timeline" },
  { href: "#actions", label: "Actions" },
  { href: "#decisions", label: "Decisions" },
  { href: "#meetings", label: "Meetings" },
  { href: "#dependencies", label: "Dependencies" },
  { href: "#review", label: "Review" },
];

/**
 * Strategic Project command center (3.0, Phase B) — the living-project detail
 * page. Runs the project as an operating unit: its header + brief, the execution
 * spine, the touchpoint timeline, action / decision / meeting intelligence,
 * dependencies, and a weekly review card — all derived state, every panel with a
 * graceful empty state.
 */
export default async function StrategicProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const { projectId } = await params;
  const now = new Date();
  const dossier = await getStrategicProjectDossier(projectId, viewer, { now });
  if (!dossier) notFound();

  const p = dossier.summary;

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <StrategicWorkspaceHeader
        current="projects"
        breadcrumbs={[
          { label: "Portfolio", href: "/operations/portfolio" },
          { label: p.initiativeTitle, href: p.initiativeHref },
          { label: p.title },
        ]}
        eyebrow={`People Strategy · ${p.initiativeTitle}`}
        title={p.title}
        subtitle={p.summary}
        meta={`${p.statusLabel} · ${p.priorityLabel} · owner ${p.owner ?? "unassigned"}${
          p.targetDateISO ? ` · target ${new Date(p.targetDateISO).toLocaleDateString()}` : ""
        }`}
        actions={
          <Link href={p.newActionHref} className="button primary small">
            Create action
          </Link>
        }
      />

      <nav className="ps-anchor-nav" aria-label="On this page">
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>

      {/* What matters now — the focal panel directly under the hero */}
      <section style={{ marginTop: 18 }}>
        <CommandCenterSection
          title="What matters now"
          hint={p.reviewNeed.needed ? `Review ${p.reviewNeed.urgency}` : "On cadence"}
        >
          <ProjectWhatMattersPanel project={p} />
        </CommandCenterSection>
      </section>

      {/* Vitals */}
      <section style={{ marginTop: 26 }}>
        <CommandCenterSection title="Project vitals" hint="Health · confidence · momentum · ownership · progress">
          <ProjectHeaderPanel project={p} />
        </CommandCenterSection>
      </section>

      {/* Brief */}
      <section id="brief" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Project brief" hint="What this is · why it matters · scope">
          <ProjectBriefPanel project={p} />
        </CommandCenterSection>
      </section>

      {/* Execution spine */}
      <section id="spine" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Execution spine" hint="Project → workstreams → milestones → actions → outcomes">
          <ProjectExecutionSpine project={p} milestones={dossier.linkedMilestones} />
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
        {/* Left — timeline */}
        <div id="timeline" style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
          <CommandCenterSection
            title="Project timeline"
            hint={`${dossier.timeline.counts.total} touchpoints · ${dossier.timeline.counts.openFollowUps} open`}
          >
            <TouchpointTimelineView
              timeline={dossier.timeline}
              emptyHint="No touchpoints yet. Recommended next step: create a meeting or action linked to this project."
            />
          </CommandCenterSection>
        </div>

        {/* Right — next moves, confidence, blockers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
          <CommandCenterSection title="Recommended next moves" hint={`${p.nextMoves.length}`}>
            <ProjectNextMovesPanel moves={p.nextMoves} />
          </CommandCenterSection>
          <CommandCenterSection title="Confidence">
            <ProjectConfidencePanel confidence={p.confidence} />
          </CommandCenterSection>
          <CommandCenterSection title="Blockers" hint="Declared vs observed">
            <ProjectBlockersPanel blockers={p.blockers} />
          </CommandCenterSection>
          <CommandCenterSection title="Related entities" hint="Classes, partners & people in this work">
            {dossier.relatedEntities.length === 0 ? (
              <EmptyCard>No specific classes, partners, or people are linked to this project&apos;s work yet.</EmptyCard>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {dossier.relatedEntities.map((e) => (
                  <li key={`${e.type}:${e.id}`} className="card" style={{ padding: "8px 12px", fontSize: 13 }}>
                    {e.href ? (
                      <Link href={e.href} style={{ fontWeight: 600, color: "inherit" }}>
                        {e.label}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{e.label}</span>
                    )}
                    <span style={{ color: "var(--text-secondary)" }}> · {e.typeLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </CommandCenterSection>
        </div>
      </div>

      {/* Action intelligence */}
      <section id="actions" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Action intelligence" hint="Open · overdue · ownership · follow-through">
          <ProjectActionIntelligencePanel intel={dossier.actionIntelligence} />
        </CommandCenterSection>
      </section>

      {/* Decision intelligence */}
      <section id="decisions" style={{ marginTop: 26 }}>
        <CommandCenterSection
          title="Decision intelligence"
          hint={`${dossier.decisionCenter.stats.followThroughRate}% follow-through`}
        >
          {dossier.decisionCenter.stats.total === 0 ? (
            <EmptyCard>No decision history yet. Decisions logged in this project&apos;s meetings will appear here.</EmptyCard>
          ) : (
            <DecisionCenterPanel center={dossier.decisionCenter} />
          )}
        </CommandCenterSection>
      </section>

      {/* Meeting intelligence */}
      <section id="meetings" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Meeting intelligence" hint="Coverage · follow-through · next meeting">
          <ProjectMeetingIntelligencePanel intel={dossier.meetingIntelligence} />
        </CommandCenterSection>
      </section>

      {/* Dependencies */}
      <section id="dependencies" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Dependencies" hint="What we wait on, what we unlock">
          <ProjectDependencyPanel view={dossier.dependencies} />
        </CommandCenterSection>
      </section>

      {/* Review */}
      <section id="review" style={{ marginTop: 26 }}>
        <CommandCenterSection title="Project review" hint="Wins · losses · risks · next moves">
          <ProjectReviewCard project={p} meetingIntel={dossier.meetingIntelligence} />
        </CommandCenterSection>
      </section>
    </div>
  );
}
