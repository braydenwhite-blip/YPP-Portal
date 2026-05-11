/**
 * Behavior tests for lib/applicant-email-gating.ts.
 *
 * Contract:
 *   - source = PORTAL → send() runs, no ManualEmailTask written
 *   - source != PORTAL → send() does NOT run, a PENDING ManualEmailTask is
 *     upserted with the matching template, and an AUTO_EMAIL_SUPPRESSED
 *     timeline event is recorded
 *   - existing tasks: re-running the gate refreshes the template and notes,
 *     but never overwrites SENT or PENDING status (only resets NOT_NEEDED /
 *     HANDLED_EXTERNALLY back to PENDING)
 *   - null/undefined source defaults to "send" so pre-migration rows are
 *     treated as portal-native
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findFirstTask,
  createTask,
  updateTask,
  createTimelineEvent,
} = vi.hoisted(() => ({
  findFirstTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  createTimelineEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    manualEmailTask: {
      findFirst: findFirstTask,
      create: createTask,
      update: updateTask,
    },
    instructorApplicationTimelineEvent: {
      create: createTimelineEvent,
    },
  },
}));

import {
  gateApplicantEmail,
  recordSuppressedApplicantEmail,
  shouldAutoSendApplicantEmail,
} from "@/lib/applicant-email-gating";

beforeEach(() => {
  vi.clearAllMocks();
  findFirstTask.mockResolvedValue(null);
  createTask.mockResolvedValue({ id: "new-task" });
  updateTask.mockResolvedValue({});
  createTimelineEvent.mockResolvedValue({});
});

describe("shouldAutoSendApplicantEmail", () => {
  it("returns true for PORTAL", () => {
    expect(shouldAutoSendApplicantEmail("PORTAL")).toBe(true);
  });

  it.each(["GOOGLE_FORMS", "CSV_IMPORT", "MANUAL_ADMIN_ENTRY"] as const)(
    "returns false for %s",
    (source) => {
      expect(shouldAutoSendApplicantEmail(source)).toBe(false);
    },
  );

  it("defaults to true for null / undefined (treats pre-migration rows as portal)", () => {
    expect(shouldAutoSendApplicantEmail(null)).toBe(true);
    expect(shouldAutoSendApplicantEmail(undefined)).toBe(true);
  });
});

describe("gateApplicantEmail", () => {
  it("runs send() when source is PORTAL", async () => {
    const send = vi.fn().mockResolvedValue("ok");
    const result = await gateApplicantEmail({
      source: "PORTAL",
      kind: "ACCEPTANCE",
      context: {
        applicationId: "app-1",
        applicantName: "Ada",
        applicationTrack: "STANDARD_INSTRUCTOR",
      },
      send,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(true);
    expect(createTask).not.toHaveBeenCalled();
    expect(updateTask).not.toHaveBeenCalled();
    expect(createTimelineEvent).not.toHaveBeenCalled();
  });

  it("suppresses send() and creates a ManualEmailTask for GOOGLE_FORMS", async () => {
    const send = vi.fn().mockResolvedValue("ok");
    const result = await gateApplicantEmail({
      source: "GOOGLE_FORMS",
      kind: "ACCEPTANCE",
      context: {
        applicationId: "app-1",
        applicantName: "Ada",
        applicationTrack: "STANDARD_INSTRUCTOR",
      },
      send,
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.sent).toBe(false);
    expect(createTask).toHaveBeenCalledTimes(1);
    const taskArgs = createTask.mock.calls[0][0];
    expect(taskArgs.data.instructorApplicationId).toBe("app-1");
    expect(taskArgs.data.kind).toBe("ACCEPTANCE");
    expect(taskArgs.data.suggestedSubject).toContain("Welcome to YPP");
    expect(taskArgs.data.suggestedBody).toContain("Ada");
    expect(createTimelineEvent).toHaveBeenCalled();
    const tlArgs = createTimelineEvent.mock.calls[0][0];
    expect(tlArgs.data.kind).toBe("AUTO_EMAIL_SUPPRESSED");
    expect(tlArgs.data.payload.emailKind).toBe("ACCEPTANCE");
  });

  it("uses 'Summer Workshop Instructor' label when track is summer workshop", async () => {
    await gateApplicantEmail({
      source: "MANUAL_ADMIN_ENTRY",
      kind: "ACCEPTANCE",
      context: {
        applicationId: "app-1",
        applicantName: "Ada",
        applicationTrack: "SUMMER_WORKSHOP_INSTRUCTOR",
      },
      send: vi.fn(),
    });
    const subject = createTask.mock.calls[0][0].data.suggestedSubject;
    expect(subject).toContain("Summer Workshop Instructor");
  });
});

describe("recordSuppressedApplicantEmail", () => {
  it("creates a fresh task when none exists", async () => {
    findFirstTask.mockResolvedValue(null);

    await recordSuppressedApplicantEmail("MISSING_INFORMATION_REQUEST", {
      applicationId: "app-1",
      applicantName: "Ada",
      applicationTrack: "STANDARD_INSTRUCTOR",
      contextNote: "Need your résumé",
    });

    expect(createTask).toHaveBeenCalledTimes(1);
    const data = createTask.mock.calls[0][0].data;
    expect(data.kind).toBe("MISSING_INFORMATION_REQUEST");
    expect(data.notes).toBe("Need your résumé");
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("refreshes template + appends to notes when a task already exists", async () => {
    findFirstTask.mockResolvedValue({
      id: "task-existing",
      notes: "First admin note",
      status: "PENDING",
    });

    await recordSuppressedApplicantEmail("MISSING_INFORMATION_REQUEST", {
      applicationId: "app-1",
      applicantName: "Ada",
      applicationTrack: "STANDARD_INSTRUCTOR",
      contextNote: "Second admin note",
    });

    expect(createTask).not.toHaveBeenCalled();
    expect(updateTask).toHaveBeenCalledTimes(1);
    const data = updateTask.mock.calls[0][0].data;
    expect(data.suggestedSubject).toContain("one more thing");
    expect(data.notes).toBe("First admin note\n\nSecond admin note");
    // PENDING stays PENDING — refresh shouldn't clobber.
    expect(data.status).toBe("PENDING");
  });

  it("preserves SENT status on a re-suppression (admin already sent it manually)", async () => {
    findFirstTask.mockResolvedValue({
      id: "task-existing",
      notes: null,
      status: "SENT",
    });

    await recordSuppressedApplicantEmail("ACCEPTANCE", {
      applicationId: "app-1",
      applicantName: "Ada",
      applicationTrack: "STANDARD_INSTRUCTOR",
    });

    const data = updateTask.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
  });

  it("resets NOT_NEEDED status back to PENDING (a re-trigger means action is needed again)", async () => {
    findFirstTask.mockResolvedValue({
      id: "task-existing",
      notes: null,
      status: "NOT_NEEDED",
    });

    await recordSuppressedApplicantEmail("REJECTION", {
      applicationId: "app-1",
      applicantName: "Ada",
      applicationTrack: "STANDARD_INSTRUCTOR",
    });

    const data = updateTask.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
  });

  it("resets HANDLED_EXTERNALLY status back to PENDING when re-triggered", async () => {
    findFirstTask.mockResolvedValue({
      id: "task-existing",
      notes: null,
      status: "HANDLED_EXTERNALLY",
    });

    await recordSuppressedApplicantEmail("REJECTION", {
      applicationId: "app-1",
      applicantName: "Ada",
      applicationTrack: "STANDARD_INSTRUCTOR",
    });

    const data = updateTask.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
  });

  it("records a timeline AUTO_EMAIL_SUPPRESSED event regardless of upsert outcome", async () => {
    await recordSuppressedApplicantEmail("ACCEPTANCE", {
      applicationId: "app-1",
      applicantName: "Ada",
      applicationTrack: "STANDARD_INSTRUCTOR",
    });
    expect(createTimelineEvent).toHaveBeenCalledTimes(1);
    const data = createTimelineEvent.mock.calls[0][0].data;
    expect(data.applicationId).toBe("app-1");
    expect(data.kind).toBe("AUTO_EMAIL_SUPPRESSED");
    expect(data.payload.emailKind).toBe("ACCEPTANCE");
    expect(data.payload.reason).toBe("non_portal_source");
  });

  it("does not crash when the timeline write fails", async () => {
    createTimelineEvent.mockRejectedValueOnce(new Error("timeline boom"));
    await expect(
      recordSuppressedApplicantEmail("ACCEPTANCE", {
        applicationId: "app-1",
        applicantName: "Ada",
        applicationTrack: "STANDARD_INSTRUCTOR",
      }),
    ).resolves.toBeDefined();
  });
});
