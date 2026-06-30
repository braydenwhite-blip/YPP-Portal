import { notFound } from "next/navigation";

import { PageHeaderV2 } from "@/components/ui-v2/page-header";
import { ButtonLink } from "@/components/ui-v2/button";
import { requireAdminPage } from "@/lib/page-guards";
import { getTemplateDefinition } from "@/lib/workflow-engine/queries";
import { workflowDomainLabel } from "@/lib/workflow-engine/constants";
import { TemplateBuilder } from "@/components/workflow-engine/template-builder";

export const metadata = { title: "Edit template · Admin" };

export default async function WorkflowTemplateBuilderPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdminPage();
  const template = await getTemplateDefinition(params.id);
  if (!template) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6">
      <PageHeaderV2
        eyebrow={`Builder · ${workflowDomainLabel(template.domain)}`}
        title={template.name}
        subtitle={template.description ?? "Design this reusable process."}
        backHref="/admin/workflow-templates"
        backLabel="Templates"
        actions={
          template.status === "PUBLISHED" ? (
            <ButtonLink href="/workflows/new" variant="secondary">
              Start a run
            </ButtonLink>
          ) : null
        }
      />
      <TemplateBuilder template={template} />
    </div>
  );
}
