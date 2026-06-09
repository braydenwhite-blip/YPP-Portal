import { actionPrefillToQuery, type ActionPrefill } from "./action-prefill";
import type {
  InitiativeHealth,
  InitiativeMomentum,
  InitiativeOwnership,
  InitiativeRisk,
  InitiativeWorkSignals,
} from "./strategic-initiative-health";
import type { InitiativeMilestoneSummary } from "./strategic-milestones";
import { initiativeHref } from "./strategic-timeline";
import type { StrategicInitiativeDef } from "./strategic-initiatives";

/**
 * YPP Execution OS — RECOMMENDED NEXT MOVES ENGINE (Phase I).
 *
 * For every initiative, derive the concrete next moves leadership should make —
 * recommended actions, meetings, ownership changes, milestone work, reviews, and
 * follow-ups. Every recommendation is DETERMINISTIC (derived from the
 * initiative's real signals + reads), EXPLAINABLE (a one-line "why"), and links
 * somewhere useful (a prefilled new action, the overdue queue, the meetings
 * tracker, or the relevant milestone). Pure — no DB, no AI.
 */

export type RecommendationKind =
  | "action"
  | "meeting"
  | "ownership"
  | "milestone"
  | "review"
  | "follow_up"
  | "decision";

export type RecommendationSeverity = "critical" | "warning" | "watch" | "neutral";

export type InitiativeRecommendation = {
  id: string;
  kind: RecommendationKind;
  title: string;
  /** The one-line "why" — always present, always explainable. */
  detail: string;
  severity: RecommendationSeverity;
  href: string;
  /** Deterministic rank — higher = do sooner. */
  score: number;
};

const KIND_LABEL: Record<RecommendationKind, string> = {
  action: "Action",
  meeting: "Meeting",
  ownership: "Ownership",
  milestone: "Milestone",
  review: "Review",
  follow_up: "Follow-up",
  decision: "Decision",
};

