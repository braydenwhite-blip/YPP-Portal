import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/public-app-url", () => ({
  toAbsoluteAppUrl: (path: string) => `https://app.test${path}`,
}));

const isActionTrackerEmailsEnabled = vi.fn(() => true);
const isPeopleDashboardEnabled = vi.fn(() => true);
vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEmailsEnabled: () => isActionTrackerEmailsEnabled(),
  isPeopleDashboardEnabled: () => isPeopleDashboardEnabled(),
}));

const sendFeedbackRequestEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email", () => ({
  sendFeedbackRequestEmail: (a: unknown) => sendFeedbackRequestEmail(a),
}));

const requireLeadership = vi.fn();
const requireSessionUser = vi.fn();
vi.mock("@/lib/authorization", () => ({
  requireLeadership: () => requireLeadership(),
  requireSessionUser: () => requireSessionUser(),
  hasRole: (roles: string[], role: string, primary?: string) =>
    roles.includes(role) || primary === role,
  hasAnyAdminSubtype: (subs: string[], wanted: string[]) =>
    subs.some((s) => wanted.includes(s)),
}));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  actionItem: { findMany: vi.fn() },
  mentorship: { findMany: vi.fn() },
  classOffering: { findMany: vi.fn() },
  feedbackRequest: {
    createMany: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  sendFeedbackRequest,
  getFeedbackResponsesForSubject,
  getFeedbackRequestForCollaborator,
  getFeedbackRequestStatusForSubject,
} from "@/lib/people-strategy/feedback-requests";
import {
  submitFeedbackResponse,
  requestMonthlyFeedback,
} from "@/lib/people-strategy/feedback-request-actions";

const MONTH = new Date("2026-06-15T12:00:00Z"); // normalizes to 2026-06-01

beforeEach(() => {
  vi.clearAllMocks();
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  isPeopleDashboardEnabled.mockReturnValue(true);
  // Default empty sources; individual tests override.
  prismaMock.actionItem.findMany.mockResolvedValue([]);
  prismaMock.mentorship.findMany.mockResolvedValue([]);
  prismaMock.classOffering.findMany.mockResolvedValue([]);
});

afterEach(() => vi.clearAllMocks());

// ── sendFeedbackRequest ──────────────────────────────────────────────────────

describe("sendFeedbackRequest", () => {
  it("creates a request and emails each recent collaborator", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "subject",
      name: "Subject Member",
      email: "subject@test.dev",
    });
    prismaMock.actionItem.findMany.mockResolvedValue([
      {
        lead: { id: "subject", name: "Subject Member", email: "subject@test.dev" },
        assignments: [
          { user: { id: "collab1", name: "Collab One", email: "c1@test.dev" } },
          { user: { id: "collab2", name: "Collab Two", email: "c2@test.dev" } },
        ],
      },
    ]);
    prismaMock.feedbackRequest.createMany.mockResolvedValue({ count: 1 });
    prismaMock.feedbackRequest.findUnique.mockResolvedValue({ id: "fr-new" });

    const res = await sendFeedbackRequest("subject", MONTH);

    // subject is excluded; two distinct collaborators remain
    expect(res.collaborators).toBe(2);
    expect(res.created).toBe(2);
    expect(res.emailsSent).toBe(2);
    expect(sendFeedbackRequestEmail).toHaveBeenCalledTimes(2);

    const firstCall = sendFeedbackRequestEmail.mock.calls[0][0];
    expect(firstCall.subjectName).toBe("Subject Member");
    expect(firstCall.formUrl).toContain("/people-strategy/feedback/fr-new");
    // month normalized to first of month
    const createArgs = prismaMock.feedbackRequest.createMany.mock.calls[0][0];
    expect((createArgs.data[0].month as Date).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("is idempotent: skips email when the request already exists for the month", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "subject", name: "S", email: "s@test.dev" });
    prismaMock.actionItem.findMany.mockResolvedValue([
      { lead: { id: "subject", name: "S", email: "s@test.dev" }, assignments: [{ user: { id: "collab1", name: "C", email: "c1@test.dev" } }] },
    ]);
    prismaMock.feedbackRequest.createMany.mockResolvedValue({ count: 0 }); // duplicate

    const res = await sendFeedbackRequest("subject", MONTH);

    expect(res.created).toBe(0);
    expect(res.emailsSent).toBe(0);
    expect(sendFeedbackRequestEmail).not.toHaveBeenCalled();
  });

  it("is a no-op when the emails flag is off", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    const res = await sendFeedbackRequest("subject", MONTH);
    expect(res).toEqual({ collaborators: 0, created: 0, emailsSent: 0 });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(sendFeedbackRequestEmail).not.toHaveBeenCalled();
  });

  it("dedupes a collaborator who appears in multiple sources", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "subject", name: "S", email: "s@test.dev" });
    prismaMock.actionItem.findMany.mockResolvedValue([
      { lead: { id: "subject", name: "S", email: "s@test.dev" }, assignments: [{ user: { id: "dup", name: "Dup", email: "d@test.dev" } }] },
    ]);
    prismaMock.mentorship.findMany.mockResolvedValue([
      { mentor: { id: "dup", name: "Dup", email: "d@test.dev" }, mentee: { id: "subject", name: "S", email: "s@test.dev" }, chair: null },
    ]);
    prismaMock.feedbackRequest.createMany.mockResolvedValue({ count: 1 });
    prismaMock.feedbackRequest.findUnique.mockResolvedValue({ id: "fr-dup" });

    const res = await sendFeedbackRequest("subject", MONTH);
    expect(res.collaborators).toBe(1);
    expect(sendFeedbackRequestEmail).toHaveBeenCalledTimes(1);
  });
});

