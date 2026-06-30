// The single factory every generator/normalizer uses to mint an `AutomationItem`.
// It fills the boilerplate (status, createdAt, workflow/relevance/dismissability
// from the type registry, urgency from `rank.ts`, deterministic id) so callers
// only provide the meaningful, type-specific fields. Pure (pass `now`).

import {
  AUTOMATION_TYPE_META,
  type AutomationItem,
  type AutomationItemType,
  type AutomationEntityType,
  type AutomationSeverity,
  type AutomationEscalation,
  type ImpactMeetingRelevance,
} from "@/lib/automation/types";
import { automationItemId, type ItemIdParts } from "@/lib/automation/item-identity";
import { computeUrgency } from "@/lib/automation/rank";
import { isoOrNull } from "@/lib/automation/date-helpers";

export type MakeAutomationItemInput = {
  type: AutomationItemType;
  chapterId: string;
  now: Date;

  title: string;
  description: string;
  why: string;
  resolvesWhen: string;

  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel?: string | null;
  secondaryActionHref?: string | null;

  entityType?: AutomationEntityType | null;
  entityId?: string | null;
  ownerId?: string | null;

  /** Override the type's default severity (e.g. upgrade when overdue). */
  severity?: AutomationSeverity;
  /** Hard due date for the work, if any. */
  dueAt?: Date | null;

  sourceData?: Record<string, unknown>;
  escalation?: AutomationEscalation | null;
  impactMeetingRelevance?: ImpactMeetingRelevance;
  playbookWeekRelevance?: number | null;
  /** Chapter's current playbook week (drives urgency's "falling behind" term). */
  currentWeek?: number;

  /** Override the deterministic id, or supply id parts for it. */
  id?: string;
  idParts?: ItemIdParts;
};

export function makeAutomationItem(input: MakeAutomationItemInput): AutomationItem {
  const meta = AUTOMATION_TYPE_META[input.type];
  const severity = input.severity ?? meta.defaultSeverity;
  const dueAt = input.dueAt ?? null;
  const escalation = input.escalation ?? null;

  const id = input.id ?? automationItemId(input.type, input.chapterId, input.idParts ?? { entityId: input.entityId });

  const urgency = computeUrgency({
    severity,
    dueAt,
    now: input.now,
    hasEscalation: escalation != null,
    playbookWeekRelevance: input.playbookWeekRelevance ?? null,
    currentWeek: input.currentWeek,
  });

  return {
    id,
    type: input.type,
    workflow: meta.workflow,
    chapterId: input.chapterId,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    title: input.title,
    description: input.description,
    why: input.why,
    dueAt: isoOrNull(dueAt),
    createdAt: input.now.toISOString(),
    severity,
    urgency,
    status: "OPEN",
    ownerId: input.ownerId ?? null,
    primaryActionLabel: input.primaryActionLabel,
    primaryActionHref: input.primaryActionHref,
    secondaryActionLabel: input.secondaryActionLabel ?? null,
    secondaryActionHref: input.secondaryActionHref ?? null,
    sourceData: input.sourceData ?? {},
    resolvesWhen: input.resolvesWhen,
    canDismiss: meta.canDismiss,
    canSnooze: meta.canSnooze,
    escalation,
    impactMeetingRelevance: input.impactMeetingRelevance ?? meta.impactMeetingRelevance,
    playbookWeekRelevance: input.playbookWeekRelevance ?? null,
  };
}
