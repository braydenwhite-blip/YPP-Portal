import type { ActionItemWithRelations } from "./action-queries";
import type { RelatedEntitySummary } from "./connections";
import { isRelatedEntityType, relatedEntityTypeLabel } from "./constants";
import type { MeetingCardDTO } from "./meetings-queries";
import type { DigestDecisionInput } from "./operational-digest";
import type { InitiativeMilestoneSummary } from "./strategic-milestones";

/**
 * YPP Execution OS — TOUCHPOINT TIMELINE ENGINE (Strategic Initiatives 3.0, Phase E).
 *
 * One PURE engine that normalizes every kind of operational event — meetings,
 * actions (created / completed / due), decisions, milestone targets, meeting
 * follow-ups, and partner touchpoints — into a single {@link TouchpointEvent}
 * shape, then groups them into the buckets leadership reads: overdue/blocked,
 * upcoming, current, recent, and past. "Touchpoint" is YPP's product language
 * for a logged operational moment (the Partner pipeline already uses it); this is
 * the strategy-aware superset, carrying the related initiative / project /
 * workstream / entity so the same event reads correctly on a project page, an
 * initiative page, the command center, or an entity page.
 *
 * No DB, no React, no AI. Every event is explainable (a `summary`), honestly
 * dated, and links to its real source. Future events are flagged `upcoming` so the
 * UI can dim them; past-due targets/follow-ups are flagged `overdue` and never
 * mis-read as healthy history.
 */

// --- vocabulary --------------------------------------------------------------

export type TouchpointSourceType =
  | "meeting"
  | "action"
  | "decision"
  | "milestone"
  | "follow_up"
  | "partner";

export type TouchpointEventType =
  | "meeting"
  | "action_created"
  | "action_completed"
  | "action_due"
  | "decision"
  | "milestone_target"
  | "follow_up"
  | "partner_touchpoint";

export type TouchpointImportance = "critical" | "high" | "normal" | "low";

/** Whether the touchpoint carries an open loop, and where that loop stands. */
export type TouchpointFollowUpStatus = "none" | "pending" | "overdue" | "done";

/** The bucket a touchpoint falls into relative to `now`. */
export type TouchpointGroup = "overdue" | "upcoming" | "current" | "recent" | "past";

export const TOUCHPOINT_GROUP_META: Record<
  TouchpointGroup,
  { label: string; tone: "overdue" | "purple" | "info" | "neutral"; order: number }
> = {
  overdue: { label: "Overdue / blocked", tone: "overdue", order: 0 },
  upcoming: { label: "Upcoming", tone: "purple", order: 1 },
  current: { label: "Current", tone: "info", order: 2 },
  recent: { label: "Recent", tone: "info", order: 3 },
  past: { label: "Past", tone: "neutral", order: 4 },
};

export type TouchpointEntityRef = {
  type: string;
  id: string;
  label: string;
  href: string | null;
};

export type TouchpointEvent = {
  /** Stable, source-unique id (e.g. `action_completed:abc`). */
  id: string;
  dateISO: string;
  eventType: TouchpointEventType;
  sourceType: TouchpointSourceType;
  title: string;
  /** The one-line "why it matters" — always present, always explainable. */
  summary: string;
  importance: TouchpointImportance;
  /** True when the event is in the future (a due date / target). */
  upcoming: boolean;
  /** True when a past-due target / follow-up has NOT been met. */
  overdue: boolean;
  /** True when an open loop has gone quiet past the staleness window. */
  stale: boolean;
  followUpStatus: TouchpointFollowUpStatus;
  group: TouchpointGroup;
  initiativeId: string | null;
  initiativeTitle: string | null;
  projectId: string | null;
  projectTitle: string | null;
  workstreamId: string | null;
  workstreamTitle: string | null;
  entity: TouchpointEntityRef | null;
  /** Person most associated with the event (owner / facilitator / decider), when known. */
  personName: string | null;
  sourceHref: string;
};

// --- tunable windows ---------------------------------------------------------

export const TOUCHPOINT_CURRENT_DAYS = 3;
export const TOUCHPOINT_RECENT_DAYS = 14;
export const TOUCHPOINT_STALE_DAYS = 21;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

