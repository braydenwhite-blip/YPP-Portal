import type { ActionItemWithRelations } from "./action-queries";
import { deriveActionUrgency } from "./action-intel";
import { isActionOverdue } from "./my-actions-selectors";

/**
 * People Strategy — the single "Next Action" helper.
 *
 * Given one action, decide the ONE most useful thing to do with it next. The
 * whole point of the redesign is that the system — not the user — picks the
 * obvious next move, so every surface (rows, the detail drawer hero, the
 * "Needs attention" feed) shows the same one primary button.
 *
 * Pure: no DB, no React, no session. `now` is injected so it unit-tests
 * deterministically. It REUSES the canonical primitives
 * ({@link isActionOverdue}, {@link deriveActionUrgency}) rather than
 * re-deriving "overdue" / "due soon", so there is one source of truth.
 *
 * The precedence ladder (most blocking gap first):
 *   1. settled (complete/dropped)  → View details
 *   2. no owner                    → Assign owner
 *   3. no deadline                 → Set deadline
 *   4. blocked                     → Unblock
 *   5. overdue                     → Update status
 *   6. due today / due soon        → Mark done
 *   7. no next step                → Add next step
 *   8. otherwise                   → Open details
 *
 * NOTE on "next step": the schema has no dedicated free-text next-step column,
 * so an action's "next step" is its {@link ActionItem.successDefinition} — the
 * one line that says what finishing looks like. Treating a missing definition
 * of done as "no next step" reuses the existing field instead of widening the
 * data model.
 */

export type ActionCtaKey =
  | "view"
  | "assign_owner"
  | "set_deadline"
  | "unblock"
  | "update_status"
  | "mark_done"
  | "add_next_step"
  | "open";

/**
 * How the surface should fulfil a CTA:
 * - `complete`  — one-click: mark the action done in place.
 * - `drawer`    — open the detail drawer (read context, pick a status, unblock).
 * - `edit`      — go to the edit form (assign, set a deadline, add a next step).
 */
export type ActionCtaBehavior = "complete" | "drawer" | "edit";

export type ActionCta = {
  key: ActionCtaKey;
  /** The button label shown to the user. */
  label: string;
  /** Short, plain-English reason this is the next move (for tooltips/aria). */
  reason: string;
  behavior: ActionCtaBehavior;
};

const CTA: Record<ActionCtaKey, Omit<ActionCta, "reason">> = {
  view: { key: "view", label: "View details", behavior: "drawer" },
  assign_owner: { key: "assign_owner", label: "Assign owner", behavior: "edit" },
  set_deadline: { key: "set_deadline", label: "Set deadline", behavior: "edit" },
  unblock: { key: "unblock", label: "Unblock", behavior: "drawer" },
  update_status: { key: "update_status", label: "Update status", behavior: "drawer" },
  mark_done: { key: "mark_done", label: "Mark done", behavior: "complete" },
  add_next_step: { key: "add_next_step", label: "Add next step", behavior: "edit" },
  open: { key: "open", label: "Open details", behavior: "drawer" },
};

/** An action has an owner when it carries a lead or someone executing it. */
export function actionHasOwner(item: ActionItemWithRelations): boolean {
  if (item.leadId) return true;
  return item.assignments.some((a) => a.role === "EXECUTING");
}

/** An action has a deadline when a start date is stored (rows usually do). */
export function actionHasDeadline(item: ActionItemWithRelations): boolean {
  return Boolean(item.deadlineStart);
}

/** An action has a "next step" when its definition of done is filled in. */
export function actionHasNextStep(item: ActionItemWithRelations): boolean {
  return Boolean((item.successDefinition ?? "").trim());
}

/**
 * Pick the single best next action (CTA) for one action item. Used everywhere a
 * primary button is shown so the UI stays consistent and uncluttered.
 */
export function deriveActionNextCta(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionCta {
  if (item.status === "COMPLETE" || item.status === "DROPPED") {
    return { ...CTA.view, reason: "It's done — open it to review the outcome." };
  }
  if (!actionHasOwner(item)) {
    return { ...CTA.assign_owner, reason: "Nobody owns this yet." };
  }
  if (!actionHasDeadline(item)) {
    return { ...CTA.set_deadline, reason: "It has no deadline to anchor it." };
  }
  if (item.status === "BLOCKED") {
    const reason = (item.blockedReason ?? "").trim();
    return {
      ...CTA.unblock,
      reason: reason ? `Blocked: ${reason}` : "It's blocked — clear or escalate it.",
    };
  }

  const urgency = deriveActionUrgency(item, now);
  if (isActionOverdue(item, now)) {
    const days = urgency.daysOverdue;
    return {
      ...CTA.update_status,
      reason: `It's ${days} day${days === 1 ? "" : "s"} overdue.`,
    };
  }
  if (urgency.level === "due_today" || urgency.level === "due_soon") {
    return {
      ...CTA.mark_done,
      reason: urgency.level === "due_today" ? "It's due today." : "It's due soon.",
    };
  }
  if (!actionHasNextStep(item)) {
    return { ...CTA.add_next_step, reason: "No next step is written down." };
  }
  return { ...CTA.open, reason: "It's on track — open it to keep it moving." };
}
