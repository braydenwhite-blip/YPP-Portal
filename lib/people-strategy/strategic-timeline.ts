import type { ActionItemWithRelations } from "./action-queries";
import { effectiveStatus } from "./action-filters";
import type { MeetingCardDTO } from "./meeting-card-types";
import { relatedEntityTypeLabel, isRelatedEntityType } from "./constants";
import type { DigestDecisionInput } from "./operational-digest";
import type { InitiativeMilestoneSummary } from "./strategic-milestones";
import type { StrategicInitiativeDef } from "./strategic-initiatives";

/**
 * YPP Execution OS — ORGANIZATIONAL / STRATEGIC TIMELINE (Phase C).
 *
 * The existing timeline ({@link deriveOperationalTimeline}) is operational — the
 * story of ONE entity. This is the STRATEGIC timeline: the story of an
 * INITIATIVE (or the whole org), answering "how did we get here?" and "what
 * happened across this initiative?" by unifying meetings, decisions, actions
 * created + completed, milestones reached, and initiative markers into one
 * chronological stream.
 *
 * Honesty over theatre: every event has a REAL timestamp from real system state
 * (an action's `completedAt`, a meeting's start, a decision's `createdAt`, a
 * milestone's last completion, a configured target date). We do NOT fabricate
 * "health changed" / "ownership changed" history — that requires a persisted
 * event log, which this layer deliberately does not add. The event type union
 * keeps those kinds reserved for when such a log exists, but the deriver only
 * emits events it can prove from the data. Pure (only the injected `now`).
 */

export type StrategicTimelineEventType =
  | "initiative_created"
  | "meeting"
  | "decision"
  | "action_created"
  | "action_completed"
  | "milestone_reached"
  | "follow_up"
  | "target"; // a configured target date (initiative or milestone)

export type StrategicTimelineSeverity = "neutral" | "positive" | "watch" | "critical";

export type StrategicTimelineSourceType =
  | "initiative"
  | "meeting"
  | "decision"
  | "action"
  | "milestone";

export type StrategicTimelineEntity = {
  type: string;
  id: string;
  label: string;
};

export type StrategicTimelineEvent = {
  /** Stable, initiative-unique id (e.g. `action_completed:abc`). */
  id: string;
  type: StrategicTimelineEventType;
  occurredAtISO: string;
  /** True when the event is in the future (a target marker), so the UI can dim it. */
  upcoming: boolean;
  title: string;
  explanation: string;
  severity: StrategicTimelineSeverity;
  sourceType: StrategicTimelineSourceType;
  ownerName: string | null;
  initiativeId: string;
  initiativeTitle: string;
  entity: StrategicTimelineEntity | null;
  href: string;
};

// --- href + explanation (exported per the Phase C contract) -----------------

export function initiativeHref(initiativeId: string): string {
  return `/operations/initiatives/${initiativeId}`;
}

/** Where a timeline event navigates to when clicked. Pure. */
export function timelineEventToHref(event: {
  type: StrategicTimelineEventType;
  initiativeId: string;
  sourceId?: string | null;
  meetingId?: string | null;
  milestoneId?: string | null;
}): string {
  switch (event.type) {
    case "meeting":
    case "decision":
    case "follow_up":
      return event.meetingId ? `/meetings/${event.meetingId}` : initiativeHref(event.initiativeId);
    case "action_created":
    case "action_completed":
      return event.sourceId ? `/actions/${event.sourceId}` : initiativeHref(event.initiativeId);
    case "milestone_reached":
    case "target":
      return event.milestoneId
        ? `${initiativeHref(event.initiativeId)}#milestone-${event.milestoneId}`
        : initiativeHref(event.initiativeId);
    case "initiative_created":
    default:
      return initiativeHref(event.initiativeId);
  }
}

/**
 * The canonical one-line explanation for a timeline event. Deterministic — the
 * same event always yields the same sentence. Used during extraction to fill
 * `explanation`, and re-exported so any surface can re-derive the copy.
 */
export function explainTimelineEvent(event: {
  type: StrategicTimelineEventType;
  title: string;
  ownerName?: string | null;
  initiativeTitle: string;
  entityLabel?: string | null;
  upcoming?: boolean;
  overdue?: boolean;
}): string {
  const by = event.ownerName ? ` by ${event.ownerName}` : "";
  const on = event.entityLabel ? ` on ${event.entityLabel}` : "";
  switch (event.type) {
    case "initiative_created":
      return `“${event.initiativeTitle}” initiative began.`;
    case "meeting":
      return `Meeting held${by}${on} for ${event.initiativeTitle}.`;
    case "decision":
      return `Decision recorded${by}: ${event.title}.`;
    case "action_created":
      return `Action created${by}${on}.`;
    case "action_completed":
      return `Action completed${by}${on}.`;
    case "milestone_reached":
      return `Milestone “${event.title}” reached.`;
    case "follow_up":
      return event.overdue
        ? `Follow-up overdue${by}: ${event.title}.`
        : `Open follow-up${by}: ${event.title}.`;
    case "target":
      return event.upcoming
        ? `Target date for “${event.title}”.`
        : `“${event.title}” target date passed.`;
    default:
      return event.title;
  }
}

