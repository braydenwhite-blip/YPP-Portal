import { describe, it, expect } from "vitest";

import {
  assembleMentorshipSnapshot,
  buildMentorshipMetrics,
  buildMentorshipSuggestions,
  buildMentorshipTrends,
  computeMentorshipCounts,
  gradeMentorshipMetric,
  MENTORSHIP_EXPECTATIONS,
  MENTORSHIP_METRIC_KEYS,
  STALE_RECOMMENDATION_DAYS,
  type MentorshipAnalyticsInput,
  type MentorshipAssignmentInput,
} from "@/lib/data-360/mentorship-analytics-core";

const NOW = new Date("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY);

function assignment(over: Partial<MentorshipAssignmentInput> & { assignmentId: string; studentId: string; advisorId: string }): MentorshipAssignmentInput {
  return {
    isActive: true,
    advisingStatus: "ENGAGED",
    needsFollowUp: false,
    followUpNote: null,
    lastCheckInAt: daysAgo(3),
    nextCheckInDueAt: daysAhead(11),
    startDate: daysAgo(30),
    studentName: "Student",
    advisorName: "Advisor",
    chapterId: "chap-1",
    ...over,
  };
}

function baseInput(over: Partial<MentorshipAnalyticsInput> = {}): MentorshipAnalyticsInput {
  return {
    assignments: [],
    recommendations: [],
    checkIns: [],
    studentIds: [],
    ...over,
  };
}

describe("computeMentorshipCounts — lifecycle-derived counts", () => {
  const input = baseInput({
    assignments: [
      // A1: never checked in, assigned 20d ago → KICKOFF_NEEDED
      assignment({ assignmentId: "a1", studentId: "s1", advisorId: "adv1", lastCheckInAt: null, nextCheckInDueAt: null, startDate: daysAgo(20) }),
      // A2: checked in 5d ago but next check-in due 1d ago → FOLLOW_UP_DUE (overdue)
      assignment({ assignmentId: "a2", studentId: "s2", advisorId: "adv2", lastCheckInAt: daysAgo(5), nextCheckInDueAt: daysAgo(1) }),
      // A3: last check-in 70d ago → STALE (overdue)
      assignment({ assignmentId: "a3", studentId: "s3", advisorId: "adv3", lastCheckInAt: daysAgo(70), nextCheckInDueAt: daysAgo(40) }),
      // A4: healthy active relationship
      assignment({ assignmentId: "a4", studentId: "s4", advisorId: "adv4", lastCheckInAt: daysAgo(4), nextCheckInDueAt: daysAhead(10) }),
      // A5: inactive → excluded everywhere
      assignment({ assignmentId: "a5", studentId: "s5", advisorId: "adv5", isActive: false }),
    ],
    // s6 is a student with no assignment at all → unassigned
    studentIds: ["s1", "s2", "s3", "s4", "s5", "s6"],
  });
  const counts = computeMentorshipCounts(input, NOW);

  it("counts supported students from active assignments only", () => {
    expect(counts.studentsSupported).toBe(4); // s1..s4 (s5 inactive)
  });

  it("counts unassigned students (no active assignment)", () => {
    // s5 (inactive assignment) and s6 (never assigned) are unassigned
    expect(counts.unassignedStudents).toBe(2);
  });

  it("counts kickoffs needed (assigned, never checked in)", () => {
    expect(counts.kickoffsNeeded).toBe(1); // a1
  });

  it("counts overdue check-ins (follow-up-due or stale)", () => {
    expect(counts.overdueCheckIns).toBe(2); // a2 (due passed) + a3 (stale)
  });

  it("counts active advisors from caseload summary", () => {
    expect(counts.activeAdvisors).toBe(4); // adv1..adv4 (adv5 inactive)
  });

  it("marks advising active when any assignment exists", () => {
    expect(counts.advisingActive).toBe(true);
    expect(computeMentorshipCounts(baseInput({ studentIds: ["s1"] }), NOW).advisingActive).toBe(false);
  });
});

describe("computeMentorshipCounts — recommendations and check-ins", () => {
  const input = baseInput({
    recommendations: [
      { id: "r1", status: "SUGGESTED", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { id: "r2", status: "SUGGESTED", createdAt: daysAgo(STALE_RECOMMENDATION_DAYS + 6), updatedAt: daysAgo(STALE_RECOMMENDATION_DAYS + 6) },
      { id: "r3", status: "IN_PROGRESS", createdAt: daysAgo(5), updatedAt: daysAgo(2) },
      { id: "r4", status: "DONE", createdAt: daysAgo(9), updatedAt: NOW },
      { id: "r5", status: "DISMISSED", createdAt: daysAgo(2), updatedAt: daysAgo(1) },
    ],
    // Two check-ins in the current calendar day (same reporting week regardless
    // of which weekday NOW falls on), one clearly weeks earlier.
    checkIns: [{ createdAt: NOW }, { createdAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000) }, { createdAt: daysAgo(30) }],
    studentIds: [],
  });
  const counts = computeMentorshipCounts(input, NOW);

  it("counts open recommendations (SUGGESTED or IN_PROGRESS)", () => {
    expect(counts.openRecommendations).toBe(3); // r1, r2, r3
  });

  it("counts stale recommendations (SUGGESTED older than threshold)", () => {
    expect(counts.staleRecommendations).toBe(1); // r2 only
  });

  it("counts recommendations completed this reporting week", () => {
    expect(counts.recommendationsCompletedThisWeek).toBe(1); // r4
  });

  it("counts check-ins logged this reporting week", () => {
    expect(counts.checkInsThisWeek).toBe(2); // NOW + yesterday, not 30d ago
  });
});

describe("computeMentorshipCounts — overloaded advisors", () => {
  it("flags an advisor carrying a heavy caseload", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      assignment({ assignmentId: `a${i}`, studentId: `s${i}`, advisorId: "busy" })
    );
    const counts = computeMentorshipCounts(baseInput({ assignments: many, studentIds: many.map((m) => m.studentId) }), NOW);
    expect(counts.overloadedAdvisors).toBe(1);
    expect(counts.activeAdvisors).toBe(1);
  });
});

