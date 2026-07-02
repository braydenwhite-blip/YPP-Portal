import { notFound, redirect } from "next/navigation";

import { DevelopmentRecordView } from "@/components/development/development-record";
import { getSession } from "@/lib/auth-supabase";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { loadDevelopmentRecord } from "@/lib/development/record";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Development record — Pathways Portal" };

export default async function DevelopmentRecordPage({
  params,
}: {
  params: { id: string };
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

  const record = await loadDevelopmentRecord(params.id);
  if (!record) notFound();

  return (
    <div className="mx-auto w-full max-w-[880px] px-1 pb-12 pt-4">
      <DevelopmentRecordView record={record} />
    </div>
  );
}
