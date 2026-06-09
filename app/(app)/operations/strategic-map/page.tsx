import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicMapData } from "@/lib/people-strategy/strategic-initiative-queries";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { CommandCenterSection } from "@/components/people-strategy/command-center-os";
import { StrategicMapView } from "@/components/people-strategy/strategic-initiatives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strategic Map · Operations" };

/**
 * Strategic Map — the executive visualization. YPP → operating areas →
 * initiatives → milestones → work, each node carrying its rolled-up health and
 * progress, every node a click into the relevant command center. Like Notion
 * Projects / Asana Portfolios / Linear Roadmaps, purpose-built for YPP and
 * derived entirely from live execution data.
 */
export default async function StrategicMapPage() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const map = await getStrategicMapData(viewer, { now });

  return (
    <div className="page-shell" style={{ maxWidth: 1080 }}>
      <ActionCommandBar
        eyebrow="People Strategy · Leadership"
        title="Strategic Map"
        subtitle="The whole portfolio top-down — areas, initiatives, and milestones with rolled-up health and progress. Click any node to drill in."
        meta={`${map.totalInitiatives} initiatives across ${map.areas.length} area${map.areas.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href="/operations/portfolio" className="button outline small">
              Portfolio
            </Link>
            <Link href="/operations/initiatives" className="button outline small">
              All initiatives
            </Link>
          </>
        }
      />

      <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontSize: 13 }}>
        <Link href="/operations" style={{ color: "var(--muted)" }}>Operations Hub</Link>
        <Link href="/operations/initiatives" style={{ color: "var(--muted)" }}>Initiatives</Link>
        <Link href="/operations/portfolio" style={{ color: "var(--muted)" }}>Portfolio</Link>
        <Link href="/operations/command-center" style={{ color: "var(--muted)" }}>Command Center</Link>
      </nav>

      <section style={{ marginTop: 18 }}>
        <CommandCenterSection title="Portfolio map" hint="Worst-health areas first">
          <StrategicMapView map={map} />
        </CommandCenterSection>
      </section>
    </div>
  );
}
