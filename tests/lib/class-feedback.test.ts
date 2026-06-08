import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authorization from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  summarizeFeedback,
  isGoodFeedback,
  isRepeatRecommendation,
} from "@/lib/class-feedback-constants";
import {
  getClassFeedbackReport,
  getClassFeedbackSummary,
  getMyClassFeedbackPrompts,
} from "@/lib/class-feedback";
import {
  submitClassFeedback,
  submitInstructorReflection,
  setClassAdminOutcome,
} from "@/lib/class-feedback-actions";

vi.mock("@/lib/authorization", () => ({
  requireSessionUser: vi.fn(),
  requireAnyRole: vi.fn(),
}));

function student() {
  return { id: "stu-1", roles: ["STUDENT"], primaryRole: "STUDENT", adminSubtypes: [] };
}
function instructor(id = "ins-1") {
  return { id, roles: ["INSTRUCTOR"], primaryRole: "INSTRUCTOR", adminSubtypes: [] };
}
function admin() {
  return { id: "adm-1", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: [] };
}

function makeForm(entries: Record<string, string | number>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, String(v));
  return fd;
}

const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
});

/* ────────────────────────────────────────────────────────────
 * Pure helpers
 * ──────────────────────────────────────────────────────────── */

describe("summarizeFeedback", () => {
  it("returns a neutral summary for no responses", () => {
    const s = summarizeFeedback([]);
    expect(s.responseCount).toBe(0);
    expect(s.avgRating).toBe(0);
    expect(s.recommendPct).toBeNull();
  });

  it("computes average, distribution, and recommend percentage", () => {
    const s = summarizeFeedback([
      { rating: 5, wouldRecommend: true },
      { rating: 4, wouldRecommend: true },
      { rating: 3, wouldRecommend: false },
      { rating: 5, wouldRecommend: null },
    ]);
    expect(s.responseCount).toBe(4);
    expect(s.avgRating).toBeCloseTo(4.25, 5);
    expect(s.distribution[5]).toBe(2);
    expect(s.distribution[4]).toBe(1);
    expect(s.distribution[3]).toBe(1);
    // 3 answered the recommend question, 2 said yes.
    expect(s.recommendResponses).toBe(3);
    expect(s.recommendCount).toBe(2);
    expect(s.recommendPct).toBeCloseTo(2 / 3, 5);
  });

  it("clamps out-of-range ratings into 1..5", () => {
    const s = summarizeFeedback([
      { rating: 0, wouldRecommend: null },
      { rating: 9, wouldRecommend: null },
    ]);
    expect(s.distribution[1]).toBe(1);
    expect(s.distribution[5]).toBe(1);
    expect(s.avgRating).toBe(3);
  });
});

describe("isGoodFeedback", () => {
  it("is true when an admin flagged it, regardless of ratings", () => {
    expect(isGoodFeedback({ avgRating: 0, responseCount: 0, flagged: true })).toBe(true);
  });
  it("is false below the response threshold", () => {
    expect(isGoodFeedback({ avgRating: 5, responseCount: 1 })).toBe(false);
  });
  it("is false below the rating threshold", () => {
    expect(isGoodFeedback({ avgRating: 3.5, responseCount: 5 })).toBe(false);
  });
  it("is true when ratings and responses both clear the bar", () => {
    expect(isGoodFeedback({ avgRating: 4.2, responseCount: 3 })).toBe(true);
  });
});

