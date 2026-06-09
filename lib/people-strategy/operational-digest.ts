import type { ActionItemStatus, ActionPriority } from "@prisma/client";

import {
  addDays,
  daysUntil,
  endOfOperatingWeek,
  startOfDay,
  startOfOperatingWeek,
} from "@/lib/leadership-action-center/dates";

import { ACTION_PRIORITY_WEIGHT } from "./constants";
import type { ActionItemWithRelations } from "./action-queries";
import { effectiveStatus } from "./action-filters";
import { effectiveDeadline, isActionOverdue } from "./my-actions-selectors";
import { daysOverdue, STALE_ACTIVITY_DAYS } from "./command-center-selectors";
import type { MeetingCardDTO } from "./meetings-queries";
import {
  meetingOutcomeFromCard,
  type MeetingOutcomeQuality,
} from "./meeting-outcome";
import { isMeetingCategory, meetingCategoryLabel } from "./meeting-categories";
import {
  areaForRelatedEntityType,
  computeOperationalHealth,
  compareOperationalHealth,
  OPERATIONAL_HEALTH_LEVELS,
  type OperationalArea,
  type OperationalHealth,
  type OperationalHealthLevel,
} from "./operational-context";
import {
  isRelatedEntityType,
  relatedEntityTypeLabel,
  type RelatedEntityType,
} from "./constants";
import type { RelatedEntitySummary } from "./connections";

/**
 * People Strategy Execution OS — Weekly Operational Digest derivations.
 *
 * This is the BRAIN that turns the raw cross-portal operating data (actions +
 * meetings + decisions + entity context) into a leadership digest: what is
 * urgent, what is stuck, which parts of YPP are falling behind, what meetings
 * produced no action, which decisions never became execution, and — most
 * importantly — a deterministic ranked order of what leadership should review
 * first.
 *
 * Every function here is PURE (no DB, no session, no React, only the injected
 * `now`) so the whole module unit-tests with plain fixtures. The query layer
 * (`operational-digest-queries.ts`) does the single batched read and feeds these
 * derivations; the Command Center + Weekly Review pages render the result. This
 * extends — never duplicates — the existing operational-context layer: it reuses
 * `effectiveStatus`, `computeOperationalHealth`, the area bridge, and the shared
 * staleness window so a "stuck" action means exactly the same thing everywhere.
 */

// --- tunable windows (documented so they can never silently drift) ----------

/** Days ahead an open action counts as "due soon" (mirrors the Action Tracker lens). */
export const DUE_SOON_DAYS = 7;
/** Days back a decision / meeting counts as "recent". */
export const RECENT_DECISION_DAYS = 14;
export const RECENT_MEETING_DAYS = 14;
/** Days back a completed action counts as a recent "win" (momentum, not problems). */
export const RECENTLY_COMPLETED_DAYS = 7;
/**
 * Days since an entity's last meeting past which it reads as "no recent meeting"
 * (a quiet part of the org that may be drifting).
 */
export const NO_RECENT_MEETING_DAYS = 21;
/** Open-item load on one entity above which it has "many unresolved items". */
export const MANY_UNRESOLVED_THRESHOLD = 5;

// --- review item vocabulary --------------------------------------------------

/**
 * The kinds of thing the recommended-review queue can surface. `area` is a whole
 * operating area rollup; the entity kinds mirror the shipped related-entity
 * types so a leader recognises what they are looking at.
 */
export const OPERATIONAL_REVIEW_KINDS = [
  "action",
  "meeting",
  "decision",
  "class",
  "instructor",
  "person",
  "partner",
  "mentorship",
  "area",
] as const;
export type OperationalReviewKind = (typeof OPERATIONAL_REVIEW_KINDS)[number];

export type OperationalReviewSeverity = "critical" | "warning" | "watch" | "neutral";

export type OperationalReviewItem = {
  /** Stable, queue-unique id (e.g. `entity:CLASS_OFFERING:cls1`). */
  id: string;
  kind: OperationalReviewKind;
  title: string;
  /** The single most important reason this surfaced, for the card headline. */
  reason: string;
  /** All contributing reasons, worst-first. */
  reasons: string[];
  /** Deterministic ranking score — higher = review sooner. */
  score: number;
  severity: OperationalReviewSeverity;
  /** Where clicking the card takes the leader to act. */
  href: string;
};

// --- serializable "lite" projections ----------------------------------------

export type ActionLite = {
  id: string;
  title: string;
  /** Effective status (computed OVERDUE / preserved BLOCKED). */
  status: ActionItemStatus;
  priority: ActionPriority;
  dueISO: string;
  ownerName: string | null;
  overdue: boolean;
  daysOverdue: number;
  blocked: boolean;
  /** No EXECUTING assignee — work nobody owns. */
  unassigned: boolean;
  relatedType: RelatedEntityType | null;
  relatedId: string | null;
  sourceMeetingId: string | null;
  href: string;
};

export type MeetingLite = {
  id: string;
  title: string;
  startISO: string;
  category: string | null;
  categoryLabel: string;
  effectiveStatus: MeetingCardDTO["effectiveStatus"];
  openFollowUps: number;
  overdueFollowUps: number;
  decisionCount: number;
  linkedActionCount: number;
  recurrence: string | null;
  relatedType: RelatedEntityType | null;
  relatedId: string | null;
  /** Deterministic operational outcome read (was the meeting useful?). */
  outcome: MeetingOutcomeQuality;
  href: string;
};

/**
 * The raw decision shape the digest consumes. The query layer extracts these
 * from loaded meetings (a decision inherits its meeting's related entity), so
 * the derivations stay DB-free and testable with plain objects.
 */
export type DigestDecisionInput = {
  id: string;
  decision: string;
  meetingId: string;
  meetingTitle: string;
  meetingCategory: string | null;
  createdAt: Date;
  decidedByName: string | null;
  /** True when a tracker action is already linked to this decision. */
  hasLinkedAction: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
};

