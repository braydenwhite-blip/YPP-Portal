import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/mentorship-canonical", () => ({
  ensureCanonicalTrack: vi.fn(),
  enforceFullProgramMentorCapacity: vi.fn(),
  getGovernanceModeForProgramGroup: vi.fn(),
  getLegacyMenteeRoleTypeForRole: vi.fn(),
  getMentorshipProgramGroupForRole: vi.fn(),
  getMentorshipTypeForProgramGroup: vi.fn(),
}));

vi.mock("@/lib/mentorship-hub", () => ({
  deriveMentorshipTypeFromRole: vi.fn(),
  getMentorshipRoleFlags: vi.fn(),
}));

vi.mock("@/lib/mentorship-access", () => ({
  getMentorshipAccessibleMenteeIds: vi.fn(),
  hasMentorshipMenteeAccess: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  createMentorshipActionItem,
  promoteMentorshipResponseToResource,
  respondToMentorshipRequest,
} from "@/lib/mentorship-hub-actions";
import { getMentorshipRoleFlags } from "@/lib/mentorship-hub";
import { hasMentorshipMenteeAccess } from "@/lib/mentorship-access";

describe("mentorship-hub-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "mentor-2",
        roles: ["MENTOR"],
      },
    } as any);
    vi.mocked(getMentorshipRoleFlags).mockReturnValue({
      isAdmin: false,
      isChapterLead: false,
      isStudent: false,
      isMentor: true,
      canSupport: true,
    });
    (prisma as any).mentorshipRequest = {
      findUnique: vi.fn(),
      update: vi.fn(),
    };
    (prisma as any).mentorshipRequestResponse = {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    };
    (prisma as any).mentorshipResource = {
      create: vi.fn(),
    };
    (prisma as any).studentIntakeCase = {
      findFirst: vi.fn(),
    };
    (prisma as any).mentorshipActionItem = {
      create: vi.fn(),
    };
    vi.mocked(hasMentorshipMenteeAccess).mockResolvedValue(true);
  });

  it("allows unrelated support-role users to answer public mentorship questions", async () => {
    (prisma as any).mentorshipRequest.findUnique.mockResolvedValue({
      id: "request-1",
      mentorshipId: null,
      menteeId: "student-1",
      trackId: null,
      visibility: "PUBLIC",
      assignedToId: null,
    });
    (prisma as any).mentorshipRequestResponse.create.mockResolvedValue({
      id: "response-1",
      createdAt: new Date("2026-03-20T12:00:00.000Z"),
    });

    const formData = new FormData();
    formData.set("requestId", "request-1");
    formData.set("answer", "Start by tightening the first paragraph.");

    await respondToMentorshipRequest(formData);

    expect((prisma as any).mentorshipRequestResponse.create).toHaveBeenCalled();
    expect((prisma as any).mentorshipRequest.update).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: {
        status: "ANSWERED",
        lastResponseAt: new Date("2026-03-20T12:00:00.000Z"),
      },
    });
  });

  it("blocks promoting private responses into shared resources", async () => {
    (prisma as any).mentorshipRequestResponse.findUnique.mockResolvedValue({
      id: "response-1",
      responderId: "mentor-2",
      body: "Keep going.",
      request: {
        id: "request-1",
        mentorshipId: null,
        menteeId: "student-1",
        trackId: null,
        passionId: null,
        visibility: "PRIVATE",
      },
    });

    const formData = new FormData();
    formData.set("responseId", "response-1");
    formData.set("title", "Helpful answer");

    await expect(
      promoteMentorshipResponseToResource(formData)
    ).rejects.toThrow(
      "Only public mentorship answers can be promoted into shared resources."
    );
    expect((prisma as any).mentorshipResource.create).not.toHaveBeenCalled();
  });

  it("allows action items when a parent-led intake plan has launched before mentor assignment", async () => {
    (prisma as any).mentorship.findFirst = vi.fn().mockResolvedValue(null);
    (prisma as any).studentIntakeCase.findFirst.mockResolvedValue({
      id: "intake-1",
      reviewOwnerId: "lead-1",
    });
    (prisma as any).mentorshipActionItem.create.mockResolvedValue({
      id: "item-1",
      mentorshipId: null,
      menteeId: "student-1",
      title: "Send welcome note",
    });

    const formData = new FormData();
    formData.set("menteeId", "student-1");
    formData.set("title", "Send welcome note");
    formData.set("details", "Share the first next step with the family.");

    await createMentorshipActionItem(formData);

    expect((prisma as any).mentorshipActionItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mentorshipId: null,
        menteeId: "student-1",
        title: "Send welcome note",
        createdById: "mentor-2",
      }),
    });
  });
});
