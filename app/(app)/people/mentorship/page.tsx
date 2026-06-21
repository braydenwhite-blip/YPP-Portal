import { notFound, redirect } from "next/navigation";

import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { MentorshipDashboardClient } from "@/components/people-strategy/mentorship-dashboard-client";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadMentorshipDashboard } from "@/lib/people-strategy/mentorship-dashboard";
import { getSession } from "@/lib/auth-supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mentorship — Pathways Portal" };

export default async function PeopleMentorshipPage() {
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

  const data = await loadMentorshipDashboard();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      <PeopleHubNav active="mentorship" showPerformance />

      <div className="mb-5 mt-4">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
          Mentorship
        </h1>
        <p className="m-0 mt-1.5 max-w-[720px] text-[13.5px] leading-relaxed text-[#717189]">
          Every member has a mentor who runs monthly check-ins and writes G&Rs.
          Work the queues below — reviews, check-ins, and applications all connect
          to actions, meetings, and people.
        </p>
      </div>

      <MentorshipDashboardClient data={data} />
    </div>
  );
}