export type DecisionLite = {
  id: string;
  decision: string;
  meetingId: string;
  meetingTitle: string;
  areaLabel: string;
  decidedByName: string | null;
  createdISO: string;
  hasLinkedAction: boolean;
  relatedType: RelatedEntityType | null;
  relatedId: string | null;
  href: string;
};

export type OperationalEntityLite = {
  /** `${type}:${id}` — the canonical related-entity key. */
  refKey: string;
  type: RelatedEntityType;
  id: string;
  label: string;
  typeLabel: string;
  area: OperationalArea;
  areaLabel: string;
  /** Safe in-portal link, or null when no stable page exists. */
  href: string | null;
  health: OperationalHealth;
  openActions: number;
  overdueActions: number;
  blockedActions: number;
  unassignedActions: number;
  meetingCount: number;
  upcomingMeetings: number;
  /** Whole days since the most recent meeting, or null when never met. */
  daysSinceLastMeeting: number | null;
  recentDecisions: number;
  unresolvedFollowUps: number;
};

export type AreaHealthRow = {
  area: OperationalArea;
  areaLabel: string;
  health: OperationalHealth;
  openActions: number;
  overdueActions: number;
  meetingCount: number;
  upcomingMeetings: number;
  unresolvedFollowUps: number;
  /** Entities in this area whose health is critical. */
  criticalEntities: number;
};

export type OperationalHealthExplanation = {
  /** Reuses the canonical four-step level (healthy → critical). */
  level: OperationalHealthLevel;
  /** One sentence: "Critical because 3 actions are overdue and …". */
  headline: string;
  reasons: string[];
  suggestedNextSteps: string[];
};

export type OperationalDigestCounts = {
  overdueActions: number;
  dueTodayActions: number;
  dueSoonActions: number;
  blockedActions: number;
  unassignedActions: number;
  upcomingMeetings: number;
  meetingsWithoutActions: number;
  unresolvedFollowUps: number;
  criticalEntities: number;
  warningEntities: number;
  recentDecisions: number;
  decisionsNeedingAction: number;
  recentlyCompletedActions: number;
};

export type WeeklyOperationalDigest = {
  generatedAt: Date;
  window: { start: Date; end: Date };
  counts: OperationalDigestCounts;
  urgentActions: ActionLite[];
  upcomingMeetings: MeetingLite[];
  staleEntities: OperationalEntityLite[];
  criticalEntities: OperationalEntityLite[];
  decisionsNeedingAction: DecisionLite[];
  meetingsNeedingFollowThrough: MeetingLite[];
  recentlyCompletedActions: ActionLite[];
  areaHealth: AreaHealthRow[];
  recommendedReviewOrder: OperationalReviewItem[];
};

// --- shared helpers ----------------------------------------------------------

const SETTLED: ReadonlySet<ActionItemStatus> = new Set<ActionItemStatus>([
  "COMPLETE",
  "DROPPED",
]);

/** The completion timestamp: exact `completedAt`, else `updatedAt` fallback. */
function completionTime(item: ActionItemWithRelations): Date {
  return item.completedAt ?? item.updatedAt;
}

/** True when an open action has no EXECUTING owner. */
function isUnassigned(item: ActionItemWithRelations): boolean {
  return !item.assignments.some((a) => a.role === "EXECUTING");
}

export function actionHref(id: string): string {
  return `/actions/${id}`;
}

export function meetingHref(id: string): string {
  return `/actions/meetings/${id}`;
}

function relatedRefKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// --- lite mappers ------------------------------------------------------------