describe("isRepeatRecommendation", () => {
  it.each([
    ["REPEAT_AS_IS", true],
    ["REPEAT_WITH_TWEAKS", true],
    ["REPEAT_NEW_INSTRUCTOR", true],
    ["REPEAT_LATER", true],
    ["NEEDS_REWORK", false],
    ["DO_NOT_REPEAT", false],
    ["UNDECIDED", false],
  ] as const)("%s → %s", (value, expected) => {
    expect(isRepeatRecommendation(value)).toBe(expected);
  });
  it("treats null as not-a-repeat", () => {
    expect(isRepeatRecommendation(null)).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────
 * getClassFeedbackReport
 * ──────────────────────────────────────────────────────────── */

describe("getClassFeedbackReport", () => {
  const offerings = [
    { id: "o1", title: "Pottery", status: "COMPLETED", endDate: PAST, instructorName: "Ada", interestArea: "Art" },
    { id: "o2", title: "Chess", status: "COMPLETED", endDate: PAST, instructorName: "Bo", interestArea: "Games" },
    { id: "o3", title: "Robotics", status: "COMPLETED", endDate: PAST, instructorName: "Cy", interestArea: "STEM" },
  ];

  it("ranks good feedback, builds the repeat plan, and flags classes needing an outcome", async () => {
    vi.mocked(prisma.classFeedback.findMany).mockResolvedValue([
      { offeringId: "o1", rating: 5, wouldRecommend: true },
      { offeringId: "o1", rating: 5, wouldRecommend: true },
      { offeringId: "o1", rating: 4, wouldRecommend: true },
      { offeringId: "o2", rating: 2, wouldRecommend: false },
      { offeringId: "o2", rating: 3, wouldRecommend: false },
    ] as any);
    vi.mocked(prisma.classOutcome.findMany).mockResolvedValue([
      { offeringId: "o1", status: "STRONG", repeatRecommendation: "REPEAT_AS_IS", gotGoodFeedback: true },
      { offeringId: "o2", status: "MIXED", repeatRecommendation: "DO_NOT_REPEAT", gotGoodFeedback: false },
    ] as any);

    const report = await getClassFeedbackReport(offerings);

    // o1 has strong ratings → good feedback; o2 does not.
    expect(report.goodFeedback.map((r) => r.offeringId)).toContain("o1");
    expect(report.goodFeedback.map((r) => r.offeringId)).not.toContain("o2");

    // Only o1 carries a "repeat" recommendation.
    expect(report.repeatPlan.map((r) => r.offeringId)).toEqual(["o1"]);

    // o3 is completed with no outcome → needs review.
    expect(report.needsOutcomeReview.map((r) => r.offeringId)).toContain("o3");
    // o2 has a recorded (non-PENDING) outcome → not in the review queue.
    expect(report.needsOutcomeReview.map((r) => r.offeringId)).not.toContain("o2");

    // Program-wide satisfaction across all 5 responses.
    expect(report.totalResponses).toBe(5);
    expect(report.avgRating).toBeCloseTo((5 + 5 + 4 + 2 + 3) / 5, 5);
  });

  it("includes admin-flagged classes that have no student ratings", async () => {
    vi.mocked(prisma.classFeedback.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.classOutcome.findMany).mockResolvedValue([
      { offeringId: "o1", status: "STRONG", repeatRecommendation: null, gotGoodFeedback: true },
    ] as any);

    const report = await getClassFeedbackReport(offerings);
    const flagged = report.goodFeedback.find((r) => r.offeringId === "o1");
    expect(flagged).toBeDefined();
    expect(flagged?.responseCount).toBe(0);
    expect(flagged?.gotGoodFeedbackFlag).toBe(true);
  });

  it("degrades to empty when the feedback table does not exist yet", async () => {
    vi.mocked(prisma.classFeedback.findMany).mockRejectedValue({ code: "P2021" });
    vi.mocked(prisma.classOutcome.findMany).mockRejectedValue({ code: "P2021" });

    const report = await getClassFeedbackReport(offerings);
    expect(report.totalResponses).toBe(0);
    expect(report.goodFeedback).toEqual([]);
    expect(report.repeatPlan).toEqual([]);
  });
});

describe("getClassFeedbackSummary", () => {
  it("returns a neutral summary when the table is missing", async () => {
    vi.mocked(prisma.classFeedback.findMany).mockRejectedValue({ code: "P2021" });
    const s = await getClassFeedbackSummary("o1");
    expect(s.responseCount).toBe(0);
  });

  it("rethrows unexpected errors instead of masking them", async () => {
    vi.mocked(prisma.classFeedback.findMany).mockRejectedValue(new Error("connection reset"));
    await expect(getClassFeedbackSummary("o1")).rejects.toThrow(/connection reset/);
  });
});

describe("getMyClassFeedbackPrompts", () => {
  it("only prompts for ended classes the student has not rated", async () => {
    vi.mocked(prisma.classEnrollment.findMany).mockResolvedValue([
      {
        offeringId: "o1",
        offering: { id: "o1", title: "Pottery", endDate: PAST, instructor: { name: "Ada" }, template: { interestArea: "Art" } },
      },
      {
        offeringId: "o2",
        offering: { id: "o2", title: "Chess", endDate: PAST, instructor: { name: "Bo" }, template: { interestArea: "Games" } },
      },
    ] as any);
    // The student already rated o2.
    vi.mocked(prisma.classFeedback.findMany).mockResolvedValue([{ offeringId: "o2" }] as any);

    const prompts = await getMyClassFeedbackPrompts("stu-1");
    expect(prompts.map((p) => p.offeringId)).toEqual(["o1"]);
    expect(prompts[0].instructorName).toBe("Ada");
  });
});

/* ────────────────────────────────────────────────────────────
 * submitClassFeedback
 * ──────────────────────────────────────────────────────────── */

describe("submitClassFeedback", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireSessionUser).mockResolvedValue(student());
  });

  it("rejects a rating outside 1..5", async () => {
    await expect(
      submitClassFeedback(makeForm({ offeringId: "o1", rating: 6 })),
    ).rejects.toThrow(/1 to 5/);
    expect(prisma.classFeedback.upsert).not.toHaveBeenCalled();
  });

  it("rejects when the student never took the class", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue(null);
    await expect(
      submitClassFeedback(makeForm({ offeringId: "o1", rating: 5 })),
    ).rejects.toThrow(/class you took/);
  });

  it("rejects feedback for a class that has not wrapped up", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      status: "ENROLLED",
      offering: { status: "IN_PROGRESS", endDate: FUTURE },
    } as any);
    await expect(
      submitClassFeedback(makeForm({ offeringId: "o1", rating: 5 })),
    ).rejects.toThrow(/wrapped up/);
  });

  it("rejects a waitlisted enrollment", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      status: "WAITLISTED",
      offering: { status: "COMPLETED", endDate: PAST },
    } as any);
    await expect(
      submitClassFeedback(makeForm({ offeringId: "o1", rating: 5 })),
    ).rejects.toThrow(/class you took/);
  });

  it("upserts feedback for a completed class the student took", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      status: "COMPLETED",
      offering: { status: "COMPLETED", endDate: PAST },
    } as any);
    vi.mocked(prisma.classFeedback.upsert).mockResolvedValue({} as any);

    const fd = makeForm({ offeringId: "o1", rating: 4, liked: "Great pace", improve: "More time" });
    fd.set("wouldRecommend", "yes");
    await submitClassFeedback(fd);

    const call = vi.mocked(prisma.classFeedback.upsert).mock.calls[0][0] as any;
    expect(call.where).toEqual({ offeringId_studentId: { offeringId: "o1", studentId: "stu-1" } });
    expect(call.create).toMatchObject({
      offeringId: "o1",
      studentId: "stu-1",
      rating: 4,
      liked: "Great pace",
      improve: "More time",
      wouldRecommend: true,
    });
  });
});

