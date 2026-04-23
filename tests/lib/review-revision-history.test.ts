/**
 * Tests for review revision history (WS5).
 *
 * Scenarios covered:
 *   1. Saving a DRAFT review does NOT create a revision row
 *   2. Submitting for the first time (no prior submittedAt) does NOT create a revision
 *   3. Editing an already-SUBMITTED review with a changed summary → creates revision row
 *   4. Editing an already-SUBMITTED review with NO meaningful change → no revision row
 *   5. Revision row captures correct reviewId, editedById, and previous summary snapshot
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Shared mock handles ───────────────────────────────────────────────────────

const mockFindUniqueApp = vi.fn();
const mockFindUniqueReview = vi.fn();
const mockAppUpdate = vi.fn();
const mockRevisionCreate = vi.fn();
const mockReviewUpsert = vi.fn();
const mockCategoryDeleteMany = vi.fn();
const mockCategoryCreateMany = vi.fn();
const mockReviewUpdateMany = vi.fn();
const mockInterviewReviewUpdateMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findUnique: mockFindUniqueApp,
      update: mockAppUpdate,
    },
    instructorApplicationReview: {
      findUnique: mockFindUniqueReview,
      updateMany: mockReviewUpdateMany,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: vi.fn(),
  isAdmin: vi.fn(() => true),
  isChapterLead: vi.fn(() => false),
  isAssignedInterviewer: vi.fn(() => false),
}));

vi.mock("@/lib/instructor-application-actions", () => ({
  approveInstructorApplication: vi.fn(),
  holdInstructorApplication: vi.fn(),
  markInstructorApplicationUnderReview: vi.fn(),
  markInterviewCompleted: vi.fn(),
  rejectInstructorApplication: vi.fn(),
  requestMoreInfo: vi.fn(),
  scheduleInterview: vi.fn(),
}));

vi.mock("@/lib/instructor-interview-actions", () => ({
  maybeAutoAdvanceAfterInterviewReview: vi.fn(async () => false),
}));

vi.mock("@/lib/workflow", () => ({
  syncInstructorApplicationWorkflow: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendReviewerAssignedEmail: vi.fn(),
  sendApplicationApprovedEmail: vi.fn(),
  sendApplicationRejectedEmail: vi.fn(),
  sendInfoRequestEmail: vi.fn(),
  sendChairDecisionEmail: vi.fn(),
  sendInterviewScheduledEmail: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wire mockTransaction to run the callback with a fake tx client. */
function setupTransaction() {
  const txRevisionCreate = vi.fn().mockResolvedValue({});
  const txReviewUpsert = vi.fn().mockResolvedValue({ id: "review-1" });
  const txCategoryDeleteMany = vi.fn().mockResolvedValue({});
  const txCategoryCreateMany = vi.fn().mockResolvedValue({});
  const txReviewUpdateMany = vi.fn().mockResolvedValue({});
  const txInterviewUpdateMany = vi.fn().mockResolvedValue({});

  mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      instructorApplicationReviewRevision: { create: txRevisionCreate },
      instructorApplicationReview: {
        upsert: txReviewUpsert,
        updateMany: txReviewUpdateMany,
      },
      instructorApplicationReviewCategory: {
        deleteMany: txCategoryDeleteMany,
        createMany: txCategoryCreateMany,
      },
      instructorInterviewReview: { updateMany: txInterviewUpdateMany },
    };
    return fn(tx);
  });

  return {
    txRevisionCreate,
    txReviewUpsert,
    txCategoryDeleteMany,
    txCategoryCreateMany,
    txReviewUpdateMany,
    txInterviewUpdateMany,
  };
}

/** Build a minimal application object the action expects. */
function makeApplication(overrides: Partial<{
  id: string;
  status: string;
  reviewerId: string | null;
  interviewRound: number;
  applicantId: string;
}> = {}) {
  return {
    id: overrides.id ?? "app-1",
    status: overrides.status ?? "UNDER_REVIEW",
    reviewerId: overrides.reviewerId ?? "reviewer-1",
    interviewRound: overrides.interviewRound ?? 1,
    applicantId: "applicant-1",
    applicant: {
      id: "applicant-1",
      name: "Test Applicant",
      email: "applicant@test.com",
      phone: null,
      chapterId: "chapter-1",
      chapter: { id: "chapter-1", name: "Test Chapter" },
    },
    reviewer: { id: "reviewer-1", name: "Reviewer One" },
    interviewerAssignments: [],
    customResponses: [],
    courseIdea: "Test course idea",
    courseOutline: "Test outline",
    firstClassPlan: "Test first class",
  };
}

