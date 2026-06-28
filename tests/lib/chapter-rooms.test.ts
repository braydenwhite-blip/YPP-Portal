import { describe, it, expect } from "vitest";
import { buildChapterRooms, collectNeedsYou, ROOM_KEYS } from "@/lib/chapters/rooms";
import { summarizeStudentCommunity } from "@/lib/chapters/student-community";
import { summarizeChapterGrowth } from "@/lib/chapters/chapter-growth";
import type { ChapterOperatingSystem } from "@/lib/chapters/operating-system";

// A minimal but realistic operating-system fixture — only the fields the room
// builder reads. Cast through unknown so the test stays focused.
function makeOs(): ChapterOperatingSystem {
  const os = {
    blockers: [
      {
        key: "partner-followup:p1",
        lane: "partners",
        severity: "warning",
        title: "Lincoln HS: follow-up overdue",
        detail: "Log a touchpoint.",
        href: "/partners/p1",
        suggestedAction: "Follow up with Lincoln HS",
        entityType: "PARTNER",
        entityId: "p1",
      },
      {
        key: "applicant-decision:a1",
        lane: "instructors",
        severity: "critical",
        title: "Jordan: decision overdue",
        detail: "Submit the decision.",
        href: "/chapter/recruiting?tab=candidates",
        suggestedAction: "Decide on Jordan",
        entityType: "INSTRUCTOR_APPLICATION",
        entityId: "a1",
      },
    ],
    blockerSummary: { total: 2, critical: 1, warning: 1, info: 0, byLane: { partners: 1, instructors: 1, curriculum: 0, classes: 0 } },
    partners: { total: 4, confirmed: 1, byStatus: { researching: 1, contacted: 1, interested: 0, meeting_scheduled: 1, final_conversation: 0, confirmed: 1, closed: 0 } },
    instructors: { total: 6, applicants: 6, hired: 2, byStage: { applied: 1, under_review: 2, interview_ready: 0, interview_scheduled: 1, interview_complete: 0, hired: 2, rejected: 0 } },
    curriculum: { total: 3, approved: 1, reviewNeeded: 1, byStatus: { not_submitted: 1, submitted: 1, needs_revision: 0, approved: 1 } },
    launch: { total: 2, ready: 1 },
    deliberables: {
      partner: {
        stats: [{ label: "Active", value: 3, hint: "", tone: "neutral" }],
        rows: [{ id: "p1", name: "Lincoln HS", subtitle: "School", stage: "Contacted", lastContact: "2 days ago", nextStep: "Follow up", status: "at_risk" }],
        totalRows: 1,
        recommendation: { text: "Reconnect with 1 at-risk partner.", cta: "Go to Partner Pipeline", href: "/partners" },
      },
      instructor: {
        stats: [{ label: "Applicants", value: 6, hint: "", tone: "neutral" }],
        rows: [{ id: "a1", name: "Jordan", stage: "Interview Complete", applied: "5 days ago", specialties: "Python", status: "at_risk" }],
        totalRows: 1,
        recommendation: { text: "Record 1 decision.", cta: "Go to Instructor Pipeline", href: "/chapter/recruiting?tab=candidates" },
      },
      curriculum: {
        stats: [{ label: "Total", value: 3, hint: "", tone: "neutral" }],
        rows: [{ id: "c1", title: "Intro Robotics", subject: "Robotics", stage: "In Review", owner: "Sam", status: "needs_feedback" }],
        totalRows: 1,
        recommendation: { text: "Give feedback on 1 curriculum.", cta: "Go to Curriculum", href: "/admin/curricula" },
      },
      class: {
        stats: [{ label: "Planned", value: 2, hint: "", tone: "neutral" }],
        rows: [{ id: "cl1", title: "Robotics Mon", subtitle: "Ages 12–14", launchDate: "Jul 1, 2026", enrolled: 3, capacity: 12, readinessPct: 60, status: "needs_attention" }],
        totalRows: 1,
        recommendation: { text: "Finish the launch checklist for 1 class.", cta: "Go to Class Launch", href: "/admin/classes" },
      },
    },
    chapter: { id: "ch1", name: "Test Chapter", location: "City, ST", lifecycleStatus: "LAUNCHING", lifecycleLabel: "Launching", president: { id: "u1", name: "CP" } },
    weekNumber: 5,
  } as unknown as ChapterOperatingSystem;
  return os;
}

