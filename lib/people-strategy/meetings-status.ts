import type { ActionPriority } from "@prisma/client";

import {
  endOfOperatingWeek,
  isSameDay,
  startOfDay,
  startOfOperatingWeek,
} from "@/lib/leadership-action-center/dates";

/**
 * People Strategy — Meetings Tracker status + metric computation.
 *
 * PURE functions of the data passed in (no `new Date()` except the explicit
 * `now` default, no I/O, no Prisma) so the whole module is unit-testable with
 * plain fixtures — mirroring `officer-meeting-generation.ts`. The page/query
 * layer maps the rich Prisma payloads into the light `MeetingView` /
 * `FollowUpView` shapes below, then everything else (effective statuses,
 * dashboard metrics, Department Pulse, weekly grouping) is computed from those.
 *
 * Effective statuses are COMPUTED, never stored — exactly like the Action
 * Tracker's computed OVERDUE. A meeting stores SCHEDULED / COMPLETED / CANCELLED;
 * "today", "in_progress", "upcoming", and "needs_follow_up" are derived from the
 * date, the optional end time, and whether open follow-ups remain.
 */

// --- stored vs effective vocabularies ---------------------------------------

export type StoredMeetingStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type EffectiveMeetingStatus =
  | "upcoming"
  | "today"
  | "in_progress"
  | "completed"
  | "needs_follow_up"
  | "canceled";

export type StoredFollowUpStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED";
export type EffectiveFollowUpStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "overdue";

// --- light, display-ready view shapes ---------------------------------------

export interface FollowUpView {
  id: string;
  status: StoredFollowUpStatus;
  dueDate: Date | null;
  area: string | null;
  priority: ActionPriority;
}

export interface MeetingView {
  id: string;
  storedStatus: StoredMeetingStatus;
  /** Meeting start datetime. */
  start: Date;
  /** Meeting end datetime, when known. */
  end: Date | null;
  category: string | null;
  followUps: FollowUpView[];
  decisionCount: number;
  agendaCount: number;
  /** Agenda items that are no longer OPEN (discussed / deferred / converted). */
  agendaDoneCount: number;
  /** Linked Action Items that are not COMPLETE. */
  openLinkedActionCount: number;
}

// --- follow-up status -------------------------------------------------------

/**
 * Effective follow-up status. A non-completed follow-up whose due date is in the
 * past is OVERDUE regardless of its stored OPEN / IN_PROGRESS value.
 */
export function computeFollowUpStatus(
  followUp: Pick<FollowUpView, "status" | "dueDate">,
  now: Date = new Date()
): EffectiveFollowUpStatus {
  if (followUp.status === "COMPLETED") return "completed";
  if (followUp.dueDate && startOfDay(followUp.dueDate) < startOfDay(now)) {
    return "overdue";
  }
  return followUp.status === "IN_PROGRESS" ? "in_progress" : "open";
}

/** A follow-up still needing work (anything not completed). */
export function isFollowUpOpen(
  followUp: Pick<FollowUpView, "status">
): boolean {
  return followUp.status !== "COMPLETED";
}

/** Count of overdue follow-ups on a meeting. */
export function overdueFollowUpCount(
  meeting: Pick<MeetingView, "followUps">,
  now: Date = new Date()
): number {
  return meeting.followUps.filter(
    (f) => computeFollowUpStatus(f, now) === "overdue"
  ).length;
}

/** Count of open (not completed) follow-ups on a meeting. */
export function openFollowUpCount(
  meeting: Pick<MeetingView, "followUps">
): number {
  return meeting.followUps.filter(isFollowUpOpen).length;
}

// --- meeting status ---------------------------------------------------------

/** Is `now` within the meeting's [start, end] window (in progress)? */
function isInProgress(meeting: Pick<MeetingView, "start" | "end">, now: Date): boolean {
  if (!isSameDay(meeting.start, now)) return false;
  if (now < meeting.start) return false;
  // No end time → treat as in progress for a default 90-minute window so a
  // running meeting without an explicit end still surfaces.
  const end = meeting.end ?? new Date(meeting.start.getTime() + 90 * 60_000);
  return now <= end;
}

/**
 * Effective meeting status. Stored CANCELLED → canceled. A COMPLETED meeting (or
 * a past SCHEDULED one) with open follow-ups is needs_follow_up; otherwise
 * completed. A SCHEDULED meeting is in_progress / today / upcoming based on the
 * clock.
 */
export function computeMeetingStatus(
  meeting: Pick<
    MeetingView,
    "storedStatus" | "start" | "end" | "followUps"
  >,
  now: Date = new Date()
): EffectiveMeetingStatus {
  if (meeting.storedStatus === "CANCELLED") return "canceled";

  const hasOpenFollowUps = meeting.followUps.some(isFollowUpOpen);

  if (meeting.storedStatus === "COMPLETED") {
    return hasOpenFollowUps ? "needs_follow_up" : "completed";
  }

  // SCHEDULED:
  if (isInProgress(meeting, now)) return "in_progress";

  const isPast = startOfDay(meeting.start) < startOfDay(now);
  if (isPast) {
    // A scheduled meeting whose date has passed but was never marked complete:
    // if it still has open follow-ups it needs attention, else treat as done.
    return hasOpenFollowUps ? "needs_follow_up" : "completed";
  }

  if (isSameDay(meeting.start, now)) return "today";
  return "upcoming";
}

