import { describe, it, expect } from "vitest";
import {
  buildChapterImpactBrief,
  classifyBriefActions,
  type BriefActionRecord,
  type ChapterImpactBriefInput,
} from "@/lib/chapters/impact-brief";
import { summarizeChapterGrowth } from "@/lib/chapters/chapter-growth";
import { summarizeChapterExpectations } from "@/lib/chapters/expectations";
import type { ChapterImpactMetrics } from "@/lib/chapters/impact-meeting";
import type { ChapterBlocker } from "@/lib/chapters/needs-attention-rules";

// Wednesday of the reporting week that starts Monday 2026-06-29.
const NOW = new Date("2026-07-01T12:00:00.000Z");
const WEEK_START = new Date("2026-06-29T00:00:00.000Z");

const METRICS: ChapterImpactMetrics = {
  partnersTotal: 6,
  partnersContacted: 5,
  partnersResponded: 3,
  partnersMeetingScheduled: 1,
  partnersMeetingsCompleted: 2,
  partnersInConversation: 2,
  partnersConfirmed: 2,
  partnersClosed: 1,
  instructorApplicants: 12,
  instructorsUnderReview: 3,
  interviewsScheduled: 2,
  interviewsCompleted: 4,
  instructorsHired: 5,
  curriculaSubmitted: 3,
  curriculaApproved: 2,
  curriculaNeedsRevision: 1,
  classesTotal: 4,
  classesPublic: 2,
  classesLaunched: 1,
  classesRunning: 1,
  enrollmentTotal: 22,
  underEnrolledClasses: 1,
};

const GROWTH = summarizeChapterGrowth({
  weekNumber: 5,
  current: {
    weekStartISO: "2026-06-29",
    weekNumber: 5,
    values: { confirmedPartners: 2, instructorsHired: 5, studentsEnrolled: 22, unresolvedBlockers: 3 },
  },
  previous: {
    weekStartISO: "2026-06-22",
    weekNumber: 4,
    values: { confirmedPartners: 1, instructorsHired: 5, studentsEnrolled: 25, unresolvedBlockers: 1 },
  },
});

const BLOCKERS: ChapterBlocker[] = [
  {
    key: "partner-followup:p1",
    lane: "partners",
    severity: "warning",
    title: "Springfield Library: follow-up overdue",
    detail: "Log a touchpoint.",
    href: "/partners/p1",
    suggestedAction: "Follow up with Springfield Library",
  },
  {
    key: "class-no-instructor:c1",
    lane: "classes",
    severity: "critical",
    title: "Intro to Coding: no instructor assigned",
    detail: "Class launches in 6 days.",
    href: "/admin/classes",
    suggestedAction: "Assign an instructor to Intro to Coding",
    entityType: "CLASS_OFFERING",
    entityId: "c1",
  },
  {
    key: "curriculum-waiting:t1",
    lane: "curriculum",
    severity: "info",
    title: "Chess Basics: curriculum awaiting review",
    href: "/admin/curricula",
    suggestedAction: "Review Chess Basics curriculum",
  },
];

function action(overrides: Partial<BriefActionRecord>): BriefActionRecord {
  return {
    id: "a0",
    title: "Do the thing",
    status: "IN_PROGRESS",
    dueAt: null,
    completedAt: null,
    leadName: "Jordan",
    blockedReason: null,
    ...overrides,
  };
}

const ACTIONS: BriefActionRecord[] = [
  action({ id: "a1", title: "Email the school district", status: "IN_PROGRESS", dueAt: new Date("2026-06-30T00:00:00.000Z") }), // overdue
  action({ id: "a2", title: "Book the classroom", status: "BLOCKED", blockedReason: "Waiting on the principal", dueAt: new Date("2026-07-10T00:00:00.000Z") }),
  action({ id: "a3", title: "Print flyers", status: "COMPLETE", completedAt: new Date("2026-06-30T09:00:00.000Z") }), // this week
  action({ id: "a4", title: "Order supplies", status: "COMPLETE", completedAt: new Date("2026-06-20T09:00:00.000Z") }), // last week
  action({ id: "a5", title: "Confirm volunteers", status: "NOT_STARTED", dueAt: new Date("2026-07-05T00:00:00.000Z") }), // due next week
  action({ id: "a6", title: "Plan showcase", status: "NOT_STARTED", dueAt: new Date("2026-08-20T00:00:00.000Z") }), // far out
];

