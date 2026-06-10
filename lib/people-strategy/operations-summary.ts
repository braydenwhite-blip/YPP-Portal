import { addDays, formatMonthDay, startOfDay } from "@/lib/leadership-action-center/dates";

import type {
  ActionLite,
  MeetingLite,
  WeeklyOperationalDigest,
} from "./operational-digest";
import type { InitiativeSummary } from "./strategic-initiative-summary";
import {
  deriveCommunicationNeeded,
  deriveInitiativeAgendaItems,
  deriveMeetingLooseEnds,
  type CommunicationNeededItem,
  type InitiativeAttentionItem,
  type MeetingLooseEnd,
} from "./weekly-execution";

/**
 * YPP Operations Summary — the ONE shared brain behind every operations view.
 *
 * The Command Center, Weekly Execution OS, Initiatives dashboard, and recap
 * generator all need the same operational meaning: what needs attention, what
 * happens this week, what was recently decided, which meeting outputs are
 * loose ends, what communication is owed, and which initiatives are at risk.
 * This module derives that meaning ONCE — from the Weekly Operational Digest
 * plus the Strategic Initiative summaries — into one integrated shape every
 * surface renders with the shared OperationsItemCard.
 *
 * One brain. Many views. Pure derivations only: no DB, no React, no AI; the
 * same inputs always produce the same output, so the whole module unit-tests
 * with plain fixtures. It deliberately REUSES the Weekly Execution loose-end /
 * communication / initiative-attention derivations rather than recalculating
 * them, so "loose end" and "communication needed" mean exactly the same thing
 * on every page.
 */

export const OPERATIONS_ITEM_KINDS = [
  "action",
  "meeting",
  "decision",
  "loose_end",
  "communication",
  "initiative",
] as const;

export type OperationsItemKind = (typeof OPERATIONS_ITEM_KINDS)[number];

export type OperationsItemTone = "danger" | "warning" | "info" | "success" | "neutral";

/** Human labels for each kind — the shared vocabulary the UI teaches. */
export const OPERATIONS_KIND_LABELS: Record<OperationsItemKind, string> = {
  action: "Action",
  meeting: "Meeting",
  decision: "Decision",
  loose_end: "Loose end",
  communication: "Communication needed",
  initiative: "Initiative",
};

/**
 * The one card-shaped item every operations surface renders. Each field maps
 * to a row on the shared OperationsItemCard; nullable fields simply don't
 * render, so an action, a meeting, and an initiative all share one shape.
 */
export type OperationsItem = {
  /** Stable, list-unique id (e.g. `action:a1`, `loose-end:decision:d1`). */
  id: string;
  kind: OperationsItemKind;
  title: string;
  /** Why this item matters right now — the card's one-line justification. */
  why: string | null;
  owner: string | null;
  dueISO: string | null;
  /** Status / health label (e.g. "Overdue 3d", "Blocked", "At risk"). */
  status: string | null;
  tone: OperationsItemTone;
  /** Source meeting, when the item came out of one. */
  meetingTitle: string | null;
  /** Related strategic initiative, when the item ladders up to one. */
  initiativeTitle: string | null;
  /** Related YPP entity (class, instructor, partner, …), when linked. */
  relatedLabel: string | null;
  /** Suggested next step — what a leader should do about it. */
  nextStep: string | null;
  href: string;
};

export type OperationsTimelineItemKind =
  | "action_created"
  | "action_completed"
  | "meeting"
  | "decision"
  | "initiative";

export type OperationsTimelineItem = {
  id: string;
  kind: OperationsTimelineItemKind;
  title: string;
  occurredAtISO: string;
  detail: string | null;
  href: string | null;
};

export type OperationsSnapshot = {
  openActions: number;
  overdueActions: number;
  blockedActions: number;
  dueThisWeek: number;
  meetingsThisWeek: number;
  looseEnds: number;
  communicationsNeeded: number;
  initiativesAtRisk: number;
};

export type OperationsSummary = {
  snapshot: OperationsSnapshot;
  needsAttention: OperationsItem[];
  thisWeek: OperationsItem[];
  recentlyDecided: OperationsItem[];
  looseEnds: OperationsItem[];
  communicationsNeeded: OperationsItem[];
  initiativesNeedingAttention: OperationsItem[];
  recentTimeline: OperationsTimelineItem[];
};

// --- per-source mappers (exported so views can reuse the exact same read) ----

function shortDate(iso: string | null): string {
  return iso ? formatMonthDay(new Date(iso)) : "no due date";
}

