import type { QueueEngine } from "@/lib/queue/engine";
import { selectDecisionQueue } from "@/lib/queue/selectors";
import type { QueueItem } from "@/lib/queue/types";
import type {
  WorkHubDecisionWithoutAction,
  WorkHubInitiativeCard,
  WorkHubWeeklyReview,
} from "@/lib/work/work-hub";

import {
  buildRecentChanges,
} from "./today";
import {
  type CcChange,
  changeBucket,
  countWhere,
  formatShortDate,
  initialsFromName,
  joinClauses,
  type OperationalTone,
  pluralize,
} from "./shared";

/**
 * Review — the weekly operating review ritual (not a metrics dashboard). What
 * changed, what needs review, which initiatives need next steps, and the focus
 * for next week. Concrete operating states only — no vanity metrics, no vague
 * "health" scores.
 */

export type CcReviewRow = {
  id: string;
  label: string;
  count: number;
  example: string;
  tone: OperationalTone;
};

export type CcReviewSessionStep = {
  id: string;
  label: string;
  count: number;
  href: string;
  icon: string;
};

export type CcInitiativeRoom = {
  id: string;
  title: string;
  progressLabel: string;
  ownerName: string | null;
  ownerInitials: string | null;
  stageLabel: string;
  statusLabel: string;
  statusTone: OperationalTone;
  topBlocker: string | null;
  nextMove: string | null;
  actions: number;
  meetings: number;
  href: string;
};

export type ReviewWorkspaceVM = {
  weekLabel: string;
  weekRangeLabel: string;
  brief: string;
  summary: {
    actionsMoved: number;
    overdue: number;
    initiativesNeedNextSteps: number;
    unresolvedFollowUp: number;
    totalChanges: number;
  };
  whatChanged: CcReviewRow[];
  whatNeedsReview: CcReviewRow[];
  reviewSession: CcReviewSessionStep[];
  initiativeRooms: CcInitiativeRoom[];
  recentChanges: { today: CcChange[]; yesterday: CcChange[]; earlier: CcChange[] };
  focusNextWeek: string[];
  startSessionHref: string;
};

// Operational status from the initiative read — deliberately never says "health".
const STATUS_FROM_TONE: Record<
  WorkHubInitiativeCard["healthTone"],
  { label: string; tone: OperationalTone }
> = {
  danger: { label: "Blocked", tone: "danger" },
  warning: { label: "At risk", tone: "warning" },
  info: { label: "Needs next steps", tone: "info" },
  success: { label: "On track", tone: "success" },
  neutral: { label: "Steady", tone: "neutral" },
};

function weekBounds(now: Date): { start: Date; end: Date } {
  const day = now.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = (day + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start, end };
}

function initiativeNeedsNextSteps(card: WorkHubInitiativeCard): boolean {
  return (
    !card.nextStep ||
    !card.owner ||
    card.pastTargetDate ||
    card.healthTone === "warning" ||
    card.healthTone === "danger" ||
    card.healthTone === "info"
  );
}

function buildInitiativeRooms(
  initiatives: WorkHubInitiativeCard[],
  engine: QueueEngine
): CcInitiativeRoom[] {
  const meetingsByInitiative = new Map<string, number>();
  for (const item of engine.items) {
    const initiativeId = item.relatedInitiative?.id;
    if (!initiativeId) continue;
    if (item.type !== "meeting" && item.type !== "meeting_prep") continue;
    meetingsByInitiative.set(initiativeId, (meetingsByInitiative.get(initiativeId) ?? 0) + 1);
  }

  return initiatives.slice(0, 5).map((card) => {
    const status = STATUS_FROM_TONE[card.healthTone];
    return {
      id: card.id,
      title: card.title,
      progressLabel: card.progressLabel,
      ownerName: card.owner,
      ownerInitials: card.owner ? initialsFromName(card.owner) : null,
      stageLabel: card.statusLabel,
      statusLabel: status.label,
      statusTone: status.tone,
      topBlocker: card.healthReasons[0] ?? (card.owner ? null : "No accountable owner"),
      nextMove: card.nextStep ?? (card.owner ? null : "Assign an accountable owner"),
      actions: card.openActions,
      meetings: meetingsByInitiative.get(card.id) ?? 0,
      href: card.href,
    };
  });
}

function buildFocusNextWeek(engine: QueueEngine, initiatives: WorkHubInitiativeCard[]): string[] {
  const focus: string[] = [];
  const unownedInitiative = initiatives.find((card) => !card.owner);
  if (unownedInitiative) focus.push(`Assign an accountable owner for ${unownedInitiative.title}`);

  if (engine.summary.overdue > 0) focus.push(`Complete ${pluralize(engine.summary.overdue, "overdue action")}`);

  const topDecision = selectDecisionQueue(engine.items)[0];
  if (topDecision) focus.push(`Finalize ${topDecision.title}`);

  const initiativeNextStep = initiatives.find((card) => card.nextStep);
  if (initiativeNextStep?.nextStep) focus.push(initiativeNextStep.nextStep);

  return focus.slice(0, 4);
}

