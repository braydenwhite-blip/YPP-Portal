import { notFound, redirect } from "next/navigation";

import { DevelopmentCockpit } from "@/components/development/development-cockpit";
import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { loadDevelopmentOverview } from "@/lib/development/load";
import { LANE_META, type DevelopmentLaneId } from "@/lib/development/signals";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Development — Pathways Portal" };

function parseLane(value: string | undefined): DevelopmentLaneId | null {
  if (value && value in LANE_META) return value as DevelopmentLaneId;
  return null;
}

export default async function DevelopmentPage({
  searchParams,
}: {
  searchParams?: { who?: string; lane?: string };
}) {
  if (!isPeopleDashboardEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const leadership = await requireLeadership().catch(() => null);
  if (!leadership) notFound();

  const hubAccess = getPeopleHubAccess(viewer);
  if (!hubAccess.showPerformance) redirect("/people/directory");

  const who = searchParams?.who === "officers" ? "officers" : "instructors";
  const laneFilter = parseLane(searchParams?.lane);
  const overview = await loadDevelopmentOverview(
    who === "officers" ? "officer" : "instructor"
  );

  return (
    <div className="mx-auto w-full max-w-[1000px] px-1 pb-12 pt-2">
      <PeopleHubNav active="develop" showPerformance />

      <div className="mb-5 mt-4">
        <PageHeaderV2
          eyebrow="Leadership development"
          title="Development"
          subtitle="Who needs coaching, who is carrying too much, and who is ready for more — across the instructors and officers who run YPP."
        />
      </div>

      <DevelopmentCockpit overview={overview} who={who} laneFilter={laneFilter} />
    </div>
  );
}