export function toActionLite(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionLite {
  const status = effectiveStatus(item, now);
  const relatedType =
    item.relatedEntityType && isRelatedEntityType(item.relatedEntityType)
      ? item.relatedEntityType
      : null;
  return {
    id: item.id,
    title: item.title,
    status,
    priority: item.priority,
    dueISO: effectiveDeadline(item).toISOString(),
    ownerName: item.lead?.name ?? item.lead?.email ?? null,
    overdue: isActionOverdue(item, now),
    daysOverdue: daysOverdue(item, now),
    blocked: status === "BLOCKED",
    unassigned: isUnassigned(item),
    relatedType,
    relatedId: relatedType ? item.relatedEntityId : null,
    sourceMeetingId: item.officerMeetingId ?? null,
    href: actionHref(item.id),
  };
}

export function toMeetingLite(m: MeetingCardDTO, now: Date = new Date()): MeetingLite {
  const relatedType =
    m.relatedEntityType && isRelatedEntityType(m.relatedEntityType)
      ? m.relatedEntityType
      : null;
  return {
    id: m.id,
    title: m.title,
    startISO: m.startISO,
    category: m.category,
    categoryLabel: m.categoryLabel,
    effectiveStatus: m.effectiveStatus,
    openFollowUps: m.openFollowUps,
    overdueFollowUps: m.overdueFollowUps,
    decisionCount: m.decisionCount,
    linkedActionCount: m.linkedActionCount,
    recurrence: m.recurrence,
    relatedType,
    relatedId: relatedType ? m.relatedEntityId : null,
    outcome: meetingOutcomeFromCard(m, now),
    href: meetingHref(m.id),
  };
}

export function toDecisionLite(d: DigestDecisionInput): DecisionLite {
  const relatedType =
    d.relatedEntityType && isRelatedEntityType(d.relatedEntityType)
      ? d.relatedEntityType
      : null;
  return {
    id: d.id,
    decision: d.decision,
    meetingId: d.meetingId,
    meetingTitle: d.meetingTitle,
    areaLabel: meetingCategoryLabel(d.meetingCategory),
    decidedByName: d.decidedByName,
    createdISO: d.createdAt.toISOString(),
    hasLinkedAction: d.hasLinkedAction,
    relatedType,
    relatedId: relatedType ? d.relatedEntityId : null,
    href: meetingHref(d.meetingId),
  };
}

// --- A. urgency buckets ------------------------------------------------------

/**
 * The deadline tiers are MUTUALLY EXCLUSIVE (an action lands in exactly one of
 * overdue / dueToday / dueThisWeek / later — `later` is dropped). The flag
 * buckets (blocked / unassigned / highPriority / stale) are ORTHOGONAL — an
 * action can appear in several, exactly like the Command Center pulse counts
 * overdue and blocked independently. `recentlyCompleted` holds settled wins.
 */
export type ActionUrgencyBuckets = {
  overdue: ActionItemWithRelations[];
  dueToday: ActionItemWithRelations[];
  dueThisWeek: ActionItemWithRelations[];
  blocked: ActionItemWithRelations[];
  unassigned: ActionItemWithRelations[];
  /** Defensive: actions with no deadline at all (none in the current schema). */
  missingDueDate: ActionItemWithRelations[];
  highPriority: ActionItemWithRelations[];
  recentlyCompleted: ActionItemWithRelations[];
  stale: ActionItemWithRelations[];
};

export function bucketActionsByUrgency(
  actions: ActionItemWithRelations[],
  now: Date = new Date()
): ActionUrgencyBuckets {
  const todayStart = startOfDay(now).getTime();
  const weekEnd = startOfDay(addDays(now, DUE_SOON_DAYS)).getTime();
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  const completedCutoff = addDays(now, -RECENTLY_COMPLETED_DAYS).getTime();
  const highWeight = ACTION_PRIORITY_WEIGHT.HIGH;

  const buckets: ActionUrgencyBuckets = {
    overdue: [],
    dueToday: [],
    dueThisWeek: [],
    blocked: [],
    unassigned: [],
    missingDueDate: [],
    highPriority: [],
    recentlyCompleted: [],
    stale: [],
  };

  for (const item of actions) {
    const status = effectiveStatus(item, now);

    if (status === "COMPLETE") {
      if (completionTime(item).getTime() >= completedCutoff) {
        buckets.recentlyCompleted.push(item);
      }
      continue;
    }
    if (status === "DROPPED") continue;

    // Orthogonal flags (open work only).
    if (status === "BLOCKED") buckets.blocked.push(item);
    if (isUnassigned(item)) buckets.unassigned.push(item);
    if (ACTION_PRIORITY_WEIGHT[item.priority] >= highWeight) {
      buckets.highPriority.push(item);
    }
    if (item.updatedAt.getTime() < staleCutoff) buckets.stale.push(item);

    // Mutually-exclusive deadline tier.
    if (isActionOverdue(item, now)) {
      buckets.overdue.push(item);
      continue;
    }
    const due = startOfDay(effectiveDeadline(item)).getTime();
    if (due <= todayStart) buckets.dueToday.push(item);
    else if (due <= weekEnd) buckets.dueThisWeek.push(item);
  }

  // Worst-first within each tier so a slice keeps the most urgent.
  buckets.overdue.sort((a, b) => daysOverdue(b, now) - daysOverdue(a, now));
  const byDeadline = (a: ActionItemWithRelations, b: ActionItemWithRelations) =>
    effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime();
  buckets.dueToday.sort(byDeadline);
  buckets.dueThisWeek.sort(byDeadline);
  return buckets;
}

/**
 * Meeting buckets. `upcomingThisWeek` = scheduled within the next
 * {@link DUE_SOON_DAYS} days. `recent` = happened within the last
 * {@link RECENT_MEETING_DAYS} days. `withoutActions` / `withUnresolvedFollowUps`
 * / `withDecisionsNoAction` only consider meetings that have actually happened,
 * so an un-started upcoming meeting is never flagged for "no action yet".
 */
export type MeetingUrgencyBuckets = {
  upcomingThisWeek: MeetingCardDTO[];
  recent: MeetingCardDTO[];
  withoutActions: MeetingCardDTO[];
  withUnresolvedFollowUps: MeetingCardDTO[];
  withDecisionsNoAction: MeetingCardDTO[];
  recurring: MeetingCardDTO[];
};

/** Has this meeting already happened (vs. still upcoming)? */
function meetingHasHappened(m: MeetingCardDTO, now: Date): boolean {
  if (m.effectiveStatus === "completed" || m.effectiveStatus === "needs_follow_up") {
    return true;
  }
  if (m.effectiveStatus === "canceled") return false;
  return new Date(m.startISO).getTime() < startOfDay(now).getTime();
}

export function bucketMeetingsByUrgency(
  meetings: MeetingCardDTO[],
  now: Date = new Date()
): MeetingUrgencyBuckets {
  const todayStart = startOfDay(now).getTime();
  const soonEnd = startOfDay(addDays(now, DUE_SOON_DAYS)).getTime();
  const recentStart = addDays(now, -RECENT_MEETING_DAYS).getTime();

  const buckets: MeetingUrgencyBuckets = {
    upcomingThisWeek: [],
    recent: [],
    withoutActions: [],
    withUnresolvedFollowUps: [],
    withDecisionsNoAction: [],
    recurring: [],
  };

  for (const m of meetings) {
    const start = new Date(m.startISO).getTime();
    if (m.recurrence) buckets.recurring.push(m);

    if (m.effectiveStatus !== "canceled" && start >= todayStart && start <= soonEnd) {
      buckets.upcomingThisWeek.push(m);
    }

    const happened = meetingHasHappened(m, now);
    const isRecent = happened && start >= recentStart;
    if (isRecent) buckets.recent.push(m);
    if (happened) {
      // "Produced no action" only matters for a recent meeting — an ancient
      // meeting with no linked work is noise, not a follow-through gap.
      if (isRecent && m.linkedActionCount === 0) buckets.withoutActions.push(m);
      if (isRecent && m.decisionCount > 0 && m.linkedActionCount === 0) {
        buckets.withDecisionsNoAction.push(m);
      }
      // Open follow-ups are chased regardless of age — a stale open follow-up is
      // exactly the stuck work leadership wants surfaced.
      if (m.openFollowUps > 0) buckets.withUnresolvedFollowUps.push(m);
    }
  }

  buckets.upcomingThisWeek.sort(
    (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
  );
  const byRecency = (a: MeetingCardDTO, b: MeetingCardDTO) =>
    new Date(b.startISO).getTime() - new Date(a.startISO).getTime();
  buckets.recent.sort(byRecency);
  buckets.withUnresolvedFollowUps.sort((a, b) => b.overdueFollowUps - a.overdueFollowUps);
  return buckets;
}

/**
 * The four triage lists the Weekly Review's first step works through, as
 * serializable lite shapes. `dueSoon` = due today + due within the week (not yet
 * overdue). The lists can overlap (an overdue action may also be unassigned) —
 * each is a distinct lens, exactly like the Command Center pulse counts.
 */
export type ActionTriage = {
  overdue: ActionLite[];
  blocked: ActionLite[];
  unassigned: ActionLite[];
  dueSoon: ActionLite[];
};

export function deriveActionTriage(
  actions: ActionItemWithRelations[],
  now: Date = new Date()
): ActionTriage {
  const b = bucketActionsByUrgency(actions, now);
  const lite = (list: ActionItemWithRelations[]) => list.map((a) => toActionLite(a, now));
  return {
    overdue: lite(b.overdue),
    blocked: lite(b.blocked),
    unassigned: lite(b.unassigned),
    dueSoon: lite([...b.dueToday, ...b.dueThisWeek]),
  };
}

// --- decisions ---------------------------------------------------------------

export function selectRecentDecisions(
  decisions: DigestDecisionInput[],
  now: Date = new Date(),
  days = RECENT_DECISION_DAYS
): DigestDecisionInput[] {
  const cutoff = addDays(now, -days).getTime();
  return decisions
    .filter((d) => d.createdAt.getTime() >= cutoff)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Recent decisions with no tracker action linked — decisions that may die. */
export function selectDecisionsNeedingAction(
  decisions: DigestDecisionInput[],
  now: Date = new Date(),
  days = RECENT_DECISION_DAYS
): DigestDecisionInput[] {
  return selectRecentDecisions(decisions, now, days).filter((d) => !d.hasLinkedAction);
}

// --- C. entity rollup --------------------------------------------------------

type EntityAccumulator = {
  type: RelatedEntityType;
  id: string;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
};

/**
 * Roll the loaded work up to the YPP entities it belongs to, deriving one health
 * read + the operating counts for each. Joins actions, meetings, and decisions
 * by their shared related-entity ref, resolves a display label from the supplied
 * batch label map (no per-entity query — avoids N+1), and returns the entities
 * worst-health first. Pure.
 */
export function deriveOperationalEntities(input: {
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: ReadonlyMap<string, RelatedEntitySummary>;
  now?: Date;
}): OperationalEntityLite[] {
  const now = input.now ?? new Date();
  const recentDecisionCutoff = addDays(now, -RECENT_DECISION_DAYS).getTime();
  const accumulators = new Map<string, EntityAccumulator>();

  const ensure = (type: RelatedEntityType, id: string): EntityAccumulator => {
    const key = relatedRefKey(type, id);
    let acc = accumulators.get(key);
    if (!acc) {
      acc = { type, id, actions: [], meetings: [], decisions: [] };
      accumulators.set(key, acc);
    }
    return acc;
  };

  for (const action of input.actions) {
    const type = action.relatedEntityType;
    const id = action.relatedEntityId;
    if (!type || !id || !isRelatedEntityType(type)) continue;
    ensure(type, id).actions.push(action);
  }
  for (const m of input.meetings) {
    const type = m.relatedEntityType;
    const id = m.relatedEntityId;
    if (!type || !id || !isRelatedEntityType(type)) continue;
    ensure(type, id).meetings.push(m);
  }
  for (const d of input.decisions) {
    const type = d.relatedEntityType;
    const id = d.relatedEntityId;
    if (!type || !id || !isRelatedEntityType(type)) continue;
    ensure(type, id).decisions.push(d);
  }

  const entities: OperationalEntityLite[] = [];
  for (const acc of accumulators.values()) {
    let openActions = 0;
    let overdueActions = 0;
    let blockedActions = 0;
    let unassignedActions = 0;
    let staleActions = 0;
    const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
    for (const action of acc.actions) {
      const status = effectiveStatus(action, now);
      if (SETTLED.has(status)) continue;
      openActions += 1;
      if (status === "OVERDUE") overdueActions += 1;
      if (status === "BLOCKED") blockedActions += 1;
      if (isUnassigned(action)) unassignedActions += 1;
      if (action.updatedAt.getTime() < staleCutoff) staleActions += 1;
    }

    let openFollowUps = 0;
    let overdueFollowUps = 0;
    let meetingsNeedingFollowUp = 0;
    let upcomingMeetings = 0;
    let lastMeetingTime: number | null = null;
    const todayStart = startOfDay(now).getTime();
    for (const m of acc.meetings) {
      openFollowUps += m.openFollowUps;
      overdueFollowUps += m.overdueFollowUps;
      if (m.effectiveStatus === "needs_follow_up") meetingsNeedingFollowUp += 1;
      const start = new Date(m.startISO).getTime();
      if (start >= todayStart && m.effectiveStatus !== "canceled") upcomingMeetings += 1;
      if (start < todayStart && (lastMeetingTime == null || start > lastMeetingTime)) {
        lastMeetingTime = start;
      }
    }

    const recentDecisions = acc.decisions.filter(
      (d) => d.createdAt.getTime() >= recentDecisionCutoff
    ).length;

    const health = computeOperationalHealth({
      openActions,
      overdueActions,
      blockedActions,
      unassignedActions,
      staleActions,
      openFollowUps,
      overdueFollowUps,
      meetingsNeedingFollowUp,
    });

    const summary = input.labels.get(relatedRefKey(acc.type, acc.id));
    const area = areaForRelatedEntityType(acc.type);
    entities.push({
      refKey: relatedRefKey(acc.type, acc.id),
      type: acc.type,
      id: acc.id,
      label: summary?.label ?? relatedEntityTypeLabel(acc.type),
      typeLabel: summary?.typeLabel ?? relatedEntityTypeLabel(acc.type),
      area,
      areaLabel: meetingCategoryLabel(area),
      href: summary?.href ?? null,
      health,
      openActions,
      overdueActions,
      blockedActions,
      unassignedActions,
      meetingCount: acc.meetings.length,
      upcomingMeetings,
      daysSinceLastMeeting:
        lastMeetingTime == null
          ? null
          : (daysUntil(new Date(lastMeetingTime), now) ?? 0) * -1,
      recentDecisions,
      unresolvedFollowUps: openFollowUps,
    });
  }

  return entities.sort(
    (a, b) =>
      compareOperationalHealth(a.health, b.health) ||
      b.overdueActions - a.overdueActions ||
      b.openActions - a.openActions ||
      a.label.localeCompare(b.label)
  );
}

/** Does an entity read as "no recent meeting" (drifting quietly)? */
export function entityHasNoRecentMeeting(entity: OperationalEntityLite): boolean {
  return (
    entity.daysSinceLastMeeting == null ||
    entity.daysSinceLastMeeting > NO_RECENT_MEETING_DAYS
  );
}

/**
 * Entities worth a "stale" call-out: open work exists but no meeting has touched
 * them recently. These are the quiet corners that drift without anyone noticing.
 */
export function selectStaleEntities(
  entities: OperationalEntityLite[]
): OperationalEntityLite[] {
  return entities.filter(
    (e) => e.openActions > 0 && entityHasNoRecentMeeting(e)
  );
}

// --- operational health by area ----------------------------------------------

type AreaAccumulator = {
  openActions: number;
  overdueActions: number;
  blockedActions: number;
  unassignedActions: number;
  staleActions: number;
  openFollowUps: number;
  overdueFollowUps: number;
  meetingsNeedingFollowUp: number;
  meetingCount: number;
  upcomingMeetings: number;
  criticalEntities: number;
};

function emptyAreaAccumulator(): AreaAccumulator {
  return {
    openActions: 0,
    overdueActions: 0,
    blockedActions: 0,
    unassignedActions: 0,
    staleActions: 0,
    openFollowUps: 0,
    overdueFollowUps: 0,
    meetingsNeedingFollowUp: 0,
    meetingCount: 0,
    upcomingMeetings: 0,
    criticalEntities: 0,
  };
}

/**
 * Roll the loaded work up to YPP operating AREAS (a meeting's category / an
 * action's entity area) so the Command Center can show one health read per area
 * — Classes, Mentorship, Partnerships, … — without a query per area. Actions
 * contribute through their linked entity's area (department-only actions have no
 * area, mirroring the area context loader); meetings contribute through their
 * category. Pure; areas with no activity are dropped, worst-health first.
 */
export function deriveAreaHealth(input: {
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  entities: OperationalEntityLite[];
  now?: Date;
}): AreaHealthRow[] {
  const now = input.now ?? new Date();
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  const todayStart = startOfDay(now).getTime();
  const byArea = new Map<OperationalArea, AreaAccumulator>();

  const ensure = (area: OperationalArea): AreaAccumulator => {
    let acc = byArea.get(area);
    if (!acc) {
      acc = emptyAreaAccumulator();
      byArea.set(area, acc);
    }
    return acc;
  };

  for (const action of input.actions) {
    const type = action.relatedEntityType;
    if (!type || !isRelatedEntityType(type)) continue;
    const status = effectiveStatus(action, now);
    if (SETTLED.has(status)) continue;
    const acc = ensure(areaForRelatedEntityType(type));
    acc.openActions += 1;
    if (status === "OVERDUE") acc.overdueActions += 1;
    if (status === "BLOCKED") acc.blockedActions += 1;
    if (isUnassigned(action)) acc.unassignedActions += 1;
    if (action.updatedAt.getTime() < staleCutoff) acc.staleActions += 1;
  }

  for (const m of input.meetings) {
    const area: OperationalArea =
      m.category && isMeetingCategory(m.category) ? m.category : "OTHER";
    const acc = ensure(area);
    acc.meetingCount += 1;
    acc.openFollowUps += m.openFollowUps;
    acc.overdueFollowUps += m.overdueFollowUps;
    if (m.effectiveStatus === "needs_follow_up") acc.meetingsNeedingFollowUp += 1;
    if (m.effectiveStatus !== "canceled" && new Date(m.startISO).getTime() >= todayStart) {
      acc.upcomingMeetings += 1;
    }
  }

  for (const e of input.entities) {
    if (e.health.level === "critical") ensure(e.area).criticalEntities += 1;
  }

  const rows: AreaHealthRow[] = [];
  for (const [area, acc] of byArea) {
    const health = computeOperationalHealth({
      openActions: acc.openActions,
      overdueActions: acc.overdueActions,
      blockedActions: acc.blockedActions,
      unassignedActions: acc.unassignedActions,
      staleActions: acc.staleActions,
      openFollowUps: acc.openFollowUps,
      overdueFollowUps: acc.overdueFollowUps,
      meetingsNeedingFollowUp: acc.meetingsNeedingFollowUp,
    });
    rows.push({
      area,
      areaLabel: meetingCategoryLabel(area),
      health,
      openActions: acc.openActions,
      overdueActions: acc.overdueActions,
      meetingCount: acc.meetingCount,
      upcomingMeetings: acc.upcomingMeetings,
      unresolvedFollowUps: acc.openFollowUps,
      criticalEntities: acc.criticalEntities,
    });
  }

  return rows.sort(
    (a, b) =>
      compareOperationalHealth(a.health, b.health) ||
      b.overdueActions - a.overdueActions ||
      a.areaLabel.localeCompare(b.areaLabel)
  );
}

// --- D. health explanation ---------------------------------------------------

const LEVEL_WORD: Record<OperationalHealthLevel, string> = {
  healthy: "Healthy",
  attention: "Watch",
  at_risk: "Warning",
  critical: "Critical",
};

export type HealthExplanationContext = {
  overdueActions?: number;
  openActions?: number;
  blockedActions?: number;
  unassignedActions?: number;
  unresolvedFollowUps?: number;
  daysSinceLastMeeting?: number | null;
  upcomingMeetings?: number;
  recentDecisionsWithoutAction?: number;
};

/**
 * Turn a health read + the raw operating context into a short, deterministic
 * explanation: a one-line headline ("Critical because 3 actions are overdue and
 * no meeting in 21 days."), the contributing reasons, and concrete next steps.
 * Never AI-generated — the same inputs always yield the same words.
 */
export function explainOperationalHealth(
  health: OperationalHealth,
  context: HealthExplanationContext = {}
): OperationalHealthExplanation {
  const overdue = Math.max(0, context.overdueActions ?? 0);
  const blocked = Math.max(0, context.blockedActions ?? 0);
  const unassigned = Math.max(0, context.unassignedActions ?? 0);
  const open = Math.max(0, context.openActions ?? 0);
  const followUps = Math.max(0, context.unresolvedFollowUps ?? 0);
  const upcoming = Math.max(0, context.upcomingMeetings ?? 0);
  const decisionsNoAction = Math.max(0, context.recentDecisionsWithoutAction ?? 0);
  const daysSince = context.daysSinceLastMeeting;
  const noRecentMeeting = daysSince == null || daysSince > NO_RECENT_MEETING_DAYS;

  const reasons: string[] = [];
  if (overdue > 0) reasons.push(`${plural(overdue, "action")} overdue`);
  if (blocked > 0) reasons.push(`${plural(blocked, "action")} blocked`);
  if (followUps > 0) reasons.push(`${plural(followUps, "open follow-up")}`);
  if (decisionsNoAction > 0) {
    reasons.push(`${plural(decisionsNoAction, "decision")} with no action assigned`);
  }
  if (unassigned > 0) reasons.push(`${plural(unassigned, "action")} with no owner`);
  if (daysSince != null && daysSince > NO_RECENT_MEETING_DAYS) {
    reasons.push(`no meeting in ${daysSince} days`);
  } else if (daysSince == null && open > 0) {
    reasons.push("no meeting on record");
  }
  if (reasons.length === 0 && open > 0) {
    reasons.push(`${plural(open, "open action")}`);
  }

  const steps: string[] = [];
  if (overdue > 0 || blocked > 0) {
    steps.push("Reassign, reschedule, or unblock the overdue work");
  }
  if (unassigned > 0) steps.push("Assign an owner to the unowned actions");
  if (decisionsNoAction > 0) steps.push("Convert open decisions into tracked actions");
  if (followUps > 0) steps.push("Close out the open meeting follow-ups");
  if (noRecentMeeting && open > 0) {
    steps.push(
      upcoming > 0
        ? "Use the upcoming meeting to get this back on track"
        : "Schedule a check-in — nothing is on the calendar"
    );
  }
  if (steps.length === 0) {
    steps.push(
      upcoming > 0
        ? "Keep the rhythm — the next meeting is already scheduled"
        : "Schedule the next review to keep momentum"
    );
  }

  const word = LEVEL_WORD[health.level];
  const topReasons = reasons.slice(0, 2);
  const headline =
    health.level === "healthy" && reasons.length === 0
      ? "Healthy — recent activity and nothing overdue."
      : `${word} because ${joinReasons(topReasons)}.`;

  return { level: health.level, headline, reasons, suggestedNextSteps: steps };
}

function joinReasons(reasons: string[]): string {
  if (reasons.length === 0) return "there is open work";
  if (reasons.length === 1) return reasons[0];
  return `${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}`;
}

// --- recommended review order ------------------------------------------------

/** Entity type → review-queue kind (mirrors what a leader recognises). */
const ENTITY_REVIEW_KIND: Record<RelatedEntityType, OperationalReviewKind> = {
  CLASS_OFFERING: "class",
  MENTORSHIP: "mentorship",
  USER: "person",
  INSTRUCTOR_APPLICATION: "instructor",
  PARTNER: "partner",
};

/** Tie-break importance of an entity type (core delivery first). */
const ENTITY_TYPE_WEIGHT: Record<RelatedEntityType, number> = {
  CLASS_OFFERING: 5,
  MENTORSHIP: 4,
  INSTRUCTOR_APPLICATION: 3,
  PARTNER: 2,
  USER: 1,
};

const SEVERITY_FROM_LEVEL: Record<OperationalHealthLevel, OperationalReviewSeverity> = {
  critical: "critical",
  at_risk: "warning",
  attention: "watch",
  healthy: "neutral",
};

function severityForScore(score: number): OperationalReviewSeverity {
  if (score >= 40) return "critical";
  if (score >= 20) return "warning";
  if (score >= 8) return "watch";
  return "neutral";
}

const KIND_TIE_BREAK: Record<OperationalReviewKind, number> = {
  action: 0,
  class: 1,
  instructor: 2,
  mentorship: 3,
  person: 4,
  partner: 5,
  area: 6,
  meeting: 7,
  decision: 8,
};

/**
 * The deterministic accountability engine: score every reviewable thing and
 * return them worst-first. Entities are weighted by overdue/blocked work, health
 * level, unresolved follow-ups, meeting staleness, unowned work, and entity-type
 * importance; meetings by their unresolved follow-through; decisions by being
 * unconverted; upcoming meetings by how soon they are; and standalone urgent
 * actions (those not already represented by a surfaced entity) by overdue depth
 * and priority. Same inputs → same order, always.
 */
export function rankReviewItems(input: {
  entities: OperationalEntityLite[];
  meetingsNeedingFollowThrough: MeetingLite[];
  decisionsNeedingAction: DecisionLite[];
  upcomingMeetings: MeetingLite[];
  urgentActions: ActionLite[];
  now?: Date;
  limit?: number;
}): OperationalReviewItem[] {
  const now = input.now ?? new Date();
  const items: OperationalReviewItem[] = [];

  // 1. Entities that are not healthy.
  for (const e of input.entities) {
    if (e.health.level === "healthy") continue;
    let score = OPERATIONAL_HEALTH_LEVELS[e.health.level].rank * 14;
    score += e.overdueActions * 20;
    score += e.blockedActions * 12;
    score += e.unresolvedFollowUps * 6;
    score += e.unassignedActions * 4;
    if (e.daysSinceLastMeeting == null) score += 8;
    else if (e.daysSinceLastMeeting > NO_RECENT_MEETING_DAYS) score += 8;
    score += ENTITY_TYPE_WEIGHT[e.type];

    const reasons: string[] = [...e.health.reasons];
    if (entityHasNoRecentMeeting(e)) {
      reasons.push(
        e.daysSinceLastMeeting == null
          ? "no meeting on record"
          : `no meeting in ${e.daysSinceLastMeeting} days`
      );
    }
    items.push({
      id: `entity:${e.refKey}`,
      kind: ENTITY_REVIEW_KIND[e.type],
      title: e.label,
      reason: reasons[0] ?? `${e.openActions} open`,
      reasons,
      score,
      severity: SEVERITY_FROM_LEVEL[e.health.level],
      href: e.href ?? "/operations/command-center",
    });
  }

  // 2. Meetings needing follow-through.
  for (const m of input.meetingsNeedingFollowThrough) {
    let score = 22;
    score += m.overdueFollowUps * 10;
    score += m.openFollowUps * 4;
    const decisionsNoAction = m.decisionCount > 0 && m.linkedActionCount === 0;
    if (decisionsNoAction) score += 15;
    const reasons: string[] = [];
    if (m.overdueFollowUps > 0) reasons.push(`${plural(m.overdueFollowUps, "overdue follow-up")}`);
    if (m.openFollowUps > 0) reasons.push(`${plural(m.openFollowUps, "open follow-up")}`);
    if (decisionsNoAction) {
      reasons.push(`${plural(m.decisionCount, "decision")} with no action`);
    }
    if (m.linkedActionCount === 0 && m.decisionCount === 0) {
      reasons.push("no actions came out of this meeting");
    }
    items.push({
      id: `meeting:${m.id}`,
      kind: "meeting",
      title: m.title,
      reason: reasons[0] ?? "needs follow-through",
      reasons,
      score,
      severity: severityForScore(score),
      href: m.href,
    });
  }

  // 3. Decisions with no action (cap the noisiest source).
  for (const d of input.decisionsNeedingAction.slice(0, 10)) {
    const score = 18;
    const reasons = ["Decided but no action assigned"];
    items.push({
      id: `decision:${d.id}`,
      kind: "decision",
      title: d.decision,
      reason: reasons[0],
      reasons,
      score,
      severity: "watch",
      href: d.href,
    });
  }

  // 4. Upcoming meetings, soonest = most prep-worthy.
  for (const m of input.upcomingMeetings) {
    const days = daysUntil(new Date(m.startISO), now) ?? 99;
    if (days > 3) continue;
    let score = 10;
    if (days <= 0) score += 8;
    else if (days <= 1) score += 6;
    else score += 3;
    const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    const reasons = [`Meeting ${when} — prep and confirm the agenda`];
    items.push({
      id: `upcoming:${m.id}`,
      kind: "meeting",
      title: m.title,
      reason: reasons[0],
      reasons,
      score,
      severity: "neutral",
      href: m.href,
    });
  }

  // 5. Standalone urgent actions not already covered by a surfaced entity.
  const surfacedRefs = new Set(
    input.entities
      .filter((e) => e.health.level !== "healthy")
      .map((e) => e.refKey)
  );
  for (const a of input.urgentActions) {
    if (!a.overdue && !a.blocked) continue;
    const ref = a.relatedType && a.relatedId ? relatedRefKey(a.relatedType, a.relatedId) : null;
    if (ref && surfacedRefs.has(ref)) continue;
    let score = 0;
    if (a.overdue) score += 15 + Math.min(a.daysOverdue, 14) * 2;
    if (a.blocked) score += 12;
    if (a.unassigned) score += 5;
    score += ACTION_PRIORITY_WEIGHT[a.priority] * 3;
    const reasons: string[] = [];
    if (a.overdue) reasons.push(`Overdue ${plural(a.daysOverdue, "day")}`);
    if (a.blocked) reasons.push("Blocked — needs unblocking");
    if (a.unassigned) reasons.push("No owner assigned");
    items.push({
      id: `action:${a.id}`,
      kind: "action",
      title: a.title,
      reason: reasons[0] ?? "Needs attention",
      reasons,
      score,
      severity: severityForScore(score),
      href: a.href,
    });
  }

  items.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_TIE_BREAK[a.kind] - KIND_TIE_BREAK[b.kind] ||
      a.title.localeCompare(b.title)
  );
  return typeof input.limit === "number" ? items.slice(0, input.limit) : items;
}

// --- B. the weekly digest assembly ------------------------------------------

export type DeriveDigestInput = {
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: ReadonlyMap<string, RelatedEntitySummary>;
  now?: Date;
  window?: { start: Date; end: Date };
  limits?: {
    urgentActions?: number;
    upcomingMeetings?: number;
    staleEntities?: number;
    criticalEntities?: number;
    decisions?: number;
    meetingsNeedingFollowThrough?: number;
    recentlyCompleted?: number;
    review?: number;
  };
};

/**
 * Assemble the full {@link WeeklyOperationalDigest} from already-loaded data.
 * Pure: callers inject `now` (and optionally an explicit window / limits). The
 * default window is the current operating week (Mon–Sun), matching the rest of
 * the leadership rhythm.
 */
export function deriveWeeklyOperationalDigest(
  input: DeriveDigestInput
): WeeklyOperationalDigest {
  const now = input.now ?? new Date();
  const window =
    input.window ?? {
      start: startOfOperatingWeek(now),
      end: endOfOperatingWeek(now),
    };
  const limits = input.limits ?? {};

  const actionBuckets = bucketActionsByUrgency(input.actions, now);
  const meetingBuckets = bucketMeetingsByUrgency(input.meetings, now);
  const entities = deriveOperationalEntities({
    actions: input.actions,
    meetings: input.meetings,
    decisions: input.decisions,
    labels: input.labels,
    now,
  });

  // Urgent actions = overdue first, then due-today, then anything blocked that
  // is not already overdue, de-duped by id.
  const urgentRaw: ActionItemWithRelations[] = [];
  const seen = new Set<string>();
  const pushUnique = (list: ActionItemWithRelations[]) => {
    for (const a of list) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      urgentRaw.push(a);
    }
  };
  pushUnique(actionBuckets.overdue);
  pushUnique(actionBuckets.dueToday);
  pushUnique(actionBuckets.blocked);
  const urgentActions = urgentRaw.map((a) => toActionLite(a, now));

  const upcomingMeetings = meetingBuckets.upcomingThisWeek.map((m) => toMeetingLite(m, now));

  // Meetings needing follow-through: unresolved follow-ups, decisions with no
  // action, or a meeting that happened and produced no action at all.
  const followThroughSeen = new Set<string>();
  const meetingsNeedingFollowThrough: MeetingLite[] = [];
  for (const list of [
    meetingBuckets.withUnresolvedFollowUps,
    meetingBuckets.withDecisionsNoAction,
    meetingBuckets.withoutActions,
  ]) {
    for (const m of list) {
      if (followThroughSeen.has(m.id)) continue;
      followThroughSeen.add(m.id);
      meetingsNeedingFollowThrough.push(toMeetingLite(m, now));
    }
  }

  const recentDecisions = selectRecentDecisions(input.decisions, now);
  const decisionsNeedingActionRaw = recentDecisions.filter((d) => !d.hasLinkedAction);
  const decisionsNeedingAction = decisionsNeedingActionRaw.map(toDecisionLite);

  const staleEntities = selectStaleEntities(entities);
  const criticalEntities = entities.filter((e) => e.health.level === "critical");
  const warningEntities = entities.filter((e) => e.health.level === "at_risk");

  const recentlyCompletedActions = actionBuckets.recentlyCompleted.map((a) =>
    toActionLite(a, now)
  );

  const unresolvedFollowUps = input.meetings.reduce((sum, m) => sum + m.openFollowUps, 0);

  const areaHealth = deriveAreaHealth({
    actions: input.actions,
    meetings: input.meetings,
    entities,
    now,
  });

  const recommendedReviewOrder = rankReviewItems({
    entities,
    meetingsNeedingFollowThrough,
    decisionsNeedingAction,
    upcomingMeetings,
    urgentActions,
    now,
    limit: limits.review ?? 12,
  });

  const counts: OperationalDigestCounts = {
    overdueActions: actionBuckets.overdue.length,
    dueTodayActions: actionBuckets.dueToday.length,
    dueSoonActions: actionBuckets.dueToday.length + actionBuckets.dueThisWeek.length,
    blockedActions: actionBuckets.blocked.length,
    unassignedActions: actionBuckets.unassigned.length,
    upcomingMeetings: meetingBuckets.upcomingThisWeek.length,
    meetingsWithoutActions: meetingBuckets.withoutActions.length,
    unresolvedFollowUps,
    criticalEntities: criticalEntities.length,
    warningEntities: warningEntities.length,
    recentDecisions: recentDecisions.length,
    decisionsNeedingAction: decisionsNeedingActionRaw.length,
    recentlyCompletedActions: recentlyCompletedActions.length,
  };

  const sliceOr = <T>(list: T[], n: number | undefined): T[] =>
    typeof n === "number" ? list.slice(0, n) : list;

  return {
    generatedAt: now,
    window,
    counts,
    urgentActions: sliceOr(urgentActions, limits.urgentActions ?? 8),
    upcomingMeetings: sliceOr(upcomingMeetings, limits.upcomingMeetings ?? 6),
    staleEntities: sliceOr(staleEntities, limits.staleEntities ?? 6),
    criticalEntities: sliceOr(criticalEntities, limits.criticalEntities ?? 6),
    decisionsNeedingAction: sliceOr(decisionsNeedingAction, limits.decisions ?? 6),
    meetingsNeedingFollowThrough: sliceOr(
      meetingsNeedingFollowThrough,
      limits.meetingsNeedingFollowThrough ?? 6
    ),
    recentlyCompletedActions: sliceOr(recentlyCompletedActions, limits.recentlyCompleted ?? 6),
    areaHealth,
    recommendedReviewOrder,
  };
}