/** True when a meeting wants leadership follow-up attention. */
export function meetingNeedsFollowUp(
  meeting: Pick<MeetingView, "storedStatus" | "start" | "end" | "followUps">,
  now: Date = new Date()
): boolean {
  return computeMeetingStatus(meeting, now) === "needs_follow_up";
}

// --- weekly grouping --------------------------------------------------------

export interface GroupedMeetings<T extends MeetingView> {
  today: T[];
  upcoming: T[];
  completed: T[];
  needsFollowUp: T[];
}

/**
 * Bucket a week's meetings into the dashboard's four sections by effective
 * status. A meeting appears in exactly one bucket (needs_follow_up wins over
 * completed). Order within a bucket is preserved from the input (callers sort
 * by date upstream).
 */
export function groupMeetingsForWeek<T extends MeetingView>(
  meetings: T[],
  now: Date = new Date()
): GroupedMeetings<T> {
  const out: GroupedMeetings<T> = {
    today: [],
    upcoming: [],
    completed: [],
    needsFollowUp: [],
  };
  for (const m of meetings) {
    const status = computeMeetingStatus(m, now);
    if (status === "needs_follow_up") out.needsFollowUp.push(m);
    else if (status === "completed" || status === "canceled") out.completed.push(m);
    else if (status === "today" || status === "in_progress") out.today.push(m);
    else out.upcoming.push(m);
  }
  return out;
}

// --- dashboard metrics ------------------------------------------------------

export interface DashboardMetrics {
  meetingsThisWeek: number;
  meetingsToday: number;
  needsFollowUp: number;
  openMeetingActions: number;
  overdueFollowUps: number;
  decisionsLogged: number;
}

/**
 * The six headline metric cards, computed over the supplied (already week-
 * scoped) meetings. `openMeetingActions` counts open follow-ups — the work a
 * meeting put on the team — so it lines up with the Needs-Follow-Up queue.
 */
export function computeDashboardMetrics(
  meetings: MeetingView[],
  now: Date = new Date()
): DashboardMetrics {
  let meetingsToday = 0;
  let needsFollowUp = 0;
  let openMeetingActions = 0;
  let overdueFollowUps = 0;
  let decisionsLogged = 0;

  for (const m of meetings) {
    const status = computeMeetingStatus(m, now);
    if (status === "today" || status === "in_progress") meetingsToday += 1;
    if (status === "needs_follow_up") needsFollowUp += 1;
    decisionsLogged += m.decisionCount;
    for (const f of m.followUps) {
      const fStatus = computeFollowUpStatus(f, now);
      if (fStatus !== "completed") openMeetingActions += 1;
      if (fStatus === "overdue") overdueFollowUps += 1;
    }
  }

  return {
    meetingsThisWeek: meetings.length,
    meetingsToday,
    needsFollowUp,
    openMeetingActions,
    overdueFollowUps,
    decisionsLogged,
  };
}

// --- department pulse -------------------------------------------------------

export interface DepartmentPulseRow {
  area: string;
  open: number;
  overdue: number;
}

/**
 * Aggregate open / overdue follow-ups by YPP area (the follow-up's `area`,
 * falling back to its meeting's category, then "OTHER"). Sorted by open desc,
 * then overdue desc — the most loaded area first — so leadership can see at a
 * glance which part of YPP is falling behind.
 */
export function computeDepartmentPulse(
  meetings: MeetingView[],
  now: Date = new Date()
): DepartmentPulseRow[] {
  const map = new Map<string, DepartmentPulseRow>();
  for (const m of meetings) {
    for (const f of m.followUps) {
      const status = computeFollowUpStatus(f, now);
      if (status === "completed") continue;
      const area = f.area ?? m.category ?? "OTHER";
      const row = map.get(area) ?? { area, open: 0, overdue: 0 };
      row.open += 1;
      if (status === "overdue") row.overdue += 1;
      map.set(area, row);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.open - a.open || b.overdue - a.overdue || a.area.localeCompare(b.area)
  );
}

// --- week range -------------------------------------------------------------

export interface WeekRange {
  start: Date;
  end: Date;
}

/**
 * The operating week (Mon–Sun) containing `now`, shifted by `offset` weeks.
 * offset 0 = this week, -1 = last week, +1 = next week. Reuses the shared
 * operating-week helpers so meetings and actions agree on week boundaries.
 */
export function weekRangeForOffset(offset: number, now: Date = new Date()): WeekRange {
  const base = new Date(now.getTime() + offset * 7 * 86_400_000);
  return { start: startOfOperatingWeek(base), end: endOfOperatingWeek(base) };
}
