import { notFound, redirect } from "next/navigation";

import { CommandModeToggle } from "@/components/command-center/command-mode";
import { PartnerCreateForm } from "@/components/command-center/partner-create-form";
import { SimpleActionStrip, SimpleSurface, type SimpleAction } from "@/components/command-center/simple";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import { hasRole } from "@/lib/authorization";
import { getSession } from "@/lib/auth-supabase";
import { isPartnerPipelineEnabled } from "@/lib/feature-flags";
import { listRelationshipLeadOptions } from "@/lib/partners-queries";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add partner · Partners" };

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

export default async function NewPartnerPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) notFound();

  const canManagePartners = hasRole(viewer.roles, "ADMIN", viewer.primaryRole);
  if (!canManagePartners) {
    return (
      <SimpleSurface
        maxWidth={720}
        header={
          <PageHeaderV2
            eyebrow="Knowledge OS"
            backHref="/partners"
            backLabel="Partners"
            title="Add a partner"
            subtitle="Partner records are managed by admins."
            actions={<CommandModeToggle />}
          />
        }
        aboveBrowse={
          <div className="rounded-[20px] border border-line-soft bg-surface px-6 py-8 text-center shadow-card">
            <p className="m-0 text-[15px] font-semibold text-ink">Admin access required</p>
            <p className="m-0 mt-2 text-[13px] text-ink-muted">
              You can browse partners and log meetings, but adding a new organization needs an admin.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/partners" variant="primary" size="md">
                Browse partners
              </ButtonLink>
              <ButtonLink href="/actions/meetings/new?area=PARTNERSHIPS" variant="secondary" size="md">
                Log a meeting
              </ButtonLink>
            </div>
          </div>
        }
      />
    );
  }

  const leads = (await listRelationshipLeadOptions()).map((lead) => ({
    id: lead.id,
    name: personName(lead),
  }));

  const strip: SimpleAction[] = [
    { label: "All partners", href: "/partners", icon: "users" },
    { label: "Add action", href: "/actions/new", icon: "bolt" },
    { label: "Schedule meeting", href: "/actions/meetings/new?area=PARTNERSHIPS", icon: "calendar" },
  ];

  return (
    <SimpleSurface
      maxWidth={720}
      header={
        <PageHeaderV2
          eyebrow="Knowledge OS"
          backHref="/partners"
          backLabel="Partners"
          title="Add a partner"
          subtitle="Organization name and relationship owner — contacts come next."
          actions={<CommandModeToggle />}
        />
      }
      aboveBrowse={
        <div className="flex flex-col gap-5">
          <PartnerCreateForm
            leads={leads}
            currentUserId={viewer.id}
            cancelHref="/partners"
            pipelineEnabled={isPartnerPipelineEnabled()}
          />
          <SimpleActionStrip actions={strip} />
        </div>
      }
    />
  );
}