const IMPORTANCE_RANK: Record<TouchpointImportance, number> = {
  critical: 3,
  high: 2,
  normal: 1,
  low: 0,
};

export function touchpointImportanceRank(importance: TouchpointImportance): number {
  return IMPORTANCE_RANK[importance];
}

// --- context + adapter inputs ------------------------------------------------

export type TouchpointContext = {
  initiativeId?: string | null;
  initiativeTitle?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  /** Where milestone / strategy events should link (project page wins over initiative). */
  strategyHref?: string | null;
  /** refKey ("TYPE:id") → entity summary, to resolve a work item's related entity. */
  entityLabels?: ReadonlyMap<string, RelatedEntitySummary>;
};

export type TouchpointFollowUpInput = {
  id: string;
  title: string;
  meetingId: string;
  meetingTitle: string;
  dueISO: string | null;
  ownerName?: string | null;
  done?: boolean;
};

export type PartnerTouchpointInput = {
  id: string;
  kind: string;
  kindLabel?: string;
  body: string;
  createdISO: string;
  partnerId: string;
  partnerName: string;
  authorName?: string | null;
};

export type DeriveTouchpointsInput = {
  context?: TouchpointContext;
  actions?: ActionItemWithRelations[];
  meetings?: MeetingCardDTO[];
  decisions?: DigestDecisionInput[];
  milestones?: InitiativeMilestoneSummary[];
  followUps?: TouchpointFollowUpInput[];
  partnerTouchpoints?: PartnerTouchpointInput[];
  now?: Date;
};

// --- entity resolution -------------------------------------------------------

function resolveEntity(
  type: string | null,
  id: string | null,
  labels: ReadonlyMap<string, RelatedEntitySummary> | undefined
): TouchpointEntityRef | null {
  if (!type || !id || !isRelatedEntityType(type)) return null;
  const summary = labels?.get(`${type}:${id}`);
  if (summary) {
    return { type, id, label: summary.label, href: summary.href };
  }
  return { type, id, label: relatedEntityTypeLabel(type), href: null };
}

function ctxFields(ctx: TouchpointContext | undefined) {
  return {
    initiativeId: ctx?.initiativeId ?? null,
    initiativeTitle: ctx?.initiativeTitle ?? null,
    projectId: ctx?.projectId ?? null,
    projectTitle: ctx?.projectTitle ?? null,
  };
}

// --- per-source normalizers --------------------------------------------------

function isSettled(status: string): boolean {
  return status === "COMPLETE" || status === "DROPPED";
}

/**
 * Build the touchpoints a single action contributes: always a "created" event,
 * a "completed" event when it is done, and an open "due" marker when it has a
 * deadline and is still open (which becomes upcoming or overdue relative to now).
 */
export function actionTouchpoints(
  action: ActionItemWithRelations,
  ctx: TouchpointContext | undefined,
  now: Date
): TouchpointEvent[] {
  const c = ctxFields(ctx);
  const entity = resolveEntity(action.relatedEntityType, action.relatedEntityId, ctx?.entityLabels);
  const owner = action.lead?.name ?? null;
  const out: TouchpointEvent[] = [];

  const createdISO = (action.createdAt ?? now).toISOString();
  out.push(
    placeEvent(
      {
        id: `action_created:${action.id}`,
        dateISO: createdISO,
        eventType: "action_created",
        sourceType: "action",
        title: action.title,
        summary: owner ? `Action created · owned by ${owner}` : "Action created · no owner yet",
        importance: owner ? "low" : "normal",
        upcoming: false,
        overdue: false,
        stale: false,
        followUpStatus: "none",
        ...c,
        workstreamId: null,
        workstreamTitle: null,
        entity,
        personName: owner,
        sourceHref: `/actions/${action.id}`,
      },
      now
    )
  );

  if (action.completedAt) {
    out.push(
      placeEvent(
        {
          id: `action_completed:${action.id}`,
          dateISO: action.completedAt.toISOString(),
          eventType: "action_completed",
          sourceType: "action",
          title: action.title,
          summary: owner ? `Completed by ${owner}` : "Action completed",
          importance: "normal",
          upcoming: false,
          overdue: false,
          stale: false,
          followUpStatus: "done",
          ...c,
          workstreamId: null,
          workstreamTitle: null,
          entity,
          personName: owner,
          sourceHref: `/actions/${action.id}`,
        },
        now
      )
    );
  } else if (action.deadlineStart && !isSettled(action.status)) {
    const due = action.deadlineStart;
    const overdue = due.getTime() < now.getTime();
    out.push(
      placeEvent(
        {
          id: `action_due:${action.id}`,
          dateISO: due.toISOString(),
          eventType: "action_due",
          sourceType: "action",
          title: action.title,
          summary: overdue
            ? `Overdue${owner ? ` · ${owner}` : " · no owner"}`
            : `Due${owner ? ` · ${owner}` : " · no owner"}`,
          importance: overdue ? "critical" : "high",
          upcoming: !overdue,
          overdue,
          stale: false,
          followUpStatus: overdue ? "overdue" : "pending",
          ...c,
          workstreamId: null,
          workstreamTitle: null,
          entity,
          personName: owner,
          sourceHref: `/actions/${action.id}`,
        },
        now
      )
    );
  }

  return out;
}

