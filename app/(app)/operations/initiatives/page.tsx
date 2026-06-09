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
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { CommandCenterSection } from "@/components/people-strategy/command-center-os";
import {
  InitiativeCardGrid,
  PortfolioStatStrip,
} from "@/components/people-strategy/strategic-initiatives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strategic Initiatives · Operations" };

/**
 * Strategic Initiatives index — the portfolio view above the Action Tracker.
 * Leadership stops seeing hundreds of disconnected actions and starts seeing
 * initiatives, each with its derived health, momentum, progress, and next move.
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
      <ActionCommandBar
        eyebrow="People Strategy · Leadership"
        title="Strategic Initiatives"
        subtitle="The major goals, programs, and campaigns YPP is driving — each with derived health, momentum, progress, and the next move."
        meta={`${stats.total} initiatives · ${stats.active} active · ${stats.atRisk + stats.critical} need attention`}
        actions={
          <>
            <Link href="/operations/strategic-map" className="button primary small">
              Strategic map
            </Link>
            <Link href="/operations/command-center" className="button outline small">
              Command Center
            </Link>
          </>
        }
      />

      <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
        <Link href="/operations" style={{ color: "var(--muted)" }}>Operations Hub</Link>
        <Link href="/operations/command-center" style={{ color: "var(--muted)" }}>Command Center</Link>
        <Link href="/operations/strategic-map" style={{ color: "var(--muted)" }}>Strategic Map</Link>
        <Link href="/operations/weekly-review" style={{ color: "var(--muted)" }}>Weekly Review</Link>
      </nav>

      <section style={{ marginTop: 18 }}>
        <CommandCenterSection title="Portfolio at a glance" hint="Derived from live execution data">
          <PortfolioStatStrip stats={stats} />
        </CommandCenterSection>
      </section>

      {needingAttention.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <CommandCenterSection title="Needs attention" hint={`${needingAttention.length} drifting, at risk, or critical`}>
            <InitiativeCardGrid initiatives={needingAttention} />
          </CommandCenterSection>
        </section>
      ) : null}

      <section style={{ marginTop: 26 }}>
        <CommandCenterSection title="All initiatives" hint="Worst health first">
          <InitiativeCardGrid
            initiatives={initiatives}
            emptyHint="No initiatives are configured yet."
          />
        </CommandCenterSection>
      </section>
    </div>
  );
}
