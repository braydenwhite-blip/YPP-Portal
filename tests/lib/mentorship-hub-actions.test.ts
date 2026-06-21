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

vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/people-strategy/action-items-actions", () => ({
  createActionItem: vi.fn(),
}));

vi.mock("@/lib/help-agent/search-indexing", () => ({
  syncActionSearchDocument: vi.fn(),
}));

vi.mock("@/lib/people-strategy/action-emails", () => ({
  notifyNewActionAssignments: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  createMentorshipSession,
  createMentorshipActionItem,
  createMentorshipNextStep,
  promoteMentorshipResponseToResource,
  respondToMentorshipRequest,
  setMentorTag,
  markKickoffComplete,
  updateMentorshipActionItemStatus,
} from "@/lib/mentorship-hub-actions";
import { getMentorshipRoleFlags } from "@/lib/mentorship-hub";
import { hasMentorshipMenteeAccess } from "@/lib/mentorship-access";
import { syncActionSearchDocument } from "@/lib/help-agent/search-indexing";

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
      findUnique: vi.fn(),
      update: vi.fn(),
    };
    (prisma as any).actionItem = {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    (prisma as any).actionComment = {
      create: vi.fn(),
    };
    (prisma as any).mentorshipSession = {
      create: vi.fn(),
      findUnique: vi.fn(),
    };
    (prisma as any).mentorship.findFirst = vi.fn();
    (prisma as any).mentorship.findUnique = vi.fn();
    (prisma as any).mentorship.update = vi.fn();
    (prisma as any).$transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        actionItem: {
          create: (prisma as any).actionItem.create,
          update: (prisma as any).actionItem.update,
        },
        mentorshipActionItem: {
          update: (prisma as any).mentorshipActionItem.update,
        },
        actionComment: {
          create: (prisma as any).actionComment.create,
        },
      })
    );
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

  it("routes an ACTIVE relationship to a canonical ActionItem, never the legacy table", async () => {
    const active = {
      id: "mentorship-1",
      mentorId: "mentor-2",
      menteeId: "student-1",
      chairId: null,
      status: "ACTIVE",
      circleMembers: [{ userId: "mentor-2", role: "PRIMARY_MENTOR" }],
    };
    // getActiveMentorshipContext + the next-step authorization both read mentorship.
    (prisma as any).mentorship.findFirst = vi.fn().mockResolvedValue(active);
    (prisma as any).mentorship.findUnique.mockResolvedValue(active);
    (prisma as any).actionItem.findFirst.mockResolvedValue(null);
    (prisma as any).actionItem.create.mockResolvedValue({ id: "action-1" });

    const formData = new FormData();
    formData.set("menteeId", "student-1");
    formData.set("title", "Draft the project outline");
    formData.set("ownerId", "student-1");

    await createMentorshipActionItem(formData);

    // Canonical write happened; the pre-assignment legacy write did NOT.
    expect((prisma as any).actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          relatedEntityType: "MENTORSHIP",
          relatedEntityId: "mentorship-1",
        }),
      })
    );
    expect((prisma as any).mentorshipActionItem.create).not.toHaveBeenCalled();
  });

  it("allows the assigned mentor to create a canonical next step", async () => {
    (prisma as any).mentorship.findUnique.mockResolvedValue({
      id: "mentorship-1",
      mentorId: "mentor-2",
      menteeId: "student-1",
      chairId: null,
      status: "ACTIVE",
      circleMembers: [{ userId: "mentor-2", role: "PRIMARY_MENTOR" }],
    });
    (prisma as any).actionItem.findFirst.mockResolvedValue(null);
    (prisma as any).actionItem.create.mockResolvedValue({ id: "action-1" });

    const formData = new FormData();
    formData.set("mentorshipId", "mentorship-1");
    formData.set("title", "Draft the project outline");
    formData.set("ownerId", "student-1");

    await expect(createMentorshipNextStep(formData)).resolves.toEqual({
      id: "action-1",
      created: true,
    });
    expect((prisma as any).actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          relatedEntityType: "MENTORSHIP",
          relatedEntityId: "mentorship-1",
          leadId: "student-1",
          visibility: "ALL_LEADERSHIP",
          assignments: {
            create: [
              { userId: "student-1", role: "LEAD" },
              { userId: "student-1", role: "EXECUTING" },
            ],
          },
        }),
      })
    );
    expect(syncActionSearchDocument).toHaveBeenCalledWith("action-1");
  });

  it("rejects a generic mentor who is not on the relationship", async () => {
    (prisma as any).mentorship.findUnique.mockResolvedValue({
      id: "mentorship-1",
      mentorId: "someone-else",
      menteeId: "student-1",
      chairId: null,
      status: "ACTIVE",
      circleMembers: [],
    });
    vi.mocked(hasMentorshipMenteeAccess).mockResolvedValue(false);

    const formData = new FormData();
    formData.set("mentorshipId", "mentorship-1");
    formData.set("title", "Draft the project outline");
    formData.set("ownerId", "student-1");

    await expect(createMentorshipNextStep(formData)).rejects.toThrow("Unauthorized");
    expect((prisma as any).actionItem.create).not.toHaveBeenCalled();
  });

  it("lets an assigned mentee complete their canonical mentorship next step", async () => {
    (prisma as any).actionItem.findFirst.mockResolvedValue({
      id: "action-1",
      leadId: "student-1",
      createdById: "mentor-2",
      visibility: "ALL_LEADERSHIP",
      status: "NOT_STARTED",
      relatedEntityId: "mentorship-1",
      assignments: [{ userId: "student-1", role: "EXECUTING" }],
    });
    (prisma as any).mentorship.findUnique.mockResolvedValue({
      menteeId: "student-1",
    });
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "student-1",
        roles: ["STUDENT"],
      },
    } as any);

    const formData = new FormData();
    formData.set("itemId", "action-1");
    formData.set("status", "COMPLETE");

    await updateMentorshipActionItemStatus(formData);

    expect((prisma as any).actionItem.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: expect.objectContaining({
        status: "COMPLETE",
        completedAt: expect.any(Date),
      }),
    });
    expect((prisma as any).actionComment.create).toHaveBeenCalled();
  });

  it("does not let a mentee complete an officer-only mentorship action", async () => {
    (prisma as any).actionItem.findFirst.mockResolvedValue({
      id: "action-1",
      leadId: "student-1",
      createdById: "mentor-2",
      visibility: "OFFICERS_ONLY",
      status: "NOT_STARTED",
      relatedEntityId: "mentorship-1",
      assignments: [{ userId: "student-1", role: "EXECUTING" }],
    });
    (prisma as any).mentorship.findUnique.mockResolvedValue({
      id: "mentorship-1",
      mentorId: "mentor-2",
      menteeId: "student-1",
      chairId: null,
      status: "ACTIVE",
      circleMembers: [],
    });
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "student-1",
        roles: ["STUDENT"],
      },
    } as any);

    const formData = new FormData();
    formData.set("itemId", "action-1");
    formData.set("status", "COMPLETE");

    await expect(updateMentorshipActionItemStatus(formData)).rejects.toThrow("Unauthorized");
    expect((prisma as any).actionItem.update).not.toHaveBeenCalled();
  });

  it("syncs kickoff milestones when a completed kickoff session is logged", async () => {
    (prisma as any).mentorship.findFirst.mockResolvedValue({
      id: "mentorship-1",
      menteeId: "student-1",
      kickoffScheduledAt: null,
      kickoffCompletedAt: null,
      circleMembers: [
        { userId: "mentor-2", role: "PRIMARY_MENTOR" },
        { userId: "student-1", role: "PEER_SUPPORT" },
      ],
    });
    (prisma as any).mentorshipSession.create.mockResolvedValue({
      id: "session-1",
    });
    (prisma as any).mentorship.update.mockResolvedValue({
      id: "mentorship-1",
    });

    const formData = new FormData();
    formData.set("menteeId", "student-1");
    formData.set("type", "KICKOFF");
    formData.set("title", "Kickoff");
    formData.set("scheduledAt", "2026-04-02T16:00:00.000Z");
    formData.set("completedNow", "true");

    await createMentorshipSession(formData);

    expect((prisma as any).mentorshipSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mentorshipId: "mentorship-1",
        type: "KICKOFF",
        completedAt: new Date("2026-04-02T16:00:00.000Z"),
      }),
    });
    expect((prisma as any).mentorship.update).toHaveBeenCalledWith({
      where: { id: "mentorship-1" },
      data: {
        kickoffScheduledAt: new Date("2026-04-02T16:00:00.000Z"),
        kickoffCompletedAt: new Date("2026-04-02T16:00:00.000Z"),
      },
    });
  });

  it("blocks setMentorTag when caller is not the mentor or chair on the pairing", async () => {
    (prisma as any).mentorship.findUnique = vi.fn().mockResolvedValue({
      mentorId: "someone-else",
      chairId: "chair-x",
    });

    await expect(setMentorTag("mentorship-99", "FOLLOW_UP_NEEDED" as any))
      .rejects.toThrow("Unauthorized");

    expect((prisma as any).mentorship.update).not.toHaveBeenCalled();
  });

  it("allows setMentorTag when caller is the mentor on the pairing", async () => {
    (prisma as any).mentorship.findUnique = vi.fn().mockResolvedValue({
      mentorId: "mentor-2",
      chairId: null,
    });
    (prisma as any).mentorship.update.mockResolvedValue({ id: "mentorship-9" });

    await expect(
      setMentorTag("mentorship-9", "OUTSTANDING_PERFORMANCE" as any)
    ).resolves.toBeUndefined();

    expect((prisma as any).mentorship.update).toHaveBeenCalledWith({
      where: { id: "mentorship-9" },
      data: { mentorTag: "OUTSTANDING_PERFORMANCE" },
    });
  });

  it("allows setMentorTag when caller is admin even if not the assigned mentor", async () => {
    vi.mocked(getMentorshipRoleFlags).mockReturnValueOnce({
      isAdmin: true,
      isChapterLead: false,
      isStudent: false,
      isMentor: true,
      canSupport: true,
    });
    (prisma as any).mentorship.update.mockResolvedValue({ id: "mentorship-9" });

    await expect(
      setMentorTag("mentorship-9", null)
    ).resolves.toBeUndefined();

    expect((prisma as any).mentorship.update).toHaveBeenCalled();
  });

  it("blocks markKickoffComplete when caller is not mentor or chair on the pairing", async () => {
    (prisma as any).mentorship.findUnique = vi.fn().mockResolvedValue({
      mentorId: "someone-else",
      chairId: "chair-x",
    });

    await expect(
      markKickoffComplete("mentorship-77", "Notes")
    ).rejects.toThrow("Unauthorized");

    expect((prisma as any).mentorship.update).not.toHaveBeenCalled();
  });

  it("allows markKickoffComplete when caller is the mentor on the pairing", async () => {
    (prisma as any).mentorship.findUnique = vi.fn().mockResolvedValue({
      mentorId: "mentor-2",
      chairId: null,
    });
    (prisma as any).mentorship.update.mockResolvedValue({ id: "mentorship-77" });

    await expect(
      markKickoffComplete("mentorship-77")
    ).resolves.toBeUndefined();

    expect((prisma as any).mentorship.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mentorship-77" },
        data: expect.objectContaining({
          cycleStage: "REFLECTION_DUE",
        }),
      })
    );
  });

  it("allows markKickoffComplete when caller is admin even if not the assigned mentor", async () => {
    vi.mocked(getMentorshipRoleFlags).mockReturnValueOnce({
      isAdmin: true,
      isChapterLead: false,
      isStudent: false,
      isMentor: true,
      canSupport: true,
    });
    (prisma as any).mentorship.update.mockResolvedValue({ id: "mentorship-77" });

    await expect(
      markKickoffComplete("mentorship-77")
    ).resolves.toBeUndefined();

    expect((prisma as any).mentorship.update).toHaveBeenCalled();
  });
});