export function meetingTouchpoint(
  meeting: MeetingCardDTO,
  ctx: TouchpointContext | undefined,
  now: Date
): TouchpointEvent {
  const c = ctxFields(ctx);
  const entity = resolveEntity(meeting.relatedEntityType, meeting.relatedEntityId, ctx?.entityLabels);
  const start = new Date(meeting.startISO);
  const upcoming = start.getTime() > now.getTime();
  const followUpStatus: TouchpointFollowUpStatus =
    meeting.overdueFollowUps > 0 ? "overdue" : meeting.openFollowUps > 0 ? "pending" : "none";
  const producedNote =
    meeting.decisionCount > 0
      ? `${meeting.decisionCount} decision${meeting.decisionCount === 1 ? "" : "s"}`
      : meeting.linkedActionCount > 0
        ? `${meeting.linkedActionCount} action${meeting.linkedActionCount === 1 ? "" : "s"}`
        : "no follow-up yet";
  return placeEvent(
    {
      id: `meeting:${meeting.id}`,
      dateISO: meeting.startISO,
      eventType: "meeting",
      sourceType: "meeting",
      title: meeting.title,
      summary: upcoming ? "Upcoming meeting" : `Meeting · ${producedNote}`,
      importance: meeting.overdueFollowUps > 0 ? "high" : "normal",
      upcoming,
      overdue: false,
      stale: false,
      followUpStatus,
      ...c,
      workstreamId: null,
      workstreamTitle: null,
      entity,
      personName: meeting.facilitator?.name ?? null,
      sourceHref: `/meetings/${meeting.id}`,
    },
    now
  );
}

export function decisionTouchpoint(
  decision: DigestDecisionInput,
  ctx: TouchpointContext | undefined,
  now: Date
): TouchpointEvent {
  const c = ctxFields(ctx);
  const entity = resolveEntity(decision.relatedEntityType, decision.relatedEntityId, ctx?.entityLabels);
  return placeEvent(
    {
      id: `decision:${decision.id}`,
      dateISO: decision.createdAt.toISOString(),
      eventType: "decision",
      sourceType: "decision",
      title: decision.decision,
      summary: decision.hasLinkedAction
        ? `Decided in ${decision.meetingTitle} · has a linked action`
        : `Decided in ${decision.meetingTitle} · no action yet`,
      importance: decision.hasLinkedAction ? "normal" : "high",
      upcoming: false,
      overdue: false,
      stale: false,
      followUpStatus: decision.hasLinkedAction ? "done" : "pending",
      ...c,
      workstreamId: null,
      workstreamTitle: null,
      entity,
      personName: decision.decidedByName,
      sourceHref: `/meetings/${decision.meetingId}`,
    },
    now
  );
}

