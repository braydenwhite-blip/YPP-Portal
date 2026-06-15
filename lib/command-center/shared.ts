import type { OwnerLane, QueueItem, QueueTone } from "@/lib/queue/types";

/**
 * Command Center OS — shared, deterministic helpers for the operating surfaces
 * (Today, Decide, Meet, Review, Follow Up, Delegate).
 *
 * Everything here is pure: it reads already-loaded Queue Engine output and
 * loader DTOs and projects calm, glanceable view-models. No DB, no clock except
 * the injected `now`, no randomness — so the same inputs always produce the same
 * surface and the adapters are unit-testable with the queue fixtures. Operating
 * language only (overdue / waiting on / no owner / needs decision / …); never
 * vague "health" or invented AI phrasing.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A serializable meeting card the operating surfaces render (no Prisma types). */
export type CcMeeting = {
  id: string;
  title: string;
  purpose: string | null;
  location: string | null;
  categoryLabel: string;
  startISO: string;
  endISO: string | null;
  timeLabel: string;
  status: CcMeetingStatus;
  statusLabel: string;
  live: boolean;
  attendees: Array<{ id: string; name: string; initials: string }>;
  attendeeCount: number;
  agendaCount: number;
  agendaDoneCount: number;
  decisionCount: number;
  openFollowUps: number;
  overdueFollowUps: number;
  openActions: number;
  href: string;
};

export type CcMeetingStatus =
  | "in_progress"
  | "today"
  | "upcoming"
  | "needs_follow_up"
  | "completed"
  | "canceled";

/** A serializable "recently decided" row (real MeetingDecision data). */
export type CcDecisionLogEntry = {
  id: string;
  decision: string;
  meetingTitle: string;
  meetingHref: string;
  decidedByName: string | null;
  decidedByInitials: string | null;
  whenISO: string;
  whenLabel: string;
};

export type OperationalTone = QueueTone;

export type OperationalState = { label: string; tone: OperationalTone };

/** A single entry in a recent-changes / activity timeline (deterministic). */
export type CcChange = {
  id: string;
  title: string;
  /** Secondary line ("By Mia Ward", "Leadership Sync", …). */
  detail: string | null;
  whenISO: string;
  whenLabel: string;
  tone: OperationalTone;
  /** A CcIconName the timeline renders. */
  icon: string;
  href: string | null;
};

// --- people ----------------------------------------------------------------

export function initialsFromName(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// --- greeting + dates ------------------------------------------------------

export function greetingForHour(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatLongDate(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
}

export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole-day difference (due − now), ignoring time of day. */
export function dayDelta(iso: string, now: Date): number {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
}

/** Concrete, calm due label. Operating language only. */
export function dueLabel(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const diff = dayDelta(iso, now);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff === -1) return "1 day overdue";
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff <= 7) return `Due in ${diff} days`;
  return `Due ${formatShortDate(iso)}`;
}

/** Relative "when" for change/decision logs ("2h ago", "Yesterday", "May 24"). */
export function whenLabel(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const diffMs = now.getTime() - then.getTime();
  const diffDays = dayDelta(iso, now);
  if (diffMs < 0) return formatShortDate(iso) ?? "";
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.round(diffMs / (60 * 1000)));
    return `${mins}m ago`;
  }
  if (diffDays === 0) {
    const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    return `${hours}h ago`;
  }
  if (diffDays === -1) return "Yesterday";
  if (diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  return formatShortDate(iso) ?? "";
}

/** today | yesterday | earlier — for grouping a recent-changes timeline. */
export function changeBucket(iso: string, now: Date): "today" | "yesterday" | "earlier" {
  const diff = dayDelta(iso, now);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  return "earlier";
}

// --- operating state -------------------------------------------------------

/**
 * The single concrete operating state for a loop, worst-first. Drives the badge
 * on every list row. Deliberately never says "health" — only what is wrong.
 */
export function operationalState(item: QueueItem): OperationalState {
  const s = item.signals;
  if (s.overdue) return { label: item.ageLabel ?? "Overdue", tone: "danger" };
  if (s.blocking) return { label: "Blocked", tone: "warning" };
  if (s.missingOwner) return { label: "No owner", tone: "warning" };
  if (s.needsDecision) return { label: "Needs decision", tone: "brand" };
  if (s.waitingOn) return { label: "Waiting on", tone: "info" };
  if (s.missingNextStep) return { label: "No next step", tone: "warning" };
  if (s.stale) return { label: "No update", tone: "neutral" };
  return { label: item.statusLabel, tone: item.tone };
}

/** A loop that needs to be talked through (routes into a meeting agenda). */
export function needsMeeting(item: QueueItem): boolean {
  return item.resolutions.includes("discuss");
}

/** A loop that needs a leadership call. */
export function needsDecision(item: QueueItem): boolean {
  return item.signals.needsDecision || item.type === "decision";
}

/** A loop parked on another person. */
export function isWaiting(item: QueueItem): boolean {
  return item.signals.waitingOn;
}

/** A loop nobody is accountable for. */
export function isUnowned(item: QueueItem): boolean {
  return item.signals.missingOwner;
}

export function isOverdue(item: QueueItem): boolean {
  return item.signals.overdue;
}

/** Recently created or updated and still open — feeds the change timelines. */
export function recentlyTouchedISO(item: QueueItem): string | null {
  return item.updatedISO ?? item.createdISO ?? null;
}

// --- owner lanes -----------------------------------------------------------

/**
 * Operational owner status — never evaluative. "Overdue (n)" if anything is
 * past due, "At capacity" once the open load is heavy, otherwise "On track".
 */
export const OWNER_AT_CAPACITY = 6;

export function ownerStatus(lane: OwnerLane): OperationalState {
  if (lane.unowned) return { label: "Unassigned", tone: "warning" };
  if (lane.overdue > 0) return { label: `Overdue (${lane.overdue})`, tone: "danger" };
  if (lane.open >= OWNER_AT_CAPACITY) return { label: "At capacity", tone: "warning" };
  return { label: "On track", tone: "success" };
}

/** Count of loops this owner is the one being waited on for. */
export function waitingOnOwnerCount(lane: OwnerLane): number {
  return lane.items.filter((item) => item.signals.waitingOn).length;
}

/** The soonest upcoming due date in a lane, as a calm label. */
export function nextFollowUpLabel(lane: OwnerLane, now: Date): string | null {
  const dated = lane.items
    .map((item) => item.dueISO)
    .filter((iso): iso is string => Boolean(iso))
    .map((iso) => new Date(iso).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);
  if (dated.length === 0) return null;
  return dueLabel(new Date(dated[0]!).toISOString(), now);
}

// --- text builders ---------------------------------------------------------

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

/** Joins clause fragments into one calm sentence ("A, B, and C"). */
export function joinClauses(clauses: Array<string | null | undefined>): string {
  const parts = clauses.filter((clause): clause is string => Boolean(clause && clause.trim()));
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Capitalize the first letter of an assembled sentence. */
export function sentence(text: string): string {
  if (!text) return text;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

// --- counts ----------------------------------------------------------------

export function countWhere(items: QueueItem[], predicate: (item: QueueItem) => boolean): number {
  let count = 0;
  for (const item of items) if (predicate(item)) count += 1;
  return count;
}

/** Distinct people we are waiting on (by name), for the briefs. */
export function distinctWaitingPeople(items: QueueItem[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    if (!item.signals.waitingOn) continue;
    const name = item.relatedPerson?.label ?? item.ownerName;
    if (name) names.add(name);
  }
  return [...names];
}
