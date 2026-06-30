import { redirect } from "next/navigation";

import { ButtonLink, EmptyStateV2, PageHeaderV2 } from "@/components/ui-v2";
import { PartnerWorkspace } from "@/components/partners/crm/partner-workspace";
import { getSession } from "@/lib/auth-supabase";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { getPartnerScope } from "@/lib/partners/permissions";
import { loadPartnerWorkspace } from "@/lib/partners/workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partners — Pathways Portal",
};

/**
 * Partner Command Workspace — the CP-facing partner CRM. Chapter Presidents see
 * their own chapter's pipeline; national leadership sees every partner. Replaces
 * the old plain operations table with the guided pipeline workspace.
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

  const scope = await getPartnerScope();

  // A Chapter President who hasn't been linked to a chapter yet.
  if (!scope.isLeadership && !scope.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Partners"
          title="Partner Workspace"
          subtitle="Research partners, send outreach, track follow-ups, and confirm partners for your chapter."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your chapter is set up, your partner pipeline appears here — research, outreach, follow-ups, meetings, and confirmed partners, all in one place."
            action={<ButtonLink href="/chapter/apply" variant="primary" size="md">Apply to start a chapter</ButtonLink>}
          />
        </div>
      </div>
    );
  }

  const data = await loadPartnerWorkspace(scope);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-1 pb-14 pt-2">
      <PageHeaderV2
        eyebrow={data.scopeLabel}
        title="Partners"
        subtitle="Build strong partnerships. Launch more classes. Change more lives."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/partners/import" variant="secondary" size="md">Import partners</ButtonLink>
            <ButtonLink href="/partners/new" variant="primary" size="md">+ Add partner</ButtonLink>
          </div>
        }
      />
      <div className="mt-5">
        <PartnerWorkspace data={data} />
      </div>
    </div>
  );
}