export function milestoneTouchpoint(
  milestone: InitiativeMilestoneSummary,
  ctx: TouchpointContext | undefined,
  now: Date
): TouchpointEvent | null {
  if (!milestone.targetDateISO) return null;
  const c = ctxFields(ctx);
  const target = new Date(milestone.targetDateISO);
  const upcoming = target.getTime() > now.getTime();
  const overdue = milestone.behindSchedule;
  return placeEvent(
    {
      id: `milestone_target:${milestone.id}`,
      dateISO: milestone.targetDateISO,
      eventType: "milestone_target",
      sourceType: "milestone",
      title: `${milestone.title} (target)`,
      summary: overdue
        ? `Milestone behind schedule · ${milestone.percent}% complete`
        : upcoming
          ? `Milestone target · ${milestone.percent}% complete`
          : `Milestone target reached · ${milestone.statusLabel}`,
      importance: overdue ? "critical" : "high",
      upcoming: upcoming && !overdue,
      overdue,
      stale: false,
      followUpStatus: milestone.status === "complete" ? "done" : "pending",
      ...c,
      workstreamId: null,
      workstreamTitle: null,
      entity: null,
      personName: milestone.ownerName,
      sourceHref: ctx?.strategyHref ?? "/operations/initiatives",
    },
    now
  );
}

export function followUpTouchpoint(
  fu: TouchpointFollowUpInput,
  ctx: TouchpointContext | undefined,
  now: Date
): TouchpointEvent {
  const c = ctxFields(ctx);
  const due = fu.dueISO ? new Date(fu.dueISO) : null;
  const overdue = !fu.done && !!due && due.getTime() < now.getTime();
  const upcoming = !fu.done && !!due && due.getTime() > now.getTime();
  return placeEvent(
    {
      id: `follow_up:${fu.id}`,
      dateISO: fu.dueISO ?? now.toISOString(),
      eventType: "follow_up",
      sourceType: "follow_up",
      title: fu.title,
      summary: fu.done
        ? `Follow-up closed · ${fu.meetingTitle}`
        : overdue
          ? `Overdue follow-up · ${fu.meetingTitle}`
          : `Open follow-up · ${fu.meetingTitle}`,
      importance: overdue ? "high" : "normal",
      upcoming,
      overdue,
      stale: false,
      followUpStatus: fu.done ? "done" : overdue ? "overdue" : "pending",
      ...c,
      workstreamId: null,
      workstreamTitle: null,
      entity: null,
      personName: fu.ownerName ?? null,
      sourceHref: `/meetings/${fu.meetingId}`,
    },
    now
  );
}

export function partnerTouchpoint(
  note: PartnerTouchpointInput,
  ctx: TouchpointContext | undefined,
  now: Date
): TouchpointEvent {
  const c = ctxFields(ctx);
  const kindLabel = note.kindLabel ?? note.kind;
  return placeEvent(
    {
      id: `partner_touchpoint:${note.id}`,
      dateISO: note.createdISO,
      eventType: "partner_touchpoint",
      sourceType: "partner",
      title: `${kindLabel}: ${note.partnerName}`,
      summary: note.body.length > 140 ? `${note.body.slice(0, 139)}…` : note.body,
      importance: note.kind === "CONCERN" ? "high" : note.kind === "WIN" ? "normal" : "low",
      upcoming: false,
      overdue: false,
      stale: false,
      followUpStatus: note.kind === "FOLLOW_UP" ? "pending" : "none",
      ...c,
      workstreamId: null,
      workstreamTitle: null,
      entity: {
        type: "PARTNER",
        id: note.partnerId,
        label: note.partnerName,
        href: `/admin/partners/${note.partnerId}`,
      },
      personName: note.authorName ?? null,
      sourceHref: `/admin/partners/${note.partnerId}`,
    },
    now
  );
}

// --- placement (group + staleness) -------------------------------------------

type RawEvent = Omit<TouchpointEvent, "group">;

/** Assign the timeline group + staleness given the event's date relative to now. */
function placeEvent(raw: RawEvent, now: Date): TouchpointEvent {
  const date = new Date(raw.dateISO);
  let group: TouchpointGroup;
  let stale = raw.stale;

  if (raw.overdue) {
    group = "overdue";
  } else if (raw.upcoming) {
    group = "upcoming";
  } else {
    const age = daysBetween(now, date);
    if (age <= TOUCHPOINT_CURRENT_DAYS) group = "current";
    else if (age <= TOUCHPOINT_RECENT_DAYS) group = "recent";
    else group = "past";
    // An open loop (pending follow-up) that has gone quiet past the window is stale.
    if (raw.followUpStatus === "pending" && age > TOUCHPOINT_STALE_DAYS) stale = true;
  }

  return { ...raw, group, stale };
}

