import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";
import { InitiativeCardGrid } from "@/components/people-strategy/strategic-initiatives";
import { StrategicWorkspaceHeader } from "@/components/people-strategy/strategic-workspace-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Initiatives · Operations" };

/**
 * Initiatives = the plan. Open any initiative to see and add its actions.
 */
export default async function StrategicInitiativesPage() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const sessionUser = await requireOfficer().catch(() => null);
  if (!sessionUser) notFound();

  const viewer = {
    id: sessionUser.id,
    roles: sessionUser.roles,
    primaryRole: sessionUser.primaryRole,
    adminSubtypes: sessionUser.adminSubtypes,
  };

  const now = new Date();
  const initiatives = await getStrategicInitiativesOverview(viewer, { now });
  const openActions = initiatives.reduce((n, i) => n + i.counts.openActions, 0);

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <StrategicWorkspaceHeader
        current="initiatives"
        eyebrow="Plan"
        title="Initiatives"
        subtitle="Each initiative is a strategic goal. Open one to see the actions that move it forward."
        meta={`${initiatives.length} initiatives · ${openActions} open actions across the portfolio`}
      />

      <section style={{ marginTop: 20 }}>
        <InitiativeCardGrid
          initiatives={initiatives}
          emptyHint="No initiatives are configured yet."
        />
      </section>
    </div>
  );
}
