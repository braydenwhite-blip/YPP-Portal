import { CardV2 } from "@/components/ui-v2/card";
import { EntityChip } from "@/components/ui-v2/entity-chip";
import { ButtonLink } from "@/components/ui-v2/button";

/**
 * "What to do next, and why" — the single most important line on the whole
 * activation layer. A summary/teaser meant to live on OTHER pages (entity
 * detail pages, dashboards); the actual complete/block actions live in the
 * full runner at /workflows/[id] (components/workflow-engine/workflow-runner.tsx).
 */
export function WorkflowNextStepCard({
  nextStep,
  instanceId,
}: {
  nextStep: {
    executionId: string;
    title: string;
    description: string | null;
    ownerId: string | null;
    ownerName: string | null;
    dueAt: string | null;
    kind: string;
  } | null;
  instanceId: string;
}) {
  if (!nextStep) return null;

  const dueLabel = formatDueDate(nextStep.dueAt);

  return (
    <CardV2 padding="lg" className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        Next step
      </p>
      <p className="text-[16px] font-semibold text-ink">{nextStep.title}</p>
      {nextStep.description ? (
        <p className="text-[13px] text-ink-muted">{nextStep.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-muted">
        <div className="flex items-center gap-1.5">
          <span>Owner:</span>
          {nextStep.ownerId ? (
            <EntityChip
              type="person"
              id={nextStep.ownerId}
              label={nextStep.ownerName ?? "Owner"}
            />
          ) : (
            <span className="text-ink-muted">Unassigned</span>
          )}
        </div>
        {dueLabel ? <span>Due {dueLabel}</span> : null}
      </div>
      <div className="flex justify-end">
        <ButtonLink href={`/workflows/${instanceId}`} variant="secondary" size="sm">
          Open workflow
        </ButtonLink>
      </div>
    </CardV2>
  );
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
