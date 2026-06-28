import { describe, it, expect } from "vitest";
import { buildChapterRooms } from "@/lib/chapters/rooms";
import {
  buildRoomActions,
  withRoomActions,
  SaveSnapshotSchema,
  LogPartnerFollowUpSchema,
} from "@/lib/chapters/room-actions";
import { summarizeStudentCommunity } from "@/lib/chapters/student-community";
import { summarizeChapterGrowth } from "@/lib/chapters/chapter-growth";
import type { ChapterOperatingSystem } from "@/lib/chapters/operating-system";

// Minimal operating-system fixture — only the fields the room + action builders
// read. Cast through unknown so the test stays focused.
function makeOs(): ChapterOperatingSystem {
  return {
    blockers: [
      { key: "partner-followup:p1", lane: "partners", severity: "warning", title: "Lincoln HS: follow-up overdue", detail: "Log a touchpoint.", href: "/partners/p1", suggestedAction: "Follow up", entityType: "PARTNER", entityId: "p1" },
      { key: "applicant-decision:a1", lane: "instructors", severity: "critical", title: "Jordan: decision overdue", detail: "Submit the decision.", href: "/chapter/recruiting?tab=candidates", suggestedAction: "Decide", entityType: "INSTRUCTOR_APPLICATION", entityId: "a1" },
      { key: "applicant-review:a2", lane: "instructors", severity: "warning", title: "Sam: waiting for review", href: "/chapter/recruiting?tab=candidates", suggestedAction: "Review", entityType: "INSTRUCTOR_APPLICATION", entityId: "a2" },
      { key: "curriculum-review:c1", lane: "curriculum", severity: "warning", title: "Robotics: CP review needed", href: "/admin/curricula", suggestedAction: "Review curriculum", entityId: "c1" },
      { key: "class-no-instructor:cl1", lane: "classes", severity: "warning", title: "Robotics Mon: missing an instructor", href: "/admin/classes/cl1", suggestedAction: "Assign instructor", entityType: "CLASS_OFFERING", entityId: "cl1" },
      { key: "class-under-enrolled:cl1", lane: "classes", severity: "warning", title: "Robotics Mon: is under-enrolled", href: "/admin/classes/cl1", suggestedAction: "Boost enrollment", entityType: "CLASS_OFFERING", entityId: "cl1" },
    ],
    blockerSummary: { total: 6, critical: 1, warning: 5, info: 0, byLane: { partners: 1, instructors: 2, curriculum: 1, classes: 2 } },
    partners: { total: 4, confirmed: 1, byStatus: { researching: 1, contacted: 1, interested: 0, meeting_scheduled: 1, final_conversation: 0, confirmed: 1, closed: 0 } },
    instructors: { total: 6, applicants: 6, hired: 2, byStage: { applied: 1, under_review: 2, interview_ready: 0, interview_scheduled: 1, interview_complete: 1, hired: 2, rejected: 0 } },
    curriculum: { total: 3, approved: 1, reviewNeeded: 1, fullyApproved: 1, cpReviewNeeded: 1, cpApproved: 0, globalReviewNeeded: 0, needsRevision: 0, submittedEver: 2, byStatus: { not_submitted: 1, cp_review: 1, cp_revision: 0, cp_approved: 0, global_review: 0, global_revision: 0, fully_approved: 1 } },
    launch: { total: 2, ready: 1 },
    deliberables: {
      partner: { stats: [{ label: "Active", value: 3, hint: "", tone: "neutral" }], rows: [{ id: "p1", name: "Lincoln HS", subtitle: "School", stage: "Contacted", lastContact: "2 days ago", nextStep: "Follow up", status: "at_risk" }], totalRows: 1, recommendation: { text: "Reconnect with 1 at-risk partner.", cta: "Go to Partner Pipeline", href: "/partners" } },
      instructor: { stats: [{ label: "Applicants", value: 6, hint: "", tone: "neutral" }], rows: [{ id: "a1", name: "Jordan", stage: "Interview Complete", applied: "5 days ago", specialties: "Python", status: "at_risk" }], totalRows: 1, recommendation: { text: "Record 1 decision.", cta: "Go to Instructor Pipeline", href: "/chapter/recruiting?tab=candidates" } },
      curriculum: { stats: [{ label: "Approved", value: 1, hint: "", tone: "positive" }], rows: [{ id: "c1", title: "Intro Robotics", subject: "Robotics", stage: "CP Review", actor: "Chapter President", owner: "Sam", status: "needs_feedback" }], totalRows: 1, recommendation: { text: "Give feedback on 1 curriculum.", cta: "Go to Curriculum", href: "/admin/curricula" } },
      class: { stats: [{ label: "Planned", value: 2, hint: "", tone: "neutral" }], rows: [{ id: "cl1", title: "Robotics Mon", subtitle: "Ages 12–14", launchDate: "Jul 1, 2026", enrolled: 3, capacity: 12, readinessPct: 60, status: "needs_attention" }], totalRows: 1, recommendation: { text: "Finish the launch checklist for 1 class.", cta: "Go to Class Launch", href: "/admin/classes" } },
    },
    chapter: { id: "ch1", name: "Test Chapter", location: "City, ST", lifecycleStatus: "LAUNCHING", lifecycleLabel: "Launching", president: { id: "u1", name: "CP" } },
    weekNumber: 5,
  } as unknown as ChapterOperatingSystem;
}

