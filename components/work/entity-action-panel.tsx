import Link from "next/link";

import { ButtonLink, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { EntityActionRowCapture } from "./entity-action-row-capture";
import {
  canEditAction,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import type { Entity360Type } from "@/lib/operations/entity-360";
import {
  deriveEntityActionPanel,
  type DecisionLite,
} from "@/lib/people-strategy/action-operations-intel";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  actionPrefillToQuery,
  buildActionPrefillFromEntity,
} from "@/lib/people-strategy/action-prefill";
import type { RelatedEntityType } from "@/lib/people-strategy/constants";
import {
  effectiveDeadline,
  isActionOverdue,
} from "@/lib/people-strategy/my-actions-selectors";

/**
 * Action System 4.0 — the Entity Action Operating Panel, rendered inside an
 * entity's record page (partner / instructor / student / class / application).
 * Pure presentation over `deriveEntityActionPanel`: the entity's open work,
 * what's overdue/blocked/unowned, the one suggested next move, the last
 * completed item, and decisions about this entity that never became actions.
 * Quick actions: create a linked action (honest ENTITY provenance via the
 * prefill contract) and open the Work Hub filtered to this entity.
 * Tailwind-only subtree; server component.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 7;

const RELATED_TO_ENTITY_360: Partial<Record<RelatedEntityType, Entity360Type>> = {
  CLASS_OFFERING: "class",
  MENTORSHIP: "mentorship",
  USER: "person",
  INSTRUCTOR_APPLICATION: "applicant",
  PARTNER: "partner",
};

function actionTone(action: ActionItemWithRelations, now: Date): StatusTone {
  if (isActionOverdue(action, now)) return "danger";
  if (action.status === "BLOCKED") return "warning";
  if (action.status === "IN_PROGRESS") return "info";
  return "neutral";
}

function actionStatusLabel(action: ActionItemWithRelations, now: Date): string {
  if (isActionOverdue(action, now)) {
    const days = Math.max(
      1,
      Math.floor((now.getTime() - effectiveDeadline(action).getTime()) / DAY_MS)
    );
    return `Overdue ${days}d`;
  }
  if (action.status === "BLOCKED") return "Blocked";
  const due = effectiveDeadline(action);
  return `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function ownerName(action: ActionItemWithRelations): string {
  return action.lead?.name ?? action.lead?.email ?? "Unowned";
}

export function EntityActionPanel({
  actions,
  decisions,
  entityType,
  entityId,
  entityLabel,
  viewer,
  now = new Date(),
}: {
  actions: ActionItemWithRelations[];
  decisions?: DecisionLite[];
  entityType: RelatedEntityType;
  entityId: string;
  entityLabel: string;
  /** When provided, rows the viewer can edit get inline Complete / Block. */
  viewer?: ActionViewer;
  now?: Date;
}) {
  const panel = deriveEntityActionPanel({ actions, decisions }, now);

  const newActionHref = actionPrefillToQuery(
    buildActionPrefillFromEntity({ type: entityType, id: entityId })
  );
  const entity360 = RELATED_TO_ENTITY_360[entityType];
  const workHubHref = entity360 ? `/work?entity=${entity360}:${entityId}` : "/work";

  const unowned = panel.open.filter(
    (action) => !action.assignments.some((a) => a.role === "EXECUTING")
  );
  const dueSoon = panel.open.filter(
    (action) =>
      !isActionOverdue(action, now) &&
      effectiveDeadline(action).getTime() <= now.getTime() + DUE_SOON_DAYS * DAY_MS
  );

  const quickActions = (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonLink href={newActionHref} variant="secondary" size="sm">
        Create action
      </ButtonLink>
      <ButtonLink href={workHubHref} variant="ghost" size="sm">
        View in Work →
      </ButtonLink>
    </div>
  );

  if (panel.isClear) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13.5px] text-ink-muted">
          No live action work is linked to {entityLabel} right now.
        </p>
        {quickActions}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* The one move that matters most for this entity. */}
      {panel.suggestedNext ? (
        <div className="rounded-[10px] border border-brand-200 bg-brand-50/60 px-3.5 py-3">
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-brand-700">
            Suggested next move
          </p>
          <p className="m-0 mt-1 text-[13.5px] text-ink">
            <Link
              href={`/actions/${panel.suggestedNext.action.id}`}
              className="font-semibold text-brand-700 hover:underline"
            >
              {panel.suggestedNext.action.title}
            </Link>{" "}
            — {panel.suggestedNext.move.move}
          </p>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
            {panel.suggestedNext.move.why}
          </p>
        </div>
      ) : null}

      {/* Concrete counts — never a composite score (§19). */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="neutral">{panel.open.length} open</StatusBadge>
        {panel.overdue.length > 0 ? (
          <StatusBadge tone="danger">{panel.overdue.length} overdue</StatusBadge>
        ) : null}
        {panel.blocked.length > 0 ? (
          <StatusBadge tone="warning">{panel.blocked.length} blocked</StatusBadge>
        ) : null}
        {dueSoon.length > 0 ? (
          <StatusBadge tone="info">
            {dueSoon.length} due within {DUE_SOON_DAYS} days
          </StatusBadge>
        ) : null}
        {unowned.length > 0 ? (
          <StatusBadge tone="warning">{unowned.length} need an owner</StatusBadge>
        ) : null}
      </div>

      {panel.open.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {panel.open.slice(0, 6).map((action) => (
            <li
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/actions/${action.id}`}
                  className="block truncate text-[13px] font-semibold text-ink hover:text-brand-700 hover:underline"
                >
                  {action.title}
                </Link>
                <p className="m-0 text-[11.5px] text-ink-muted">
                  {ownerName(action)}
                  {action.officerMeeting
                    ? ` · From meeting: ${action.officerMeeting.title ?? "Officer meeting"}`
                    : ""}
                </p>
              </div>
              <StatusBadge tone={actionTone(action, now)}>
                {actionStatusLabel(action, now)}
              </StatusBadge>
              {viewer &&
              canEditAction(viewer, {
                leadId: action.leadId,
                createdById: action.createdById,
                visibility: action.visibility,
                assignments: action.assignments.map((a) => ({
                  userId: a.user.id,
                  role: a.role,
                })),
              }) ? (
                <EntityActionRowCapture
                  actionId={action.id}
                  blockedReason={action.blockedReason}
                  completionNote={action.completionNote}
                  completionOutcome={action.completionOutcome}
                  nextFollowUpAt={action.nextFollowUpAt}
                />
              ) : null}
            </li>
          ))}
          {panel.open.length > 6 ? (
            <li className="text-[12px] text-ink-muted">
              <Link href={workHubHref} className="font-semibold text-brand-700 hover:underline">
                + {panel.open.length - 6} more — view all in Work →
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      {panel.decisionsWithoutActions.length > 0 ? (
        <div className="rounded-[8px] border border-amber-200 bg-amber-50/60 px-3 py-2">
          <p className="m-0 text-[12.5px] font-semibold text-ink">
            {panel.decisionsWithoutActions.length} decision
            {panel.decisionsWithoutActions.length === 1 ? "" : "s"} about this record still
            need actions
          </p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
            {panel.decisionsWithoutActions.slice(0, 3).map((decision) => (
              <li key={decision.id} className="truncate text-[12.5px] text-ink-muted">
                · {decision.decision}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {panel.lastCompleted ? (
        <p className="m-0 text-[12px] text-ink-muted">
          Last completed:{" "}
          <Link
            href={`/actions/${panel.lastCompleted.id}`}
            className="text-ink hover:underline"
          >
            {panel.lastCompleted.title}
          </Link>
          {panel.lastCompleted.completedAt
            ? ` · ${panel.lastCompleted.completedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : ""}
        </p>
      ) : null}

      {quickActions}
    </div>
  );
}
