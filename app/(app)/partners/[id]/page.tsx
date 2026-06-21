import { redirect } from "next/navigation";
import Link from "next/link";

import { PartnerOperationsDetailView } from "@/components/partners/partner-operations-detail";
import { getSession } from "@/lib/auth-supabase";
import { hasRole } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadPartnerOperationsDetail } from "@/lib/partners-operations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner — Pathways Portal" };

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const { id } = await params;
  const partner = await loadPartnerOperationsDetail(id, viewer);
  if (!partner) redirect("/partners");

  const canManage = hasRole(viewer.roles, "ADMIN", viewer.primaryRole);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      <Link
        href="/partners"
        className="mb-4 inline-block text-[13px] font-semibold text-[#5a1da8] no-underline hover:underline"
      >
        ← All partners
      </Link>

      <PartnerOperationsDetailView partner={partner} canManage={canManage && isActionTrackerEnabled()} />
    </div>
  );
}