/** Build a minimal admin actor. */
function makeAdminActor(id = "reviewer-1") {
  return {
    id,
    chapterId: "chapter-1",
    roles: ["ADMIN"],
    featureKeys: new Set<string>(),
  };
}

/** The four categories required for INSTRUCTOR_INITIAL_REVIEW_SIGNALS. */
const REQUIRED_CATEGORIES = [
  { category: "CURRICULUM_STRENGTH", rating: "ON_TRACK", notes: "Good" },
  { category: "RELATIONSHIP_BUILDING", rating: "ON_TRACK", notes: "Good" },
  { category: "ORGANIZATION_AND_COMMITMENT", rating: "ON_TRACK", notes: "Good" },
  { category: "LONG_TERM_POTENTIAL", rating: "ON_TRACK", notes: "Good" },
];

/** Build FormData for saveInstructorApplicationReviewAction. */
function makeFormData(opts: {
  intent?: "submit" | "save";
  summary?: string;
  notes?: string;
  concerns?: string;
  nextStep?: string;
  categories?: Array<{ category: string; rating: string; notes: string }>;
  applicationId?: string;
}) {
  const fd = new FormData();
  fd.set("applicationId", opts.applicationId ?? "app-1");
  fd.set("returnTo", "/review");
  fd.set("intent", opts.intent ?? "submit");
  fd.set("summary", opts.summary ?? "Good candidate");
  fd.set("notes", opts.notes ?? "");
  fd.set("concerns", opts.concerns ?? "");
  fd.set("applicantMessage", "");
  fd.set("flagForLeadership", "false");
  // Default to HOLD to avoid the "lead interviewer required" guard on MOVE_TO_INTERVIEW
  fd.set("nextStep", opts.nextStep ?? "HOLD");
  fd.set(
    "categoriesJson",
    JSON.stringify(opts.categories ?? REQUIRED_CATEGORIES)
  );
  return fd;
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe("saveInstructorApplicationReviewAction — revision history", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();

    // Default auth setup: admin session
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "reviewer-1", roles: ["ADMIN"], email: "admin@test.com" },
    } as never);

    const { getHiringActor, isAdmin } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue(makeAdminActor("reviewer-1"));
    vi.mocked(isAdmin).mockReturnValue(true);

    mockFindUniqueApp.mockResolvedValue(makeApplication());
  });

  it("saving a DRAFT review does not create a revision row", async () => {
    // Existing review is a DRAFT (no submittedAt)
    mockFindUniqueReview.mockResolvedValueOnce({
      id: "review-1",
      status: "DRAFT",
      submittedAt: null,
      summary: "Old summary",
      notes: null,
      concerns: null,
      nextStep: null,
      categories: [],
    });

    const { txRevisionCreate } = setupTransaction();

    const { saveInstructorApplicationReviewAction } = await import(
      "@/lib/instructor-review-actions"
    );

    await saveInstructorApplicationReviewAction(
      makeFormData({ intent: "save", nextStep: "" })
    );

    expect(txRevisionCreate).not.toHaveBeenCalled();
  });

  it("first-time submission (no prior submittedAt) does NOT create a revision row", async () => {
    // No existing review at all (new review)
    mockFindUniqueReview.mockResolvedValueOnce(null);

    const { txRevisionCreate } = setupTransaction();

    const { saveInstructorApplicationReviewAction } = await import(
      "@/lib/instructor-review-actions"
    );

    await saveInstructorApplicationReviewAction(makeFormData({ intent: "submit" }));

    expect(txRevisionCreate).not.toHaveBeenCalled();
  });

  it("first submission with pre-existing DRAFT (no submittedAt) does NOT create a revision row", async () => {
    // Existing review is a DRAFT (not yet submitted)
    mockFindUniqueReview.mockResolvedValueOnce({
      id: "review-1",
      status: "DRAFT",
      submittedAt: null,
      summary: "Draft text",
      notes: null,
      concerns: null,
      nextStep: null,
      categories: [],
    });

    const { txRevisionCreate } = setupTransaction();

    const { saveInstructorApplicationReviewAction } = await import(
      "@/lib/instructor-review-actions"
    );

    await saveInstructorApplicationReviewAction(makeFormData({ intent: "submit" }));

    expect(txRevisionCreate).not.toHaveBeenCalled();
  });

  it("editing an already-SUBMITTED review with a changed summary creates a revision row", async () => {
    const previousSummary = "Old summary before edit";
    mockFindUniqueReview.mockResolvedValueOnce({
      id: "review-1",
      status: "SUBMITTED",
      submittedAt: new Date("2026-04-20T10:00:00Z"),
      summary: previousSummary,
      notes: null,
      concerns: null,
      nextStep: "HOLD",
      categories: REQUIRED_CATEGORIES.map((c) => ({
        category: c.category,
        rating: c.rating,
        notes: c.notes,
      })),
    });

    const { txRevisionCreate, txReviewUpsert } = setupTransaction();

    const { saveInstructorApplicationReviewAction } = await import(
      "@/lib/instructor-review-actions"
    );

    await saveInstructorApplicationReviewAction(
      makeFormData({ intent: "submit", summary: "Updated summary after edit" })
    );

    // A revision row must have been created with the PREVIOUS state
    expect(txRevisionCreate).toHaveBeenCalledTimes(1);
    expect(txRevisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewId: "review-1",
          editedById: "reviewer-1",
          summary: previousSummary,
          nextStep: "HOLD",
        }),
      })
    );

    // The review upsert should also have been called (the update still happens)
    expect(txReviewUpsert).toHaveBeenCalledTimes(1);
  });

  it("editing an already-SUBMITTED review with NO meaningful change does NOT create a revision row", async () => {
    // Existing submitted review with exact same field values as incoming
    const sharedSummary = "Same summary unchanged";
    const sharedCategories = REQUIRED_CATEGORIES.map((c) => ({
      category: c.category,
      rating: c.rating,
      notes: c.notes,
    }));

    mockFindUniqueReview.mockResolvedValueOnce({
      id: "review-1",
      status: "SUBMITTED",
      submittedAt: new Date("2026-04-20T10:00:00Z"),
      summary: sharedSummary,
      notes: null,
      concerns: null,
      nextStep: "HOLD",
      categories: sharedCategories,
    });

    const { txRevisionCreate } = setupTransaction();

    const { saveInstructorApplicationReviewAction } = await import(
      "@/lib/instructor-review-actions"
    );

    await saveInstructorApplicationReviewAction(
      makeFormData({
        intent: "submit",
        summary: sharedSummary,
        nextStep: "HOLD",
        categories: REQUIRED_CATEGORIES,
      })
    );

    expect(txRevisionCreate).not.toHaveBeenCalled();
  });

  it("revision row captures correct reviewId, editedById, and previous field snapshot", async () => {
    const previousState = {
      id: "review-42",
      status: "SUBMITTED",
      submittedAt: new Date("2026-04-21T09:00:00Z"),
      summary: "Original summary",
      notes: "Original notes",
      concerns: null,
      nextStep: "HOLD",
      categories: [
        { category: "CURRICULUM_STRENGTH", rating: "GETTING_STARTED", notes: "Needs work" },
        { category: "RELATIONSHIP_BUILDING", rating: "ON_TRACK", notes: "Good" },
        { category: "ORGANIZATION_AND_COMMITMENT", rating: "ON_TRACK", notes: "Fine" },
        { category: "LONG_TERM_POTENTIAL", rating: "BEHIND_SCHEDULE", notes: "Concern" },
      ],
    };

    // Act as a different admin
    const { getHiringActor, isAdmin } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue(makeAdminActor("admin-2"));
    vi.mocked(isAdmin).mockReturnValue(true);

    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-2", roles: ["ADMIN"], email: "admin2@test.com" },
    } as never);

    mockFindUniqueApp.mockResolvedValue(makeApplication({ reviewerId: "admin-2" }));
    mockFindUniqueReview.mockResolvedValueOnce(previousState);

    const { txRevisionCreate } = setupTransaction();

    const { saveInstructorApplicationReviewAction } = await import(
      "@/lib/instructor-review-actions"
    );

    await saveInstructorApplicationReviewAction(
      makeFormData({
        intent: "submit",
        summary: "Revised summary",
        notes: "Updated notes",
        nextStep: "HOLD",
      })
    );

    expect(txRevisionCreate).toHaveBeenCalledTimes(1);

    const callArgs = txRevisionCreate.mock.calls[0][0];
    expect(callArgs.data).toMatchObject({
      reviewId: "review-42",
      editedById: "admin-2",
      summary: "Original summary",
      notes: "Original notes",
      concerns: null,
      nextStep: "HOLD",
    });
    // categoriesSnapshot should be an array with the four previous category entries
    expect(Array.isArray(callArgs.data.categoriesSnapshot)).toBe(true);
    expect(callArgs.data.categoriesSnapshot).toHaveLength(4);
    expect(callArgs.data.categoriesSnapshot[0]).toMatchObject({
      category: "CURRICULUM_STRENGTH",
      rating: "GETTING_STARTED",
    });
  });
});