// ── submitFeedbackResponse (the linked form action) ──────────────────────────

describe("submitFeedbackResponse", () => {
  it("saves the response and stamps submittedAt for the named collaborator", async () => {
    requireSessionUser.mockResolvedValue({ id: "collab1", roles: ["STAFF"] });
    prismaMock.feedbackRequest.findUnique.mockResolvedValue({ id: "fr1", collaboratorId: "collab1" });
    prismaMock.feedbackRequest.update.mockResolvedValue({});

    const res = await submitFeedbackResponse({ requestId: "fr1", responseBody: "Great collaborator." });

    expect(res.ok).toBe(true);
    expect(res.submittedAt).toBeInstanceOf(Date);
    const updateArgs = prismaMock.feedbackRequest.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "fr1" });
    expect(updateArgs.data.responseBody).toBe("Great collaborator.");
    expect(updateArgs.data.submittedAt).toBeInstanceOf(Date);
  });

  it("rejects a non-collaborator (cannot write someone else's request)", async () => {
    requireSessionUser.mockResolvedValue({ id: "intruder", roles: ["STAFF"] });
    prismaMock.feedbackRequest.findUnique.mockResolvedValue({ id: "fr1", collaboratorId: "collab1" });

    await expect(
      submitFeedbackResponse({ requestId: "fr1", responseBody: "sneaky" })
    ).rejects.toThrow("Unauthorized");
    expect(prismaMock.feedbackRequest.update).not.toHaveBeenCalled();
  });

  it("rejects empty feedback", async () => {
    requireSessionUser.mockResolvedValue({ id: "collab1", roles: ["STAFF"] });
    await expect(
      submitFeedbackResponse({ requestId: "fr1", responseBody: "   " })
    ).rejects.toThrow();
    expect(prismaMock.feedbackRequest.update).not.toHaveBeenCalled();
  });

  it("throws when the emails flag is off", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    await expect(
      submitFeedbackResponse({ requestId: "fr1", responseBody: "hi" })
    ).rejects.toThrow("not enabled");
  });
});

// ── Read visibility — Leadership/Board only ─────────────────────────────────────────

describe("getFeedbackResponsesForSubject", () => {
  it("returns raw responses for CPO/Board (requireLeadership passes)", async () => {
    requireLeadership.mockResolvedValue({ id: "cpo", roles: ["ADMIN"], adminSubtypes: ["LEADERSHIP"] });
    prismaMock.feedbackRequest.findMany.mockResolvedValue([
      {
        id: "fr1",
        month: new Date("2026-06-01T00:00:00Z"),
        submittedAt: new Date(),
        responseBody: "candid feedback",
        collaborator: { id: "collab1", name: "C", email: "c@test.dev" },
      },
    ]);

    const rows = await getFeedbackResponsesForSubject("subject");
    expect(rows).toHaveLength(1);
    expect(rows[0].responseBody).toBe("candid feedback");
  });

  it("throws for non-CPO/Board and never queries responses", async () => {
    requireLeadership.mockRejectedValue(new Error("Unauthorized"));

    await expect(getFeedbackResponsesForSubject("subject")).rejects.toThrow("Unauthorized");
    expect(prismaMock.feedbackRequest.findMany).not.toHaveBeenCalled();
  });
});

// ── Form read — only the named collaborator, never the subject ───────────────

describe("getFeedbackRequestForCollaborator", () => {
  it("returns the request to the named collaborator", async () => {
    prismaMock.feedbackRequest.findUnique.mockResolvedValue({
      id: "fr1",
      collaboratorId: "collab1",
      month: new Date("2026-06-01T00:00:00Z"),
      responseBody: null,
      submittedAt: null,
      subjectUser: { id: "subject", name: "Subject Member" },
    });

    const req = await getFeedbackRequestForCollaborator("fr1", "collab1");
    expect(req).not.toBeNull();
    expect(req?.subjectUser.name).toBe("Subject Member");
  });

  it("returns null to the subject (subject cannot read raw feedback here)", async () => {
    prismaMock.feedbackRequest.findUnique.mockResolvedValue({
      id: "fr1",
      collaboratorId: "collab1",
      month: new Date("2026-06-01T00:00:00Z"),
      responseBody: "secret",
      submittedAt: new Date(),
      subjectUser: { id: "subject", name: "Subject Member" },
    });

    const asSubject = await getFeedbackRequestForCollaborator("fr1", "subject");
    expect(asSubject).toBeNull();
  });
});

