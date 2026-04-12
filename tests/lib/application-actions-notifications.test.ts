import { beforeEach, describe, expect, it, vi } from "vitest";

const createSystemNotification = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    decision: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    analyticsEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  assertAdminOrChapterLead: vi.fn(),
  assertCanMakeChapterDecision: vi.fn(),
  assertCanManageHiringInterviews: vi.fn(),
  assertCanManagePosition: vi.fn(),
  getHiringActor: vi.fn(),
  isAdmin: vi.fn(),
  isDesignatedInterviewer: vi.fn(),
}));

vi.mock("@/lib/notification-actions", () => ({
  createSystemNotification,
}));

vi.mock("@/lib/email", () => ({
  sendApplicationStatusEmail: vi.fn(),
  sendNotificationEmail: vi.fn(),
}));

vi.mock("@/lib/hiring-decision-utils", () => ({
  getHiringChairStatus: vi.fn(),
  isHiringDecisionApproved: vi.fn(() => false),
  isHiringDecisionPending: vi.fn(() => true),
  isHiringDecisionReturned: vi.fn(() => false),
}));

vi.mock("@/lib/application-schemas", () => ({
  jobApplicationSchema: {},
}));

describe("application action notification policies", () => {
  beforeEach(() => {
    vi.resetModules();
    createSystemNotification.mockReset();
  });

  it("routes returned hiring decisions through the application decision SMS policy", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    prismaMock.decision.findUnique.mockResolvedValue({
      id: "decision-1",
      decidedById: "reviewer-1",
      accepted: true,
      applicationId: "application-1",
      application: {
        applicant: {
          name: "Jordan Patel",
        },
        position: {
          chapterId: "chapter-1",
          type: "INSTRUCTOR",
        },
      },
    });
    prismaMock.decision.update.mockResolvedValue({});
    prismaMock.analyticsEvent.create.mockResolvedValue({});

    const { returnHiringDecision } = await import("@/lib/application-actions");
    await returnHiringDecision("decision-1", "chair-1", "Please add more detail.");

    expect(createSystemNotification).toHaveBeenCalledWith(
      "reviewer-1",
      "SYSTEM",
      "Hiring Decision Returned",
      expect.stringContaining("Please add more detail."),
      "/applications/application-1",
      { policyKey: "APPLICATION_DECISIONS" }
    );
  });
});
