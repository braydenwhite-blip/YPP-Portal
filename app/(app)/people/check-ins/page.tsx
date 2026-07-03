import { notFound, redirect } from "next/navigation";

import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { LegacySurfaceBanner } from "@/components/ui-v2";
import { MonthlyCheckInsClient } from "@/components/people-strategy/monthly-check-ins-client";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadMonthlyCheckInQueue } from "@/lib/people-strategy/people-performance";
import { parseMonthKey } from "@/lib/people-strategy/people-performance-selectors";
import { getSession } from "@/lib/auth-supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly Check-ins — Pathways Portal" };

export default async function MonthlyCheckInsPage() {
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

  const { queue, currentMonthKey } = await loadMonthlyCheckInQueue();
  const currentMonth = parseMonthKey(currentMonthKey);
  const monthQueueLabel = currentMonth
    ? new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
        .format(currentMonth)
        .toUpperCase()
    : currentMonthKey.toUpperCase();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      <PeopleHubNav active="check-ins" showPerformance />

      <div className="mt-4">
        <LegacySurfaceBanner
          title="Check-ins now live in Mentorship."
          body="This page keeps the monthly rating rollup; each person's conversation record moved into their Mentorship workspace."
          ctaLabel="Open Mentorship"
          ctaHref="/mentorship?view=admin"
        />
      </div>

      <div className="mb-5 mt-4">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
          Monthly Check-ins
        </h1>
        <p className="m-0 mt-1.5 max-w-[640px] text-[13.5px] leading-relaxed text-[#717189]">
          Every member has a monthly check-in with their mentor. Each one moves
          through five steps before the meeting.
        </p>
      </div>

      <MonthlyCheckInsClient
        queue={queue}
        monthQueueLabel={monthQueueLabel}
        currentMonthKey={currentMonthKey}
      />
    </div>
  );
}
