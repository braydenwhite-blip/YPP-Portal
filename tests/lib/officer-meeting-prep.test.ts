import { describe, expect, it } from "vitest";

import {
  buildCandidateGroups,
  buildDecisionsNeeded,
  inferDefaultPhase,
} from "@/lib/people-strategy/officer-meeting-prep";

describe("officer-meeting-prep", () => {
  it("groups ownerless and blocked actions separately", () => {
    const groups = buildCandidateGroups({
      unassigned: [
        {
          id: "a1",
          title: "Assign instructor",
          ownerName: null,
          dueISO: "2026-07-10T00:00:00.000Z",
          href: "/actions/a1",
          relatedLabel: "Riverside partner",
          blocked: false,
          overdue: false,
          daysOverdue: 0,
          status: "OPEN",
          priority: "HIGH",
          nextStep: null,
          contextSummary: null,
          sourceMeetingTitle: null,
        },
      ],
      blocked: [],
      overdue: [],
      reviewItems: [],
      agenda: [],
    });
    expect(groups.find((g) => g.key === "ownerless")?.items).toHaveLength(1);
  });

  it("infers before phase for upcoming meetings", () => {
    expect(inferDefaultPhase("SCHEDULED", "upcoming")).toBe("before");
    expect(inferDefaultPhase("SCHEDULED", "in_progress")).toBe("during");
    expect(inferDefaultPhase("COMPLETED", "completed")).toBe("after");
  });

  it("builds decisions needed from cross-team candidates", () => {
    const groups = buildCandidateGroups({
      unassigned: [],
      blocked: [],
      overdue: [],
      reviewItems: [
        {
          id: "person:p1",
          kind: "person",
          title: "Jennifer — provisional review due",
          reason: "Quarterly review",
          reasons: ["Quarterly review"],
          score: 10,
          severity: "warning",
          href: "/people/p1",
        },
      ],
      agenda: [],
    });
    const all = groups.flatMap((g) => g.items);
    expect(buildDecisionsNeeded(all)).toContain("Jennifer — provisional review due");
  });
});
