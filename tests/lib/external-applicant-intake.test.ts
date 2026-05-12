/**
 * Behavior-level tests for lib/external-applicant-intake.ts.
 *
 * We mock prisma + session helpers, then assert that the public action
 * (createExternalInstructorApplicant) wires through the right defaults:
 *   - source stamped on the InstructorApplication
 *   - stub User created when the email is unknown
 *   - existing User reused when the email is already on file
 *   - permission rejection for non-admin / non-CP callers
 *   - Chapter President scope is enforced
 *   - default ManualEmailTask is seeded
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = { user: { id: "admin-1", roles: ["ADMIN"] } } as const;
const cpSessionMock = { user: { id: "cp-1", roles: ["CHAPTER_PRESIDENT"] } } as const;
const unauthorizedSessionMock = { user: { id: "joe", roles: ["STUDENT"] } } as const;

// ─── Mocks (hoisted so vi.mock factories can reference them) ─────────────────

const {
  getSessionMock,
  findUniqueUser,
  createUser,
  updateUser,
  findFirstReviewer,
  createInstructorApplication,
  findManualEmailTaskFirst,
  createManualEmailTask,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  findUniqueUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  findFirstReviewer: vi.fn(),
  createInstructorApplication: vi.fn(),
  findManualEmailTaskFirst: vi.fn(),
  createManualEmailTask: vi.fn(),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueUser,
      findFirst: findFirstReviewer,
      create: createUser,
      update: updateUser,
    },
    instructorApplication: {
      create: createInstructorApplication,
    },
    manualEmailTask: {
      findFirst: findManualEmailTaskFirst,
      create: createManualEmailTask,
    },
  },
}));

vi.mock("@/lib/instructor-application-defaults", () => ({
  findDefaultInitialReviewerForChapter: vi.fn(async () => null),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── Imports under test (after mocks) ────────────────────────────────────────

import { createExternalInstructorApplicant } from "@/lib/external-applicant-intake";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue(sessionMock);
  findUniqueUser.mockResolvedValue(null);
  findFirstReviewer.mockResolvedValue(null);
  createInstructorApplication.mockImplementation(async ({ data }) => ({
    id: "app-1",
    ...data,
  }));
  createUser.mockImplementation(async ({ data }) => ({
    id: "user-1",
    chapterId: data.chapterId ?? null,
    ...data,
  }));
  findManualEmailTaskFirst.mockResolvedValue(null);
  createManualEmailTask.mockResolvedValue({ id: "task-1" });
});

describe("createExternalInstructorApplicant", () => {
  it("rejects when caller is neither ADMIN nor CHAPTER_PRESIDENT", async () => {
    getSessionMock.mockResolvedValue(unauthorizedSessionMock);
    await expect(
      createExternalInstructorApplicant({
        name: "Test",
        email: "test@example.com",
        source: "GOOGLE_FORMS",
      }),
    ).rejects.toThrow(/Unauthorized/);
    expect(createInstructorApplication).not.toHaveBeenCalled();
  });

  it("rejects unknown sources", async () => {
    await expect(
      createExternalInstructorApplicant({
        name: "Test",
        email: "test@example.com",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source: "INVALID" as any,
      }),
    ).rejects.toThrow(/GOOGLE_FORMS or MANUAL_ADMIN_ENTRY/);
  });

  it("rejects missing name / email", async () => {
    await expect(
      createExternalInstructorApplicant({ name: "", email: "x@y.com", source: "GOOGLE_FORMS" }),
    ).rejects.toThrow(/name is required/);
    await expect(
      createExternalInstructorApplicant({ name: "X", email: "", source: "GOOGLE_FORMS" }),
    ).rejects.toThrow(/valid applicant email/);
  });

  it("creates a stub user when email is unknown and stamps source on the application", async () => {
    const result = await createExternalInstructorApplicant({
      name: "Ada Lovelace",
      email: "Ada@Example.com",
      source: "GOOGLE_FORMS",
      externalResponseUrl: "https://forms.example.com/abc",
      externalAnswersCopy: "Q1: yes",
    });

    expect(createUser).toHaveBeenCalledTimes(1);
    const userArgs = createUser.mock.calls[0][0];
    expect(userArgs.data.email).toBe("ada@example.com"); // normalized
    expect(userArgs.data.passwordHash).toBe("IMPORTED");
    expect(userArgs.data.primaryRole).toBe("APPLICANT");

    expect(createInstructorApplication).toHaveBeenCalledTimes(1);
    const appArgs = createInstructorApplication.mock.calls[0][0];
    expect(appArgs.data.source).toBe("GOOGLE_FORMS");
    expect(appArgs.data.importedById).toBe("admin-1");
    expect(appArgs.data.externalResponseUrl).toBe("https://forms.example.com/abc");
    expect(appArgs.data.externalAnswersCopy).toBe("Q1: yes");
    // External submitted date wasn't passed; should be null, not now.
    expect(appArgs.data.externalSubmittedAt).toBeNull();
    expect(appArgs.data.externalImportedAt).toBeInstanceOf(Date);

    expect(result.createdNewUser).toBe(true);
    expect(result.applicationId).toBe("app-1");

    // A default ManualEmailTask (APPLICATION_CONFIRMATION) should be seeded.
    expect(createManualEmailTask).toHaveBeenCalled();
    const taskArgs = createManualEmailTask.mock.calls[0][0];
    expect(taskArgs.data.kind).toBe("APPLICATION_CONFIRMATION");
    expect(taskArgs.data.instructorApplicationId).toBe("app-1");
  });

  it("reuses an existing user when the email is already on file", async () => {
    findUniqueUser.mockResolvedValue({
      id: "existing-user",
      email: "ada@example.com",
      name: "Ada",
      chapterId: null,
    });

    const result = await createExternalInstructorApplicant({
      name: "Ada Lovelace",
      email: "ada@example.com",
      source: "MANUAL_ADMIN_ENTRY",
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(result.createdNewUser).toBe(false);
    expect(createInstructorApplication).toHaveBeenCalled();
    const appArgs = createInstructorApplication.mock.calls[0][0];
    expect(appArgs.data.applicantId).toBe("existing-user");
    expect(appArgs.data.source).toBe("MANUAL_ADMIN_ENTRY");
  });

  it("locks Chapter Presidents into their own chapter", async () => {
    getSessionMock.mockResolvedValue(cpSessionMock);
    findUniqueUser.mockImplementation(async ({ where }) => {
      // First call is "who am I" — returns the chapter; second call is the
      // applicant lookup by email, returning null so we create a stub.
      if (where?.id === "cp-1") return { chapterId: "chap-1" };
      return null;
    });

    await createExternalInstructorApplicant({
      name: "Ada",
      email: "ada@example.com",
      source: "GOOGLE_FORMS",
      // Try to spoof a different chapter — CP should still be locked to chap-1.
      chapterId: "chap-2",
    });

    expect(createUser).toHaveBeenCalled();
    expect(createUser.mock.calls[0][0].data.chapterId).toBe("chap-1");
    expect(createInstructorApplication).toHaveBeenCalled();
  });

  it("blocks Chapter Presidents without a chapter assignment", async () => {
    getSessionMock.mockResolvedValue(cpSessionMock);
    findUniqueUser.mockImplementation(async ({ where }) => {
      if (where?.id === "cp-1") return { chapterId: null };
      return null;
    });

    await expect(
      createExternalInstructorApplicant({
        name: "Ada",
        email: "ada@example.com",
        source: "GOOGLE_FORMS",
      }),
    ).rejects.toThrow(/Chapter Presidents must have a chapter/);
    expect(createInstructorApplication).not.toHaveBeenCalled();
  });

  it("does not seed a duplicate APPLICATION_CONFIRMATION task if one already exists", async () => {
    findManualEmailTaskFirst.mockResolvedValue({ id: "existing-task" });
    await createExternalInstructorApplicant({
      name: "Ada",
      email: "ada@example.com",
      source: "GOOGLE_FORMS",
    });
    expect(createManualEmailTask).not.toHaveBeenCalled();
  });
});
