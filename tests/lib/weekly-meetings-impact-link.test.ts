import { describe, expect, it } from "vitest";

import {
  buildImpactCoverage,
  matchImpactMeetingForEntry,
} from "@/lib/weekly-meetings/impact-link";
import type { MeetingStatus, MeetingType } from "@/lib/weekly-meetings/meeting-types";

function candidate(
  id: string,
  type: MeetingType,
  status: MeetingStatus,
  opts: { teamId?: string | null; chapterId?: string | null; scheduledISO?: string } = {}
) {
  return {
    id,
    title: id,
    type,
    teamId: opts.teamId ?? null,
    chapterId: opts.chapterId ?? null,
    status,
    scheduledISO: opts.scheduledISO ?? "2026-06-22T15:00:00.000Z",
  };
}

describe("matchImpactMeetingForEntry", () => {
  it("matches a team entry to its team meeting, preferring specific over all-teams", () => {
    const hint = matchImpactMeetingForEntry(
      { scope: "team", scopeId: "t1" },
      [
        candidate("all", "WEEKLY_TEAM_IMPACT", "SCHEDULED", { teamId: null }),
        candidate("specific", "WEEKLY_TEAM_IMPACT", "SCHEDULED", { teamId: "t1" }),
      ]
    );
    expect(hint?.id).toBe("specific");
    expect(hint?.allTeams).toBe(false);
  });

  it("falls back to the all-teams meeting and flags it", () => {
    const hint = matchImpactMeetingForEntry({ scope: "team", scopeId: "t9" }, [
      candidate("all", "WEEKLY_TEAM_IMPACT", "SCHEDULED", { teamId: null }),
    ]);
    expect(hint?.id).toBe("all");
    expect(hint?.allTeams).toBe(true);
  });

  it("prefers an in-progress meeting over a scheduled one", () => {
    const hint = matchImpactMeetingForEntry({ scope: "team", scopeId: "t1" }, [
      candidate("later", "WEEKLY_TEAM_IMPACT", "SCHEDULED", { teamId: "t1" }),
      candidate("live", "WEEKLY_TEAM_IMPACT", "IN_PROGRESS", { teamId: "t1" }),
    ]);
    expect(hint?.id).toBe("live");
  });

  it("ignores completed meetings and cross-scope/cross-team types", () => {
    expect(
      matchImpactMeetingForEntry({ scope: "team", scopeId: "t1" }, [
        candidate("done", "WEEKLY_TEAM_IMPACT", "COMPLETED", { teamId: "t1" }),
        candidate("other-team", "WEEKLY_TEAM_IMPACT", "SCHEDULED", { teamId: "t2" }),
        candidate("chapter", "CHAPTER_IMPACT", "SCHEDULED", { chapterId: "c1" }),
      ])
    ).toBeNull();
  });

  it("matches chapter entries to chapter meetings only", () => {
    const hint = matchImpactMeetingForEntry({ scope: "chapter", scopeId: "c1" }, [
      candidate("ch", "CHAPTER_IMPACT", "SCHEDULED", { chapterId: "c1" }),
    ]);
    expect(hint?.id).toBe("ch");
  });
});

describe("buildImpactCoverage", () => {
  it("reconciles a team roster with submitted/draft/missing entries", () => {
    const coverage = buildImpactCoverage({
      scopeLabel: "Design",
      weekLabel: "Week of Jun 22, 2026",
      roster: [
        { userId: "a", name: "Alice" },
        { userId: "b", name: "Bob" },
        { userId: "c", name: "Cara" },
      ],
      entries: [
        { userId: "a", name: "Alice", status: "SUBMITTED", presentingCount: 2 },
        { userId: "b", name: "Bob", status: "DRAFT", presentingCount: 5 },
      ],
    });
    expect(coverage.hasRoster).toBe(true);
    expect(coverage.expected).toBe(3);
    expect(coverage.submitted).toBe(1);
    // Draft rows do not reach the meeting, so they are not counted as presenting.
    expect(coverage.presenting).toBe(2);
    expect(coverage.people.map((p) => [p.name, p.status])).toEqual([
      ["Alice", "SUBMITTED"],
      ["Bob", "DRAFT"],
      ["Cara", "MISSING"],
    ]);
  });

  it("folds in a submitter who is no longer on the roster", () => {
    const coverage = buildImpactCoverage({
      scopeLabel: "Design",
      weekLabel: "wk",
      roster: [{ userId: "a", name: "Alice" }],
      entries: [
        { userId: "a", name: "Alice", status: "SUBMITTED", presentingCount: 1 },
        { userId: "z", name: "Zed", status: "SUBMITTED", presentingCount: 1 },
      ],
    });
    expect(coverage.people.map((p) => p.userId).sort()).toEqual(["a", "z"]);
    expect(coverage.submitted).toBe(2);
    expect(coverage.presenting).toBe(2);
  });

  it("counts a multi-team person once across their entries (all-teams meeting)", () => {
    const coverage = buildImpactCoverage({
      scopeLabel: "All teams",
      weekLabel: "wk",
      roster: [
        { userId: "a", name: "Alice" },
        { userId: "b", name: "Bob" },
      ],
      entries: [
        { userId: "a", name: "Alice", status: "DRAFT", presentingCount: 4 },
        { userId: "a", name: "Alice", status: "SUBMITTED", presentingCount: 3 },
        { userId: "b", name: "Bob", status: "DRAFT", presentingCount: 0 },
      ],
    });
    // Alice counts once as SUBMITTED; only her submitted entry's rows present.
    expect(coverage.submitted).toBe(1);
    expect(coverage.presenting).toBe(3);
    const alice = coverage.people.find((p) => p.userId === "a");
    expect(alice).toMatchObject({ status: "SUBMITTED", presentingCount: 3 });
    expect(coverage.people).toHaveLength(2);
  });

  it("reports submitters-only when there is no roster (chapter scope)", () => {
    const coverage = buildImpactCoverage({
      scopeLabel: "North Chapter",
      weekLabel: "wk",
      roster: null,
      entries: [{ userId: "p", name: "Pat", status: "SUBMITTED", presentingCount: 3 }],
    });
    expect(coverage.hasRoster).toBe(false);
    expect(coverage.expected).toBe(1);
    expect(coverage.people.every((p) => p.status !== "MISSING")).toBe(true);
  });
});
