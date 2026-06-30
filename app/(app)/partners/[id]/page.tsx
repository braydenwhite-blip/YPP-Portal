import { redirect } from "next/navigation";

import { PartnerOperatingRoom } from "@/components/partners/crm/partner-operating-room";
import { getSession } from "@/lib/auth-supabase";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { requirePartnerAccess } from "@/lib/partners/permissions";
import { loadPartnerDetail } from "@/lib/partners/detail";

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

  // Chapter-scoped access: leadership or the CP who owns this partner's chapter.
  const access = await requirePartnerAccess(id).catch(() => null);
  if (!access) redirect("/partners");

  const partner = await loadPartnerDetail(id, access);
  if (!partner) redirect("/partners");

  return (
    <div className="mx-auto w-full max-w-[1100px] px-1 pb-14 pt-2">
      <PartnerOperatingRoom partner={partner} />
    </div>
  );
}
