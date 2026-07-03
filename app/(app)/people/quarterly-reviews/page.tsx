import { notFound, redirect } from "next/navigation";

import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { LegacySurfaceBanner } from "@/components/ui-v2";
import { QuarterlyReviewsClient } from "@/components/people-strategy/quarterly-reviews-client";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadQuarterlyReviewsDashboard } from "@/lib/people-strategy/quarterly-reviews-dashboard";
import { getSession } from "@/lib/auth-supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quarterly Reviews — Pathways Portal" };

export default async function QuarterlyReviewsPage() {
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

  const { rows } = await loadQuarterlyReviewsDashboard();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      <PeopleHubNav active="quarterly-reviews" showPerformance />

      <div className="mt-4">
        <LegacySurfaceBanner
          title="A person's full story now lives in Mentorship."
          body="This roll-up stays for the quarterly committee; each person's development record and timeline moved into their Mentorship workspace."
          ctaLabel="Open Mentorship"
          ctaHref="/mentorship"
        />
      </div>

      <div className="mb-5 mt-4">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
          Quarterly Reviews
        </h1>
        <p className="m-0 mt-1.5 max-w-[720px] text-[13.5px] leading-relaxed text-[#717189]">
          Every three months a member&apos;s check-ins, action history, and feedback
          roll up into a mentor committee review. Leadership-only.
        </p>
      </div>

      <QuarterlyReviewsClient rows={rows} />
    </div>
  );
}
