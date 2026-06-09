import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { selectProjectAttentionQueue } from "@/lib/people-strategy/strategic-project-attention";
import { getStrategicProjectPortfolio } from "@/lib/people-strategy/strategic-project-queries";
import { CommandCenterSection } from "@/components/people-strategy/command-center-os";
import {
  ProjectCardGrid,
  ProjectStatStrip,
  StrategicAttentionQueue,
} from "@/components/people-strategy/strategic-projects";
import {
  StrategicStack,
  StrategicWorkspaceHeader,
} from "@/components/people-strategy/strategic-workspace-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strategic Projects · Operations" };

/**
 * Strategic Projects portfolio (3.0, Phase C) — the working board beneath the
 * initiatives. Leadership sees the concrete projects that run every week, each
 * with derived health, confidence, blockers, owner, momentum, and the next move.
 * Triple-gated + officer-guarded; a scoped officer only feeds the work they may
 * see, and every project derives honest empty states when nothing is linked.
 */
export default async function StrategicProjectsPage() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const data = await getStrategicProjectPortfolio(viewer, { now });
  const stats = data.stats;
  const attentionQueue = selectProjectAttentionQueue(data.projects);

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <StrategicWorkspaceHeader
        current="projects"
        breadcrumbs={[{ label: "Portfolio", href: "/operations/portfolio" }, { label: "Projects" }]}
        eyebrow="People Strategy · Leadership"
        title="Strategic Projects"
        subtitle="The concrete bodies of work that move each initiative forward — with derived health, confidence, blockers, ownership, and the next move."
        meta={`${stats.total} projects · ${stats.active} active · ${stats.needsAttention} need attention · ${stats.blocked} blocked`}
      />

      <StrategicStack>
        <CommandCenterSection title="Projects at a glance" hint="Derived from live execution data">
          <ProjectStatStrip stats={stats} />
        </CommandCenterSection>

        <CommandCenterSection
          title="Where to look first"
          hint={
            attentionQueue.length > 0
              ? `${attentionQueue.length} project${attentionQueue.length === 1 ? "" : "s"} ranked by urgency`
              : "Nothing urgent"
          }
        >
          <StrategicAttentionQueue items={attentionQueue} />
        </CommandCenterSection>

        {data.needingAttention.length > 0 ? (
          <CommandCenterSection title="Needs attention" hint={`${data.needingAttention.length} drifting, at risk, or critical`}>
            <ProjectCardGrid projects={data.needingAttention} />
          </CommandCenterSection>
        ) : null}

        {data.blocked.length > 0 ? (
          <CommandCenterSection title="Blocked" hint="Observed or at-risk declared blockers">
            <ProjectCardGrid projects={data.blocked} />
          </CommandCenterSection>
        ) : null}

        {data.unowned.length > 0 ? (
          <CommandCenterSection title="Owner gaps" hint="Unowned or unclear accountability">
            <ProjectCardGrid projects={data.unowned} />
          </CommandCenterSection>
        ) : null}

        {data.stale.length > 0 ? (
          <CommandCenterSection title="Losing momentum" hint="Has tracked work but has gone quiet">
            <ProjectCardGrid projects={data.stale} />
          </CommandCenterSection>
        ) : null}

        {data.fastest.length > 0 ? (
          <CommandCenterSection title="Accelerating" hint="Momentum is building — keep it fed">
            <ProjectCardGrid projects={data.fastest} />
          </CommandCenterSection>
        ) : null}

        {data.byInitiative.map((group) => (
          <CommandCenterSection
            key={group.initiativeId}
            title={group.initiativeTitle}
            hint={
              <Link href={group.initiativeHref} style={{ color: "var(--ypp-purple, #6b21c8)" }}>
                Open initiative →
              </Link>
            }
          >
            <ProjectCardGrid projects={group.projects} />
          </CommandCenterSection>
        ))}

        <CommandCenterSection title="All projects" hint="Worst concern first">
          <ProjectCardGrid
            projects={data.projects}
            emptyHint="No projects are configured yet. Add one in lib/people-strategy/strategic-projects.ts."
          />
        </CommandCenterSection>
      </StrategicStack>
    </div>
  );
}