function actionStatus(action: ActionLite): { status: string; tone: OperationsItemTone } {
  if (action.blocked) return { status: "Blocked", tone: "danger" };
  if (action.overdue) return { status: `Overdue ${action.daysOverdue}d`, tone: "danger" };
  if (action.unassigned) return { status: "No owner", tone: "warning" };
  if (action.status === "COMPLETE") return { status: "Completed", tone: "success" };
  return { status: `Due ${shortDate(action.dueISO)}`, tone: "info" };
}

export function actionToOperationsItem(
  action: ActionLite,
  options: { why?: string; nextStep?: string | null } = {}
): OperationsItem {
  const { status, tone } = actionStatus(action);
  return {
    id: `action:${action.id}`,
    kind: "action",
    title: action.title,
    why:
      options.why ??
      (action.blocked
        ? (action.nextStep ?? "Blocked and needs leadership support.")
        : action.overdue
          ? `Overdue since ${shortDate(action.dueISO)}.`
          : action.unassigned
            ? "No one owns this work yet."
            : (action.contextSummary ?? null)),
    owner: action.ownerName,
    dueISO: action.dueISO,
    status,
    tone,
    meetingTitle: action.sourceMeetingTitle,
    initiativeTitle: null,
    relatedLabel: action.relatedLabel,
    nextStep: options.nextStep === undefined ? action.nextStep : options.nextStep,
    href: action.href,
  };
}

/** "This meeting created 2 decisions, 3 actions, and 1 loose end." */
export function meetingOutputSentence(meeting: MeetingLite): string {
  const parts = [
    `${meeting.decisionCount} decision${meeting.decisionCount === 1 ? "" : "s"}`,
    `${meeting.linkedActionCount} action${meeting.linkedActionCount === 1 ? "" : "s"}`,
    `${meeting.openFollowUps} loose end${meeting.openFollowUps === 1 ? "" : "s"}`,
  ];
  return `This meeting created ${parts[0]}, ${parts[1]}, and ${parts[2]}.`;
}

export function meetingToOperationsItem(
  meeting: MeetingLite,
  options: { upcoming?: boolean } = {}
): OperationsItem {
  const upcoming = options.upcoming ?? meeting.effectiveStatus === "upcoming";
  return {
    id: `meeting:${meeting.id}`,
    kind: "meeting",
    title: meeting.title,
    why: upcoming
      ? `Upcoming ${meeting.categoryLabel.toLowerCase()} meeting — confirm the agenda before it starts.`
      : meetingOutputSentence(meeting),
    owner: meeting.facilitatorName,
    dueISO: meeting.startISO,
    status: upcoming ? `Meets ${shortDate(meeting.startISO)}` : meeting.outcome.headline,
    tone: upcoming ? "info" : meeting.openFollowUps > 0 ? "warning" : "success",
    meetingTitle: meeting.title,
    initiativeTitle: null,
    relatedLabel: meeting.relatedLabel,
    nextStep: upcoming
      ? "Make sure every output becomes a decision, action, or loose end."
      : (meeting.outcome.suggestedNextSteps[0] ?? null),
    href: meeting.href,
  };
}

const LOOSE_END_TONE: Record<MeetingLooseEnd["kind"], OperationsItemTone> = {
  decision: "warning",
  follow_up: "info",
  missing_owner: "danger",
  missing_due_date: "warning",
  communication: "warning",
};

const LOOSE_END_STATUS: Record<MeetingLooseEnd["kind"], string> = {
  decision: "Decision without action",
  follow_up: "Not yet an action",
  missing_owner: "No owner",
  missing_due_date: "No due date",
  communication: "Needs outreach",
};

export function looseEndToOperationsItem(looseEnd: MeetingLooseEnd): OperationsItem {
  return {
    id: `loose-end:${looseEnd.id}`,
    kind: "loose_end",
    title: looseEnd.title,
    why: looseEnd.why,
    owner: looseEnd.owner,
    dueISO: looseEnd.dueISO,
    status: LOOSE_END_STATUS[looseEnd.kind],
    tone: LOOSE_END_TONE[looseEnd.kind],
    meetingTitle: looseEnd.meetingTitle,
    initiativeTitle: null,
    relatedLabel: null,
    nextStep:
      looseEnd.kind === "decision"
        ? "Convert this decision into an action and assign an owner."
        : "Convert this into an action and assign an owner.",
    href: looseEnd.href,
  };
}

export function communicationToOperationsItem(item: CommunicationNeededItem): OperationsItem {
  return {
    id: `communication:${item.id}`,
    kind: "communication",
    title: `${item.contactLabel} — ${item.title}`,
    why: item.why,
    owner: item.owner,
    dueISO: null,
    status: item.audience,
    tone: "warning",
    meetingTitle: null,
    initiativeTitle: null,
    relatedLabel: item.contactLabel,
    nextStep: `Suggested message: ${item.suggestedMessage}`,
    href: item.href,
  };
}

