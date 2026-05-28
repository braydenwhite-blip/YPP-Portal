import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  offeredFindMany,
  offeredUpdateMany,
  offeredUpdate,
  gateApplicantEmail,
  sendChoiceReminder,
  sendInterviewReminder,
} = vi.hoisted(() => ({
  offeredFindMany: vi.fn(),
  offeredUpdateMany: vi.fn(),
  offeredUpdate: vi.fn(),
  gateApplicantEmail: vi.fn(),
  sendChoiceReminder: vi.fn(),
  sendInterviewReminder: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    offeredInterviewSlot: {
      findMany: offeredFindMany,
      updateMany: offeredUpdateMany,
      update: offeredUpdate,
    },
  },
}));

vi.mock("@/lib/portal-auth-utils", () => ({
  getBaseUrl: vi.fn(async () => "https://portal.test"),
}));

vi.mock("@/lib/applicant-email-gating", () => ({
  gateApplicantEmail,
}));

vi.mock("@/lib/email", () => ({
  sendInterviewChoiceReminderEmail: sendChoiceReminder,
  sendInstructorInterviewReminderEmail: sendInterviewReminder,
}));

describe("processInstructorInterviewReminders", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    gateApplicantEmail.mockImplementation(async (input: { send: () => Promise<unknown> }) => ({
      sent: true,
      result: await input.send(),
    }));
    sendChoiceReminder.mockResolvedValue({ success: true });
    sendInterviewReminder.mockResolvedValue({ success: true });
    offeredUpdateMany.mockResolvedValue({ count: 3 });
    offeredUpdate.mockResolvedValue({});
  });

  it("sends pending-choice reminders and marks the offered slots", async () => {
    const now = new Date("2026-05-28T16:00:00.000Z");
    const oldCreatedAt = new Date("2026-05-27T12:00:00.000Z");
    const firstChoice = {
      id: "slot-1",
      instructorApplicationId: "app-1",
      scheduledAt: new Date("2026-05-30T16:00:00.000Z"),
      durationMinutes: 60,
      createdAt: oldCreatedAt,
      instructorApplication: {
        id: "app-1",
        source: "PORTAL",
        applicationTrack: "STANDARD_INSTRUCTOR",
        applicant: { name: "Ada Applicant", email: "ada@example.com" },
      },
    };
    const secondChoice = {
      ...firstChoice,
      id: "slot-2",
      scheduledAt: new Date("2026-05-31T16:00:00.000Z"),
    };
    const thirdChoice = {
      ...firstChoice,
      id: "slot-3",
      scheduledAt: new Date("2026-06-01T16:00:00.000Z"),
    };
    offeredFindMany
      .mockResolvedValueOnce([firstChoice, secondChoice, thirdChoice])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { processInstructorInterviewReminders } = await import(
      "@/lib/instructor-interview-reminders"
    );
    const result = await processInstructorInterviewReminders(now);

    expect(sendChoiceReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@example.com",
        applicantName: "Ada Applicant",
        statusUrl: "https://portal.test/application-status",
      })
    );
    expect(offeredUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ instructorApplicationId: "app-1" }),
        data: { choiceReminderSentAt: now },
      })
    );
    expect(result.choiceReminders).toBe(1);
  });

  it("sends confirmed interview reminders to applicant and interviewer", async () => {
    const now = new Date("2026-05-28T16:00:00.000Z");
    const confirmedSlot = {
      id: "slot-confirmed",
      scheduledAt: new Date("2026-05-29T15:00:00.000Z"),
      durationMinutes: 60,
      meetingUrl: "Room 204",
      offeredBy: { id: "lead-1", name: "Lead Interviewer", email: "lead@example.com" },
      instructorApplication: {
        id: "app-1",
        source: "PORTAL",
        applicationTrack: "STANDARD_INSTRUCTOR",
        interviewRound: 1,
        applicant: { name: "Ada Applicant", email: "ada@example.com" },
        interviewerAssignments: [
          {
            round: 1,
            interviewer: { id: "lead-1", name: "Lead Interviewer", email: "lead@example.com" },
          },
        ],
      },
    };
    offeredFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([confirmedSlot])
      .mockResolvedValueOnce([]);

    const { processInstructorInterviewReminders } = await import(
      "@/lib/instructor-interview-reminders"
    );
    const result = await processInstructorInterviewReminders(now);

    expect(sendInterviewReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@example.com",
        role: "applicant",
        meetingDetails: "Room 204",
        windowLabel: "24-hour",
      })
    );
    expect(sendInterviewReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lead@example.com",
        role: "interviewer",
        meetingDetails: "Room 204",
        windowLabel: "24-hour",
      })
    );
    expect(offeredUpdate).toHaveBeenCalledWith({
      where: { id: "slot-confirmed" },
      data: { reminder24SentAt: now },
    });
    expect(result.reminder24).toBe(1);
  });
});
