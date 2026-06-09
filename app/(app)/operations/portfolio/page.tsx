import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicPortfolioData } from "@/lib/people-strategy/strategic-initiative-queries";
import { getStrategicProjectPortfolio } from "@/lib/people-strategy/strategic-project-queries";
import { CommandCenterSection } from "@/components/people-strategy/command-center-os";
import {
  StrategicStack,
  StrategicWorkspaceHeader,
} from "@/components/people-strategy/strategic-workspace-nav";
import { PortfolioStatStrip } from "@/components/people-strategy/strategic-initiatives";
import {
  DependencyGraphBoard,
  PortfolioBoard,
} from "@/components/people-strategy/strategic-initiatives-os";
import {
  ProjectCardGrid,
  ProjectStatStrip,
} from "@/components/people-strategy/strategic-projects";

export const dynamic = "force-dynamic";
export const metadata = { title: "Initiative Portfolio · Operations" };

/**
 * Initiative Portfolio (Phase I) — the executive layer. From one page leadership
 * understands the whole organization: what matters most, what's growing, what's
 * risky, where the resources and gaps are, what's blocked, where to focus, the
 * strategic opportunities, and the cross-initiative dependency graph. All derived
 * from live execution data; triple-gated and officer-guarded.
 */
export default async function InitiativePortfolioPage() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const data = await getStrategicPortfolioData(viewer, { now });
  const projectData = await getStrategicProjectPortfolio(viewer, { now });
  const stats = data.portfolio.stats;

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <StrategicWorkspaceHeader
        current="portfolio"
        eyebrow="People Strategy · Leadership"
        title="Initiative Portfolio"
        subtitle="The whole organization from one page — what matters most, what's growing, what's at risk, what's blocked, where to focus, and how initiatives depend on each other."
        meta={`${stats.total} initiatives · ${stats.active} active · ${stats.atRisk + stats.critical} need attention`}
      />

      <StrategicStack>
        <CommandCenterSection title="Portfolio at a glance" hint="Derived from live execution data">
          <PortfolioStatStrip stats={stats} />
        </CommandCenterSection>

        <CommandCenterSection title="Portfolio board" hint="Importance · impact · momentum · risk · capacity">
          <PortfolioBoard portfolio={data.portfolio} />
        </CommandCenterSection>

        <CommandCenterSection title="Dependency engine" hint="What is actually holding us back">
          <DependencyGraphBoard graph={data.dependencyGraph} />
        </CommandCenterSection>

        <CommandCenterSection
          title="Project board"
          hint={
            <Link href="/operations/projects" style={{ color: "var(--ypp-purple, #6b21c8)" }}>
              Open all {projectData.stats.total} projects →
            </Link>
          }
        >
          <div style={{ display: "grid", gap: 16 }}>
            <ProjectStatStrip stats={projectData.stats} />
            {projectData.needingAttention.length > 0 ? (
              <div>
                <h3 className="ps-section-title" style={{ margin: "0 0 8px", fontSize: 13 }}>
                  Projects needing attention
                </h3>
                <ProjectCardGrid projects={projectData.needingAttention} />
              </div>
            ) : null}
            <div>
              <h3 className="ps-section-title" style={{ margin: "0 0 8px", fontSize: 13 }}>
                All projects
              </h3>
              <ProjectCardGrid
                projects={projectData.projects}
                emptyHint="No projects are configured yet."
              />
            </div>
          </div>
        </CommandCenterSection>
      </StrategicStack>
    </div>
  );
}
