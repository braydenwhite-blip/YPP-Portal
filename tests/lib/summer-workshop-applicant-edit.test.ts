/**
 * Tests for the new workshop-outline branch in
 * `editInstructorApplicationFields`. Covers:
 *  - SW applicants can update their outline before chair review
 *  - invalid outlines are rejected without touching the row
 *  - outline edits on standard applicants are ignored (won't clobber
 *    the JSON column)
 *  - WORKSHOP_OUTLINE_UPDATED audit event fires on change
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindFirst,
  mockUpdate,
  mockTimelineCreate,
  mockTransaction,
  mockGetSession,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockTimelineCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetSession: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    instructorApplicationTimelineEvent: {
      create: mockTimelineCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: mockGetSession,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { editInstructorApplicationFields } from "@/lib/instructor-application-actions";

function makeForm(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

const completeOutlineFields = {
  workshopTitle: "Public Speaking 101",
  workshopAgeRange: "Grades 6–8",
  workshopDurationMinutes: "45",
  workshopLearningGoals: "Identify a strong opening\nDeliver a 60-second talk",
  workshopActivityFlow:
    "Hook (5) → mini-lesson (10) → pair practice (20) → share-outs (10).",
  workshopMaterialsNeeded: "Index cards\nMarkers",
  workshopEngagementHook:
    "Show two clip openings and ask the room which kept their attention.",
  workshopAdaptationNotes:
    "If the group is shy, switch to silent peer feedback on index cards.",
};

beforeEach(() => {
  mockFindFirst.mockReset();
  mockUpdate.mockReset();
  mockTimelineCreate.mockReset();
  mockTransaction.mockReset();
  mockGetSession.mockReset();
  mockRevalidatePath.mockReset();

  // Run the callback with a tx-shaped mock that delegates back to our mocks.
  mockTransaction.mockImplementation(async (cb: unknown) => {
    if (typeof cb !== "function") return undefined;
    const tx = {
      instructorApplication: { update: mockUpdate },
      instructorApplicationTimelineEvent: { create: mockTimelineCreate },
    };
    return (cb as (tx: typeof tx) => Promise<unknown>)(tx);
  });
});

describe("editInstructorApplicationFields — workshop outline branch", () => {
  it("rejects when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await editInstructorApplicationFields(
      { status: "idle", message: "" },
      makeForm({})
    );
    expect(result.status).toBe("error");
  });

  it("persists a valid outline edit and writes a WORKSHOP_OUTLINE_UPDATED event", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "app-1",
      applicantId: "user-1",
      status: "UNDER_REVIEW",
      applicationTrack: "SUMMER_WORKSHOP_INSTRUCTOR",
      workshopOutline: { title: "Old title" },
    });

    const result = await editInstructorApplicationFields(
      { status: "idle", message: "" },
      makeForm(completeOutlineFields)
    );

    expect(result.status).toBe("success");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "app-1" });
    expect(updateArg.data.workshopOutline).toMatchObject({
      title: "Public Speaking 101",
      ageRange: "Grades 6–8",
      durationMinutes: 45,
      learningGoals: ["Identify a strong opening", "Deliver a 60-second talk"],
      materialsNeeded: ["Index cards", "Markers"],
    });

    const kinds = mockTimelineCreate.mock.calls.map((c) => c[0].data.kind);
    expect(kinds).toContain("APPLICANT_EDITED");
    expect(kinds).toContain("WORKSHOP_OUTLINE_UPDATED");
  });

  it("rejects an invalid outline (no goals) without writing", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "app-1",
      applicantId: "user-1",
      status: "UNDER_REVIEW",
      applicationTrack: "SUMMER_WORKSHOP_INSTRUCTOR",
      workshopOutline: null,
    });

    const result = await editInstructorApplicationFields(
      { status: "idle", message: "" },
      makeForm({ ...completeOutlineFields, workshopLearningGoals: "" })
    );

    expect(result.status).toBe("error");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockTimelineCreate).not.toHaveBeenCalled();
  });

  it("blocks editing once the application has reached CHAIR_REVIEW", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "app-1",
      applicantId: "user-1",
      status: "CHAIR_REVIEW",
      applicationTrack: "SUMMER_WORKSHOP_INSTRUCTOR",
      workshopOutline: null,
    });

    const result = await editInstructorApplicationFields(
      { status: "idle", message: "" },
      makeForm(completeOutlineFields)
    );

    expect(result.status).toBe("error");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("ignores outline fields submitted by a STANDARD applicant", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "app-1",
      applicantId: "user-1",
      status: "UNDER_REVIEW",
      applicationTrack: "STANDARD_INSTRUCTOR",
      workshopOutline: null,
      // Provide a flat field so changes can register.
      teachingExperience: "old experience",
    });

    const result = await editInstructorApplicationFields(
      { status: "idle", message: "" },
      makeForm({
        ...completeOutlineFields,
        teachingExperience: "new experience that is meaningfully different",
      })
    );

    expect(result.status).toBe("success");
    // Standard applicants get the safelist-only update; workshopOutline
    // must NOT be in the data payload.
    const updateArg = mockUpdate.mock.calls[0][0];
    expect("workshopOutline" in updateArg.data).toBe(false);
    expect(updateArg.data.teachingExperience).toBe(
      "new experience that is meaningfully different"
    );

    const kinds = mockTimelineCreate.mock.calls.map((c) => c[0].data.kind);
    expect(kinds).toContain("APPLICANT_EDITED");
    expect(kinds).not.toContain("WORKSHOP_OUTLINE_UPDATED");
  });
});
