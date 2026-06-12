import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// ── Mocks (mirrors tests/lib/people-strategy-feedback.test.ts) ──────────────

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

const sendMonthlyFeedbackRequestEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendMonthlyFeedbackRequestEmail: (a: unknown) => sendMonthlyFeedbackRequestEmail(a),
}));

const requireLeadership = vi.fn();
vi.mock("@/lib/authorization", () => ({
  requireLeadership: () => requireLeadership(),
}));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  actionItem: { findMany: vi.fn() },
  mentorship: { findMany: vi.fn() },
  classOffering: { findMany: vi.fn() },
  officerMeeting: { findMany: vi.fn() },
  feedbackRequest: { create: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { buildFeedbackRequestEmailContent } from "@/lib/people-strategy/feedback-email-content";
import {
  composeSuggestedCollaborator,
  evidenceScore,
  suggestFeedbackCollaborators,
  type CollaboratorWorkEvidence,
} from "@/lib/people-strategy/feedback-plan";
import {
  prepareMonthlyFeedbackPlan,
  sendPlannedFeedbackRequests,
} from "@/lib/people-strategy/feedback-plan-actions";

const SUBJECT = { id: "subject-1", name: "Brayden Kim", email: "brayden@ypp.org" };
const VIEWER = { id: "cpo-1", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: ["LEADERSHIP"] };

function rawUser(id: string, name: string, email: string | null = `${id}@ypp.org`) {
  return { id, name, email, primaryRole: "STAFF", title: null, archivedAt: null };
}

function makeEvidence(
  overrides: Partial<CollaboratorWorkEvidence> = {}
): CollaboratorWorkEvidence {
  return {
    user: { id: "u1", name: "Ian Park", email: "ian@ypp.org", primaryRole: "STAFF", title: null },
    sharedActions: [],
    mentorshipRoles: [],
    sharedClasses: [],
    sharedMeetings: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  isPeopleDashboardEnabled.mockReturnValue(true);
  requireLeadership.mockResolvedValue(VIEWER);
  sendMonthlyFeedbackRequestEmail.mockResolvedValue({ success: true });
  prismaMock.user.findUnique.mockResolvedValue(SUBJECT);
  prismaMock.actionItem.findMany.mockResolvedValue([]);
  prismaMock.mentorship.findMany.mockResolvedValue([]);
  prismaMock.classOffering.findMany.mockResolvedValue([]);
  prismaMock.officerMeeting.findMany.mockResolvedValue([]);
  prismaMock.feedbackRequest.findMany.mockResolvedValue([]);
  prismaMock.feedbackRequest.create.mockImplementation(
    async ({ data }: { data: { collaboratorId: string } }) => ({
      id: `req-${data.collaboratorId}`,
    })
  );
});

afterEach(() => vi.clearAllMocks());

// ── Email content builder ────────────────────────────────────────────────────

describe("buildFeedbackRequestEmailContent", () => {
  it("builds the subject, greeting, work list, due date, and privacy note", () => {
    const content = buildFeedbackRequestEmailContent({
      recipientName: "Ian Park",
      subjectName: "Brayden Kim",
      monthLabel: "June 2026",
      dueDateLabel: "Friday, June 19, 2026",
      workItems: ["Hiring sprint — due Jun 20", "Curriculum review"],
    });
    expect(content.subject).toBe("Feedback request for Brayden Kim — June 2026 check-in");
    expect(content.greeting).toBe("Hi Ian,");
    expect(content.intro[0]).toContain("monthly check-in for June 2026");
    expect(content.workItems).toEqual(["Hiring sprint — due Jun 20", "Curriculum review"]);
    expect(content.closing[0]).toBe("Please share your feedback by Friday, June 19, 2026.");
    expect(content.closing).toContain("It takes about 3–5 minutes.");
    expect(content.closing.join(" ")).toContain("confidential");
    expect(content.closing.join(" ")).toContain("will not see what you write");
  });

  it("caps the work list at five items and tolerates a missing name/due date", () => {
    const content = buildFeedbackRequestEmailContent({
      recipientName: null,
      subjectName: "Brayden Kim",
      monthLabel: "June 2026",
      dueDateLabel: null,
      workItems: ["a", "b", "c", "d", "e", "f", "g"],
    });
    expect(content.greeting).toBe("Hi there,");
    expect(content.workItems).toHaveLength(5);
    expect(content.closing.some((line) => line.startsWith("Please share"))).toBe(false);
  });
});

// ── Suggestion composition (pure) ────────────────────────────────────────────

describe("composeSuggestedCollaborator", () => {
  it("words concrete reasons from each evidence source", () => {
    const suggestion = composeSuggestedCollaborator(
      makeEvidence({
        sharedActions: [
          { id: "a1", title: "Hiring sprint", deadlineLabel: "Jun 20", subjectLeads: true },
          { id: "a2", title: "Curriculum review", deadlineLabel: null, subjectLeads: false },
        ],
        mentorshipRoles: ["mentor"],
        sharedClasses: [{ id: "c1", title: "Intro to Coding" }],
        sharedMeetings: [{ id: "m1", title: "Weekly Sync" }],
      }),
      "Brayden Kim",
      120
    );
    expect(suggestion).not.toBeNull();
    expect(suggestion!.reasons).toEqual([
      "Worked with Brayden on 2 action items in the last 120 days",
      "Brayden's mentor",
      "On the same instructional team for 1 class",
      "Attended 1 meeting with Brayden in the last 120 days",
    ]);
    expect(suggestion!.contextItems).toContainEqual({
      type: "action",
      id: "a1",
      title: "Hiring sprint",
      detail: "Brayden leads · due Jun 20",
    });
    expect(suggestion!.defaultSelected).toBe(true);
  });

  it("leaves meetings-only overlaps unchecked by default", () => {
    const suggestion = composeSuggestedCollaborator(
      makeEvidence({ sharedMeetings: [{ id: "m1", title: "Weekly Sync" }] }),
      "Brayden Kim",
      120
    );
    expect(suggestion!.defaultSelected).toBe(false);
    expect(suggestion!.reasons).toHaveLength(1);
  });

  it("never default-selects someone without an email on file", () => {
    const suggestion = composeSuggestedCollaborator(
      makeEvidence({
        user: { id: "u2", name: "No Email", email: null, primaryRole: null, title: null },
        sharedActions: [{ id: "a1", title: "X", deadlineLabel: null, subjectLeads: false }],
      }),
      "Brayden Kim",
      120
    );
    expect(suggestion!.defaultSelected).toBe(false);
  });

  it("returns null when there is no evidence at all", () => {
    expect(composeSuggestedCollaborator(makeEvidence(), "Brayden Kim", 120)).toBeNull();
  });

  it("ranks direct shared work above meeting-room overlap", () => {
    const direct = makeEvidence({
      sharedActions: [{ id: "a1", title: "X", deadlineLabel: null, subjectLeads: false }],
    });
    const meetingsOnly = makeEvidence({
      sharedMeetings: [
        { id: "m1", title: "A" },
        { id: "m2", title: "B" },
      ],
    });
    expect(evidenceScore(direct)).toBeGreaterThan(0);
    expect(evidenceScore(meetingsOnly)).toBeLessThanOrEqual(evidenceScore(direct));
  });
});

// ── suggestFeedbackCollaborators (queries + merge) ───────────────────────────

describe("suggestFeedbackCollaborators", () => {
  it("merges sources per collaborator and excludes the subject and archived users", async () => {
    prismaMock.actionItem.findMany.mockResolvedValue([
      {
        id: "a1",
        title: "Hiring sprint",
        leadId: SUBJECT.id,
        deadlineStart: new Date("2026-06-20T00:00:00Z"),
        deadlineEnd: null,
        lead: rawUser(SUBJECT.id, "Brayden Kim"),
        assignments: [
          { user: rawUser("ian", "Ian Park") },
          { user: { ...rawUser("gone", "Archived Person"), archivedAt: new Date() } },
        ],
      },
    ]);
    prismaMock.mentorship.findMany.mockResolvedValue([
      {
        mentor: rawUser("ian", "Ian Park"),
        mentee: rawUser(SUBJECT.id, "Brayden Kim"),
        chair: null,
      },
    ]);

    const suggestions = await suggestFeedbackCollaborators(SUBJECT.id);
    expect(suggestions.map((s) => s.id)).toEqual(["ian"]);
    expect(suggestions[0].reasons).toContain("Brayden's mentor");
    expect(suggestions[0].reasons.some((r) => r.includes("1 action item"))).toBe(true);
  });

  it("includes shared officer meetings as evidence", async () => {
    prismaMock.officerMeeting.findMany.mockResolvedValue([
      {
        id: "m1",
        title: "Weekly Leadership Sync",
        date: new Date("2026-06-08T00:00:00Z"),
        attendees: [
          { user: rawUser(SUBJECT.id, "Brayden Kim") },
          { user: rawUser("sam", "Sam Singer") },
        ],
      },
    ]);
    const suggestions = await suggestFeedbackCollaborators(SUBJECT.id);
    expect(suggestions.map((s) => s.id)).toEqual(["sam"]);
    expect(suggestions[0].defaultSelected).toBe(false);
    expect(suggestions[0].contextItems[0]).toMatchObject({
      type: "meeting",
      title: "Weekly Leadership Sync",
    });
  });
});

// ── prepareMonthlyFeedbackPlan ───────────────────────────────────────────────

describe("prepareMonthlyFeedbackPlan", () => {
  it("requires the Leadership/Board tier", async () => {
    requireLeadership.mockRejectedValue(new Error("Unauthorized"));
    await expect(
      prepareMonthlyFeedbackPlan({ subjectUserId: SUBJECT.id })
    ).rejects.toThrow("Unauthorized");
    expect(prismaMock.feedbackRequest.findMany).not.toHaveBeenCalled();
  });

  it("refuses when either feature flag is off", async () => {
    isPeopleDashboardEnabled.mockReturnValue(false);
    await expect(
      prepareMonthlyFeedbackPlan({ subjectUserId: SUBJECT.id })
    ).rejects.toThrow("not enabled");
    isPeopleDashboardEnabled.mockReturnValue(true);
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    await expect(
      prepareMonthlyFeedbackPlan({ subjectUserId: SUBJECT.id })
    ).rejects.toThrow("not enabled");
  });

  it("maps already-requested collaborators per selectable month", async () => {
    const monthStart = new Date();
    const currentMonth = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1)
    );
    prismaMock.feedbackRequest.findMany.mockResolvedValue([
      { collaboratorId: "ian", month: currentMonth },
    ]);
    const plan = await prepareMonthlyFeedbackPlan({ subjectUserId: SUBJECT.id });
    expect(plan.months).toHaveLength(3);
    expect(plan.defaultMonthKey).toBe(plan.months[0].key);
    expect(plan.alreadyRequestedByMonth[plan.defaultMonthKey]).toEqual(["ian"]);
    expect(plan.subject.id).toBe(SUBJECT.id);
  });
});