export function recommendationKindLabel(kind: RecommendationKind): string {
  return KIND_LABEL[kind];
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// --- prefill helpers (reused by the detail page's "New action" CTAs) --------

/** The goal category a new action should carry to auto-join this initiative. */
export function initiativePrimaryGoalCategory(def: StrategicInitiativeDef): string {
  return def.match.goalCategories?.[0] ?? def.title;
}

/** A prefilled `/actions/new` link whose action will match back into the initiative. */
export function buildInitiativeActionPrefill(
  def: StrategicInitiativeDef,
  overrides: Partial<ActionPrefill> = {}
): string {
  const prefill: ActionPrefill = {
    area: initiativePrimaryGoalCategory(def),
    // Action 4.0: carry an EXPLICIT, registry-valid strategic link + source so
    // the new action is honestly tied to this initiative (not just keyword-matched).
    sourceType: "INITIATIVE",
    strategicInitiativeId: def.id,
    ...overrides,
  };
  return actionPrefillToQuery(prefill);
}

// --- the engine --------------------------------------------------------------

export type DeriveRecommendationsInput = {
  def: StrategicInitiativeDef;
  signals: InitiativeWorkSignals;
  health: InitiativeHealth;
  risk: InitiativeRisk;
  momentum: InitiativeMomentum;
  ownership: InitiativeOwnership;
  milestones: InitiativeMilestoneSummary[];
  limit?: number;
};

/**
 * Derive the recommended next moves for one initiative, worst/most-impactful
 * first. Terminal initiatives (completed / archived) recommend only a wrap-up
 * review. Pure + unit-tested.
 */
export function deriveInitiativeRecommendations(
  input: DeriveRecommendationsInput
): InitiativeRecommendation[] {
  const { def, signals, health, risk, momentum, ownership, milestones } = input;
  const recs: InitiativeRecommendation[] = [];
  const detailHref = initiativeHref(def.id);

  // Terminal — nothing to push, just a wrap-up.
  if (health.level === "completed") {
    recs.push({
      id: `${def.id}:wrapup`,
      kind: "review",
      title: "Capture lessons learned",
      detail: "This initiative is complete — record what worked before archiving.",
      severity: "neutral",
      href: detailHref,
      score: 10,
    });
    return recs;
  }
  if (health.level === "archived") return recs;

  // 1. Overdue / blocked work — the most urgent.
  if (signals.overdueActions > 0 || signals.blockedActions > 0) {
    const bits: string[] = [];
    if (signals.overdueActions > 0) bits.push(plural(signals.overdueActions, "overdue action"));
    if (signals.blockedActions > 0) bits.push(plural(signals.blockedActions, "blocked action"));
    recs.push({
      id: `${def.id}:unblock`,
      kind: "action",
      title: "Clear the stuck work",
      detail: `${bits.join(" and ")} — reassign, reschedule, or unblock.`,
      severity: signals.overdueActions >= 3 ? "critical" : "warning",
      href: "/actions/all?status=OVERDUE",
      score: 100 + signals.overdueActions * 6 + signals.blockedActions * 4,
    });
  }

  // 2. Ownership gaps.
  if (ownership.clarity === "unowned" || ownership.clarity === "unclear") {
    recs.push({
      id: `${def.id}:ownership`,
      kind: "ownership",
      title:
        ownership.clarity === "unowned"
          ? "Assign an owner"
          : "Clarify ownership",
      detail: ownership.reason,
      severity: ownership.clarity === "unowned" ? "warning" : "watch",
      href: `${detailHref}#ownership`,
      score: ownership.clarity === "unowned" ? 80 : 55,
    });
  }

  // 3. Decisions that never became action.
  if (signals.decisionsWithoutAction > 0) {
    recs.push({
      id: `${def.id}:decisions`,
      kind: "decision",
      title: "Convert decisions into action",
      detail: `${plural(signals.decisionsWithoutAction, "decision")} recorded but not yet owned.`,
      severity: "watch",
      href: `${detailHref}#timeline`,
      score: 70 + signals.decisionsWithoutAction * 3,
    });
  }

  // 4. Open / overdue meeting follow-ups.
  if (signals.overdueFollowUps > 0 || signals.openFollowUps > 0) {
    recs.push({
      id: `${def.id}:followups`,
      kind: "follow_up",
      title: "Close the meeting follow-ups",
      detail:
        signals.overdueFollowUps > 0
          ? `${plural(signals.overdueFollowUps, "overdue follow-up")} from recent meetings.`
          : `${plural(signals.openFollowUps, "open follow-up")} from recent meetings.`,
      severity: signals.overdueFollowUps > 0 ? "warning" : "watch",
      href: "/actions/meetings",
      score: 60 + signals.overdueFollowUps * 4,
    });
  }

  // 5. Milestones behind schedule.
  for (const ms of milestones) {
    if (ms.behindSchedule) {
      recs.push({
        id: `${def.id}:milestone-behind:${ms.id}`,
        kind: "milestone",
        title: `Re-plan “${ms.title}”`,
        detail: "Its target date has passed and it is not complete.",
        severity: "warning",
        href: `${detailHref}#milestone-${ms.id}`,
        score: 65,
      });
    }
  }

  // 6. The next milestone with no work yet — the natural next push.
  const nextEmpty = milestones.find(
    (m) => m.status === "not_started" && m.totalActions === 0 && !m.behindSchedule
  );
  if (nextEmpty) {
    recs.push({
      id: `${def.id}:milestone-start:${nextEmpty.id}`,
      kind: "milestone",
      title: `Start “${nextEmpty.title}”`,
      detail: "The next milestone has no tracked work — create the first action.",
      severity: "neutral",
      href: buildInitiativeActionPrefill(def, { title: nextEmpty.title }),
      score: 40,
    });
  }

  // 7. Quiet execution — schedule a working session.
  if (
    signals.openActions > 0 &&
    (signals.daysSinceLastMeeting == null || signals.daysSinceLastMeeting > 21) &&
    signals.upcomingMeetings === 0
  ) {
    recs.push({
      id: `${def.id}:meeting`,
      kind: "meeting",
      title: "Schedule a working session",
      detail:
        signals.daysSinceLastMeeting == null
          ? "No meeting on record while work is open."
          : `No meeting in ${signals.daysSinceLastMeeting} days.`,
      severity: "watch",
      href: "/actions/meetings?new=1",
      score: 50,
    });
  }

  // 8. Stalled momentum with open work — restart it.
  if (momentum.level === "stalled" && signals.openActions > 0) {
    recs.push({
      id: `${def.id}:restart`,
      kind: "action",
      title: "Restart momentum",
      detail: "Nothing has moved recently — drive one open action to done this week.",
      severity: "warning",
      href: "/actions/all?status=OVERDUE",
      score: 58,
    });
  }

  // 9. No tracked work at all — seed the initiative.
  if (signals.totalActions === 0) {
    recs.push({
      id: `${def.id}:seed`,
      kind: "action",
      title: "Create the first action",
      detail: "This initiative has no tracked work yet — give it a first concrete next step.",
      severity: "watch",
      href: buildInitiativeActionPrefill(def),
      score: 45,
    });
  }

  // 10. Calm but worth a periodic review.
  if (recs.length === 0) {
    recs.push({
      id: `${def.id}:review`,
      kind: "review",
      title: "Run a quick review",
      detail:
        risk.level === "low"
          ? "On track — confirm the next milestone and keep the rhythm."
          : "Review progress and confirm the next move.",
      severity: "neutral",
      href: detailHref,
      score: 20,
    });
  }

  recs.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return typeof input.limit === "number" ? recs.slice(0, input.limit) : recs;
}