/* ────────────────────────────────────────────────────────────
 * submitInstructorReflection
 * ──────────────────────────────────────────────────────────── */

describe("submitInstructorReflection", () => {
  it("rejects a non-owner instructor who is not an admin", async () => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(instructor("other"));
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({ instructorId: "ins-1" } as any);
    await expect(
      submitInstructorReflection(makeForm({ offeringId: "o1", wentWell: "good" })),
    ).rejects.toThrow(/instructor/i);
    expect(prisma.classOutcome.upsert).not.toHaveBeenCalled();
  });

  it("rejects an empty reflection", async () => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(instructor("ins-1"));
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({ instructorId: "ins-1" } as any);
    await expect(
      submitInstructorReflection(makeForm({ offeringId: "o1" })),
    ).rejects.toThrow(/at least one note/);
  });

  it("saves the owning instructor's reflection", async () => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(instructor("ins-1"));
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({ instructorId: "ins-1" } as any);
    vi.mocked(prisma.classOutcome.upsert).mockResolvedValue({} as any);

    const fd = makeForm({ offeringId: "o1", wentWell: "Engaged students", challenges: "Pacing" });
    fd.set("wouldTeachAgain", "yes");
    await submitInstructorReflection(fd);

    const call = vi.mocked(prisma.classOutcome.upsert).mock.calls[0][0] as any;
    expect(call.where).toEqual({ offeringId: "o1" });
    expect(call.create).toMatchObject({
      offeringId: "o1",
      instructorId: "ins-1",
      instructorWentWell: "Engaged students",
      instructorChallenges: "Pacing",
      instructorWouldTeachAgain: true,
    });
    expect(call.create.instructorReflectedAt).toBeInstanceOf(Date);
  });
});

