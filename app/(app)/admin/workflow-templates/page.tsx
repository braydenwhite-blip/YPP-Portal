import Link from "next/link";

import { PageHeaderV2 } from "@/components/ui-v2/page-header";
import { CardV2 } from "@/components/ui-v2/card";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import { EmptyStateV2 } from "@/components/ui-v2/empty-state";
import { requireAdminPage } from "@/lib/page-guards";
import { listTemplates } from "@/lib/workflow-engine/queries";
import { WORKFLOW_BLUEPRINTS } from "@/lib/workflow-engine/blueprints";
import { workflowDomainLabel } from "@/lib/workflow-engine/constants";
import {
  TemplatesHubActions,
  type BlueprintOption,
} from "@/components/workflow-engine/templates-hub-actions";

export const metadata = { title: "Workflow Templates · Admin" };

export default async function WorkflowTemplatesPage() {
  await requireAdminPage();
  const templates = await listTemplates({ includeArchived: true });

  const blueprintOptions: BlueprintOption[] = WORKFLOW_BLUEPRINTS.map((b) => ({
    key: b.key,
    name: b.name,
    domainLabel: workflowDomainLabel(b.domain),
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeaderV2
        eyebrow="Admin · MissionOS"
        title="Workflow Templates"
        subtitle="Design reusable processes once — partner acquisition, hiring, onboarding, launches — then run them as workflows."
        actions={<TemplatesHubActions blueprints={blueprintOptions} />}
      />

      {templates.length === 0 ? (
        <CardV2 padding="lg">
          <EmptyStateV2
            title="No templates yet"
            body="Install a ready-made blueprint or build one from scratch."
          />
        </CardV2>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <Link key={t.id} href={`/admin/workflow-templates/${t.id}`}>
              <CardV2 padding="md" className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-semibold text-ink">{t.name}</span>
                  <StatusBadge
                    tone={
                      t.status === "PUBLISHED"
                        ? "success"
                        : t.status === "ARCHIVED"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {t.status.toLowerCase()}
                  </StatusBadge>
                </div>
                {t.description ? (
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{t.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                  <span>{t.domainLabel}</span>
                  <span>· {t.stageCount} stages</span>
                  <span>· {t.stepCount} steps</span>
                  <span>· {t.automationCount} automations</span>
                  {t.activeInstanceCount > 0 ? (
                    <span className="text-brand-700">· {t.activeInstanceCount} running</span>
                  ) : null}
                  {t.isBlueprint ? <StatusBadge tone="info">blueprint</StatusBadge> : null}
                </div>
              </CardV2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
