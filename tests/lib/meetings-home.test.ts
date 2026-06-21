import { describe, expect, it } from "vitest";

import { GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE } from "@/lib/people-strategy/impact-meetings";
import {
  bucketMeetings,
  isImpactMeetingType,
  meetingDetailHref,
  meetingStatusLabel,
  type MeetingsHomeCard,
} from "@/lib/people-strategy/meetings-home";
import type { EffectiveMeetingStatus } from "@/lib/people-strategy/meetings-status";

/**
 * Canonical `/meetings` home — pure selector contract.
 *
 * Proves the home routes each meeting to the ONE canonical detail for its type,
 * never shows the same meeting twice, and labels status in plain English.
 */

function card(
  id: string,
  effectiveStatus: EffectiveMeetingStatus,
  opts: { agendaCount?: number; startISO?: string } = {}
): MeetingsHomeCard {
  return {
    id,
    effectiveStatus,
    agendaCount: opts.agendaCount ?? 1,
    startISO: opts.startISO ?? "2026-06-21T15:00:00.000Z",
  };
}

describe("meetingDetailHref — one canonical detail room", () => {
  it("routes impact meetings to the unified meeting room", () => {
    expect(meetingDetailHref(GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE, "m1")).toBe(
      "/meetings/m1"
    );
    expect(isImpactMeetingType(GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE)).toBe(true);
  });

  it("routes officer and every other meeting type to the same room", () => {
    expect(meetingDetailHref("OFFICER_MEETING", "m2")).toBe("/meetings/m2");
    expect(meetingDetailHref("APPLICANT_INTERVIEW", "m3")).toBe("/meetings/m3");
    expect(meetingDetailHref(null, "m4")).toBe("/meetings/m4");
    expect(isImpactMeetingType("OFFICER_MEETING")).toBe(false);
  });

  it("does not create type-specific detail routes", () => {
    const officer = meetingDetailHref("OFFICER_MEETING", "same");
    const impact = meetingDetailHref(GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE, "same");
    expect(officer).toBe(impact);
  });
});

describe("meetingStatusLabel — plain language, no jargon", () => {
  it("maps every status to an understandable label", () => {
    expect(meetingStatusLabel("in_progress")).toBe("In progress");
    expect(meetingStatusLabel("today")).toBe("Today");
    expect(meetingStatusLabel("upcoming")).toBe("Upcoming");
    expect(meetingStatusLabel("completed")).toBe("Done");
    expect(meetingStatusLabel("needs_follow_up")).toBe("Needs follow-up");
    expect(meetingStatusLabel("canceled")).toBe("Canceled");
  });

  it("uses no internal/technical vocabulary", () => {
    const banned = ["artifact", "node", "pipeline", "presentation object", "system state"];
    const statuses: EffectiveMeetingStatus[] = [
      "in_progress",
      "today",
      "upcoming",
      "completed",
      "needs_follow_up",
      "canceled",
    ];
    for (const status of statuses) {
      const label = meetingStatusLabel(status).toLowerCase();
      for (const word of banned) expect(label).not.toContain(word);
    }
  });
});

describe("bucketMeetings — four sections, no duplicates", () => {
  it("places officer and impact meetings into the correct sections", () => {
    const cards: MeetingsHomeCard[] = [
      card("live", "in_progress"),
      card("today", "today"),
      card("prep", "upcoming", { agendaCount: 0 }),
      card("ready", "upcoming", { agendaCount: 3 }),
      card("done", "completed"),
      card("wrap", "needs_follow_up"),
      card("cancelled", "canceled"),
    ];
    const { today, needsPrep, upcoming, recent } = bucketMeetings(cards);

    expect(today.map((c) => c.id).sort()).toEqual(["live", "today"]);
    expect(needsPrep.map((c) => c.id)).toEqual(["prep"]);
    expect(upcoming.map((c) => c.id)).toEqual(["ready"]);
    expect(recent.map((c) => c.id).sort()).toEqual(["done", "wrap"]);
  });

  it("shows every meeting in at most one section (no duplicate cards)", () => {
    const cards: MeetingsHomeCard[] = [
      card("a", "today"),
      card("b", "upcoming", { agendaCount: 0 }),
      card("c", "upcoming", { agendaCount: 2 }),
      card("d", "completed"),
    ];
    const buckets = bucketMeetings(cards);
    const all = [...buckets.today, ...buckets.needsPrep, ...buckets.upcoming, ...buckets.recent];
    const ids = all.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dedupes a meeting that appears twice in the input by id", () => {
    const cards: MeetingsHomeCard[] = [card("dup", "today"), card("dup", "today")];
    const buckets = bucketMeetings(cards);
    const all = [...buckets.today, ...buckets.needsPrep, ...buckets.upcoming, ...buckets.recent];
    expect(all.filter((c) => c.id === "dup")).toHaveLength(1);
  });

  it("orders upcoming soonest-first and recent newest-first", () => {
    const cards: MeetingsHomeCard[] = [
      card("later", "upcoming", { agendaCount: 1, startISO: "2026-07-01T15:00:00.000Z" }),
      card("sooner", "upcoming", { agendaCount: 1, startISO: "2026-06-25T15:00:00.000Z" }),
      card("old", "completed", { startISO: "2026-06-01T15:00:00.000Z" }),
      card("recent", "completed", { startISO: "2026-06-18T15:00:00.000Z" }),
    ];
    const { upcoming, recent } = bucketMeetings(cards);
    expect(upcoming.map((c) => c.id)).toEqual(["sooner", "later"]);
    expect(recent.map((c) => c.id)).toEqual(["recent", "old"]);
  });
});
