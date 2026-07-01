import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

// ── Hoisted mock fns (referenced inside vi.mock factories below) ──────────
const {
  entityWorkflowCardMock,
  studioClientMock,
  getCurriculumDraftForStudioMock,
  getSessionMock,
} = vi.hoisted(() => ({
  entityWorkflowCardMock: vi.fn(async () => createElement("div", { "data-testid": "workflow-card" })),
  studioClientMock: vi.fn(() => createElement("div", { "data-testid": "studio-client" })),
  getCurriculumDraftForStudioMock: vi.fn(async () => ({
    access: { canEdit: true, canReview: false },
    draft: {
      id: "draft-1",
      title: "Intro to Robotics",
      description: "A robotics curriculum",
      interestArea: "STEM",
      outcomes: [],
      courseConfig: {},
      weeklyPlans: [],
      understandingChecks: {},
      reviewRubric: {},
      reviewNotes: null,
      reviewedAt: null,
      submittedAt: null,
      approvedAt: null,
      generatedTemplateId: null,
      status: "IN_PROGRESS",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  })),
  getSessionMock: vi.fn(async () => ({
    user: { id: "session-user-1", name: "Ada Instructor", roles: ["INSTRUCTOR"] },
  })),
}));

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth-supabase", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/curriculum-draft-actions", () => ({
  getCurriculumDraftForStudio: getCurriculumDraftForStudioMock,
}));

vi.mock("@/lib/curriculum-draft-progress", () => ({
  getCurriculumDraftProgress: vi.fn(() => ({ percentComplete: 40 })),
  getWeeklyPlansInput: vi.fn((weeklyPlans: unknown) => weeklyPlans ?? []),
}));

vi.mock("@/lib/lesson-design-studio", () => ({
  buildLessonDesignStudioHref: vi.fn(() => "/instructor/lesson-design-studio"),
  deriveStudioPhase: vi.fn(() => "OUTCOMES"),
  getCanonicalStudioHref: vi.fn(() => null),
  getStudioEntryContextFromSearchParams: vi.fn(() => ({ source: "direct" })),
  studioStepSlugToPhase: vi.fn(() => "OUTCOMES"),
}));

vi.mock("@/lib/lesson-design-studio-gate", () => ({
  getLessonDesignStudioGateStatus: vi.fn(async () => ({ unlocked: true })),
}));

vi.mock("../../app/(app)/instructor/lesson-design-studio/studio-client", () => ({
  StudioClient: studioClientMock,
}));

vi.mock("../../app/(app)/instructor/lesson-design-studio/studio.css", () => ({}));

vi.mock("@/components/workflow-engine/entity-workflow-card", () => ({
  EntityWorkflowCard: entityWorkflowCardMock,
}));

import LessonDesignStudioDraftStepPage from "@/app/(app)/instructor/lesson-design-studio/[draftId]/[step]/page";

describe("LessonDesignStudioDraftStepPage — workflow card integration", () => {
  beforeEach(() => {
    entityWorkflowCardMock.mockClear();
    studioClientMock.mockClear();
  });

  it("renders EntityWorkflowCard scoped to the curriculum draft, alongside StudioClient", async () => {
    const element = await LessonDesignStudioDraftStepPage({
      params: Promise.resolve({ draftId: "draft-1", step: "outcomes" }),
      searchParams: Promise.resolve({}),
    });

    expect(element).toBeTruthy();

    // The page returns a fragment; walk its children to find the wrapped
    // EntityWorkflowCard and the StudioClient elements.
    const children = (element as { props: { children: unknown[] } }).props.children as any[];
    const workflowCardWrapper = children[0];
    const workflowCardElement = workflowCardWrapper.props.children;

    expect(workflowCardElement.type).toBe(entityWorkflowCardMock);
    expect(workflowCardElement.props).toEqual({
      entityType: "CURRICULUM_DRAFT",
      entityId: "draft-1",
      title: "Curriculum approval workflow",
    });

    const studioClientElement = children[1];
    expect(studioClientElement.type).toBe(studioClientMock);
    expect(studioClientElement.props.draft.id).toBe("draft-1");
  });
});
