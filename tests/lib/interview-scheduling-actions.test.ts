import { beforeEach, describe, expect, it, vi } from "vitest";

const createSystemNotification = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    interviewSchedulingRequest: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notification-actions", () => ({
  createSystemNotification,
}));

vi.mock("@/lib/interview-scheduling-shared", () => ({
  ACTIVE_INTERVIEW_REQUEST_STATUSES: ["REQUESTED", "BOOKED", "RESCHEDULE_REQUESTED"],
  generateInterviewSlots: vi.fn(),
  getInterviewRequestAgeBase: vi.fn(),
  isInterviewRequestAtRisk: vi.fn(() => true),
  rangesOverlap: vi.fn(),
}));

vi.mock("@/lib/feature-gates", () => ({
  getEnabledFeatureKeysForUser: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendApplicationStatusEmail: vi.fn(),
  sendNotificationEmail: vi.fn(),
}));

describe("interview scheduling notification policies", () => {
  beforeEach(() => {
    vi.resetModules();
    createSystemNotification.mockReset();
  });

  it("routes reminder automation through the interview update SMS policy", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    prismaMock.interviewSchedulingRequest.findMany
      .mockResolvedValueOnce([
        {
          id: "request-1",
          intervieweeId: "student-1",
          interviewerId: "reviewer-1",
          scheduledAt: new Date("2026-04-13T14:00:00.000Z"),
          interviewee: { id: "student-1", name: "Jordan Patel", email: "student@example.com" },
          interviewer: { id: "reviewer-1", name: "Pat Reviewer", email: "reviewer@example.com" },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.interviewSchedulingRequest.update.mockResolvedValue({});

    const { runInterviewAutomation } = await import("@/lib/interview-scheduling-actions");
    await runInterviewAutomation();

    expect(createSystemNotification).toHaveBeenNthCalledWith(
      1,
      "student-1",
      "SYSTEM",
      "Interview tomorrow",
      expect.stringContaining("Pat Reviewer"),
      "/interviews/schedule",
      { policyKey: "INTERVIEW_UPDATES" }
    );
    expect(createSystemNotification).toHaveBeenNthCalledWith(
      2,
      "reviewer-1",
      "SYSTEM",
      "Interview tomorrow",
      expect.stringContaining("Jordan Patel"),
      "/interviews/schedule",
      { policyKey: "INTERVIEW_UPDATES" }
    );
  });
});