// --- assembly ----------------------------------------------------------------

export type TouchpointTimeline = {
  overdue: TouchpointEvent[];
  upcoming: TouchpointEvent[];
  current: TouchpointEvent[];
  recent: TouchpointEvent[];
  past: TouchpointEvent[];
  /** Every event, most important / most recent first. */
  all: TouchpointEvent[];
  counts: {
    total: number;
    overdue: number;
    upcoming: number;
    openFollowUps: number;
    stale: number;
    completions: number;
    decisions: number;
    meetings: number;
  };
  isEmpty: boolean;
};

/** Normalize every supplied source into a flat, ungrouped touchpoint list. */
export function normalizeTouchpoints(input: DeriveTouchpointsInput): TouchpointEvent[] {
  const now = input.now ?? new Date();
  const ctx = input.context;
  const out: TouchpointEvent[] = [];

  for (const a of input.actions ?? []) out.push(...actionTouchpoints(a, ctx, now));
  for (const m of input.meetings ?? []) out.push(meetingTouchpoint(m, ctx, now));
  for (const d of input.decisions ?? []) out.push(decisionTouchpoint(d, ctx, now));
  for (const ms of input.milestones ?? []) {
    const ev = milestoneTouchpoint(ms, ctx, now);
    if (ev) out.push(ev);
  }
  for (const fu of input.followUps ?? []) out.push(followUpTouchpoint(fu, ctx, now));
  for (const p of input.partnerTouchpoints ?? []) out.push(partnerTouchpoint(p, ctx, now));

  return out;
}

/** Sort key: upcoming soonest-first; everything else newest-first, importance breaks ties. */
function compareForAll(a: TouchpointEvent, b: TouchpointEvent): number {
  // Overdue first, then upcoming, then past — by group order.
  const ga = TOUCHPOINT_GROUP_META[a.group].order;
  const gb = TOUCHPOINT_GROUP_META[b.group].order;
  if (ga !== gb) return ga - gb;
  const ta = new Date(a.dateISO).getTime();
  const tb = new Date(b.dateISO).getTime();
  // Upcoming: soonest first (ascending). Others: newest first (descending).
  const dir = a.group === "upcoming" ? ta - tb : tb - ta;
  if (dir !== 0) return dir;
  return touchpointImportanceRank(b.importance) - touchpointImportanceRank(a.importance);
}

/**
 * Group normalized touchpoints into the leadership buckets. Within each bucket,
 * upcoming sorts soonest-first and the rest newest-first. Deterministic + pure.
 */
export function groupTouchpoints(events: TouchpointEvent[]): TouchpointTimeline {
  const sorted = [...events].sort(compareForAll);
  const overdue = sorted.filter((e) => e.group === "overdue");
  const upcoming = sorted.filter((e) => e.group === "upcoming");
  const current = sorted.filter((e) => e.group === "current");
  const recent = sorted.filter((e) => e.group === "recent");
  const past = sorted.filter((e) => e.group === "past");

  return {
    overdue,
    upcoming,
    current,
    recent,
    past,
    all: sorted,
    counts: {
      total: sorted.length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      openFollowUps: sorted.filter((e) => e.followUpStatus === "pending" || e.followUpStatus === "overdue").length,
      stale: sorted.filter((e) => e.stale).length,
      completions: sorted.filter((e) => e.eventType === "action_completed").length,
      decisions: sorted.filter((e) => e.eventType === "decision").length,
      meetings: sorted.filter((e) => e.eventType === "meeting").length,
    },
    isEmpty: sorted.length === 0,
  };
}

/** Normalize + group in one call — the engine's main entry point. */
export function deriveTouchpointTimeline(input: DeriveTouchpointsInput): TouchpointTimeline {
  return groupTouchpoints(normalizeTouchpoints(input));
}