function briefInput(overrides: Partial<ChapterImpactBriefInput> = {}): ChapterImpactBriefInput {
  return {
    chapter: { id: "ch1", name: "Springfield", lifecycleLabel: "Active", presidentName: "Alex" },
    weekNumber: 5,
    focus: "Logistics, orientation & curriculum",
    weekStart: WEEK_START,
    weekLabel: "Week of Jun 29, 2026",
    now: NOW,
    growth: GROWTH,
    expectations: summarizeChapterExpectations({
      confirmedPartners: 2,
      instructorApplicants: 12,
      instructorsHired: 5,
      studentsEnrolled: 22,
      classesRunning: 1,
    }),
    metrics: METRICS,
    studentMetrics: {
      enrolledCount: 22,
      attendancePercent: 84,
      hasAttendanceData: true,
      retentionPercent: 91,
      feedbackCount: 3,
      unresolvedConcerns: 1,
    },
    studentNeeds: [
      { title: "2 students missed two sessions in a row", severity: "warning", href: "/chapter/students" },
    ],
    blockers: BLOCKERS,
    actions: ACTIONS,
    supportRequests: [
      { id: "s1", title: "Need help with school approval", category: "SCHOOL_APPROVAL", priority: "URGENT", createdAt: new Date("2026-06-25T00:00:00.000Z"), assignedToName: null },
      { id: "s2", title: "Curriculum question", category: "CURRICULUM", priority: "MEDIUM", createdAt: new Date("2026-06-26T00:00:00.000Z"), assignedToName: "Sam" },
    ],
    decisionRows: [{ id: "r1", title: "Approve budget for launch event", detail: "Needs $250" }],
    weeklyEntry: "SUBMITTED",
    meeting: { id: "m1", scheduledAt: new Date("2026-07-03T17:00:00.000Z"), status: "SCHEDULED", isThisWeek: true },
    attendanceRecordedThisWeek: true,
    snapshotSavedThisWeek: true,
    partnerFollowUpsDue: 2,
    ...overrides,
  };
}

describe("classifyBriefActions", () => {
  it("splits actions into overdue, waiting, due-next-week, and completed-this-week", () => {
    const work = classifyBriefActions(ACTIONS, WEEK_START, NOW);
    expect(work.overdue.map((a) => a.id)).toEqual(["a1"]);
    expect(work.waiting.map((a) => a.id)).toEqual(["a2"]);
    expect(work.dueNextWeek.map((a) => a.id)).toEqual(["a5"]);
    expect(work.completedThisWeek.map((a) => a.id)).toEqual(["a3"]);
    // a1 (overdue), a2 (blocked), a5, a6 are open; completed ones are not.
    expect(work.openCount).toBe(4);
  });

  it("actions completed before this week never count as weekly wins", () => {
    const work = classifyBriefActions(ACTIONS, WEEK_START, NOW);
    expect(work.completedThisWeek.some((a) => a.id === "a4")).toBe(false);
  });
});