// ── sendPlannedFeedbackRequests ──────────────────────────────────────────────

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function withIanAsCollaborator() {
  prismaMock.actionItem.findMany.mockResolvedValue([
    {
      id: "a1",
      title: "Hiring sprint",
      leadId: SUBJECT.id,
      deadlineStart: new Date("2026-06-20T00:00:00Z"),
      deadlineEnd: null,
      lead: rawUser(SUBJECT.id, "Brayden Kim"),
      assignments: [{ user: rawUser("ian", "Ian Park") }],
    },
  ]);
}

describe("sendPlannedFeedbackRequests", () => {
  it("requires the Leadership/Board tier before touching data", async () => {
    requireLeadership.mockRejectedValue(new Error("Unauthorized"));
    await expect(
      sendPlannedFeedbackRequests({
        subjectUserId: SUBJECT.id,
        monthKey: currentMonthKey(),
        collaboratorIds: ["ian"],
      })
    ).rejects.toThrow("Unauthorized");
    expect(prismaMock.feedbackRequest.create).not.toHaveBeenCalled();
  });

  it("rejects months outside the allowed window", async () => {
    await expect(
      sendPlannedFeedbackRequests({
        subjectUserId: SUBJECT.id,
        monthKey: "2020-01",
        collaboratorIds: ["ian"],
      })
    ).rejects.toThrow(/Target month/);
  });

  it("creates rows with the recomputed reason/context and emails the recipient", async () => {
    withIanAsCollaborator();
    const result = await sendPlannedFeedbackRequests({
      subjectUserId: SUBJECT.id,
      monthKey: currentMonthKey(),
      collaboratorIds: ["ian"],
    });

    expect(result).toMatchObject({
      created: 1,
      alreadyRequested: 0,
      notSuggested: 0,
      emailsSent: 1,
      emailsNotSent: 0,
    });
    const createArg = prismaMock.feedbackRequest.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      subjectUserId: SUBJECT.id,
      collaboratorId: "ian",
      requestedById: VIEWER.id,
    });
    expect(createArg.data.reason).toContain("Worked with Brayden on 1 action item");
    expect(createArg.data.contextItems[0]).toMatchObject({ type: "action", title: "Hiring sprint" });
    expect(createArg.data.dueAt).toBeInstanceOf(Date);

    const emailArg = sendMonthlyFeedbackRequestEmail.mock.calls[0][0];
    expect(emailArg.to).toBe("ian@ypp.org");
    expect(emailArg.formUrl).toBe("https://app.test/people-strategy/feedback/req-ian");
    expect(emailArg.content.subject).toContain("Brayden Kim");
  });

  it("refuses ids that are not currently backed by shared work", async () => {
    withIanAsCollaborator();
    const result = await sendPlannedFeedbackRequests({
      subjectUserId: SUBJECT.id,
      monthKey: currentMonthKey(),
      collaboratorIds: ["stranger"],
    });
    expect(result).toMatchObject({ created: 0, notSuggested: 1, emailsSent: 0 });
    expect(prismaMock.feedbackRequest.create).not.toHaveBeenCalled();
    expect(sendMonthlyFeedbackRequestEmail).not.toHaveBeenCalled();
  });

  it("treats an existing (subject, collaborator, month) row as already requested — no re-email", async () => {
    withIanAsCollaborator();
    prismaMock.feedbackRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "5.22.0",
      })
    );
    const result = await sendPlannedFeedbackRequests({
      subjectUserId: SUBJECT.id,
      monthKey: currentMonthKey(),
      collaboratorIds: ["ian"],
    });
    expect(result).toMatchObject({ created: 0, alreadyRequested: 1, emailsSent: 0 });
    expect(sendMonthlyFeedbackRequestEmail).not.toHaveBeenCalled();
  });

  it("reports a failed email honestly instead of claiming it was sent", async () => {
    withIanAsCollaborator();
    sendMonthlyFeedbackRequestEmail.mockResolvedValue({ success: false, error: "boom" });
    const result = await sendPlannedFeedbackRequests({
      subjectUserId: SUBJECT.id,
      monthKey: currentMonthKey(),
      collaboratorIds: ["ian"],
    });
    expect(result).toMatchObject({ created: 1, emailsSent: 0, emailsNotSent: 1 });
  });

  it("creates the request but counts the missing email when no address is on file", async () => {
    prismaMock.actionItem.findMany.mockResolvedValue([
      {
        id: "a1",
        title: "Hiring sprint",
        leadId: SUBJECT.id,
        deadlineStart: new Date("2026-06-20T00:00:00Z"),
        deadlineEnd: null,
        lead: rawUser(SUBJECT.id, "Brayden Kim"),
        assignments: [{ user: rawUser("ian", "Ian Park", null) }],
      },
    ]);
    const result = await sendPlannedFeedbackRequests({
      subjectUserId: SUBJECT.id,
      monthKey: currentMonthKey(),
      collaboratorIds: ["ian"],
    });
    expect(result).toMatchObject({ created: 1, emailsSent: 0, emailsNotSent: 1 });
    expect(sendMonthlyFeedbackRequestEmail).not.toHaveBeenCalled();
  });
});
