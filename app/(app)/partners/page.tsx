import { redirect } from "next/navigation";

import { PartnersOperationsTable } from "@/components/partners/partners-operations-table";
import { ButtonLink } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { hasRole } from "@/lib/authorization";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { loadPartnersOperationsList } from "@/lib/partners-operations";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partners — Pathways Portal",
};

/**
 * Partners — relationship operations by chapter (handoff mockup).
 * Row click opens the partner detail at /partners/[id].
 */
export default async function PartnersPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const canManage = hasRole(viewer.roles, "ADMIN", viewer.primaryRole);
  const rows = await loadPartnersOperationsList();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
            Partners
          </h1>
          <p className="m-0 mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-[#717189]">
            Relationships organized by chapter — with the lead, connected classes,
            assigned instructors, and next follow-up.
          </p>
        </div>
        {canManage ? (
          <ButtonLink
            href="/people/classes"
            variant="primary"
            size="md"
            className="border-0 bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] shadow-none hover:opacity-95"
          >
            + Create class with partner
          </ButtonLink>
        ) : null}
      </div>

      <PartnersOperationsTable rows={rows} />
    </div>
  );
}
