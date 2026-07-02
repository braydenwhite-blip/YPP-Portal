import type { MeetingListItem } from "./meeting-types";

/**
 * Meetings hub — operational lanes (pure).
 *
 * The hub list answers "what meetings exist"; these lanes answer "which
 * meetings need follow-through". Every lane names a concrete, checkable gap
 * (no facilitator, open follow-ups, no recorded outcomes) — never a vague
 * score. Pure and deterministic (`now` injected), computed from the same
 * MeetingListItem projection the hub already loads, and unit-tested with
 * plain fixtures.
 */

export const MEETING_ATTENTION_LANES = [
  "needs_owner",
  "follow_ups_unresolved",
  "no_outcomes",
  "happening_soon",
] as const;
export type MeetingAttentionLane = (typeof MEETING_ATTENTION_LANES)[number];

export const MEETING_ATTENTION_LANE_LABELS: Record<MeetingAttentionLane, string> = {
  needs_owner: "Needs a facilitator",
  follow_ups_unresolved: "Follow-ups unresolved",
  no_outcomes: "Ended without outcomes",
  happening_soon: "Happening soon",
};

/** What each lane means — rendered as the lane hint so the strip teaches itself. */
export const MEETING_ATTENTION_LANE_HINTS: Record<MeetingAttentionLane, string> = {
  needs_owner: "Nobody owns running this meeting yet",
  follow_ups_unresolved: "The meeting produced follow-ups that are still open",
  no_outcomes: "Completed with no decisions or follow-ups recorded",
  happening_soon: "Within the next 3 days — prep the agenda and attendees",
};

export type MeetingAttentionItem = {
  id: string;
  title: string;
  scheduledISO: string;
  typeLabel: string;
  scopeLabel: string | null;
  /** The concrete finding ("3 open follow-ups", "No facilitator assigned"). */
  detail: string;
  href: string;
};

export type MeetingAttentionGroup = {
  lane: MeetingAttentionLane;
  label: string;
  hint: string;
  items: MeetingAttentionItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far ahead a scheduled meeting counts as "happening soon". */
export const HAPPENING_SOON_DAYS = 3;
/** How far back a no-outcome completion still warrants a nudge (older is noise). */
export const NO_OUTCOMES_LOOKBACK_DAYS = 14;

/** Max meetings shown per lane — the strip stays a nudge, not an inventory. */
const LANE_LIMIT = 5;

function item(m: MeetingListItem, detail: string): MeetingAttentionItem {
  return {
    id: m.id,
    title: m.title,
    scheduledISO: m.scheduledISO,
    typeLabel: m.typeLabel,
    scopeLabel: m.scopeLabel,
    detail,
    href: `/meetings/${m.id}`,
  };
}

/** Which single lane does this meeting belong to? First matching rule wins. */
export function laneForMeeting(
  m: MeetingListItem,
  now: Date
): { lane: MeetingAttentionLane; detail: string } | null {
  const scheduledMs = new Date(m.scheduledISO).getTime();
  const nowMs = now.getTime();

  if ((m.status === "SCHEDULED" || m.status === "IN_PROGRESS") && !m.facilitator) {
    return { lane: "needs_owner", detail: "No facilitator assigned" };
  }
  if (m.status === "COMPLETED" && m.counts.openFollowUps > 0) {
    return {
      lane: "follow_ups_unresolved",
      detail: `${m.counts.openFollowUps} open follow-up${m.counts.openFollowUps === 1 ? "" : "s"}`,
    };
  }
  if (
    m.status === "COMPLETED" &&
    m.counts.decisions === 0 &&
    m.counts.followUps === 0 &&
    scheduledMs >= nowMs - NO_OUTCOMES_LOOKBACK_DAYS * DAY_MS
  ) {
    return { lane: "no_outcomes", detail: "No decisions or follow-ups recorded" };
  }
  if (
    m.status === "SCHEDULED" &&
    scheduledMs >= nowMs &&
    scheduledMs <= nowMs + HAPPENING_SOON_DAYS * DAY_MS
  ) {
    const detail =
      m.counts.attendees === 0 ? "No attendees invited yet" : `${m.counts.attendees} invited`;
    return { lane: "happening_soon", detail };
  }
  return null;
}

/**
 * Group meetings into the attention lanes, worst-first (a meeting lands in at
 * most one lane). Lanes with no meetings are omitted, so a healthy hub shows
 * nothing at all. Within a lane, soonest/most recent first.
 */
export function deriveMeetingAttention(
  meetings: MeetingListItem[],
  now: Date
): MeetingAttentionGroup[] {
  const byLane = new Map<MeetingAttentionLane, MeetingAttentionItem[]>();
  for (const m of meetings) {
    if (m.status === "CANCELLED") continue;
    const hit = laneForMeeting(m, now);
    if (!hit) continue;
    const list = byLane.get(hit.lane) ?? [];
    list.push(item(m, hit.detail));
    byLane.set(hit.lane, list);
  }

  const groups: MeetingAttentionGroup[] = [];
  for (const lane of MEETING_ATTENTION_LANES) {
    const items = byLane.get(lane);
    if (!items || items.length === 0) continue;
    // Upcoming lanes: soonest first. Completed lanes: most recent first.
    const dir = lane === "happening_soon" || lane === "needs_owner" ? 1 : -1;
    items.sort((a, b) => a.scheduledISO.localeCompare(b.scheduledISO) * dir);
    groups.push({
      lane,
      label: MEETING_ATTENTION_LANE_LABELS[lane],
      hint: MEETING_ATTENTION_LANE_HINTS[lane],
      items: items.slice(0, LANE_LIMIT),
    });
  }
  return groups;
}
