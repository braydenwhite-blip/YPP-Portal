import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicPortfolioData } from "@/lib/people-strategy/strategic-initiative-queries";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { CommandCenterSection } from "@/components/people-strategy/command-center-os";
import { PortfolioStatStrip } from "@/components/people-strategy/strategic-initiatives";
import {
  DependencyGraphBoard,
  PortfolioBoard,
} from "@/components/people-strategy/strategic-initiatives-os";

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
  const stats = data.portfolio.stats;

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <ActionCommandBar
        eyebrow="People Strategy · Leadership"
        title="Initiative Portfolio"
        subtitle="The whole organization from one page — what matters most, what's growing, what's at risk, what's blocked, where to focus, and how initiatives depend on each other."
        meta={`${stats.total} initiatives · ${stats.active} active · ${stats.atRisk + stats.critical} need attention`}
        actions={
          <>
            <Link href="/operations/initiatives" className="button primary small">
              All initiatives
            </Link>
            <Link href="/operations/strategic-map" className="button outline small">
              Strategic map
            </Link>
          </>
        }
      />

      <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
        <Link href="/operations" style={{ color: "var(--muted)" }}>Operations Hub</Link>
        <Link href="/operations/initiatives" style={{ color: "var(--muted)" }}>Initiatives</Link>
        <Link href="/operations/strategic-map" style={{ color: "var(--muted)" }}>Strategic Map</Link>
        <Link href="/operations/command-center" style={{ color: "var(--muted)" }}>Command Center</Link>
      </nav>

      <section style={{ marginTop: 18 }}>
        <CommandCenterSection title="Portfolio at a glance" hint="Derived from live execution data">
          <PortfolioStatStrip stats={stats} />
        </CommandCenterSection>
      </section>

      <section style={{ marginTop: 26 }}>
        <CommandCenterSection title="Portfolio board" hint="Importance · impact · momentum · risk · capacity">
          <PortfolioBoard portfolio={data.portfolio} />
        </CommandCenterSection>
      </section>

      <section style={{ marginTop: 26 }}>
        <CommandCenterSection title="Dependency engine" hint="What is actually holding us back">
          <DependencyGraphBoard graph={data.dependencyGraph} />
        </CommandCenterSection>
      </section>
    </div>
  );
}