export function initiativeAttentionToOperationsItem(item: InitiativeAttentionItem): OperationsItem {
  return {
    id: item.id.startsWith("initiative:") ? item.id : `initiative:${item.id}`,
    kind: "initiative",
    title: item.title,
    why: item.why,
    owner: item.owner,
    dueISO: null,
    status: item.status,
    tone: "warning",
    meetingTitle: null,
    initiativeTitle: item.title,
    relatedLabel: item.currentMilestone ? `Milestone: ${item.currentMilestone}` : null,
    nextStep: item.suggestedNextAction,
    href: item.href,
  };
}

// --- section derivations ------------------------------------------------------

const NEEDS_ATTENTION_LIMIT = 14;
const SECTION_LIMIT = 8;
const TIMELINE_LIMIT = 16;

function dedupe(items: OperationsItem[]): OperationsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * What needs leadership attention right now: overdue, blocked, and ownerless
 * actions first (worst first), then loose ends, at-risk initiatives, and
 * communications waiting to be sent.
 */
export function deriveNeedsAttention(input: {
  digest: WeeklyOperationalDigest;
  looseEnds: MeetingLooseEnd[];
  communications: CommunicationNeededItem[];
  initiativeAttention: InitiativeAttentionItem[];
}): OperationsItem[] {
  const actions = [
    ...[...input.digest.triage.overdue].sort((a, b) => b.daysOverdue - a.daysOverdue),
    ...input.digest.triage.blocked,
    ...input.digest.triage.unassigned,
  ].map((action) => actionToOperationsItem(action));
  return dedupe([
    ...actions,
    ...input.looseEnds.map(looseEndToOperationsItem),
    ...input.initiativeAttention.slice(0, 3).map(initiativeAttentionToOperationsItem),
    ...input.communications
      .filter((c) => c.source !== "recap")
      .slice(0, 3)
      .map(communicationToOperationsItem),
  ]).slice(0, NEEDS_ATTENTION_LIMIT);
}

/** Upcoming initiative milestones inside the operating window. */
export function deriveUpcomingMilestoneItems(
  initiatives: InitiativeSummary[] = [],
  now: Date = new Date(),
  daysAhead = 7
): OperationsItem[] {
  const start = startOfDay(now).getTime();
  const end = startOfDay(addDays(now, daysAhead)).getTime();
  const out: OperationsItem[] = [];
  for (const initiative of initiatives) {
    for (const milestone of initiative.milestones) {
      if (milestone.status === "complete" || !milestone.targetDateISO) continue;
      const target = startOfDay(new Date(milestone.targetDateISO)).getTime();
      if (target < start || target > end) continue;
      out.push({
        id: `milestone:${initiative.id}:${milestone.id}`,
        kind: "initiative",
        title: milestone.title,
        why: `Milestone for ${initiative.title} is due ${shortDate(milestone.targetDateISO)}.`,
        owner: milestone.ownerName ?? initiative.owner,
        dueISO: milestone.targetDateISO,
        status: milestone.statusLabel,
        tone: milestone.status === "at_risk" || milestone.behindSchedule ? "warning" : "info",
        meetingTitle: null,
        initiativeTitle: initiative.title,
        relatedLabel: null,
        nextStep: `Confirm what must happen this week to land ${milestone.title}.`,
        href: initiative.href,
      });
    }
  }
  return out.sort((a, b) => (a.dueISO ?? "").localeCompare(b.dueISO ?? ""));
}

/** What is on deck this week: due-soon actions, upcoming meetings, milestones. */
export function deriveThisWeek(input: {
  digest: WeeklyOperationalDigest;
  initiatives?: InitiativeSummary[];
  now?: Date;
}): OperationsItem[] {
  const now = input.now ?? new Date();
  return dedupe([
    ...input.digest.triage.dueSoon.map((action) =>
      actionToOperationsItem(action, { why: `Due this week (${shortDate(action.dueISO)}).` })
    ),
    ...input.digest.upcomingMeetings.map((meeting) =>
      meetingToOperationsItem(meeting, { upcoming: true })
    ),
    ...deriveUpcomingMilestoneItems(input.initiatives ?? [], now),
  ]).slice(0, SECTION_LIMIT + 4);
}

/**
 * What recently happened: completed actions, newly created actions, and recent
 * meetings with their outputs ("This meeting created 2 decisions…").
 */
