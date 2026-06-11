import type { RelatedEntityType } from "@/lib/people-strategy/constants";
import type {
  ActionLite,
  DecisionLite,
  MeetingLite,
} from "@/lib/people-strategy/operational-digest";

/**
 * Data 360 — the unified timeline.
 *
 * One chronological story across every tracker: meetings that happened,
 * decisions that were made, actions that were created, and actions that were
 * completed. Consumes the digest's lite projections so the same loaded data
 * backs the Command Center, the Data 360 page, and every Entity 360 drawer.
 * Pure (callers inject `now`); unit-tested with plain fixtures.
 */

export const TIMELINE_EVENT_KINDS = [
  "meeting",
  "decision",
  "action_created",
  "action_completed",
  // Story events used by Entity 360 panels (joins, pairings, roles, notes).
  "joined",
  "mentorship",
  "class_assigned",
  "role",
  "note",
] as const;
export type TimelineEventKind = (typeof TIMELINE_EVENT_KINDS)[number];

export const TIMELINE_EVENT_LABELS: Record<TimelineEventKind, string> = {
  meeting: "Meeting",
  decision: "Decision",
  action_created: "Action created",
  action_completed: "Action completed",
  joined: "Joined",
  mentorship: "Mentorship",
  class_assigned: "Class",
  role: "Role",
  note: "Note",
};

/** The filter chips the timeline UI offers. */
export const TIMELINE_FILTERS = ["all", "meetings", "decisions", "actions"] as const;
export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export const TIMELINE_FILTER_LABELS: Record<TimelineFilter, string> = {
  all: "All",
  meetings: "Meetings",
  decisions: "Decisions",
  actions: "Actions",
};

const FILTER_KINDS: Record<TimelineFilter, readonly TimelineEventKind[]> = {
  all: TIMELINE_EVENT_KINDS,
  meetings: ["meeting"],
  decisions: ["decision"],
  actions: ["action_created", "action_completed"],
};

export type TimelineEvent = {
  /** Unique across kinds (`meeting:…`, `decision:…`, `action_created:…`). */
  id: string;
  kind: TimelineEventKind;
  occurredAtISO: string;
  title: string;
  /** One supporting line — who/where/why, never a wall of text. */
  detail: string | null;
  actorName: string | null;
  relatedType: RelatedEntityType | null;
  relatedId: string | null;
  relatedLabel: string | null;
  href: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of history the unified timeline covers by default. */
export const TIMELINE_DAYS_BACK = 30;

/**
 * Merge the loaded operating data into one newest-first event stream.
 * Meetings contribute when they have happened (upcoming meetings belong to
 * planning views, not history); actions contribute a creation event and — when
 * complete — a completion event.
 */
export function buildUnifiedTimeline(input: {
  actions: ActionLite[];
  meetings: MeetingLite[];
  decisions: DecisionLite[];
  now?: Date;
  daysBack?: number;
  limit?: number;
}): TimelineEvent[] {
  const now = input.now ?? new Date();
  const cutoff = now.getTime() - (input.daysBack ?? TIMELINE_DAYS_BACK) * DAY_MS;
  const events: TimelineEvent[] = [];

  const inWindow = (iso: string | null | undefined): iso is string => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= cutoff && t <= now.getTime();
  };

  for (const meeting of input.meetings) {
    if (!inWindow(meeting.startISO)) continue;
    if (meeting.effectiveStatus === "canceled" || meeting.effectiveStatus === "upcoming") {
      continue;
    }
    const parts: string[] = [meeting.categoryLabel];
    if (meeting.decisionCount > 0) {
      parts.push(`${meeting.decisionCount} decision${meeting.decisionCount === 1 ? "" : "s"}`);
    }
    if (meeting.linkedActionCount > 0) {
      parts.push(`${meeting.linkedActionCount} action${meeting.linkedActionCount === 1 ? "" : "s"} created`);
    }
    if (meeting.openFollowUps > 0) {
      parts.push(`${meeting.openFollowUps} open follow-up${meeting.openFollowUps === 1 ? "" : "s"}`);
    }
    events.push({
      id: `meeting:${meeting.id}`,
      kind: "meeting",
      occurredAtISO: meeting.startISO,
      title: meeting.title,
      detail: parts.join(" · "),
      actorName: meeting.facilitatorName,
      relatedType: meeting.relatedType,
      relatedId: meeting.relatedId,
      relatedLabel: meeting.relatedLabel,
      href: meeting.href,
    });
  }

  for (const decision of input.decisions) {
    if (!inWindow(decision.createdISO)) continue;
    events.push({
      id: `decision:${decision.id}`,
      kind: "decision",
      occurredAtISO: decision.createdISO,
      title: decision.decision,
      detail: decision.hasLinkedAction
        ? `${decision.meetingTitle} · action assigned`
        : `${decision.meetingTitle} · no action yet`,
      actorName: decision.decidedByName,
      relatedType: decision.relatedType,
      relatedId: decision.relatedId,
      relatedLabel: null,
      href: decision.href,
    });
  }

  for (const action of input.actions) {
    if (inWindow(action.createdISO)) {
      events.push({
        id: `action_created:${action.id}`,
        kind: "action_created",
        occurredAtISO: action.createdISO as string,
        title: action.title,
        detail: action.contextSummary,
        actorName: action.ownerName,
        relatedType: action.relatedType,
        relatedId: action.relatedId,
        relatedLabel: action.relatedLabel,
        href: action.href,
      });
    }
    if (action.status === "COMPLETE" && inWindow(action.completedISO)) {
      events.push({
        id: `action_completed:${action.id}`,
        kind: "action_completed",
        occurredAtISO: action.completedISO as string,
        title: action.title,
        detail: action.relatedLabel
          ? `${action.relatedTypeLabel}: ${action.relatedLabel}`
          : null,
        actorName: action.ownerName,
        relatedType: action.relatedType,
        relatedId: action.relatedId,
        relatedLabel: action.relatedLabel,
        href: action.href,
      });
    }
  }

  events.sort(
    (a, b) =>
      new Date(b.occurredAtISO).getTime() - new Date(a.occurredAtISO).getTime() ||
      a.id.localeCompare(b.id)
  );
  return typeof input.limit === "number" ? events.slice(0, input.limit) : events;
}

/** Apply a filter chip to an already-built timeline. */
export function filterTimeline(
  events: TimelineEvent[],
  filter: TimelineFilter
): TimelineEvent[] {
  if (filter === "all") return events;
  const kinds = new Set<TimelineEventKind>(FILTER_KINDS[filter]);
  return events.filter((e) => kinds.has(e.kind));
}

export type TimelineDay = {
  /** Calendar day key (`YYYY-MM-DD`, local time). */
  dayISO: string;
  /** Human label ("Jun 11"). */
  dayLabel: string;
  events: TimelineEvent[];
};

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Group a (newest-first) timeline by calendar day for the rail rendering —
 * one dated header per day, events in their original order beneath it.
 */
export function groupTimelineByDay(events: TimelineEvent[]): TimelineDay[] {
  const days: TimelineDay[] = [];
  let current: TimelineDay | null = null;
  for (const event of events) {
    const key = localDayKey(event.occurredAtISO);
    if (!current || current.dayISO !== key) {
      current = {
        dayISO: key,
        dayLabel: new Date(event.occurredAtISO).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        events: [],
      };
      days.push(current);
    }
    current.events.push(event);
  }
  return days;
}
