import { redirect } from "next/navigation";

import { PageHeaderV2 } from "@/components/ui-v2";
import { ImportPartners } from "@/components/partners/crm/import-partners";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { getPartnerScope, partnerScopeWhere } from "@/lib/partners/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import partners · Partners" };

export default async function ImportPartnersPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const scope = await getPartnerScope();
  // Import attaches partners to a chapter, so it requires a chapter to import into.
  if (!scope.ledChapterId) redirect("/partners");

  const existing = await prisma.partner.findMany({
    where: partnerScopeWhere(scope),
    select: { id: true, name: true, website: true, location: true, contactEmail: true },
    take: 1000,
  });

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-14 pt-2">
      <PageHeaderV2
        eyebrow="Partners"
        backHref="/partners"
        backLabel="Partners"
        title="Import partners"
        subtitle="Bring your partner research from a spreadsheet straight into the pipeline."
      />
      <div className="mt-5">
        <ImportPartners chapterId={scope.ledChapterId} existing={existing} />
      </div>
    </div>
  );
}
