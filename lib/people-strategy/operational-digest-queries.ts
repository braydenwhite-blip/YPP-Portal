import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { addDays, daysUntil, startOfDay } from "@/lib/leadership-action-center/dates";

import { type ActionViewer } from "./action-permissions";
import {
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "./action-queries";
import { type MeetingCardDTO } from "./meeting-card-types";
import {
  loadRelatedEntityLabels,
  type RelatedEntitySummary,
} from "./connections";
import {
  isRelatedEntityType,
  type RelatedEntityRef,
  type RelatedEntityType,
} from "./constants";
import { meetingCategoryLabel } from "./meeting-categories";
import {
  areaForRelatedEntityType,
  computeOperationalHealth,
  type OperationalArea,
  type OperationalHealth,
} from "./operational-context";
import {
  combineHealthSignals,
  deriveActionSignals,
  deriveMeetingSignals,
  getOperationalContextForEntity,
  type EntityOperationalContext,
} from "./operational-context-queries";
import {
  deriveWeeklyOperationalDigest,
  explainOperationalHealth,
  NO_RECENT_MEETING_DAYS,
  RECENT_DECISION_DAYS,
  type DigestDecisionInput,
  type OperationalHealthExplanation,
  type WeeklyOperationalDigest,
} from "./operational-digest";

/**
 * People Strategy Execution OS — Command Center digest QUERIES.
 *
 * The single batched read layer that feeds the pure digest derivations. It
 * composes the existing per-domain helpers (`listVisibleActionItems`,
 * `listMeetingsInRange`, `getMeetingsForEntities`, `loadRelatedEntityLabels`) —
 * never a second source of truth — and is careful to avoid N+1: actions load in
 * one query, the relevant meetings in one ranged query, the per-entity meeting
 * history in one batched query, and the entity labels in one query per type.
 *
 * Permission model (mirrors the rest of this module):
 *   - Actions are visibility-filtered via `listVisibleActionItems`, so a scoped
 *     officer only ever feeds the digest the actions they may see.
 *   - The meeting reads are NOT per-viewer filtered (the Meetings Tracker is
 *     officer-gated at the page guard), so these loaders MUST only be called from
 *     an officer-gated surface (the Command Center / Weekly Execution pages call
 *     `requireOfficer`). Entity-level digests inherit the same gate.
 */

/** How far back / ahead the digest's ranged meeting read looks. */
export const DIGEST_MEETING_LOOKBACK_DAYS = 30;
export const DIGEST_MEETING_LOOKAHEAD_DAYS = 14;

export type DigestQueryOptions = { now?: Date };

// --- shared loaders ----------------------------------------------------------

/** Distinct, validated related-entity refs across the loaded actions. */
function collectEntityRefs(actions: ActionItemWithRelations[]): RelatedEntityRef[] {
  const seen = new Set<string>();
  const refs: RelatedEntityRef[] = [];
  const add = (type: string | null, id: string | null) => {
    if (!type || !id || !isRelatedEntityType(type)) return;
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ type, id });
  };
  for (const a of actions) add(a.relatedEntityType, a.relatedEntityId);
  return refs;
}

/**
 * The old Meetings Tracker was removed, so meetings + meeting-derived decisions
 * are always empty now. This still resolves the entity labels the digest uses to
 * name related-entity work.
 */
async function loadDigestMeetingData(
  refs: RelatedEntityRef[]
): Promise<{
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: Map<string, RelatedEntitySummary>;
}> {
  const labels = await loadRelatedEntityLabels(refs).catch(
    () => new Map<string, RelatedEntitySummary>()
  );
  return { meetings: [], decisions: [], labels };
}

function emptyDigest(now: Date): WeeklyOperationalDigest {
  return deriveWeeklyOperationalDigest({
    actions: [],
    meetings: [],
    decisions: [],
    labels: new Map(),
    now,
  });
}

// --- A. global leadership digest --------------------------------------------

