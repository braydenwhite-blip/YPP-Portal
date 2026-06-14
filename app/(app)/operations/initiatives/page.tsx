import Link from "next/link";
import { notFound } from "next/navigation";

import { InitiativeCardGrid } from "@/components/people-strategy/strategic-initiatives";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Initiatives · Work" };

/** Initiatives = the plan. Open one to see and add its actions. */
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
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 pb-10">
      <PageHeaderV2
        eyebrow="Work"
        backHref="/work?view=initiatives"
        backLabel="Work"
        title="Initiatives"
        subtitle="Each initiative is a goal. Open one to see the actions that move it forward."
        actions={
          <ButtonLink href="/work" variant="ghost" size="sm">
            Work hub →
          </ButtonLink>
        }
      />

      <ActionTrackerTabsV2 active="initiatives" />

      <p className="m-0 text-[12.5px] text-ink-muted">
        {initiatives.length} initiatives · {openActions} open actions
      </p>

      <InitiativeCardGrid
        initiatives={initiatives}
        emptyHint="No initiatives are configured yet."
      />

      <p className="m-0 text-[12.5px] text-ink-muted">
        Tip: use{" "}
        <Link href="/work?view=initiatives" className="font-semibold text-brand-700 no-underline hover:underline">
          Work → Initiatives
        </Link>{" "}
        for the same list inside your daily queue.
      </p>
    </div>
  );
}