/* ────────────────────────────────────────────────────────────
 * setClassAdminOutcome
 * ──────────────────────────────────────────────────────────── */

describe("setClassAdminOutcome", () => {
  it("rejects non-admin callers", async () => {
    vi.mocked(authorization.requireAnyRole).mockRejectedValue(
      new Error("Insufficient role: requires one of ADMIN"),
    );
    await expect(
      setClassAdminOutcome(makeForm({ offeringId: "o1", status: "STRONG" })),
    ).rejects.toThrow(/role/i);
  });

  it("rejects an unknown outcome status", async () => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(admin());
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({ id: "o1" } as any);
    await expect(
      setClassAdminOutcome(makeForm({ offeringId: "o1", status: "BOGUS" })),
    ).rejects.toThrow(/Invalid outcome status/);
  });

  it("upserts the outcome and journals a timeline note", async () => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(admin());
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({ id: "o1" } as any);
    vi.mocked(prisma.classOutcome.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.classOfferingTimelineEvent.create).mockResolvedValue({} as any);

    const fd = makeForm({
      offeringId: "o1",
      status: "STRONG",
      repeatRecommendation: "REPEAT_WITH_TWEAKS",
      adminNotes: "Filled fast",
    });
    fd.set("gotGoodFeedback", "true");
    await setClassAdminOutcome(fd);

    const call = vi.mocked(prisma.classOutcome.upsert).mock.calls[0][0] as any;
    expect(call.create).toMatchObject({
      offeringId: "o1",
      status: "STRONG",
      repeatRecommendation: "REPEAT_WITH_TWEAKS",
      gotGoodFeedback: true,
      adminNotes: "Filled fast",
      recordedById: "adm-1",
    });

    const journal = vi.mocked(prisma.classOfferingTimelineEvent.create).mock.calls[0][0] as any;
    expect(journal.data.kind).toBe("NOTE");
    expect(journal.data.summary).toMatch(/Class outcome/i);
  });

  it("clears the repeat recommendation when left blank", async () => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(admin());
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({ id: "o1" } as any);
    vi.mocked(prisma.classOutcome.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.classOfferingTimelineEvent.create).mockResolvedValue({} as any);

    await setClassAdminOutcome(makeForm({ offeringId: "o1", status: "MIXED" }));
    const call = vi.mocked(prisma.classOutcome.upsert).mock.calls[0][0] as any;
    expect(call.create.repeatRecommendation).toBeNull();
  });
});