export type DigestInputs = {
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: Map<string, RelatedEntitySummary>;
};

/**
 * The single batched read that backs both the whole-org digest and the Weekly
 * Review: every visible action, the meetings in the operating window, and the
 * full meeting history of every entity with open work. Returns empty inputs when
 * the tracker flag is off.
 *
 * Exported so the Strategic Initiatives layer can reuse the exact same batched
 * read (one source of truth, no N+1) and classify the loaded work into
 * initiatives in memory.
 */
export async function loadDigestInputs(
  viewer: ActionViewer,
  now: Date
): Promise<DigestInputs> {
  if (!isActionTrackerEnabled()) {
    return { actions: [], meetings: [], decisions: [], labels: new Map() };
  }

  const actions = await listVisibleActionItems(viewer).catch(
    () => [] as ActionItemWithRelations[]
  );

  const refs = collectEntityRefs(actions);
  const { meetings, decisions, labels } = await loadDigestMeetingData(refs);
  return { actions, meetings, decisions, labels };
}

/**
 * The whole-org weekly operational digest for a leadership viewer. Loads every
 * action the viewer may see, the meetings in the operating window, and the full
 * meeting history of every entity with open work, then derives the digest. Fails
 * safe to an empty digest when the tracker flag is off. Officer-gate the caller.
 */
export async function getWeeklyOperationalDigestForViewer(
  viewer: ActionViewer,
  options: DigestQueryOptions = {}
): Promise<WeeklyOperationalDigest> {
  const now = options.now ?? new Date();
  const { actions, meetings, decisions, labels } = await loadDigestInputs(viewer, now);
  return deriveWeeklyOperationalDigest({ actions, meetings, decisions, labels, now });
}

// --- B. area-level digest ----------------------------------------------------

export type AreaOperationalDigest = {
  area: OperationalArea;
  areaLabel: string;
  health: OperationalHealth;
  explanation: OperationalHealthExplanation;
  digest: WeeklyOperationalDigest;
};

/**
 * The operational digest scoped to one YPP operating area — actions whose linked
 * entity rolls up to the area (the same rule the area context loader uses) plus
 * the meetings tagged with the area. Backs future area command pages
 * (Classes / Mentorship / Partners / …). Fails safe to an empty area.
 */
export async function getOperationalDigestForArea(
  area: OperationalArea,
  viewer: ActionViewer,
  options: DigestQueryOptions = {}
): Promise<AreaOperationalDigest> {
  const now = options.now ?? new Date();
  const areaLabel = meetingCategoryLabel(area);

  if (!isActionTrackerEnabled()) {
    const health = computeOperationalHealth({});
    return {
      area,
      areaLabel,
      health,
      explanation: explainOperationalHealth(health, {}),
      digest: emptyDigest(now),
    };
  }

  const allActions = await listVisibleActionItems(viewer).catch(
    () => [] as ActionItemWithRelations[]
  );

  const actions = allActions.filter(
    (a) =>
      a.relatedEntityType != null &&
      isRelatedEntityType(a.relatedEntityType) &&
      areaForRelatedEntityType(a.relatedEntityType) === area
  );

  const refs = collectEntityRefs(actions);
  const { meetings, decisions, labels } = await loadDigestMeetingData(refs);

  const digest = deriveWeeklyOperationalDigest({
    actions,
    meetings,
    decisions,
    labels,
    now,
  });

  const actionSignals = deriveActionSignals(actions, now);
  const meetingSignals = deriveMeetingSignals(meetings);
  const health = computeOperationalHealth(
    combineHealthSignals(actionSignals, meetingSignals)
  );
  const explanation = explainOperationalHealth(health, {
    overdueActions: actionSignals.overdue,
    openActions: actionSignals.open,
    blockedActions: actionSignals.blocked,
    unassignedActions: actionSignals.unassigned,
    unresolvedFollowUps: meetingSignals.openFollowUps,
    upcomingMeetings: digest.counts.upcomingMeetings,
    recentDecisionsWithoutAction: digest.counts.decisionsNeedingAction,
    daysSinceLastMeeting: daysSinceLastMeetingOf(meetings, now),
  });

  return { area, areaLabel, health, explanation, digest };
}