describe("gradeMentorshipMetric", () => {
  it("grades a target-zero metric met at 0 and over above 0", () => {
    const exp = MENTORSHIP_EXPECTATIONS.overdueCheckIns;
    expect(gradeMentorshipMetric(exp, 0, true)).toBe("met");
    expect(gradeMentorshipMetric(exp, 3, true)).toBe("over");
  });

  it("does not grade unassigned students until advising is active", () => {
    const exp = MENTORSHIP_EXPECTATIONS.unassignedStudents;
    expect(gradeMentorshipMetric(exp, 5, false)).toBe("none");
    expect(gradeMentorshipMetric(exp, 5, true)).toBe("over");
    expect(gradeMentorshipMetric(exp, 0, true)).toBe("met");
  });

  it("leaves informational metrics ungraded", () => {
    expect(gradeMentorshipMetric(MENTORSHIP_EXPECTATIONS.checkInsThisWeek, 12, true)).toBe("none");
  });
});

describe("buildMentorshipMetrics", () => {
  it("produces a metric for every key with a real drilldown", () => {
    const counts = computeMentorshipCounts(baseInput({ studentIds: ["s1"] }), NOW);
    const metrics = buildMentorshipMetrics(counts);
    expect(metrics).toHaveLength(MENTORSHIP_METRIC_KEYS.length);
    for (const m of metrics) {
      expect(m.href).toBeTruthy();
      expect(m.href!.startsWith("/")).toBe(true);
    }
  });

  it("marks a breached target-zero metric as a gap with danger tone", () => {
    const input = baseInput({
      assignments: [assignment({ assignmentId: "a1", studentId: "s1", advisorId: "adv1", lastCheckInAt: daysAgo(70) })],
      studentIds: ["s1"],
    });
    const metrics = buildMentorshipMetrics(computeMentorshipCounts(input, NOW));
    const overdue = metrics.find((m) => m.key === "overdueCheckIns")!;
    expect(overdue.value).toBe(1);
    expect(overdue.isGap).toBe(true);
    expect(overdue.tone).toBe("danger");
    expect(overdue.statusLabel).toBe("Over target");
  });

  it("keeps informational metrics tone-neutral and gap-free", () => {
    const metrics = buildMentorshipMetrics(computeMentorshipCounts(baseInput(), NOW));
    const supported = metrics.find((m) => m.key === "studentsSupported")!;
    expect(supported.tone).toBe("default");
    expect(supported.isGap).toBe(false);
    expect(supported.statusLabel).toBe("");
  });
});

