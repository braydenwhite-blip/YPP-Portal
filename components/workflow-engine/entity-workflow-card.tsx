// ============================================================================
// Universal Workflow Engine — EntityWorkflowCard (Part 3 of the activation layer)
// ============================================================================
//
// The single "drop this into any entity page and see its workflow state"
// component. An async server component: fetches its own data (composing the
// already-built card-data loaders + health + attachment pieces — it does not
// re-derive any of their logic) and renders either:
//   - an empty state + WorkflowStartButton, when the entity has no active
//     primary workflow yet ("workflows should feel unavoidable"), or
//   - a live summary card: stage pill + health badge (with the concrete
//     `reasons` always visible, never a bare color chip), progress strip,
//     next-step card, an attach-another-workflow button, and (opt-in) the
//     linked actions / linked meetings / recent-activity detail blocks.
//
// Props:
//   - entityType   (required) — a WorkflowEntityType value, e.g. "PARTNER".
//   - entityId     (required) — the id of that entity row.
//   - chapterId    (optional) — forwarded to WorkflowStartButton so a newly
//                   started instance is scoped to the right chapter.
//   - title        (optional) — header title; defaults to the running
//                   instance's template name (or is omitted from the empty
//                   state, which always names the entity type instead).
//   - showDetails  (optional, default false) — opt-in "full detail" mode.
//                   false (default): a compact card — header, progress,
//                   health reasons, next step, attach button, other-workflow
//                   count. true: additionally fetches and renders
//                   WorkflowLinkedActions, WorkflowLinkedMeetings and
//                   WorkflowTimelineMini below the above. Left as a prop
//                   (rather than always-on) so a page that embeds several
//                   cards at once (e.g. a dashboard) can stay lightweight,
//                   while a single entity's detail page can opt into the
//                   full picture.
//
// Uses a plain CardV2 (not RecordSection) as the outer wrapper: this card is
// meant to be dropped in as ONE block among several on an entity page (often
// beside other CardV2s in a sidebar/summary rail), not to *be* a whole page
// section with its own anchor — callers that want the RecordSection chrome
// (title/description/id) can wrap <EntityWorkflowCard /> in one themselves.

import { CardV2 } from "@/components/ui-v2/card";
import { EmptyStateV2 } from "@/components/ui-v2/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui-v2/status-badge";
import { ButtonLink } from "@/components/ui-v2/button";
import { WorkflowStagePill } from "@/components/workflow-engine/workflow-stage-pill";
import { WorkflowProgressStrip } from "@/components/workflow-engine/workflow-progress-strip";
import { WorkflowNextStepCard } from "@/components/workflow-engine/workflow-next-step-card";
import { WorkflowBlockerList } from "@/components/workflow-engine/workflow-blocker-list";
import { WorkflowLinkedActions } from "@/components/workflow-engine/workflow-linked-actions";
import { WorkflowLinkedMeetings } from "@/components/workflow-engine/workflow-linked-meetings";
import { WorkflowTimelineMini } from "@/components/workflow-engine/workflow-timeline-mini";
import { WorkflowStartButton } from "@/components/workflow-engine/workflow-start-button";
import { WorkflowAttachButton } from "@/components/workflow-engine/workflow-attach-button";
import {
  getEntityWorkflowSummary,
  getWorkflowLinkedActionsData,
  getWorkflowLinkedMeetingsData,
  getWorkflowTimelineData,
} from "@/lib/workflow-engine/card-data";
import { listStartableTemplates } from "@/lib/workflow-engine/queries";
import { workflowEntityTypeLabel } from "@/lib/workflow-engine/entity-types";
import type { WorkflowHealthStatus } from "@/lib/workflow-engine/health";
import type { StageProgressStatus } from "@/lib/workflow-engine/types";

const HEALTH_TONE: Record<WorkflowHealthStatus, StatusTone> = {
  ON_TRACK: "success",
  NEEDS_ATTENTION: "warning",
  BLOCKED: "danger",
  OVERDUE: "danger",
  STALLED: "warning",
  COMPLETE: "neutral",
  ARCHIVED: "neutral",
};