// --- C. entity-level digest --------------------------------------------------

export type EntityOperationalDigest = {
  context: EntityOperationalContext;
  explanation: OperationalHealthExplanation;
  openCount: number;
  overdueCount: number;
  unresolvedFollowUps: number;
  recentDecisionCount: number;
  upcomingMeetingCount: number;
  daysSinceLastMeeting: number | null;
  isStale: boolean;
  /** The single best next move for this entity (first suggested step). */
  recommendedNextAction: string;
};

/**
 * Enrich the existing entity operational context with the digest read: a health
 * explanation, a recommended next action, stale status, and the operating counts
 * the panel surfaces. Returns null for the same reasons the context loader does
 * (bad type / blank id / tracker off), so a caller can skip the panel. Builds on
 * `getOperationalContextForEntity` — does not re-query the entity's work.
 */
export async function getOperationalDigestForEntity(
  type: RelatedEntityType,
  id: string,
  viewer: ActionViewer,
  options: DigestQueryOptions = {}
): Promise<EntityOperationalDigest | null> {
  const now = options.now ?? new Date();
  const context = await getOperationalContextForEntity(type, id, viewer, now);
  if (!context) return null;

  const actionSignals = deriveActionSignals(context.actions, now);
  const meetingSignals = deriveMeetingSignals(context.meetings);
  const upcomingMeetingCount = countUpcomingMeetings(context.meetings, now);
  const daysSinceLastMeeting = daysSinceLastMeetingOf(context.meetings, now);
  const recentDecisionCount = countRecentDecisions(context.recentDecisions, now);

  const explanation = explainOperationalHealth(context.health, {
    overdueActions: actionSignals.overdue,
    openActions: actionSignals.open,
    blockedActions: actionSignals.blocked,
    unassignedActions: actionSignals.unassigned,
    unresolvedFollowUps: meetingSignals.openFollowUps,
    upcomingMeetings: upcomingMeetingCount,
    daysSinceLastMeeting,
  });

  const isStale =
    actionSignals.open > 0 &&
    (daysSinceLastMeeting == null || daysSinceLastMeeting > NO_RECENT_MEETING_DAYS);

  return {
    context,
    explanation,
    openCount: actionSignals.open,
    overdueCount: actionSignals.overdue,
    unresolvedFollowUps: meetingSignals.openFollowUps,
    recentDecisionCount,
    upcomingMeetingCount,
    daysSinceLastMeeting,
    isStale,
    recommendedNextAction: explanation.suggestedNextSteps[0] ?? "Keep the rhythm — schedule the next review",
  };
}

// --- small shared meeting-card reducers -------------------------------------

function countUpcomingMeetings(meetings: MeetingCardDTO[], now: Date): number {
  const todayStart = startOfDay(now).getTime();
  return meetings.filter(
    (m) =>
      m.effectiveStatus !== "canceled" &&
      new Date(m.startISO).getTime() >= todayStart
  ).length;
}

function daysSinceLastMeetingOf(meetings: MeetingCardDTO[], now: Date): number | null {
  const todayStart = startOfDay(now).getTime();
  let last: number | null = null;
  for (const m of meetings) {
    const t = new Date(m.startISO).getTime();
    if (t < todayStart && (last == null || t > last)) last = t;
  }
  return last == null ? null : (daysUntil(new Date(last), now) ?? 0) * -1;
}

function countRecentDecisions(
  decisions: Array<{ createdISO: string }>,
  now: Date
): number {
  const cutoff = addDays(now, -RECENT_DECISION_DAYS).getTime();
  return decisions.filter((d) => new Date(d.createdISO).getTime() >= cutoff).length;
}
