import { GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE } from "./impact-meetings";
import type { EffectiveMeetingStatus } from "./meetings-status";

/**
 * People Strategy — Meetings home (canonical `/meetings`) selectors (PURE).
 *
 * `/meetings` is the single front door for the whole meetings experience. It does
 * NOT own a second data source — it reads the same canonical `OfficerMeeting`
 * records (via `meetings-queries`) the two type-specific hubs read, then groups
 * them into four plain-language sections and points every card at the ONE
 * canonical detail for its type. Keeping the grouping / routing / labels here
 * (pure, `now` injected) makes them unit-testable with light fixtures and keeps
 * the page a thin presentation layer.
 *
 * Every meeting type opens the same detail experience:
 *   • `/meetings/[id]` — prepare, run, and follow up in one place.
 */

/** True only for the Global Operations Impact Presentation — the one type that
 *  opens the dedicated Impact workspace. Every other type uses the officer
 *  meeting workspace, which renders all meeting types. */
export function isImpactMeetingType(type: string | null | undefined): boolean {
  return type === GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE;
}

/**
 * The ONE canonical detail route for every meeting. Meeting type still matters
 * inside the room (Impact Meetings show team updates and agenda generation),
 * but the URL never forks the workflow.
 */
export function meetingDetailHref(_type: string | null | undefined, id: string): string {
  return `/meetings/${id}`;
}

/**
 * Plain-English meeting status label — no internal jargon. These are the words a
 * leader reads on a card ("Today", "Needs follow-up"), kept in one place so the
 * home, the cards, and the tests can never drift.
 */
const STATUS_LABELS: Record<EffectiveMeetingStatus, string> = {
  in_progress: "In progress",
  today: "Today",
  upcoming: "Upcoming",
  completed: "Done",
  needs_follow_up: "Needs follow-up",
  canceled: "Canceled",
};

export function meetingStatusLabel(status: EffectiveMeetingStatus): string {
  return STATUS_LABELS[status] ?? "—";
}

/** The minimal card shape the home buckets read (a structural subset of
 *  `MeetingCardDTO`, so a real card passes straight in). */
export interface MeetingsHomeCard {
  id: string;
  effectiveStatus: EffectiveMeetingStatus;
  /** Number of agenda items — 0 means the meeting still needs prep. */
  agendaCount: number;
  startISO: string;
}

export interface MeetingsHomeBuckets<T extends MeetingsHomeCard> {
  /** Happening today or live right now. */
  today: T[];
  /** Upcoming (future) meetings with no agenda yet — prep them before they run. */
  needsPrep: T[];
  /** Upcoming (future) meetings that already have an agenda. */
  upcoming: T[];
  /** Finished meetings, most recent first. */
  recent: T[];
}

/**
 * Sort meetings into the four home sections (Today / Needs prep / Upcoming /
 * Recent). Every meeting lands in EXACTLY ONE bucket (deduped by id) so the same
 * meeting can never appear twice on the home. Priority order:
 *   today / live → needs-prep (future, no agenda) → upcoming (future, prepped)
 *   → recent (finished). Canceled meetings are intentionally left off the home
 *   (still reachable via search and the type hubs).
 */
export function bucketMeetings<T extends MeetingsHomeCard>(
  cards: T[],
  _now: Date = new Date()
): MeetingsHomeBuckets<T> {
  const seen = new Set<string>();
  const today: T[] = [];
  const needsPrep: T[] = [];
  const upcoming: T[] = [];
  const recent: T[] = [];

  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);

    const status = card.effectiveStatus;
    if (status === "today" || status === "in_progress") {
      today.push(card);
    } else if (status === "upcoming") {
      if (card.agendaCount === 0) needsPrep.push(card);
      else upcoming.push(card);
    } else if (status === "completed" || status === "needs_follow_up") {
      recent.push(card);
    }
  }

  today.sort((a, b) => a.startISO.localeCompare(b.startISO));
  needsPrep.sort((a, b) => a.startISO.localeCompare(b.startISO));
  upcoming.sort((a, b) => a.startISO.localeCompare(b.startISO));
  recent.sort((a, b) => b.startISO.localeCompare(a.startISO));

  return { today, needsPrep, upcoming, recent };
}