// --- importance --------------------------------------------------------------

const TYPE_IMPORTANCE: Record<StrategicTimelineEventType, number> = {
  milestone_reached: 50,
  initiative_created: 40,
  decision: 35,
  target: 30,
  action_completed: 20,
  meeting: 18,
  follow_up: 16,
  action_created: 10,
};

const SEVERITY_BUMP: Record<StrategicTimelineSeverity, number> = {
  critical: 14,
  positive: 8,
  watch: 6,
  neutral: 0,
};

/**
 * A deterministic importance score for a timeline event, so a "key moments"
 * view can surface the milestones, decisions, and completions over the routine
 * action churn. Higher = more important. Pure.
 */
export function rankTimelineImportance(event: {
  type: StrategicTimelineEventType;
  severity: StrategicTimelineSeverity;
}): number {
  return (TYPE_IMPORTANCE[event.type] ?? 0) + (SEVERITY_BUMP[event.severity] ?? 0);
}

// --- extraction --------------------------------------------------------------

function entityFor(
  type: string | null,
  id: string | null,
  labels?: ReadonlyMap<string, string>
): StrategicTimelineEntity | null {
  if (!type || !id || !isRelatedEntityType(type)) return null;
  const label = labels?.get(`${type}:${id}`) ?? relatedEntityTypeLabel(type);
  return { type, id, label };
}

export type DeriveTimelineInput = {
  def: StrategicInitiativeDef;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  milestones: InitiativeMilestoneSummary[];
  /** Optional refKey → human label map to enrich entity context. */
  entityLabels?: ReadonlyMap<string, string>;
  now?: Date;
};

/**
 * Extract every provable timeline event for one initiative from its loaded work
 * + derived milestones. No sorting / limiting here (see
 * {@link deriveStrategicTimeline}). Pure.
 */
export function deriveTimelineEvents(input: DeriveTimelineInput): StrategicTimelineEvent[] {
  const now = input.now ?? new Date();
  const { def } = input;
  const events: StrategicTimelineEvent[] = [];
  const labels = input.entityLabels;

  const push = (
    partial: Omit<StrategicTimelineEvent, "initiativeId" | "initiativeTitle" | "explanation" | "href"> & {
      meetingId?: string | null;
      milestoneId?: string | null;
      sourceId?: string | null;
      overdue?: boolean;
    }
  ) => {
    const { meetingId, milestoneId, sourceId, overdue, ...rest } = partial;
    events.push({
      ...rest,
      initiativeId: def.id,
      initiativeTitle: def.title,
      explanation: explainTimelineEvent({
        type: rest.type,
        title: rest.title,
        ownerName: rest.ownerName,
        initiativeTitle: def.title,
        entityLabel: rest.entity?.label,
        upcoming: rest.upcoming,
        overdue,
      }),
      href: timelineEventToHref({
        type: rest.type,
        initiativeId: def.id,
        sourceId: sourceId ?? null,
        meetingId: meetingId ?? null,
        milestoneId: milestoneId ?? null,
      }),
    });
  };

  // Initiative created (from its configured start date).
  if (def.startDateISO) {
    push({
      id: `initiative_created:${def.id}`,
      type: "initiative_created",
      occurredAtISO: def.startDateISO,
      upcoming: new Date(def.startDateISO).getTime() > now.getTime(),
      title: `${def.title} created`,
      severity: "neutral",
      sourceType: "initiative",
      ownerName: def.owner ?? null,
      entity: null,
    });
  }

  // Meetings.
  for (const m of input.meetings) {
    const needsFollowUp = m.effectiveStatus === "needs_follow_up";
    push({
      id: `meeting:${m.id}`,
      type: "meeting",
      occurredAtISO: m.startISO,
      upcoming: new Date(m.startISO).getTime() > now.getTime(),
      title: m.title,
      severity: needsFollowUp ? "watch" : "neutral",
      sourceType: "meeting",
      ownerName: m.facilitator?.name ?? null,
      entity: entityFor(m.relatedEntityType, m.relatedEntityId, labels),
      meetingId: m.id,
    });
  }

  // Decisions.
  for (const d of input.decisions) {
    push({
      id: `decision:${d.id}`,
      type: "decision",
      occurredAtISO: d.createdAt.toISOString(),
      upcoming: false,
      title: d.decision,
      severity: "neutral",
      sourceType: "decision",
      ownerName: d.decidedByName,
      entity: entityFor(d.relatedEntityType, d.relatedEntityId, labels),
      meetingId: d.meetingId,
    });
  }

  // Actions — created, and (when done) completed.
  for (const a of input.actions) {
    const status = effectiveStatus(a, now);
    const entity = entityFor(a.relatedEntityType, a.relatedEntityId, labels);
    const owner = a.lead?.name ?? a.lead?.email ?? null;
    push({
      id: `action_created:${a.id}`,
      type: "action_created",
      occurredAtISO: a.createdAt.toISOString(),
      upcoming: false,
      title: a.title,
      severity: "neutral",
      sourceType: "action",
      ownerName: owner,
      entity,
      sourceId: a.id,
    });
    if (status === "COMPLETE") {
      push({
        id: `action_completed:${a.id}`,
        type: "action_completed",
        occurredAtISO: (a.completedAt ?? a.updatedAt).toISOString(),
        upcoming: false,
        title: a.title,
        severity: "positive",
        sourceType: "action",
        ownerName: owner,
        entity,
        sourceId: a.id,
      });
    }
  }

  // Milestones reached — dated by the last completion among the milestone's work.
  const actionById = new Map(input.actions.map((a) => [a.id, a]));
  for (const ms of input.milestones) {
    if (ms.status !== "complete") continue;
    let reachedAt: number | null = null;
    for (const id of ms.actionIds) {
      const a = actionById.get(id);
      if (!a) continue;
      const t = (a.completedAt ?? a.updatedAt).getTime();
      if (reachedAt == null || t > reachedAt) reachedAt = t;
    }
    if (reachedAt == null) continue;
    push({
      id: `milestone_reached:${def.id}:${ms.id}`,
      type: "milestone_reached",
      occurredAtISO: new Date(reachedAt).toISOString(),
      upcoming: false,
      title: ms.title,
      severity: "positive",
      sourceType: "milestone",
      ownerName: ms.ownerName,
      entity: null,
      milestoneId: ms.id,
    });
  }

  // Target-date markers (initiative + per-milestone) — real configured dates.
  if (def.targetDateISO) {
    const overdue = new Date(def.targetDateISO).getTime() < now.getTime();
    push({
      id: `target:${def.id}`,
      type: "target",
      occurredAtISO: def.targetDateISO,
      upcoming: !overdue,
      title: def.title,
      severity: overdue ? "watch" : "neutral",
      sourceType: "initiative",
      ownerName: def.owner ?? null,
      entity: null,
      overdue,
    });
  }
  for (const ms of input.milestones) {
    if (!ms.targetDateISO || ms.status === "complete") continue;
    const overdue = ms.behindSchedule;
    push({
      id: `target:${def.id}:${ms.id}`,
      type: "target",
      occurredAtISO: ms.targetDateISO,
      upcoming: !overdue,
      title: ms.title,
      severity: overdue ? "critical" : "neutral",
      sourceType: "milestone",
      ownerName: ms.ownerName,
      entity: null,
      milestoneId: ms.id,
      overdue,
    });
  }

  return events;
}