// ── getFeedbackRequestStatusForSubject — non-confidential metadata ───────────

describe("getFeedbackRequestStatusForSubject", () => {
  it("returns null when the emails flag is off", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    expect(await getFeedbackRequestStatusForSubject("subject")).toBeNull();
    expect(prismaMock.feedbackRequest.findMany).not.toHaveBeenCalled();
  });

  it("returns an all-zero status when there are no requests", async () => {
    prismaMock.feedbackRequest.findMany.mockResolvedValue([]);
    const status = await getFeedbackRequestStatusForSubject("subject");
    expect(status).toEqual({
      total: 0,
      outstanding: 0,
      submitted: 0,
      lastRequestedAt: null,
      lastRequestedMonth: null,
      lastSubmittedAt: null,
    });
  });

  it("computes counts and the latest requested/submitted dates (no responseBody read)", async () => {
    prismaMock.feedbackRequest.findMany.mockResolvedValue([
      {
        month: new Date("2026-05-01T00:00:00Z"),
        createdAt: new Date("2026-05-02T00:00:00Z"),
        submittedAt: new Date("2026-05-10T00:00:00Z"),
      },
      {
        month: new Date("2026-06-01T00:00:00Z"),
        createdAt: new Date("2026-06-03T00:00:00Z"),
        submittedAt: null,
      },
      {
        month: new Date("2026-04-01T00:00:00Z"),
        createdAt: new Date("2026-04-02T00:00:00Z"),
        submittedAt: new Date("2026-04-09T00:00:00Z"),
      },
    ]);

    const status = await getFeedbackRequestStatusForSubject("subject");
    expect(status).toEqual({
      total: 3,
      submitted: 2,
      outstanding: 1,
      lastRequestedAt: new Date("2026-06-03T00:00:00Z"),
      lastRequestedMonth: new Date("2026-06-01T00:00:00Z"),
      lastSubmittedAt: new Date("2026-05-10T00:00:00Z"),
    });

    // Must NOT request the confidential response body.
    const selectArg = prismaMock.feedbackRequest.findMany.mock.calls[0][0].select;
    expect(selectArg).not.toHaveProperty("responseBody");
  });
});

// ── requestMonthlyFeedback action — Leadership/Board only, multi-subject ────────────

describe("requestMonthlyFeedback", () => {
  function stubOneCollaborator() {
    prismaMock.user.findUnique.mockResolvedValue({ id: "subject", name: "S", email: "s@test.dev" });
    prismaMock.actionItem.findMany.mockResolvedValue([
      { lead: { id: "subject", name: "S", email: "s@test.dev" }, assignments: [{ user: { id: "collab1", name: "C", email: "c1@test.dev" } }] },
    ]);
    prismaMock.feedbackRequest.createMany.mockResolvedValue({ count: 1 });
    prismaMock.feedbackRequest.findUnique.mockResolvedValue({ id: "fr-x" });
  }

  it("requires CPO/Board (rejects when requireLeadership throws)", async () => {
    requireLeadership.mockRejectedValue(new Error("Unauthorized"));
    await expect(requestMonthlyFeedback({ subjectUserIds: ["subject"] })).rejects.toThrow(
      "Unauthorized"
    );
    expect(prismaMock.feedbackRequest.createMany).not.toHaveBeenCalled();
  });

  it("throws when the dashboard flag is off (before touching prisma)", async () => {
    isPeopleDashboardEnabled.mockReturnValue(false);
    await expect(requestMonthlyFeedback({ subjectUserIds: ["subject"] })).rejects.toThrow(
      "not enabled"
    );
    expect(requireLeadership).not.toHaveBeenCalled();
  });

  it("aggregates results across subjects and dedupes ids", async () => {
    requireLeadership.mockResolvedValue({ id: "cpo", roles: ["ADMIN"], adminSubtypes: ["LEADERSHIP"] });
    stubOneCollaborator();

    const res = await requestMonthlyFeedback({ subjectUserIds: ["subject", "subject"] });
    // Deduped to a single subject.
    expect(res.subjects).toBe(1);
    expect(res.created).toBe(1);
    expect(res.emailsSent).toBe(1);
    expect(sendFeedbackRequestEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty selection", async () => {
    requireLeadership.mockResolvedValue({ id: "cpo", roles: ["ADMIN"], adminSubtypes: ["LEADERSHIP"] });
    await expect(requestMonthlyFeedback({ subjectUserIds: [] })).rejects.toThrow();
  });
});
