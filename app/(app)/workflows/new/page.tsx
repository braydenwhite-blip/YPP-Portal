import { PageHeaderV2 } from "@/components/ui-v2/page-header";
import { requirePageRoles } from "@/lib/page-guards";
import { listStartableTemplates } from "@/lib/workflow-engine/queries";
import { StartWorkflowForm } from "@/components/workflow-engine/start-workflow-form";

export const metadata = { title: "Start workflow · MissionOS" };

const OFFICER_ROLES = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"];

export default async function NewWorkflowPage() {
  await requirePageRoles(OFFICER_ROLES);
  const templates = await listStartableTemplates();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <PageHeaderV2
        eyebrow="MissionOS"
        title="Start a workflow"
        subtitle="Pick a published template and the engine runs it from here."
        backHref="/workflows"
        backLabel="Workflows"
      />
      <StartWorkflowForm templates={templates} />
    </div>
  );
}