const sc = summarizeStudentCommunity({ enrollments: [], attendance: [], feedback: [], concerns: [] }, new Date("2026-06-24T12:00:00Z"));
const growth = summarizeChapterGrowth({
  weekNumber: 5,
  current: { weekStartISO: "2026-06-22", weekNumber: 5, values: { confirmedPartners: 1 } },
  previous: { weekStartISO: "2026-06-15", weekNumber: 4, values: { confirmedPartners: 0 } },
});

function rooms() {
  return buildChapterRooms(makeOs(), sc, growth);
}
function actionsFor(key: string) {
  const room = rooms().find((r) => r.key === key)!;
  return buildRoomActions(room);
}

describe("buildRoomActions — generation", () => {
  it("gives every room 2–4 actions with exactly one primary and a non-empty href", () => {
    for (const room of rooms()) {
      const actions = buildRoomActions(room);
      expect(actions.length).toBeGreaterThanOrEqual(2);
      expect(actions.length).toBeLessThanOrEqual(4);
      expect(actions.filter((a) => a.primary)).toHaveLength(1);
      for (const a of actions) {
        expect(a.href.length).toBeGreaterThan(0); // fallback href always present
        expect(a.roomActionId.startsWith(room.key)).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    expect(actionsFor("partner_network")).toEqual(actionsFor("partner_network"));
  });
});

describe("Partner Network actions", () => {
  it("offers a direct Log follow-up mutation tied to the partner record", () => {
    const a = actionsFor("partner_network");
    const log = a.find((x) => x.mutation?.handler === "logPartnerFollowUp");
    expect(log).toBeTruthy();
    expect(log!.primary).toBe(true);
    expect(log!.mutation).toMatchObject({ entityType: "PARTNER", entityId: "p1" });
    expect(log!.href).toBe("/partners/p1"); // deep-link fallback
  });

  it("includes a Track action whose blockerKey is the stable need key (idempotent dedup)", () => {
    const track = actionsFor("partner_network").find((x) => x.kind === "track");
    expect(track?.track?.blockerKey).toBe("partner-followup:p1");
    // Regenerating yields the identical key → trackChapterBlocker dedups by sourceId.
    const again = actionsFor("partner_network").find((x) => x.kind === "track");
    expect(again?.track?.blockerKey).toBe(track?.track?.blockerKey);
  });
});

describe("Teaching Organization actions", () => {
  it("surfaces the overdue decision first and deep-links the review flow (no bypass)", () => {
    const a = actionsFor("teaching_org");
    const primary = a.find((x) => x.primary)!;
    expect(primary.label).toBe("Submit decision");
    expect(primary.kind).toBe("link"); // never a direct mutation of the chair flow
    expect(a.some((x) => x.label === "Review applicant")).toBe(true);
  });
});

describe("Learning Program actions (real two-stage curriculum approval)", () => {
  // Focused helper: rebuild the learning room with a single curriculum blocker.
  function learningActionsWith(
    blocker: Record<string, unknown>,
    opts?: { isLeadership?: boolean }
  ) {
    const os = makeOs();
    (os as unknown as { blockers: unknown[] }).blockers = [blocker];
    const room = buildChapterRooms(os, sc, growth).find((r) => r.key === "learning_program")!;
    return buildRoomActions(room, opts);
  }

  it("offers a REAL inline CP-approve mutation (no more disabled global review)", () => {
    const a = actionsFor("learning_program");
    const approve = a.find((x) => x.roomActionId.endsWith(":cp-approve"))!;
    expect(approve.kind).toBe("mutate");
    expect(approve.primary).toBe(true);
    expect(approve.mutation).toMatchObject({
      handler: "cpApproveCurriculum",
      entityType: "CLASS_TEMPLATE",
      entityId: "c1",
    });
    // The Phase-3 honestly-disabled "Soon" action is gone.
    expect(a.every((x) => !x.disabledReason)).toBe(true);
    expect(a.some((x) => x.label === "Request revision")).toBe(true);
  });

  it("enables Send to global review when a curriculum is CP-approved", () => {
    const a = learningActionsWith({
      key: "curriculum-send-global:c2",
      lane: "curriculum",
      severity: "info",
      title: "Robotics: CP approved — send to global review",
      href: "/admin/curricula",
      suggestedAction: "Send to global review",
      entityId: "c2",
    });
    const send = a.find((x) => x.roomActionId.endsWith(":send-global"))!;
    expect(send.kind).toBe("mutate");
    expect(send.mutation).toMatchObject({ handler: "sendCurriculumToGlobalReview", entityId: "c2" });
  });

  it("shows global review as watch-only to a CP, and as real mutations to leadership", () => {
    const globalBlocker = {
      key: "curriculum-global-review:c3",
      lane: "curriculum",
      severity: "info",
      title: "Robotics: awaiting global review",
      href: "/admin/curricula",
      suggestedAction: "Global review",
      entityId: "c3",
    };
    // CP viewer: no global mutation, just a watch link.
    const cpView = learningActionsWith(globalBlocker);
    expect(cpView.some((x) => x.mutation?.handler === "globalApproveCurriculum")).toBe(false);
    expect(cpView.some((x) => x.roomActionId.endsWith(":global-status"))).toBe(true);
    // Leadership viewer: real approve + send-back mutations.
    const leadView = learningActionsWith(globalBlocker, { isLeadership: true });
    expect(leadView.find((x) => x.roomActionId.endsWith(":global-approve"))?.mutation).toMatchObject({
      handler: "globalApproveCurriculum",
      entityId: "c3",
    });
    expect(leadView.find((x) => x.roomActionId.endsWith(":global-revision"))?.mutation).toMatchObject({
      handler: "globalRequestCurriculumRevision",
      entityId: "c3",
    });
  });
});

describe("Live Classes actions", () => {
  it("deep-links concrete launch-gap fixes to the class record", () => {
    const a = actionsFor("live_classes");
    const fix = a.find((x) => x.roomActionId.endsWith(":instructor") || x.roomActionId.endsWith(":enroll"));
    expect(fix).toBeTruthy();
    expect(fix!.href).toBe("/admin/classes/cl1");
  });
});

describe("Student Community actions", () => {
  it("offers attendance, feedback, and a records link", () => {
    const a = actionsFor("student_community");
    expect(a.some((x) => x.label === "Open attendance" && x.href === "/attendance")).toBe(true);
    expect(a.some((x) => x.label === "Collect feedback")).toBe(true);
  });
});

describe("Chapter Growth actions", () => {
  it("makes Save snapshot the primary direct mutation", () => {
    const a = actionsFor("chapter_growth");
    const save = a.find((x) => x.mutation?.handler === "saveKpiSnapshot")!;
    expect(save.primary).toBe(true);
    expect(save.label).toBe("Save snapshot");
    expect(a.some((x) => x.href === "/my-weekly-impact")).toBe(true);
  });
});

describe("withRoomActions", () => {
  it("attaches actions to all six rooms", () => {
    const withActions = withRoomActions(rooms());
    expect(withActions).toHaveLength(6);
    expect(withActions.every((r) => Array.isArray(r.actions) && r.actions.length >= 2)).toBe(true);
  });
});

describe("action input schemas", () => {
  it("SaveSnapshotSchema requires a chapterId", () => {
    expect(SaveSnapshotSchema.safeParse({ chapterId: "ch1" }).success).toBe(true);
    expect(SaveSnapshotSchema.safeParse({}).success).toBe(false);
  });

  it("LogPartnerFollowUpSchema validates the follow-up payload shape", () => {
    expect(
      LogPartnerFollowUpSchema.safeParse({ chapterId: "ch1", partnerId: "p1", note: "Called the school" }).success
    ).toBe(true);
    // optional ISO next follow-up date accepted
    expect(
      LogPartnerFollowUpSchema.safeParse({ chapterId: "ch1", partnerId: "p1", note: "x", nextFollowUpAt: "2026-07-01T00:00:00.000Z" }).success
    ).toBe(true);
    // missing required fields rejected
    expect(LogPartnerFollowUpSchema.safeParse({ chapterId: "ch1", note: "x" }).success).toBe(false);
    expect(LogPartnerFollowUpSchema.safeParse({ chapterId: "ch1", partnerId: "p1", note: "" }).success).toBe(false);
    // bad date rejected
    expect(
      LogPartnerFollowUpSchema.safeParse({ chapterId: "ch1", partnerId: "p1", note: "x", nextFollowUpAt: "soon" }).success
    ).toBe(false);
  });
});
