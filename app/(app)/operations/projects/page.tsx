import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicProjectPortfolio } from "@/lib/people-strategy/strategic-project-queries";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { CommandCenterSection } from "@/components/people-strategy/command-center-os";
import {
  ProjectCardGrid,
  ProjectStatStrip,
} from "@/components/people-strategy/strategic-projects";

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

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <ActionCommandBar
        eyebrow="People Strategy · Leadership"
        title="Strategic Projects"
        subtitle="The concrete bodies of work that move each initiative forward — with derived health, confidence, blockers, ownership, and the next move."
        meta={`${stats.total} projects · ${stats.active} active · ${stats.needsAttention} need attention · ${stats.blocked} blocked`}
        actions={
          <>
            <Link href="/operations/initiatives" className="button primary small">
              Initiatives
            </Link>
            <Link href="/operations/portfolio" className="button outline small">
              Portfolio
            </Link>
            <Link href="/operations/command-center" className="button outline small">
              Command Center
            </Link>
          </>
        }
      />

      <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
        <Link href="/operations" style={{ color: "var(--muted)" }}>Operations Hub</Link>
        <Link href="/operations/initiatives" style={{ color: "var(--muted)" }}>Initiatives</Link>
        <Link href="/operations/portfolio" style={{ color: "var(--muted)" }}>Portfolio</Link>
        <Link href="/operations/command-center" style={{ color: "var(--muted)" }}>Command Center</Link>
        <Link href="/operations/weekly-review" style={{ color: "var(--muted)" }}>Weekly Review</Link>
      </nav>

      <section style={{ marginTop: 18 }}>
        <CommandCenterSection title="Projects at a glance" hint="Derived from live execution data">
          <ProjectStatStrip stats={stats} />
        </CommandCenterSection>
      </section>

      {data.needingAttention.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <CommandCenterSection title="Needs attention" hint={`${data.needingAttention.length} drifting, at risk, or critical`}>
            <ProjectCardGrid projects={data.needingAttention} />
          </CommandCenterSection>
        </section>
      ) : null}

      {data.blocked.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <CommandCenterSection title="Blocked" hint="Observed or at-risk declared blockers">
            <ProjectCardGrid projects={data.blocked} />
          </CommandCenterSection>
        </section>
      ) : null}

      {data.unowned.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <CommandCenterSection title="Owner gaps" hint="Unowned or unclear accountability">
            <ProjectCardGrid projects={data.unowned} />
          </CommandCenterSection>
        </section>
      ) : null}

      {data.byInitiative.map((group) => (
        <section key={group.initiativeId} style={{ marginTop: 26 }}>
          <CommandCenterSection
            title={group.initiativeTitle}
            hint={
              <Link href={group.initiativeHref} style={{ color: "var(--ypp-purple, #6b21c8)" }}>
                Open initiative →
              </Link>
            }
          >
            <ProjectCardGrid projects={group.projects} />
          </CommandCenterSection>
        </section>
      ))}

      <section style={{ marginTop: 26 }}>
        <CommandCenterSection title="All projects" hint="Worst concern first">
          <ProjectCardGrid
            projects={data.projects}
            emptyHint="No projects are configured yet. Add one in lib/people-strategy/strategic-projects.ts."
          />
        </CommandCenterSection>
      </section>
    </div>
  );
}
