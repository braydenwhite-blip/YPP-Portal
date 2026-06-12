import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";
import {
  derivePortfolioStats,
  selectInitiativesNeedingAttention,
} from "@/lib/people-strategy/strategic-initiative-summary";
import { CommandCenterSection } from "@/components/people-strategy/command-center-os";
import { OperationsEmptyState } from "@/components/people-strategy/operations-item-card";
import {
  InitiativeCardGrid,
  PortfolioStatStrip,
} from "@/components/people-strategy/strategic-initiatives";
import { LegacySurfaceBanner } from "@/components/ui-v2";
import {
  StrategicStack,
  StrategicWorkspaceHeader,
} from "@/components/people-strategy/strategic-workspace-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Initiatives · Operations" };

/**
 * Initiatives — the strategic layer of the leadership OS. It answers one
 * question: what are the big goals, and are they moving? Each initiative card
 * shows derived health, owner, momentum, progress, and the next move; the
 * deeper analytical views (Portfolio, Projects, Strategic Map) are secondary
 * and linked from here instead of crowding the primary nav.
 *
 * Triple-gated (operations hub + tracker + strategic-initiatives flags) and
 * officer-guarded; a scoped officer only ever feeds the initiatives the work
 * their visibility allows.
 */
export default async function StrategicInitiativesPage() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const initiatives = await getStrategicInitiativesOverview(viewer, { now });
  const stats = derivePortfolioStats(initiatives);
  const needingAttention = selectInitiativesNeedingAttention(initiatives);

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <LegacySurfaceBanner
        title="Work Hub shows initiative health beside the rest of the work now."
        body="Active initiatives with reasons and open-action counts live at /work — this workspace keeps the dossiers, milestones, and planning tools."
        ctaLabel="Open Work Hub"
        ctaHref="/work?view=initiatives"
      />
      <StrategicWorkspaceHeader
        current="initiatives"
        eyebrow="YPP Leadership OS"
        title="Initiatives"
        subtitle="The big goals, and whether they are moving — each with derived health, momentum, progress, and the next move."
        meta={`${stats.total} initiatives · ${stats.active} active · ${stats.atRisk + stats.critical} need attention`}
      />

      <StrategicStack>
        <CommandCenterSection title="Portfolio at a glance" hint="Derived from live execution data">
          <PortfolioStatStrip stats={stats} />
        </CommandCenterSection>

        <CommandCenterSection title="Needs attention" hint="Drifting, at risk, or critical — worst first">
          {needingAttention.length > 0 ? (
            <InitiativeCardGrid initiatives={needingAttention} />
          ) : (
            <OperationsEmptyState title="No initiatives need leadership attention right now.">
              Every initiative has an owner, a next step, and no overdue or blocked work.
            </OperationsEmptyState>
          )}
        </CommandCenterSection>

        <CommandCenterSection title="All initiatives" hint="Worst health first">
          <InitiativeCardGrid
            initiatives={initiatives}
            emptyHint="No initiatives are configured yet."
          />
        </CommandCenterSection>

        <CommandCenterSection
          title="Deeper views"
          hint="Secondary analytical views — most weeks the cards above are enough"
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/operations/portfolio" className="button outline small">
              Portfolio board
            </Link>
            <Link href="/operations/projects" className="button outline small">
              Strategic projects
            </Link>
            <Link href="/operations/strategic-map" className="button outline small">
              Strategic map
            </Link>
          </div>
        </CommandCenterSection>
      </StrategicStack>
    </div>
  );
}