describe("buildChapterImpactBrief", () => {
  it("is ready when the weekly update is submitted and nothing is missing", () => {
    const brief = buildChapterImpactBrief(briefInput());
    expect(brief.readiness.state).toBe("ready");
    expect(brief.readiness.label).toBe("Ready for Impact Meeting");
    expect(brief.missingData).toEqual([]);
  });

  it("a missing weekly update makes the brief not ready", () => {
    const brief = buildChapterImpactBrief(briefInput({ weeklyEntry: "MISSING", snapshotSavedThisWeek: false }));
    expect(brief.readiness.state).toBe("not_ready");
    expect(brief.readiness.label).toBe("Missing weekly update");
    expect(brief.missingData.map((m) => m.key)).toContain("weekly_update");
    expect(brief.missingData.map((m) => m.key)).toContain("snapshot");
  });

  it("says exactly what data is missing, with the action that fills it", () => {
    const brief = buildChapterImpactBrief(
      briefInput({ meeting: null, attendanceRecordedThisWeek: false })
    );
    const keys = brief.missingData.map((m) => m.key);
    expect(keys).toContain("meeting");
    expect(keys).toContain("attendance");
    expect(brief.readiness.state).toBe("almost");
    for (const item of brief.missingData) {
      expect(item.action.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("a next-week meeting still counts as missing for this week", () => {
    const brief = buildChapterImpactBrief(
      briefInput({
        meeting: { id: "m2", scheduledAt: new Date("2026-07-08T17:00:00.000Z"), status: "SCHEDULED", isThisWeek: false },
      })
    );
    expect(brief.missingData.map((m) => m.key)).toContain("meeting");
  });

  it("collects decisions from impact rows, critical blockers, and urgent support requests", () => {
    const brief = buildChapterImpactBrief(briefInput());
    const sources = brief.decisionsNeeded.map((d) => d.source);
    expect(sources).toContain("impact_row");
    expect(sources).toContain("blocker");
    expect(sources).toContain("support_request");
    // The MEDIUM-priority support request is not a leadership decision.
    expect(brief.decisionsNeeded.some((d) => d.title.includes("Curriculum question"))).toBe(false);
    // Impact rows come first — the CP flagged them explicitly.
    expect(brief.decisionsNeeded[0].title).toBe("Approve budget for launch event");
  });

  it("wins combine real growth deltas with actions completed this week", () => {
    const brief = buildChapterImpactBrief(briefInput());
    expect(brief.wins.some((w) => /Confirmed partners up 1/.test(w))).toBe(true);
    expect(brief.wins).toContain("1 action completed this week");
  });

  it("what-changed reports regressions honestly", () => {
    const brief = buildChapterImpactBrief(briefInput());
    expect(brief.whatChanged.regressions.some((r) => /Students enrolled down 3/.test(r))).toBe(true);
  });

  it("commitments lead with overdue work and never duplicate", () => {
    const brief = buildChapterImpactBrief(briefInput());
    expect(brief.commitments[0].text).toBe("Clear overdue: Email the school district");
    expect(brief.commitments.length).toBeLessThanOrEqual(5);
    expect(new Set(brief.commitments.map((c) => c.text)).size).toBe(brief.commitments.length);
    expect(brief.commitments.some((c) => c.source === "growth")).toBe(true);
  });

  it("lanes carry current numbers, movement, and a concrete next step", () => {
    const brief = buildChapterImpactBrief(briefInput());
    const partners = brief.lanes.find((l) => l.key === "partners")!;
    expect(partners.headline).toContain("2 confirmed");
    expect(partners.changed.some((c) => /Confirmed partners/.test(c))).toBe(true);
    expect(partners.nextStep).toBe("Follow up with Springfield Library");

    const students = brief.lanes.find((l) => l.key === "students")!;
    expect(students.nextStep).toBe("2 students missed two sessions in a row");

    // Classes lane owns both class and curriculum blockers.
    const classes = brief.lanes.find((l) => l.key === "classes")!;
    expect(classes.attentionCount).toBe(2);
    expect(classes.nextStep).toBe("Assign an instructor to Intro to Coding");
  });

  it("risks exclude info-level noise and rank critical first", () => {
    const brief = buildChapterImpactBrief(briefInput());
    expect(brief.risks).toHaveLength(2);
    expect(brief.risks[0].severity).toBe("critical");
    expect(brief.risks.some((r) => r.title.includes("Chess Basics"))).toBe(false);
  });

  it("headline states the trend and the counts that matter", () => {
    const brief = buildChapterImpactBrief(briefInput());
    expect(brief.headline).toContain("1 overdue action");
    expect(brief.headline).toContain("3 decisions needed");
  });

  it("an empty chapter produces honest empty states, not fabricated data", () => {
    const empty = buildChapterImpactBrief(
      briefInput({
        growth: summarizeChapterGrowth({
          weekNumber: 1,
          current: { weekStartISO: "2026-06-29", weekNumber: 1, values: {} },
          previous: null,
        }),
        expectations: summarizeChapterExpectations({}),
        metrics: { ...METRICS, classesRunning: 0 },
        studentMetrics: {
          enrolledCount: 0,
          attendancePercent: 0,
          hasAttendanceData: false,
          retentionPercent: 0,
          feedbackCount: 0,
          unresolvedConcerns: 0,
        },
        studentNeeds: [],
        blockers: [],
        actions: [],
        supportRequests: [],
        decisionRows: [],
        weeklyEntry: "MISSING",
        meeting: null,
        attendanceRecordedThisWeek: false,
        snapshotSavedThisWeek: false,
        partnerFollowUpsDue: 0,
      })
    );
    expect(empty.whatChanged.status).toBe("No Baseline Yet");
    expect(empty.wins).toEqual([]);
    expect(empty.risks).toEqual([]);
    expect(empty.decisionsNeeded).toEqual([]);
    expect(empty.readiness.state).toBe("not_ready");
    // No attendance item when nothing is running — never nag about impossible data.
    expect(empty.missingData.map((m) => m.key)).not.toContain("attendance");
    // Commitments still propose the growth next action.
    expect(empty.commitments.length).toBeGreaterThan(0);
  });
});
