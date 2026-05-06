import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn();
const mockRevalidatePath = vi.fn();
const mockGetSession = vi.fn();
const mockGetHiringActor = vi.fn();
const mockFindApplication = vi.fn();
const mockFindCurriculumDrafts = vi.fn();
const mockFindExistingInterviewReview = vi.fn();
const mockTransaction = vi.fn();
const mockMaybeAutoAdvanceAfterInterviewReview = vi.fn();
const mockMarkInterviewCompleted = vi.fn();
const mockApproveInstructorApplication = vi.fn();
const mockHoldInstructorApplication = vi.fn();
const mockRejectInstructorApplication = vi.fn();
const mockSendToChair = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findUnique: mockFindApplication,
    },
    curriculumDraft: {
      findMany: mockFindCurriculumDrafts,
    },
    instructorInterviewReview: {
      findUnique: mockFindExistingInterviewReview,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: mockGetHiringActor,
  isAdmin: (actor: { roles: string[] }) => actor.roles.includes("ADMIN"),
  isChapterLead: (actor: { roles: string[] }) => actor.roles.includes("CHAPTER_PRESIDENT"),
  isAssignedInterviewer: (
    actor: { id: string },
    application: {
      interviewRound?: number | null;
      interviewerAssignments: Array<{
        interviewerId: string;
        round?: number | null;
        removedAt: Date | null;
      }>;
    }
  ) => {
    const currentRound = application.interviewRound ?? 1;
    return application.interviewerAssignments.some(
      (assignment) =>
        assignment.interviewerId === actor.id &&
        !assignment.removedAt &&
        (assignment.round == null || assignment.round === currentRound)
    );
  },
}));

vi.mock("@/lib/instructor-application-actions", () => ({
  approveInstructorApplication: mockApproveInstructorApplication,
  holdInstructorApplication: mockHoldInstructorApplication,
  markInstructorApplicationUnderReview: vi.fn(),
  markInterviewCompleted: mockMarkInterviewCompleted,
  rejectInstructorApplication: mockRejectInstructorApplication,
  requestMoreInfo: vi.fn(),
  scheduleInterview: vi.fn(),
  sendToChair: mockSendToChair,
}));

vi.mock("@/lib/instructor-interview-actions", () => ({
  maybeAutoAdvanceAfterInterviewReview: mockMaybeAutoAdvanceAfterInterviewReview,
}));

function buildApplication(overrides?: {
  interviewerAssignments?: Array<{
    interviewerId: string;
    round?: number | null;
    role?: "LEAD" | "SECOND";
    removedAt?: Date | null;
  }>;
}) {
  return {
    id: "app-1",
    applicantId: "applicant-1",
    reviewerId: "reviewer-1",
    interviewRound: 1,
    status: "INTERVIEW_SCHEDULED",
    applicant: {
      id: "applicant-1",
      name: "Applicant One",
      email: "applicant@test.com",
      phone: null,
      chapterId: "chapter-1",
      chapter: { id: "chapter-1", name: "Chapter One" },
    },
    reviewer: { id: "reviewer-1", name: "Reviewer One" },
    interviewerAssignments:
      overrides?.interviewerAssignments?.map((assignment) => ({
        interviewerId: assignment.interviewerId,
        round: assignment.round ?? 1,
        role: assignment.role ?? "LEAD",
        removedAt: assignment.removedAt ?? null,
      })) ?? [],
    customResponses: [],
  };
}

