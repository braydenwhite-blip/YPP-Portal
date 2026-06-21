import { describe, expect, it } from "vitest";

import { buildHomeFocus, buildHomeQueuePreview } from "@/lib/home/home-focus";
import type { LeadershipHomeData } from "@/lib/home/leadership-home";

const NOW = new Date("2026-06-16T15:00:00.000Z");

/** Minimal LeadershipHomeData — only the fields the focus selector reads. */
function data(overrides: Partial<LeadershipHomeData> = {}): LeadershipHomeData {
  return {
    brief: [],
    chiefOfStaff: [],
    stats: {
      overdueActions: 0,
      blockedActions: 0,
      unownedActions: 0,
      upcomingMeetings: 0,
      applicantsAwaitingDecision: 0,
      studentsWithoutAdvisor: 0,
      advisorCheckInsOverdue: 0,
      partnerFollowUpsOverdue: 0,
      openPartnerRequests: 0,
    },
    attention: [],
    upcomingMeetings: [],
    overdueActions: [],
    decisionQueue: [],
    recentActivity: [],
    ...overrides,
  } as LeadershipHomeData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meeting = (o: Record<string, unknown>): any => o;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const attention = (o: Record<string, unknown>): any => o;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const action = (o: Record<string, unknown>): any => o;

describe("buildHomeFocus", () => {
  it("returns null (clear) when nothing needs attention", () => {
    expect(buildHomeFocus(data(), NOW)).toBeNull();
  });

  it("prioritises a meeting happening today above everything else", () => {
    const focus = buildHomeFocus(
      data({
        upcomingMeetings: [
          meeting({
            id: "m1",
            title: "Ops sync",
            startISO: "2026-06-16T18:00:00.000Z",
            categoryLabel: "Operations",
            facilitatorName: "Mia",
          }),
        ],
        overdueActions: [action({ id: "a1", title: "Late thing", href: "/actions/a1", daysOverdue: 5, ownerName: "Sam" })],
      }),
      NOW
    );
    expect(focus?.category).toBe("Meeting today");
    expect(focus?.primaryHref).toBe("/meetings/m1");
    expect(focus?.primaryLabel).toBe("Open meeting prep");
  });

  it("falls to the worst attention loop when no meeting is today", () => {
    const focus = buildHomeFocus(
      data({
        attention: [
          attention({
            id: "att-1",
            kind: "decision",
            category: "missing_next_step",
            title: "Decide budget",
            why: "Decided but not tracked.",
            suggestedStep: "Convert it to an action.",
            ageLabel: "4 days",
            severity: "high",
            href: "/meetings/m9",
          }),
        ],
      }),
      NOW
    );
    expect(focus?.category).toBe("Needs a next step");
    expect(focus?.primaryLabel).toBe("Review & decide");
    expect(focus?.why).toContain("Convert it to an action.");
    expect(focus?.sourceId).toBe("att-1");
  });

  it("falls to the most overdue action when there's no meeting or attention loop", () => {
    const focus = buildHomeFocus(
      data({
        overdueActions: [action({ id: "a1", title: "Send email", href: "/actions/a1", daysOverdue: 3, ownerName: "Sam" })],
      }),
      NOW
    );
    expect(focus?.category).toBe("Overdue action");
    expect(focus?.primaryHref).toBe("/actions/a1");
    expect(focus?.why).toContain("3 days past due");
  });
});

describe("buildHomeQueuePreview", () => {
  it("counts the queue and shows the next loop that isn't already the focus", () => {
    const d = data({
      attention: [
        attention({ id: "att-1", kind: "action", category: "urgent", title: "A", why: "x", href: "/a" }),
        attention({ id: "att-2", kind: "action", category: "urgent", title: "B", why: "y", href: "/b" }),
      ],
    });
    const focus = buildHomeFocus(d, NOW); // picks att-1
    const preview = buildHomeQueuePreview(d, focus);
    expect(preview.count).toBe(2);
    expect(preview.next?.title).toBe("B");
  });
});
