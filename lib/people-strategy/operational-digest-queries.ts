import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { addDays, daysUntil, startOfDay } from "@/lib/leadership-action-center/dates";

import { type ActionViewer } from "./action-permissions";
import {
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "./action-queries";
import {
  getMeetingsForEntities,
  listMeetingsForArea,
  listMeetingsInRange,
  mapMeetingToCardDTO,
  meetingDisplayTitle,
  type MeetingCardDTO,
  type MeetingWithCommandCenter,
} from "./meetings-queries";
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
 *     an officer-gated surface (the Command Center / Weekly Review pages call
 *     `requireOfficer`). Entity-level digests inherit the same gate.
 */

/** How far back / ahead the digest's ranged meeting read looks. */
export const DIGEST_MEETING_LOOKBACK_DAYS = 30;
export const DIGEST_MEETING_LOOKAHEAD_DAYS = 14;

export type DigestQueryOptions = { now?: Date };

// --- shared loaders ----------------------------------------------------------

/** Distinct, validated related-entity refs across the loaded actions + meetings. */
function collectEntityRefs(
  actions: ActionItemWithRelations[],
  meetings: Array<{ relatedEntityType: string | null; relatedEntityId: string | null }>
): RelatedEntityRef[] {
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
  for (const m of meetings) add(m.relatedEntityType, m.relatedEntityId);
  return refs;
}

/** Flatten raw meeting decisions into the digest's DB-free decision shape. */
function extractDigestDecisions(
  meetings: MeetingWithCommandCenter[]
): DigestDecisionInput[] {
  const out: DigestDecisionInput[] = [];
  for (const m of meetings) {
    const title = meetingDisplayTitle(m);
    for (const d of m.decisions) {
      out.push({
        id: d.id,
        decision: d.decision,
        meetingId: m.id,
        meetingTitle: title,
        meetingCategory: m.category,
        createdAt: d.createdAt,
        decidedByName: d.decidedBy?.name ?? d.decidedBy?.email ?? null,
        hasLinkedAction: d.linkedActionId != null,
        relatedEntityType: m.relatedEntityType,
        relatedEntityId: m.relatedEntityId,
      });
    }
  }
  return out;
}

/**
 * Merge a ranged meeting set with the per-entity meeting history (deduped by id)
 * so the digest sees both the recent operating window AND the full history of
 * every entity that carries open work — the latter is what makes
 * `daysSinceLastMeeting` and entity health accurate even when an entity's last
 * meeting predates the window.
 */
async function loadDigestMeetingData(
  primaryMeetings: MeetingWithCommandCenter[],
  refs: RelatedEntityRef[],
  now: Date
): Promise<{
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: Map<string, RelatedEntitySummary>;
}> {
  const [meetingsByEntity, labels] = await Promise.all([
    getMeetingsForEntities(refs).catch(
      () => new Map<string, MeetingWithCommandCenter[]>()
    ),
    loadRelatedEntityLabels(refs).catch(() => new Map<string, RelatedEntitySummary>()),
  ]);

  const rawById = new Map<string, MeetingWithCommandCenter>();
  for (const m of primaryMeetings) rawById.set(m.id, m);
  for (const list of meetingsByEntity.values()) {
    for (const m of list) rawById.set(m.id, m);
  }
  const raw = [...rawById.values()];

  return {
    meetings: raw.map((m) => mapMeetingToCardDTO(m, now)),
    decisions: extractDigestDecisions(raw),
    labels,
  };
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
  if (!isActionTrackerEnabled()) return emptyDigest(now);

  const [actions, windowMeetings] = await Promise.all([
    listVisibleActionItems(viewer).catch(() => [] as ActionItemWithRelations[]),
    listMeetingsInRange(
      addDays(now, -DIGEST_MEETING_LOOKBACK_DAYS),
      addDays(now, DIGEST_MEETING_LOOKAHEAD_DAYS)
    ).catch(() => [] as MeetingWithCommandCenter[]),
  ]);

  const refs = collectEntityRefs(actions, windowMeetings);
  const { meetings, decisions, labels } = await loadDigestMeetingData(
    windowMeetings,
    refs,
    now
  );

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

  const [allActions, areaMeetings] = await Promise.all([
    listVisibleActionItems(viewer).catch(() => [] as ActionItemWithRelations[]),
    listMeetingsForArea(area, {
      since: addDays(now, -DIGEST_MEETING_LOOKBACK_DAYS),
    }).catch(() => [] as MeetingWithCommandCenter[]),
  ]);

  const actions = allActions.filter(
    (a) =>
      a.relatedEntityType != null &&
      isRelatedEntityType(a.relatedEntityType) &&
      areaForRelatedEntityType(a.relatedEntityType) === area
  );

  const refs = collectEntityRefs(actions, areaMeetings);
  const { meetings, decisions, labels } = await loadDigestMeetingData(
    areaMeetings,
    refs,
    now
  );

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