describe("buildMentorshipSuggestions — gaps and active-workflow dedupe", () => {
  const input = baseInput({
    assignments: [
      assignment({ assignmentId: "a1", studentId: "s1", advisorId: "adv1", lastCheckInAt: daysAgo(70) }), // overdue
    ],
    studentIds: ["s1", "s2", "s3"], // s2,s3 unassigned
    recommendations: [
      { id: "r2", status: "SUGGESTED", createdAt: daysAgo(30), updatedAt: daysAgo(30) }, // stale
    ],
  });
  const counts = computeMentorshipCounts(input, NOW);

  it("fires one suggestion per breached target-zero metric with a blueprint", () => {
    const s = buildMentorshipSuggestions(counts);
    const keys = s.map((x) => x.metricKey);
    expect(keys).toContain("unassignedStudents");
    expect(keys).toContain("overdueCheckIns");
    expect(keys).toContain("staleRecommendations");
    // overloadedAdvisors has no gapTemplateKey → no suggestion
    expect(keys).not.toContain("overloadedAdvisors");
    for (const x of s) expect(x.templateKey).toBe("student-advising");
  });

  it("orders uncovered gaps first, then by descending count", () => {
    const s = buildMentorshipSuggestions(counts);
    // unassigned = 2 should rank above overdue = 1 and stale = 1
    expect(s[0].metricKey).toBe("unassignedStudents");
    expect(s[0].currentValue).toBe(2);
  });

  it("marks a suggestion covered when an active workflow already exists", () => {
    const s = buildMentorshipSuggestions(counts, new Set(["student-advising"]));
    expect(s.every((x) => x.covered)).toBe(true);
    // covered ones sink below any uncovered ones (there are none here)
  });

  it("suppresses the unassigned suggestion entirely when advising is inactive", () => {
    const noAdvising = computeMentorshipCounts(baseInput({ studentIds: ["s1", "s2"] }), NOW);
    const s = buildMentorshipSuggestions(noAdvising);
    expect(s.find((x) => x.metricKey === "unassignedStudents")).toBeUndefined();
  });
});

describe("buildMentorshipTrends", () => {
  it("buckets check-ins and recommendations by week from real timestamps", () => {
    const input = baseInput({
      checkIns: [{ createdAt: NOW }, { createdAt: daysAgo(7) }, { createdAt: daysAgo(14) }],
      recommendations: [
        { id: "r1", status: "SUGGESTED", createdAt: daysAgo(7), updatedAt: daysAgo(7) },
        { id: "r2", status: "DONE", createdAt: daysAgo(21), updatedAt: NOW },
      ],
    });
    const trends = buildMentorshipTrends(input, NOW, 8);
    expect(trends.checkIns).toHaveLength(8);
    expect(trends.recommendationsCompleted).toHaveLength(8);
    // Last bucket (this week) has 1 check-in and 1 completed recommendation.
    expect(trends.checkIns[trends.checkIns.length - 1].value).toBe(1);
    expect(trends.recommendationsCompleted[trends.recommendationsCompleted.length - 1].value).toBe(1);
    // Only DONE recs count toward completed.
    const totalCompleted = trends.recommendationsCompleted.reduce((s, p) => s + p.value, 0);
    expect(totalCompleted).toBe(1);
  });
});

describe("assembleMentorshipSnapshot", () => {
  it("assembles metrics, suggestions, trends, and a gap count end-to-end", () => {
    const input = baseInput({
      assignments: [assignment({ assignmentId: "a1", studentId: "s1", advisorId: "adv1", lastCheckInAt: daysAgo(70) })],
      studentIds: ["s1", "s2"],
      recommendations: [{ id: "r1", status: "SUGGESTED", createdAt: daysAgo(30), updatedAt: daysAgo(30) }],
      checkIns: [{ createdAt: NOW }],
    });
    const snap = assembleMentorshipSnapshot(input, { now: NOW });
    expect(snap.metrics).toHaveLength(MENTORSHIP_METRIC_KEYS.length);
    expect(snap.gapCount).toBeGreaterThanOrEqual(2); // unassigned + overdue + stale
    expect(snap.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(snap.trends.checkIns.length).toBeGreaterThan(0);
  });
});
