import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn(),
  requireTeachingSessionAccess: vi.fn(),
  canTeachOffering: vi.fn(),
  offeringFindUnique: vi.fn(),
  enrollmentFindUnique: vi.fn(),
  actionFindFirst: vi.fn(),
  actionFindUnique: vi.fn(),
  actionCreate: vi.fn(),
  actionUpdate: vi.fn(),
  commentCreate: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  requireSessionUser: mocks.requireSessionUser,
}));

vi.mock("@/lib/classes/instructor-access", () => ({
  requireTeachingSessionAccess: mocks.requireTeachingSessionAccess,
  canTeachOffering: mocks.canTeachOffering,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    classOffering: { findUnique: mocks.offeringFindUnique },
    classEnrollment: { findUnique: mocks.enrollmentFindUnique },
    actionItem: {
      findFirst: mocks.actionFindFirst,
      findUnique: mocks.actionFindUnique,
      create: mocks.actionCreate,
      update: mocks.actionUpdate,
    },
    actionComment: { create: mocks.commentCreate },
    $transaction: vi.fn(async (items: Promise<unknown>[]) => Promise.all(items)),
  },
}));

import {
  completeInstructorStudentFollowUp,
  flagInstructorStudentFollowUp,
} from "@/lib/classes/student-follow-up-actions";
import { INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX } from "@/lib/classes/student-follow-up";
import { completeAssignedInstructorRequest } from "@/lib/classes/instructor-request-actions";

const viewer = { id: "instructor-1", name: "Taylor", email: "taylor@example.org", roles: ["INSTRUCTOR"] };
const access = {
  viewer,
  classSession: {
    id: "session-1",
    offeringId: "class-1",
    offering: {
      id: "class-1",
      title: "Design for Good",
      chapterId: "chapter-1",
      instructorId: viewer.id,
    },
  },
  assignment: null,
  managesChapter: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSessionUser.mockResolvedValue(viewer);
  mocks.requireTeachingSessionAccess.mockResolvedValue(access);
  mocks.canTeachOffering.mockResolvedValue(true);
  mocks.offeringFindUnique.mockResolvedValue({ title: "Design for Good", chapterId: "chapter-1" });
  mocks.enrollmentFindUnique.mockResolvedValue({ student: { name: "Avery" } });
  mocks.actionFindFirst.mockResolvedValue(null);
  mocks.actionCreate.mockResolvedValue({ id: "follow-up-1" });
  mocks.actionUpdate.mockResolvedValue({});
  mocks.commentCreate.mockResolvedValue({});
});

describe("completeAssignedInstructorRequest", () => {
  it("does not rewrite a request that is already complete", async () => {
    mocks.actionFindUnique.mockResolvedValue({
      id: "request-1",
      status: "COMPLETE",
      leadId: viewer.id,
      visibility: "ALL_LEADERSHIP",
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: "class-1",
      assignments: [],
    });

    await expect(completeAssignedInstructorRequest({
      actionId: "request-1",
      note: "Already completed earlier.",
    })).resolves.toEqual({
      ok: false,
      error: "You do not have access to complete this request",
    });
    expect(mocks.actionUpdate).not.toHaveBeenCalled();
  });
});

describe("flagInstructorStudentFollowUp", () => {
  const input = {
    offeringId: "class-1",
    sessionId: "session-1",
    studentId: "student-1",
    reason: "Check in about the group activity.",
  };

  it("does not read or write a student when the viewer does not teach the class", async () => {
    mocks.canTeachOffering.mockResolvedValue(false);

    await expect(flagInstructorStudentFollowUp(input)).resolves.toEqual({
      ok: false,
      error: "Only an assigned instructor can flag a student follow-up",
    });
    expect(mocks.enrollmentFindUnique).not.toHaveBeenCalled();
    expect(mocks.actionCreate).not.toHaveBeenCalled();
  });

  it("requires the selected student to be enrolled in the same class", async () => {
    mocks.enrollmentFindUnique.mockResolvedValue(null);

    await expect(flagInstructorStudentFollowUp(input)).resolves.toEqual({
      ok: false,
      error: "That student is not connected to this class",
    });
    expect(mocks.actionCreate).not.toHaveBeenCalled();
  });

  it("creates one class-, session-, student-, and instructor-scoped open action", async () => {
    await expect(flagInstructorStudentFollowUp(input)).resolves.toEqual({ ok: true });

    expect(mocks.actionFindFirst).toHaveBeenCalledWith({
      where: {
        sourceId: `${INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX}class-1:session-1:student-1`,
        leadId: viewer.id,
      },
      select: { id: true, status: true },
    });
    expect(mocks.actionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        leadId: viewer.id,
        relatedEntityType: "USER",
        relatedEntityId: "student-1",
        status: "NOT_STARTED",
      }),
    }));
  });
});

describe("completeInstructorStudentFollowUp", () => {
  const input = {
    offeringId: "class-1",
    studentId: "student-1",
    actionId: "follow-up-1",
    attentionKey: "class-1:student-1:requested:follow-up-1",
    reason: "Check in about the group activity.",
    note: "Checked in and agreed on a smaller group role.",
  };

  it("cannot complete a requested action from another class", async () => {
    mocks.actionFindFirst.mockResolvedValue(null);

    await expect(completeInstructorStudentFollowUp(input)).resolves.toEqual({
      ok: false,
      error: "That follow-up is not assigned to you",
    });
    expect(mocks.actionFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "follow-up-1",
        leadId: viewer.id,
        relatedEntityId: "student-1",
        sourceId: {
          startsWith: `${INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX}class-1:`,
        },
      }),
      select: { id: true },
    });
    expect(mocks.actionUpdate).not.toHaveBeenCalled();
  });

  it("completes the same requested action and records its outcome", async () => {
    mocks.actionFindFirst.mockResolvedValue({ id: "follow-up-1" });

    await expect(completeInstructorStudentFollowUp(input)).resolves.toEqual({ ok: true });
    expect(mocks.actionUpdate).toHaveBeenCalledWith({
      where: { id: "follow-up-1" },
      data: expect.objectContaining({
        status: "COMPLETE",
        completionNote: input.note,
      }),
    });
    expect(mocks.commentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ actionItemId: "follow-up-1", authorId: viewer.id }),
    });
  });

  it("scopes a derived attention completion to the same student", async () => {
    const derived = { ...input, actionId: undefined, attentionKey: "derived-key" };
    mocks.actionFindFirst.mockResolvedValue({ id: "derived-action" });

    await completeInstructorStudentFollowUp(derived);

    expect(mocks.actionFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        leadId: viewer.id,
        relatedEntityType: "USER",
        relatedEntityId: "student-1",
      }),
      select: { id: true },
    });
  });
});