const emptySc = summarizeStudentCommunity({ enrollments: [], attendance: [], feedback: [], concerns: [] }, new Date("2026-06-24T12:00:00Z"));
const noBaselineGrowth = summarizeChapterGrowth({
  weekNumber: 5,
  current: { weekStartISO: "2026-06-22", weekNumber: 5, values: { confirmedPartners: 1 } },
  previous: null,
});

describe("buildChapterRooms", () => {
  it("returns all six rooms in canonical order", () => {
    const rooms = buildChapterRooms(makeOs(), emptySc, noBaselineGrowth);
    expect(rooms.map((r) => r.key)).toEqual([...ROOM_KEYS]);
    expect(rooms).toHaveLength(6);
  });

  it("gives every room a mission, question, status, evidence, needs source, and next action", () => {
    const rooms = buildChapterRooms(makeOs(), emptySc, noBaselineGrowth);
    for (const room of rooms) {
      expect(room.title.length).toBeGreaterThan(0);
      expect(room.mission.length).toBeGreaterThan(0);
      expect(room.question).toMatch(/\?$/);
      expect(room.status.label.length).toBeGreaterThan(0);
      expect(room.evidence.columns.length).toBeGreaterThanOrEqual(5);
      expect(room.evidence.columns[room.evidence.columns.length - 1]).toBe("Status");
      expect(room.nextAction.text.length).toBeGreaterThan(0);
      expect(room.nextAction.href.length).toBeGreaterThan(0);
      expect(Array.isArray(room.needs)).toBe(true);
    }
  });

  it("routes blockers into the matching room's Needs You", () => {
    const rooms = buildChapterRooms(makeOs(), emptySc, noBaselineGrowth);
    const partner = rooms.find((r) => r.key === "partner_network")!;
    const teaching = rooms.find((r) => r.key === "teaching_org")!;
    expect(partner.needs.some((n) => n.entityId === "p1")).toBe(true);
    expect(teaching.needs.some((n) => n.severity === "critical")).toBe(true);
    // Each need is attributed to its room for the shared feed.
    expect(partner.needs.every((n) => n.roomKey === "partner_network")).toBe(true);
  });

  it("introduces no fake data in the new rooms when none was collected", () => {
    const rooms = buildChapterRooms(makeOs(), emptySc, noBaselineGrowth);
    const student = rooms.find((r) => r.key === "student_community")!;
    const growth = rooms.find((r) => r.key === "chapter_growth")!;
    expect(student.status.label).toBe("No Data Yet");
    expect(student.evidence.rows).toHaveLength(0);
    expect(student.evidence.emptyMessage).toMatch(/No attendance or feedback/);
    expect(growth.status.label).toBe("No Baseline Yet");
  });

  it("is deterministic", () => {
    const a = buildChapterRooms(makeOs(), emptySc, noBaselineGrowth);
    const b = buildChapterRooms(makeOs(), emptySc, noBaselineGrowth);
    expect(a).toEqual(b);
  });
});

describe("collectNeedsYou", () => {
  it("aggregates room needs into one severity-sorted feed", () => {
    const rooms = buildChapterRooms(makeOs(), emptySc, noBaselineGrowth);
    const feed = collectNeedsYou(rooms);
    expect(feed.length).toBeGreaterThanOrEqual(2);
    // Critical sorts ahead of warning.
    expect(feed[0].severity).toBe("critical");
  });
});
