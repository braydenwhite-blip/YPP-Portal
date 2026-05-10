import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userAdminSubtype: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendNewApplicationNotification: vi.fn(),
  sendApplicationApprovedEmail: vi.fn(),
  sendApplicationRejectedEmail: vi.fn(),
  sendInfoRequestEmail: vi.fn(),
  sendChairDecisionEmail: vi.fn(),
  sendInterviewScheduledEmail: vi.fn(),
  sendPickYourTimeEmail: vi.fn(),
  sendInterviewConfirmedEmail: vi.fn(),
  sendInstructorPreApprovedEmail: vi.fn(),
  sendReviewerAssignedEmail: vi.fn(),
  sendInterviewerAssignedEmail: vi.fn(),
  sendInterviewTimesDeclinedEmail: vi.fn(),
  sendChairReviewQueuedEmail: vi.fn(),
  generateIcsContent: vi.fn(() => "ICS"),
}));

vi.mock("@/lib/portal-auth-utils", () => ({
  getBaseUrl: vi.fn(async () => "https://portal.test"),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/workflow", () => ({
  syncInstructorApplicationWorkflow: vi.fn(),
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: vi.fn(),
  assertCanActAsChair: vi.fn(),
  assertCanAssignInterviewers: vi.fn(),
  assertCanManageApplication: vi.fn(),
  isAdmin: vi.fn(() => false),
  isHiringChair: vi.fn(() => false),
}));

vi.mock("@/lib/telemetry", () => ({
  recordTelemetryEvent: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { sendNewApplicationNotification } from "@/lib/email";
import { notifyReviewersOfNewApplication } from "@/lib/instructor-application-actions";

const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const userFindMany = prisma.user.findMany as unknown as ReturnType<typeof vi.fn>;
const subtypeFindFirst = prisma.userAdminSubtype.findFirst as unknown as ReturnType<typeof vi.fn>;
const sendMock = sendNewApplicationNotification as unknown as ReturnType<typeof vi.fn>;

describe("notifyReviewersOfNewApplication", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    userFindMany.mockReset();
    subtypeFindFirst.mockReset();
    sendMock.mockReset();
  });

  it("includes every active HIRING_CHAIR user and the HIRING_ADMIN owner", async () => {
    userFindUnique.mockResolvedValueOnce({
      name: "Alex Rivera",
      email: "alex@example.com",
      chapterId: "chap-1",
    });

    // CP query (first findMany) — chapter presidents
    userFindMany
      .mockResolvedValueOnce([
        { email: "cp1@example.com" },
        { email: "cp2@example.com" },
      ])
      // Hiring chairs (second findMany)
      .mockResolvedValueOnce([
        { email: "chair1@example.com" },
        { email: "chair2@example.com" },
      ]);

    subtypeFindFirst.mockResolvedValueOnce({
      user: { email: "hiring-admin@example.com" },
    });

    await notifyReviewersOfNewApplication("user-1");

    // The HIRING_CHAIR query must filter by role + archivedAt: null
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roles: { some: { role: "HIRING_CHAIR" } },
          archivedAt: null,
        }),
        select: { email: true },
      })
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.applicantName).toBe("Alex Rivera");
    expect(new Set(call.to)).toEqual(
      new Set([
        "cp1@example.com",
        "cp2@example.com",
        "chair1@example.com",
        "chair2@example.com",
        "hiring-admin@example.com",
      ])
    );
  });

  it("dedupes when a HIRING_CHAIR is also the HIRING_ADMIN default owner", async () => {
    userFindUnique.mockResolvedValueOnce({
      name: "Alex Rivera",
      email: "alex@example.com",
      chapterId: null,
    });

    userFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: "shared@example.com" }]);
    subtypeFindFirst.mockResolvedValueOnce({
      user: { email: "shared@example.com" },
    });

    await notifyReviewersOfNewApplication("user-1");

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toEqual(["shared@example.com"]);
  });

  it("still sends when only HIRING_CHAIR users exist (no HIRING_ADMIN owner)", async () => {
    userFindUnique.mockResolvedValueOnce({
      name: "Alex Rivera",
      email: "alex@example.com",
      chapterId: null,
    });

    userFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: "chair@example.com" }]);
    subtypeFindFirst.mockResolvedValueOnce(null);

    await notifyReviewersOfNewApplication("user-1");

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toEqual(["chair@example.com"]);
  });

  it("does not send when no recipients are found", async () => {
    userFindUnique.mockResolvedValueOnce({
      name: "Alex Rivera",
      email: "alex@example.com",
      chapterId: null,
    });

    userFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    subtypeFindFirst.mockResolvedValueOnce(null);

    await notifyReviewersOfNewApplication("user-1");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
