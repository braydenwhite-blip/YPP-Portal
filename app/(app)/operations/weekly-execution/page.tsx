import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { listActionAssignableUsers } from "@/lib/people-strategy/action-queries";
import { getWeeklyOperationalDigestForViewer } from "@/lib/people-strategy/operational-digest-queries";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";
import { deriveWeeklyExecutionOS } from "@/lib/people-strategy/weekly-execution";
import { WeeklyExecutionOSView } from "@/components/people-strategy/weekly-execution";
import { StrategicWorkspaceHeader } from "@/components/people-strategy/strategic-workspace-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly Execution · Operations" };

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

/**
 * Weekly Execution OS - the officer meeting operating loop.
 *
 * Uses the same Action + Meetings 360 digest as the Command Center and folds in
 * the existing Strategic Initiatives layer when enabled. This page does not
 * invent a second tracker; it turns the existing trackers into the weekly agenda,
 * meeting capture, loose-end inbox, communication queue, and recap draft.
 */
export default async function WeeklyExecutionPage() {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const [digest, people, initiatives] = await Promise.all([
    getWeeklyOperationalDigestForViewer(viewer, { now }),
    listActionAssignableUsers(),
    isStrategicInitiativesEnabled()
      ? getStrategicInitiativesOverview(viewer, { now }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const os = deriveWeeklyExecutionOS({ digest, initiatives, now });

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <StrategicWorkspaceHeader
        current="weekly-execution"
        showStrategic={isStrategicInitiativesEnabled()}
        eyebrow="YPP Leadership OS"
        title="Weekly Execution"
        subtitle="Run the weekly officer meeting: build the agenda, capture the meeting, resolve loose ends, and draft the recap."
        meta={`${os.snapshot.urgent} urgent | ${os.snapshot.initiativesNeedingAttention} initiatives | ${os.snapshot.communicationsNeeded} communications`}
        actions={
          <>
            <Link href="/operations/command-center" className="button outline small">
              Back to command center
            </Link>
            <Link href="/actions/new" className="button small">
              + New action
            </Link>
          </>
        }
      />

      <div style={{ marginTop: 22 }}>
        <WeeklyExecutionOSView
          os={os}
          people={people.map((person) => ({ id: person.id, name: personName(person) }))}
          currentUserId={viewer.id}
        />
      </div>
    </div>
  );
}