export function deriveRecentlyDecided(digest: WeeklyOperationalDigest): OperationsItem[] {
  const completed = digest.recentlyCompletedActions.map((action) =>
    actionToOperationsItem(action, { why: "Completed this week.", nextStep: null })
  );
  const created = (digest.newActionsThisWeek ?? [])
    .filter((action) => action.status !== "COMPLETE")
    .map((action) =>
      actionToOperationsItem(action, { why: "New action created this week." })
    );
  const meetings = digest.recentMeetings
    .filter((m) => m.decisionCount > 0 || m.linkedActionCount > 0 || m.openFollowUps > 0)
    .map((meeting) => meetingToOperationsItem(meeting, { upcoming: false }));
  return dedupe([...completed, ...created, ...meetings]).slice(0, SECTION_LIMIT + 4);
}

/** Recent operational history, newest first, merged across every source. */
export function deriveOperationsTimeline(input: {
  digest: WeeklyOperationalDigest;
  initiatives?: InitiativeSummary[];
}): OperationsTimelineItem[] {
  const events: OperationsTimelineItem[] = [];

  for (const action of input.digest.newActionsThisWeek ?? []) {
    if (!action.createdISO) continue;
    events.push({
      id: `created:${action.id}`,
      kind: "action_created",
      title: action.title,
      occurredAtISO: action.createdISO,
      detail: action.ownerName ? `Created — ${action.ownerName}` : "Created",
      href: action.href,
    });
  }
  for (const action of input.digest.recentlyCompletedActions) {
    events.push({
      id: `completed:${action.id}`,
      kind: "action_completed",
      title: action.title,
      // Completion timestamps aren't carried on ActionLite; the due date is the
      // closest stable anchor for ordering completed work in the window.
      occurredAtISO: action.dueISO,
      detail: action.ownerName ? `Completed — ${action.ownerName}` : "Completed",
      href: action.href,
    });
  }
  for (const meeting of input.digest.recentMeetings) {
    events.push({
      id: `meeting:${meeting.id}`,
      kind: "meeting",
      title: meeting.title,
      occurredAtISO: meeting.startISO,
      detail: meetingOutputSentence(meeting),
      href: meeting.href,
    });
  }
  for (const decision of input.digest.decisionsNeedingAction) {
    events.push({
      id: `decision:${decision.id}`,
      kind: "decision",
      title: decision.decision,
      occurredAtISO: decision.createdISO,
      detail: `Decided in ${decision.meetingTitle}`,
      href: decision.href,
    });
  }
  for (const initiative of input.initiatives ?? []) {
    for (const event of initiative.timeline.events.slice(0, 2)) {
      if (event.upcoming) continue;
      events.push({
        id: `initiative-event:${initiative.id}:${event.id}`,
        kind: "initiative",
        title: event.title,
        occurredAtISO: event.occurredAtISO,
        detail: `${initiative.title} — ${event.explanation}`,
        href: initiative.href,
      });
    }
  }

  return events
    .sort((a, b) => b.occurredAtISO.localeCompare(a.occurredAtISO))
    .slice(0, TIMELINE_LIMIT);
}

// --- the one integrated summary ----------------------------------------------

export function deriveOperationsSummary(input: {
  digest: WeeklyOperationalDigest;
  initiatives?: InitiativeSummary[];
  now?: Date;
}): OperationsSummary {
  const now = input.now ?? new Date();
  const initiatives = input.initiatives ?? [];

  // One derivation per concept, shared with the Weekly Execution OS so the
  // words mean the same thing on every page.
  const looseEnds = deriveMeetingLooseEnds(input.digest);
  const communications = deriveCommunicationNeeded({ digest: input.digest, initiatives });
  const initiativeAttention = deriveInitiativeAgendaItems(initiatives, now);

  return {
    snapshot: {
      openActions: input.digest.counts.openActions,
      overdueActions: input.digest.counts.overdueActions,
      blockedActions: input.digest.counts.blockedActions,
      dueThisWeek: input.digest.counts.dueSoonActions,
      meetingsThisWeek: input.digest.counts.meetingsThisWeek,
      looseEnds: looseEnds.length,
      communicationsNeeded: communications.length,
      initiativesAtRisk: initiativeAttention.length,
    },
    needsAttention: deriveNeedsAttention({
      digest: input.digest,
      looseEnds,
      communications,
      initiativeAttention,
    }),
    thisWeek: deriveThisWeek({ digest: input.digest, initiatives, now }),
    recentlyDecided: deriveRecentlyDecided(input.digest),
    looseEnds: looseEnds.map(looseEndToOperationsItem),
    communicationsNeeded: communications.map(communicationToOperationsItem),
    initiativesNeedingAttention: initiativeAttention.map(initiativeAttentionToOperationsItem),
    recentTimeline: deriveOperationsTimeline({ digest: input.digest, initiatives }),
  };
}