export function buildReviewWorkspace(input: {
  engine: QueueEngine;
  weeklyReview: WorkHubWeeklyReview;
  initiatives: WorkHubInitiativeCard[];
  decisionsWithoutActions: WorkHubDecisionWithoutAction[];
  upcomingMeetings: number;
  now: Date;
}): ReviewWorkspaceVM {
  const { engine, weeklyReview, initiatives, decisionsWithoutActions, upcomingMeetings, now } = input;
  const items = engine.items;

  const { start, end } = weekBounds(now);
  const weekRangeLabel = `${formatShortDate(start.toISOString())} – ${formatShortDate(end.toISOString())}`;

  const followUpCount = countWhere(
    items,
    (i) => i.type === "follow_up" || i.type === "partner_follow_up"
  );
  const initiativesNeedNextSteps = initiatives.filter(initiativeNeedsNextSteps).length;
  const decisionsNotFinalized = selectDecisionQueue(items).length + decisionsWithoutActions.length;
  const applicantsWaiting = countWhere(
    items,
    (i) => i.type === "application" && (i.signals.stale || i.signals.waitingOn)
  );
  const classesNotReady = countWhere(items, (i) => i.type === "class_setup");
  const staleInitiatives = initiatives.filter(
    (card) => card.healthTone === "warning" || card.healthTone === "danger" || card.pastTargetDate
  ).length;

  const changedRows: CcReviewRow[] = [
    { id: "completed", label: "Completed actions", count: weeklyReview.completedThisWeek, example: "closed this week", tone: "success" },
    { id: "created", label: "New actions", count: weeklyReview.createdThisWeek, example: "opened this week", tone: "brand" },
    { id: "from-meetings", label: "Meeting follow-ups created", count: weeklyReview.fromMeetingsThisWeek, example: "from this week's meetings", tone: "info" },
    { id: "blockers", label: "New blockers", count: engine.summary.blocked, example: "blocked work", tone: "danger" },
    { id: "unowned", label: "Work without an owner", count: engine.summary.unowned, example: "needs an owner", tone: "warning" },
  ];
  const whatChanged = changedRows.filter((row) => row.count > 0);

  const reviewRows: CcReviewRow[] = [
    { id: "stale-initiatives", label: "Initiatives need next steps", count: initiativesNeedNextSteps, example: "no clear next move", tone: "info" },
    { id: "overdue", label: "Overdue actions", count: engine.summary.overdue, example: "past due date", tone: "danger" },
    { id: "decisions", label: "Decisions not finalized", count: decisionsNotFinalized, example: "awaiting a leadership call", tone: "brand" },
    { id: "meeting-followups", label: "Meetings with unresolved follow-ups", count: followUpCount, example: "follow-ups still open", tone: "warning" },
    { id: "applicants", label: "Applicants waiting too long", count: applicantsWaiting, example: "no recent update", tone: "warning" },
    { id: "classes", label: "Classes not ready", count: classesNotReady, example: "missing requirements", tone: "info" },
  ];
  const whatNeedsReview = reviewRows.filter((row) => row.count > 0);

  const totalChanges = whatChanged.reduce((sum, row) => sum + row.count, 0);

  const brief = `This week: ${joinClauses([
    `${pluralize(weeklyReview.completedThisWeek, "action")} moved`,
    engine.summary.overdue > 0 ? `${engine.summary.overdue} ${engine.summary.overdue === 1 ? "is" : "are"} overdue` : null,
    initiativesNeedNextSteps > 0 ? `${pluralize(initiativesNeedNextSteps, "initiative")} need next steps` : null,
    followUpCount > 0 ? `${pluralize(followUpCount, "meeting follow-up")} ${followUpCount === 1 ? "is" : "are"} unresolved` : null,
  ])}.`;

  const allChanges = buildRecentChanges(items, now, 12);

  return {
    weekLabel: "This Week",
    weekRangeLabel,
    brief,
    summary: {
      actionsMoved: weeklyReview.completedThisWeek,
      overdue: engine.summary.overdue,
      initiativesNeedNextSteps,
      unresolvedFollowUp: followUpCount,
      totalChanges,
    },
    whatChanged,
    whatNeedsReview,
    reviewSession: [
      { id: "overdue", label: "Review overdue work", count: engine.summary.overdue, href: "/work/queue?queue=weekly-review", icon: "clock" },
      { id: "owners", label: "Assign owners", count: engine.summary.unowned, href: "/delegate", icon: "handoff" },
      { id: "meetings", label: "Prep meetings", count: upcomingMeetings, href: "/meet", icon: "calendar" },
      { id: "decisions", label: "Resolve decisions", count: selectDecisionQueue(items).length, href: "/decide", icon: "scale" },
      { id: "defer", label: "Defer low-priority items", count: engine.summary.quickWins, href: "/work/queue?queue=quick-wins", icon: "check" },
    ],
    initiativeRooms: buildInitiativeRooms(initiatives, engine),
    recentChanges: {
      today: allChanges.filter((change) => changeBucket(change.whenISO, now) === "today"),
      yesterday: allChanges.filter((change) => changeBucket(change.whenISO, now) === "yesterday"),
      earlier: allChanges.filter((change) => changeBucket(change.whenISO, now) === "earlier"),
    },
    focusNextWeek: buildFocusNextWeek(engine, initiatives),
    startSessionHref: "/work/queue?queue=weekly-review",
  };
}