async function buildSubmitFormData() {
  const { INSTRUCTOR_REVIEW_CATEGORIES } = await import("@/lib/instructor-review-config");

  const formData = new FormData();
  formData.set("applicationId", "app-1");
  formData.set("returnTo", "/applications/instructor/app-1");
  formData.set("intent", "submit");
  formData.set("overallRating", "ON_TRACK");
  formData.set("recommendation", "ACCEPT");
  formData.set("summary", "Strong interview with clear teaching signals.");
  formData.set("overallNotes", "Candidate handled follow-ups well.");
  formData.set("demeanorNotes", "Warm and calm.");
  formData.set("maturityNotes", "Owned tradeoffs.");
  formData.set("communicationNotes", "Clear examples.");
  formData.set("professionalismNotes", "Prepared and punctual.");
  formData.set("followUpItems", "None.");
  formData.set("curriculumFeedback", "");
  formData.set("revisionRequirements", "");
  formData.set("applicantMessage", "");
  formData.set("curriculumDraftId", "");
  formData.set("flagForLeadership", "false");
  formData.set(
    "categoriesJson",
    JSON.stringify(
      INSTRUCTOR_REVIEW_CATEGORIES.map((category) => ({
        category: category.key,
        rating: "ON_TRACK",
        notes: `${category.label} note`,
      }))
    )
  );
  formData.set(
    "questionResponsesJson",
    JSON.stringify([
      {
        id: null,
        localId: "q-1",
        questionBankId: "qb-1",
        source: "DEFAULT",
        status: "ASKED",
        prompt: "Tell me about a time you adapted a lesson in real time.",
        followUpPrompt: "",
        competency: "Adaptability",
        whyAsked: "We want to hear how the candidate adjusts for students.",
        notes: "Gave a concrete classroom example and explained the reasoning.",
        rating: "ON_TRACK",
        tags: [],
        askedAt: new Date("2026-04-20T12:00:00.000Z").toISOString(),
        skippedAt: null,
        sortOrder: 0,
      },
    ])
  );

  return formData;
}

function installSuccessfulTransactionMock() {
  mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      instructorInterviewReview: {
        upsert: vi.fn().mockResolvedValue({ id: "review-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      instructorInterviewReviewCategory: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 7 }),
      },
      instructorInterviewQuestionResponse: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: "response-1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      instructorApplicationReview: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    return callback(tx);
  });
}

describe("saveInstructorInterviewReviewAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetSession.mockResolvedValue({
      user: { id: "reviewer-1", roles: ["CHAPTER_PRESIDENT"] },
    });
    mockGetHiringActor.mockResolvedValue({
      id: "reviewer-1",
      chapterId: "chapter-1",
      roles: ["CHAPTER_PRESIDENT"],
      featureKeys: new Set<string>(),
    });
    mockFindCurriculumDrafts.mockResolvedValue([]);
    mockFindExistingInterviewReview.mockResolvedValue(null);
    mockMaybeAutoAdvanceAfterInterviewReview.mockResolvedValue(false);
    mockSendToChair.mockResolvedValue({ success: true });
    installSuccessfulTransactionMock();
  });

  it("does not bypass the chair queue while current-round interviewers are still outstanding", async () => {
    mockFindApplication.mockResolvedValue(
      buildApplication({
        interviewerAssignments: [
          { interviewerId: "reviewer-1", role: "LEAD" },
          { interviewerId: "reviewer-2", role: "SECOND" },
        ],
      })
    );

    const formData = await buildSubmitFormData();
    const { saveInstructorInterviewReviewAction } = await import("@/lib/instructor-review-actions");

    await saveInstructorInterviewReviewAction(formData);

    expect(mockMaybeAutoAdvanceAfterInterviewReview).toHaveBeenCalledWith("app-1", "reviewer-1");
    expect(mockMarkInterviewCompleted).not.toHaveBeenCalled();
    expect(mockSendToChair).not.toHaveBeenCalled();
    expect(mockApproveInstructorApplication).not.toHaveBeenCalled();
    expect(mockHoldInstructorApplication).not.toHaveBeenCalled();
    expect(mockRejectInstructorApplication).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/applications/instructor/app-1");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/applications/instructor/app-1?notice=interview-review-submitted"
    );
  });

  it("routes legacy no-assignment interview submissions into the chair queue", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "reviewer-1", roles: ["ADMIN"] },
    });
    mockGetHiringActor.mockResolvedValue({
      id: "reviewer-1",
      chapterId: "chapter-1",
      roles: ["ADMIN"],
      featureKeys: new Set<string>(),
    });
    mockFindApplication.mockResolvedValue(buildApplication());

    const formData = await buildSubmitFormData();
    const { saveInstructorInterviewReviewAction } = await import("@/lib/instructor-review-actions");

    await saveInstructorInterviewReviewAction(formData);

    expect(mockMarkInterviewCompleted).toHaveBeenCalledWith(
      "app-1",
      "reviewer-1",
      "Strong interview with clear teaching signals."
    );
    expect(mockSendToChair).toHaveBeenCalledTimes(1);
    expect(mockApproveInstructorApplication).not.toHaveBeenCalled();
    expect(mockHoldInstructorApplication).not.toHaveBeenCalled();
    expect(mockRejectInstructorApplication).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(
      "/applications/instructor/app-1?notice=interview-review-submitted"
    );
  });
});
