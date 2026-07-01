import { notFound } from "next/navigation";

import { PageHeaderV2 } from "@/components/ui-v2/page-header";
import { requirePageRoles } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { getInstanceDetail } from "@/lib/workflow-engine/queries";
import { workflowDomainLabel } from "@/lib/workflow-engine/constants";
import { listAssignableUsers } from "@/lib/weekly-meetings/teams";
import { loadWorkflowCockpitIntel } from "@/lib/data-360/workflow-cockpit-intel";
import { WorkflowRunner } from "@/components/workflow-engine/workflow-runner";
import { WorkflowIntelligencePanel } from "@/components/workflow-engine/workflow-intelligence-panel";

export const metadata = { title: "Workflow · MissionOS" };

const OFFICER_ROLES = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"];

export default async function WorkflowInstancePage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageRoles(OFFICER_ROLES);
  const detail = await getInstanceDetail(params.id);
  if (!detail) notFound();

  const [assignableUsers, attachments, intel] = await Promise.all([
    listAssignableUsers(),
    prisma.workflowAttachment.findMany({
      where: { workflowInstanceId: params.id },
      select: { id: true, entityType: true, entityId: true, relationship: true },
    }),
    loadWorkflowCockpitIntel(detail),
  ]);

  const subtitleParts = [
    detail.templateName,
    workflowDomainLabel(detail.definition.domain),
    detail.ownerName ? `Owner: ${detail.ownerName}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <PageHeaderV2
        eyebrow="Workflow"
        title={detail.instance.title}
        subtitle={subtitleParts.join(" · ")}
        backHref="/workflows"
        backLabel="Workflows"
      />
      <WorkflowIntelligencePanel intel={intel} />
      <WorkflowRunner
        detail={detail}
        assignableUsers={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
        relatedAttachments={attachments}
      />
    </div>
  );
}
