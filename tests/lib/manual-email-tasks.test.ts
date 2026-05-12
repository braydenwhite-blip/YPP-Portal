/**
 * Behavior tests for lib/manual-email-tasks.ts.
 *
 * The contract under test:
 *   - listManualEmailTasksForInstructorApplication returns a serialized DTO
 *   - addManualEmailTaskForInstructorApplication renders a default template
 *     when subject/body are omitted
 *   - updateManualEmailTaskStatus stamps markedSentAt + markedSentById on
 *     the SENT transition, and clears them when reset to PENDING
 *   - deleteManualEmailTask is admin/CP/HC only
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = { user: { id: "admin-1", roles: ["ADMIN"] } } as const;
const unauthorizedSessionMock = { user: { id: "joe", roles: ["STUDENT"] } } as const;

const {
  getSessionMock,
  findUniqueApp,
  createTask,
  findUniqueTask,
  updateTask,
  findManyTask,
  deleteTask,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  findUniqueApp: vi.fn(),
  createTask: vi.fn(),
  findUniqueTask: vi.fn(),
  updateTask: vi.fn(),
  findManyTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findUnique: findUniqueApp,
    },
    manualEmailTask: {
      findUnique: findUniqueTask,
      findMany: findManyTask,
      create: createTask,
      update: updateTask,
      delete: deleteTask,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  addManualEmailTaskForInstructorApplication,
  deleteManualEmailTask,
  listManualEmailTasksForInstructorApplication,
  updateManualEmailTaskStatus,
} from "@/lib/manual-email-tasks";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue(sessionMock);
});

describe("listManualEmailTasksForInstructorApplication", () => {
  it("serializes Prisma rows into the DTO shape", async () => {
    const now = new Date("2026-05-11T20:00:00.000Z");
    findManyTask.mockResolvedValue([
      {
        id: "t1",
        kind: "APPLICATION_CONFIRMATION",
        status: "PENDING",
        suggestedSubject: "Subj",
        suggestedBody: "Body",
        notes: null,
        markedSentAt: null,
        markedSentBy: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "t2",
        kind: "ACCEPTANCE",
        status: "SENT",
        suggestedSubject: "Welcome",
        suggestedBody: "Body 2",
        notes: "Sent via Gmail",
        markedSentAt: now,
        markedSentBy: { id: "u-2", name: "Admin Two" },
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await listManualEmailTasksForInstructorApplication("app-1");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "t1",
      kind: "APPLICATION_CONFIRMATION",
      status: "PENDING",
      suggestedSubject: "Subj",
      suggestedBody: "Body",
      notes: null,
      markedSentAt: null,
      markedSentBy: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(result[1].status).toBe("SENT");
    expect(result[1].markedSentBy?.name).toBe("Admin Two");
    expect(result[1].markedSentAt).toBe(now.toISOString());
  });
});

describe("addManualEmailTaskForInstructorApplication", () => {
  it("renders a default template when subject/body are omitted", async () => {
    findUniqueApp.mockResolvedValue({
      id: "app-1",
      applicationTrack: "STANDARD_INSTRUCTOR",
      applicant: { name: "Ada" },
    });
    createTask.mockResolvedValue({ id: "task-1" });

    await addManualEmailTaskForInstructorApplication({
      applicationId: "app-1",
      kind: "INTERVIEW_INVITATION",
    });

    expect(createTask).toHaveBeenCalledTimes(1);
    const data = createTask.mock.calls[0][0].data;
    expect(data.kind).toBe("INTERVIEW_INVITATION");
    expect(data.instructorApplicationId).toBe("app-1");
    expect(data.suggestedSubject).toContain("interview invitation");
    expect(data.suggestedBody).toContain("Ada");
    expect(data.createdById).toBe("admin-1");
  });

  it("uses 'Summer Workshop Instructor' label for the summer track", async () => {
    findUniqueApp.mockResolvedValue({
      id: "app-1",
      applicationTrack: "SUMMER_WORKSHOP_INSTRUCTOR",
      applicant: { name: "Ada" },
    });
    createTask.mockResolvedValue({ id: "task-1" });

    await addManualEmailTaskForInstructorApplication({
      applicationId: "app-1",
      kind: "ACCEPTANCE",
    });
    const data = createTask.mock.calls[0][0].data;
    expect(data.suggestedSubject).toContain("Summer Workshop Instructor");
  });

  it("rejects unknown applicationId", async () => {
    findUniqueApp.mockResolvedValue(null);
    await expect(
      addManualEmailTaskForInstructorApplication({
        applicationId: "missing",
        kind: "ACCEPTANCE",
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("updateManualEmailTaskStatus", () => {
  it("stamps markedSentAt + markedSentById on the SENT transition", async () => {
    findUniqueTask.mockResolvedValue({
      id: "t1",
      instructorApplicationId: "app-1",
      chapterPresidentApplicationId: null,
      genericApplicationId: null,
    });

    const result = await updateManualEmailTaskStatus({
      taskId: "t1",
      status: "SENT",
    });

    expect(result.ok).toBe(true);
    expect(updateTask).toHaveBeenCalledTimes(1);
    const data = updateTask.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
    expect(data.markedSentAt).toBeInstanceOf(Date);
    expect(data.markedSentById).toBe("admin-1");
  });

  it("clears markedSent fields when transitioning back to PENDING", async () => {
    findUniqueTask.mockResolvedValue({
      id: "t1",
      instructorApplicationId: "app-1",
      chapterPresidentApplicationId: null,
      genericApplicationId: null,
    });

    await updateManualEmailTaskStatus({ taskId: "t1", status: "PENDING" });

    const data = updateTask.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
    expect(data.markedSentAt).toBeNull();
    expect(data.markedSentById).toBeNull();
  });

  it("leaves markedSent fields untouched on NOT_NEEDED / HANDLED_EXTERNALLY", async () => {
    findUniqueTask.mockResolvedValue({
      id: "t1",
      instructorApplicationId: "app-1",
      chapterPresidentApplicationId: null,
      genericApplicationId: null,
    });

    await updateManualEmailTaskStatus({ taskId: "t1", status: "NOT_NEEDED" });
    let data = updateTask.mock.calls[0][0].data;
    expect(data.status).toBe("NOT_NEEDED");
    expect(data.markedSentAt).toBeUndefined();
    expect(data.markedSentById).toBeUndefined();

    updateTask.mockClear();

    await updateManualEmailTaskStatus({ taskId: "t1", status: "HANDLED_EXTERNALLY" });
    data = updateTask.mock.calls[0][0].data;
    expect(data.status).toBe("HANDLED_EXTERNALLY");
    expect(data.markedSentAt).toBeUndefined();
    expect(data.markedSentById).toBeUndefined();
  });

  it("returns error for unknown task", async () => {
    findUniqueTask.mockResolvedValue(null);
    const result = await updateManualEmailTaskStatus({
      taskId: "missing",
      status: "SENT",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/);
  });

  it("rejects unauthorized callers via the returned error envelope", async () => {
    getSessionMock.mockResolvedValue(unauthorizedSessionMock);
    const result = await updateManualEmailTaskStatus({
      taskId: "t1",
      status: "SENT",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Unauthorized/);
  });
});

describe("deleteManualEmailTask", () => {
  it("deletes the task when caller is authorized", async () => {
    findUniqueTask.mockResolvedValue({ id: "t1", instructorApplicationId: "app-1" });
    deleteTask.mockResolvedValue({});
    const result = await deleteManualEmailTask("t1");
    expect(result.ok).toBe(true);
    expect(deleteTask).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("returns error envelope when caller is not admin/CP/HC", async () => {
    getSessionMock.mockResolvedValue(unauthorizedSessionMock);
    const result = await deleteManualEmailTask("t1");
    expect(result.ok).toBe(false);
    expect(deleteTask).not.toHaveBeenCalled();
  });
});