// --- assembly ----------------------------------------------------------------

export type StrategicTimeline = {
  /** Past + present events, newest first. */
  events: StrategicTimelineEvent[];
  /** Future target markers, soonest first. */
  upcoming: StrategicTimelineEvent[];
  /** The highest-importance past events (milestones, decisions, completions). */
  keyMoments: StrategicTimelineEvent[];
};

function sortNewestFirst(a: StrategicTimelineEvent, b: StrategicTimelineEvent): number {
  return (
    new Date(b.occurredAtISO).getTime() - new Date(a.occurredAtISO).getTime() ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Assemble an initiative's strategic timeline: extract every provable event,
 * split past from upcoming target markers, sort, and select the key moments.
 * Pure; ties break on the stable event id so the order is deterministic.
 */
export function deriveStrategicTimeline(
  input: DeriveTimelineInput & { limit?: number; keyMomentsLimit?: number }
): StrategicTimeline {
  const all = deriveTimelineEvents(input);
  const past = all.filter((e) => !e.upcoming).sort(sortNewestFirst);
  const upcoming = all
    .filter((e) => e.upcoming)
    .sort(
      (a, b) =>
        new Date(a.occurredAtISO).getTime() - new Date(b.occurredAtISO).getTime() ||
        a.id.localeCompare(b.id)
    );

  const keyMoments = [...past]
    .sort(
      (a, b) =>
        rankTimelineImportance(b) - rankTimelineImportance(a) ||
        sortNewestFirst(a, b)
    )
    .slice(0, input.keyMomentsLimit ?? 6);

  return {
    events: typeof input.limit === "number" ? past.slice(0, input.limit) : past,
    upcoming,
    keyMoments,
  };
}

/**
 * Merge per-initiative timelines into one ORG-WIDE strategic timeline (the
 * Command Center "what happened this week" read). Pure.
 */
export function mergeStrategicTimelines(
  timelines: StrategicTimelineEvent[][],
  limit?: number
): StrategicTimelineEvent[] {
  const merged = timelines.flat().sort(sortNewestFirst);
  return typeof limit === "number" ? merged.slice(0, limit) : merged;
}
