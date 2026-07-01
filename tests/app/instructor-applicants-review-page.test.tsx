import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

// ── Hoisted mock fns (referenced inside vi.mock factories below) ──────────
const {
  entityWorkflowCardMock,
  finalReviewCockpitMock,
  getApplicationForFinalReviewMock,
} = vi.hoisted(() => ({
  entityWorkflowCardMock: vi.fn(async () => createElement("div", { "data-testid": "workflow-card" })),
  finalReviewCockpitMock: vi.fn(() => createElement("div", { "data-testid": "cockpit" })),
  getApplicationForFinalReviewMock: vi.fn(async () => ({
    id: "app-1",
    applicant: { id: "applicant-1", name: "Ada Lovelace", email: "ada@example.com", chapterId: "chapter-9", chapter: { id: "chapter-9", name: "Chapter Nine" } },
  })),
}));

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: vi.fn(async () => ({ id: "actor-1", chapterId: "chapter-9", roles: ["ADMIN"], featureKeys: new Set() })),
  isAdmin: vi.fn(() => true),
}));

vi.mock("@/lib/feature-flags", () => ({
  isInstructorApplicantWorkflowV1Enabled: vi.fn(() => true),
}));

vi.mock("@/lib/page-guards", () => ({
  requireChairPage: vi.fn(async () => ({ id: "session-user-1" })),
}));

vi.mock("@/lib/final-review-queries", () => ({
  getApplicationForFinalReview: getApplicationForFinalReviewMock,
  getApplicantEvidenceRecord: vi.fn(async () => null),
  getChairQueueNeighbors: vi.fn(async () => ({ prevId: null, nextId: null, siblings: [] })),
  getChairDraft: vi.fn(async () => ({ rationale: "", comparisonNotes: "", savedAt: null })),
  getNotificationSnapshot: vi.fn(async () => ({ lastNotificationError: null, lastNotificationErrorAt: null, attempts: [] })),
  getDecisionAuditChain: vi.fn(async () => ({ decisions: [] })),
  getReviewSignalsForApplication: vi.fn(async () => []),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplicationTimelineEvent: { findFirst: vi.fn(async () => null) },
    instructorApplicationChairDecision: { count: vi.fn(async () => 0) },
    userAdminSubtype: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/active-chair", () => ({
  canMakeFinalApplicantDecision: vi.fn(() => true),
  getActiveChair: vi.fn(async () => ({ id: "actor-1", name: "Active Chair", email: "chair@example.com" })),
  NON_CHAIR_DECISION_MESSAGE: "Only the currently assigned Chair can submit the final decision.",
}));

vi.mock("@/components/instructor-applicants/final-review/FinalReviewCockpit", () => ({
  default: finalReviewCockpitMock,
}));

vi.mock("@/components/workflow-engine/entity-workflow-card", () => ({
  EntityWorkflowCard: entityWorkflowCardMock,
}));

import FinalReviewCockpitPage from "@/app/(app)/admin/instructor-applicants/[id]/review/page";

describe("FinalReviewCockpitPage — workflow card integration", () => {
  beforeEach(() => {
    entityWorkflowCardMock.mockClear();
    finalReviewCockpitMock.mockClear();
  });

  it("renders EntityWorkflowCard scoped to the instructor application, alongside FinalReviewCockpit", async () => {
    const element = await FinalReviewCockpitPage({
      params: Promise.resolve({ id: "app-1" }),
    });

    // The page returns a fragment; render it enough to trigger the async
    // server component call by invoking React's element tree directly.
    expect(element).toBeTruthy();

    // EntityWorkflowCard is an async server component invoked as a plain
    // function by React when rendering — but since we don't have a full RSC
    // renderer in this unit test, assert on the element graph instead: find
    // the EntityWorkflowCard element within the returned fragment's children.
    const children = (element as { props: { children: unknown[] } }).props.children as any[];
    const workflowCardWrapper = children[0];
    const workflowCardElement = workflowCardWrapper.props.children;

    expect(workflowCardElement.type).toBe(entityWorkflowCardMock);
    expect(workflowCardElement.props).toEqual({
      entityType: "INSTRUCTOR_APPLICATION",
      entityId: "app-1",
      chapterId: "chapter-9",
      title: "Hiring workflow",
    });

    const cockpitElement = children[1];
    expect(cockpitElement.type).toBe(finalReviewCockpitMock);
    expect(cockpitElement.props.application.id).toBe("app-1");
  });

  it("falls back to null chapterId when the applicant has none", async () => {
    getApplicationForFinalReviewMock.mockResolvedValueOnce({
      id: "app-2",
      applicant: { id: "applicant-2", name: "No Chapter", email: "nc@example.com", chapterId: null, chapter: null },
    });

    const element = await FinalReviewCockpitPage({
      params: Promise.resolve({ id: "app-2" }),
    });

    const children = (element as { props: { children: unknown[] } }).props.children as any[];
    const workflowCardElement = children[0].props.children;
    expect(workflowCardElement.props.chapterId).toBeNull();
    expect(workflowCardElement.props.entityId).toBe("app-2");
  });
});
