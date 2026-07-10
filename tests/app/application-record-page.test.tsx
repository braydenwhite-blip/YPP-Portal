import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const mockRequireApplicationReviewerPage = vi.fn();
const mockLoadApplicationRecord = vi.fn();
const mockGetHiringActor = vi.fn();
const mockAssertCanViewApplicant = vi.fn();
const mockCanSeeChairQueue = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("@/lib/page-guards", () => ({
  requireApplicationReviewerPage: mockRequireApplicationReviewerPage,
}));

vi.mock("@/lib/applications/application-record", () => ({
  loadApplicationRecord: mockLoadApplicationRecord,
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  assertCanViewApplicant: mockAssertCanViewApplicant,
  canSeeChairQueue: mockCanSeeChairQueue,
  getHiringActor: mockGetHiringActor,
}));

vi.mock("@/lib/instructor-applicant-board-queries", () => ({
  getApplicationForWorkspace: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/active-chair", () => ({
  getActiveChair: vi.fn().mockResolvedValue(null),
  canMakeFinalApplicantDecision: vi.fn().mockReturnValue(false),
  NON_CHAIR_DECISION_MESSAGE:
    "Only the currently assigned Chair can submit the final decision.",
}));

vi.mock("@/components/instructor-applicants/WorkspaceChairDecisionPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/ui-v2", () => ({
  ButtonLink: () => null,
  Checklist: () => null,
  DecisionDock: () => null,
  EntityChip: () => null,
  KeyFactsGrid: () => null,
  ProfileHeader: () => null,
  RecordSection: () => null,
  StatusBadge: () => null,
}));

function applicationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    applicant: {
      id: "applicant-1",
      name: "Applicant One",
      email: "applicant@example.com",
      primaryRole: "APPLICANT",
      chapterId: "chapter-1",
      chapterName: "Chapter One",
    },
    reviewer: { id: "reviewer-1", name: "Reviewer One" },
    interviewRound: 2,
    interviewerAssignments: [
      {
        id: "assignment-1",
        role: "LEAD",
        round: 2,
        interviewer: { id: "interviewer-1", name: "Interviewer One" },
      },
    ],
    ...overrides,
  };
}

describe("ApplicationRecordPage permissions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireApplicationReviewerPage.mockResolvedValue({
      id: "chapter-president-1",
      roles: ["CHAPTER_PRESIDENT"],
      primaryRole: "CHAPTER_PRESIDENT",
      adminSubtypes: [],
    });
    mockLoadApplicationRecord.mockResolvedValue(applicationRecord());
    mockGetHiringActor.mockResolvedValue({
      id: "chapter-president-1",
      chapterId: "other-chapter",
      roles: ["CHAPTER_PRESIDENT"],
      featureKeys: new Set<string>(),
    });
    mockCanSeeChairQueue.mockReturnValue(false);
  });

  it("404s when the per-record applicant guard fails", async () => {
    mockAssertCanViewApplicant.mockImplementation(() => {
      throw new Error("Chapter Presidents can only view applicants in their own chapter.");
    });

    const { default: ApplicationRecordPage } = await import(
      "@/app/(app)/admin/instructor-applicants/[id]/page"
    );

    await expect(
      ApplicationRecordPage({ params: Promise.resolve({ id: "app-1" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockAssertCanViewApplicant).toHaveBeenCalledWith(
      expect.objectContaining({ id: "chapter-president-1" }),
      {
        id: "app-1",
        applicantId: "applicant-1",
        reviewerId: "reviewer-1",
        interviewRound: 2,
        applicantChapterId: "chapter-1",
        interviewerAssignments: [
          { interviewerId: "interviewer-1", round: 2, removedAt: null },
        ],
      }
    );
    expect(mockNotFound).toHaveBeenCalled();
  });
});