const HEALTH_LABEL: Record<WorkflowHealthStatus, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  BLOCKED: "Blocked",
  OVERDUE: "Overdue",
  STALLED: "Stalled",
  COMPLETE: "Complete",
  ARCHIVED: "Archived",
};

/** Drop health.ts's per-step "is blocked" reasons — WorkflowBlockerList above
 *  already shows those, one line per step, instead of a generic bullet. */
function nonBlockedReasons(reasons: string[]): string[] {
  return reasons.filter((r) => !r.includes("is blocked"));
}

export async function EntityWorkflowCard({
  entityType,
  entityId,
  chapterId,
  title,
  showDetails = false,
}: {
  entityType: string;
  entityId: string;
  chapterId?: string | null;
  title?: string;
  /** Opt-in "full detail" mode — also renders linked actions, linked
   *  meetings, and a recent-activity timeline. Defaults to false so pages
   *  embedding several cards at once stay lightweight. */
  showDetails?: boolean;
}): Promise<JSX.Element> {
  const entityLabel = workflowEntityTypeLabel(entityType);
  const summary = await getEntityWorkflowSummary(entityType, entityId);

  if (!summary) {
    const templates = await listStartableTemplates();
    return (
      <CardV2 padding="lg">
        <EmptyStateV2
          title="No active workflow yet"
          body={`This ${entityLabel.toLowerCase()} doesn't have a workflow running. Start one to track what happens next.`}
          action={
            <WorkflowStartButton
              entityType={entityType}
              entityId={entityId}
              templates={templates}
              chapterId={chapterId}
            />
          }
        />
      </CardV2>
    );
  }

  const [linkedActions, linkedMeetings, timeline] = showDetails
    ? await Promise.all([
        getWorkflowLinkedActionsData(summary.instanceId),
        getWorkflowLinkedMeetingsData(summary.instanceId),
        getWorkflowTimelineData(summary.instanceId),
      ])
    : [[], [], []];

  const stageStatus: StageProgressStatus =
    summary.health.status === "BLOCKED" ? "BLOCKED" : "CURRENT";
  const healthTone = HEALTH_TONE[summary.health.status];
  const healthTitle =
    summary.health.reasons.length > 0 ? summary.health.reasons.join(" · ") : undefined;

  return (
    <CardV2 padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[15px] font-bold text-ink">{title ?? summary.templateName}</p>
          <div className="flex flex-wrap items-center gap-2">
            {summary.currentStageName ? (
              <WorkflowStagePill stageName={summary.currentStageName} status={stageStatus} />
            ) : null}
            <StatusBadge tone={healthTone} title={healthTitle}>
              {HEALTH_LABEL[summary.health.status]}
            </StatusBadge>
          </div>
        </div>
        <ButtonLink href={`/workflows/${summary.instanceId}`} variant="ghost" size="sm">
          View full workflow
        </ButtonLink>
      </div>

      <WorkflowProgressStrip
        completionPercent={summary.completionPercent}
        stageLabel={summary.currentStageName ?? undefined}
      />

      <WorkflowBlockerList blockers={summary.blockers} />

      {/* Non-blocked reasons only — a blocked step's reason is already shown
          via WorkflowBlockerList above, one line per step rather than a
          generic bullet. */}
      {nonBlockedReasons(summary.health.reasons).length > 0 ? (
        <ul className="flex flex-col gap-1">
          {nonBlockedReasons(summary.health.reasons).map((reason) => (
            <li key={reason} className="text-[12.5px] text-ink-muted">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      <WorkflowNextStepCard nextStep={summary.nextStep} instanceId={summary.instanceId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {summary.otherActiveCount > 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            +{summary.otherActiveCount} other active workflow
            {summary.otherActiveCount === 1 ? "" : "s"} for this {entityLabel.toLowerCase()}
          </p>
        ) : (
          <span />
        )}
        <WorkflowAttachButton
          entityType={entityType}
          entityId={entityId}
          excludeInstanceId={summary.instanceId}
        />
      </div>

      {showDetails ? (
        <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
          <WorkflowLinkedActions actions={linkedActions} />
          <WorkflowLinkedMeetings meetings={linkedMeetings} />
          <WorkflowTimelineMini events={timeline} />
        </div>
      ) : null}
    </CardV2>
  );
}
