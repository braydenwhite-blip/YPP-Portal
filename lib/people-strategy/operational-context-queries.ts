import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { addDays } from "@/lib/leadership-action-center/dates";

import { type ActionViewer } from "./action-permissions";
import {
  getActionsForEntity,
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "./action-queries";
import { effectiveStatus } from "./action-filters";
import { STALE_ACTIVITY_DAYS } from "./command-center-selectors";
import {
  isRelatedEntityType,
  type RelatedEntityType,
} from "./constants";
import {
  loadRelatedEntitySummary,
  type RelatedEntitySummary,
} from "./connections";
import { meetingCategoryLabel } from "./meeting-categories";
import {
  type EffectiveFollowUpStatus,
  type MeetingCardDTO,
} from "./meeting-card-types";
import {
  areaForRelatedEntityType,
  computeOperationalHealth,
  type OperationalArea,
  type OperationalHealth,
  type OperationalHealthSignals,
} from "./operational-context";

/**
 * People Strategy Operating System — unified Operational Context loader.
 *
 * This is the join point of the cross-portal nervous system: given a YPP entity
 * (a class / mentorship / person / application / partner) OR a whole operating
 * area, it loads BOTH the meetings and the actions that belong to it, derives a
 * single operating-health read, and pulls the open follow-ups + recent decisions
 * that give the work its context. Entity pages render the result through one
 * `OperationalContextPanel` instead of an actions-only list.
 *
 * The signal derivations are PURE (exported for unit tests); the loaders compose
 * the existing per-domain queries (`getActionsForEntity`, `getMeetingsForEntity`)
 * and fail safe — one empty / failing subsystem degrades to an empty section
 * rather than throwing.
 */

const SETTLED = new Set(["COMPLETE", "DROPPED"]);

// --- pure signal derivations -------------------------------------------------

export type ActionSignals = {
  open: number;
  overdue: number;
  blocked: number;
  unassigned: number;
  stale: number;
};

/**
 * Reduce a set of (already visibility-filtered) actions to the raw counts the
 * health computation needs. "Stale" = an open action whose most recent update is
 * older than the shared staleness window. Pure over an `effectiveStatus` read so
 * a past-due open item counts as overdue exactly like everywhere else.
 */
export function deriveActionSignals(
  actions: ActionItemWithRelations[],
  now: Date = new Date()
): ActionSignals {
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  let open = 0;
  let overdue = 0;
  let blocked = 0;
  let unassigned = 0;
  let stale = 0;

  for (const action of actions) {
    const status = effectiveStatus(action, now);
    if (SETTLED.has(status)) continue;
    open += 1;
    if (status === "OVERDUE") overdue += 1;
    if (status === "BLOCKED") blocked += 1;
    if (!action.assignments.some((a) => a.role === "EXECUTING")) unassigned += 1;
    if (action.updatedAt.getTime() < staleCutoff) stale += 1;
  }

  return { open, overdue, blocked, unassigned, stale };
}

export type MeetingSignals = {
  openFollowUps: number;
  overdueFollowUps: number;
  meetingsNeedingFollowUp: number;
};

/**
 * Reduce a set of meeting card DTOs to the follow-up signals the health
 * computation needs. A meeting "needs follow-up" when its effective status says
 * so (a completed / past meeting with open follow-ups). Pure.
 */
export function deriveMeetingSignals(meetings: MeetingCardDTO[]): MeetingSignals {
  let openFollowUps = 0;
  let overdueFollowUps = 0;
  let meetingsNeedingFollowUp = 0;
  for (const m of meetings) {
    openFollowUps += m.openFollowUps;
    overdueFollowUps += m.overdueFollowUps;
    if (m.effectiveStatus === "needs_follow_up") meetingsNeedingFollowUp += 1;
  }
  return { openFollowUps, overdueFollowUps, meetingsNeedingFollowUp };
}

/** Combine action + meeting signals into the health-input shape. */
export function combineHealthSignals(
  actions: ActionSignals,
  meetings: MeetingSignals
): OperationalHealthSignals {
  return {
    openActions: actions.open,
    overdueActions: actions.overdue,
    blockedActions: actions.blocked,
    unassignedActions: actions.unassigned,
    staleActions: actions.stale,
    openFollowUps: meetings.openFollowUps,
    overdueFollowUps: meetings.overdueFollowUps,
    meetingsNeedingFollowUp: meetings.meetingsNeedingFollowUp,
  };
}

/** Health for a surface from its loaded actions + meeting card DTOs (pure). */
export function deriveOperationalHealth(
  actions: ActionItemWithRelations[],
  meetings: MeetingCardDTO[],
  now: Date = new Date()
): OperationalHealth {
  return computeOperationalHealth(
    combineHealthSignals(deriveActionSignals(actions, now), deriveMeetingSignals(meetings))
  );
}

// --- context DTOs ------------------------------------------------------------

export type FollowUpContextDTO = {
  id: string;
  title: string;
  meetingId: string;
  meetingTitle: string;
  dueISO: string | null;
  effectiveStatus: EffectiveFollowUpStatus;
  ownerName: string | null;
  areaLabel: string;
};

export type DecisionContextDTO = {
  id: string;
  decision: string;
  meetingId: string;
  meetingTitle: string;
  createdISO: string;
  decidedByName: string | null;
};

// Meeting-derived follow-ups / decisions are no longer loaded (the old Meetings
// Tracker was removed); these context sections are always empty now.

// --- entity context loader ---------------------------------------------------

export type EntityOperationalContext = {
  ref: { type: RelatedEntityType; id: string };
  area: OperationalArea;
  summary: RelatedEntitySummary | null;
  meetings: MeetingCardDTO[];
  actions: ActionItemWithRelations[];
  openFollowUps: FollowUpContextDTO[];
  recentDecisions: DecisionContextDTO[];
  health: OperationalHealth;
};

/**
 * The complete operational context for one YPP entity: every related meeting,
 * every visible related action, the open follow-ups + recent decisions those
 * meetings produced, a display summary of the entity, and a single health read.
 * Returns null for a bad type / blank id / tracker-off so a caller can simply
 * skip the panel. Each subsystem is loaded in parallel and fails safe.
 */
export async function getOperationalContextForEntity(
  type: RelatedEntityType,
  id: string,
  viewer: ActionViewer,
  now: Date = new Date()
): Promise<EntityOperationalContext | null> {
  if (!isActionTrackerEnabled()) return null;
  if (!isRelatedEntityType(type)) return null;
  const entityId = id?.trim();
  if (!entityId) return null;

  const [actions, summary] = await Promise.all([
    getActionsForEntity(type, entityId, viewer).catch(() => [] as ActionItemWithRelations[]),
    loadRelatedEntitySummary(type, entityId).catch(() => null),
  ]);

  // The old Meetings Tracker was removed — related meetings are always empty now.
  const meetings: MeetingCardDTO[] = [];

  return {
    ref: { type, id: entityId },
    area: areaForRelatedEntityType(type),
    summary,
    meetings,
    actions,
    openFollowUps: [],
    recentDecisions: [],
    health: deriveOperationalHealth(actions, meetings, now),
  };
}

// --- area context loader -----------------------------------------------------

export type AreaOperationalContext = {
  area: OperationalArea;
  areaLabel: string;
  meetings: MeetingCardDTO[];
  actions: ActionItemWithRelations[];
  openFollowUps: FollowUpContextDTO[];
  recentDecisions: DecisionContextDTO[];
  health: OperationalHealth;
};

/**
 * The operational context for a whole YPP area (a meeting category): meetings
 * tagged with the area + actions whose linked entity rolls up to it. Used by the
 * cross-portal area pulse. Fails safe to an empty area.
 */
export async function getOperationalContextForArea(
  area: OperationalArea,
  viewer: ActionViewer,
  now: Date = new Date()
): Promise<AreaOperationalContext> {
  const empty: AreaOperationalContext = {
    area,
    areaLabel: meetingCategoryLabel(area),
    meetings: [],
    actions: [],
    openFollowUps: [],
    recentDecisions: [],
    health: computeOperationalHealth({}),
  };
  if (!isActionTrackerEnabled()) return empty;

  const allActions = await listVisibleActionItems(viewer).catch(
    () => [] as ActionItemWithRelations[]
  );

  // Actions belong to an area when their linked entity type rolls up to it.
  const actions = allActions.filter(
    (a) =>
      a.relatedEntityType != null &&
      isRelatedEntityType(a.relatedEntityType) &&
      areaForRelatedEntityType(a.relatedEntityType) === area
  );

  // The old Meetings Tracker was removed — area meetings are always empty now.
  const meetings: MeetingCardDTO[] = [];

  return {
    area,
    areaLabel: meetingCategoryLabel(area),
    meetings,
    actions,
    openFollowUps: [],
    recentDecisions: [],
    health: deriveOperationalHealth(actions, meetings, now),
  };
}
