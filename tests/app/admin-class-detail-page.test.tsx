import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

// ── Hoisted mock fns (referenced inside vi.mock factories below) ──────────
const {
  entityWorkflowCardMock,
  loadClassAdminDetailMock,
  getOfferingTimelineMock,
  getSessionMock,
} = vi.hoisted(() => ({
  entityWorkflowCardMock: vi.fn(async () =>
    createElement("div", { "data-testid": "workflow-card" }),
  ),
  loadClassAdminDetailMock: vi.fn(async () => ({
    id: "class-1",
    title: "Intro to Robotics",
    chapterId: "chapter-9",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-03-01"),
    meetingDays: ["Monday"],
    meetingTime: "16:00-18:00",
    timezone: "America/New_York",
    deliveryMode: "VIRTUAL",
    locationName: null,
    locationAddress: null,
    zoomLink: "https://zoom.example/abc",
    status: "ACTIVE",
    confirmedCount: 0,
    approval: null,
  })),
  getOfferingTimelineMock: vi.fn(async () => []),
  getSessionMock: vi.fn(async () => ({
    user: { id: "user-1", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: [] },
  })),
}));

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("@/app/(app)/admin/classes/[id]/_components/loaders", () => ({
  loadClassAdminDetail: loadClassAdminDetailMock,
}));

vi.mock("@/lib/class-offering-timeline", () => ({
  getOfferingTimeline: getOfferingTimelineMock,
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/people-strategy/action-permissions", () => ({
  canCreateAction: vi.fn(() => false),
}));

vi.mock("@/lib/people-strategy/operational-context-queries", () => ({
  getOperationalContextForEntity: vi.fn(async () => null),
}));

vi.mock("@/components/people-strategy/operational-context-panel", () => ({
  OperationalContextPanel: vi.fn(() => createElement("div", { "data-testid": "ops-context" })),
}));

vi.mock("@/lib/people-strategy/action-prefill", () => ({
  meetingPrefillToQuery: vi.fn(() => "/meetings/new"),
}));

vi.mock("@/components/help-agent/ask-about-this", () => ({
  AskAboutThis: vi.fn(() => createElement("div", { "data-testid": "ask-about-this" })),
}));

vi.mock("@/app/(app)/admin/classes/[id]/_components/publish-controls", () => ({
  ClassPublishControls: vi.fn(() => createElement("div", { "data-testid": "publish-controls" })),
}));

vi.mock("@/app/(app)/admin/classes/[id]/_components/header", () => ({
  ClassReviewBanner: vi.fn(() => null),
}));

vi.mock("@/components/workflow-engine/entity-workflow-card", () => ({
  EntityWorkflowCard: entityWorkflowCardMock,
}));

import AdminClassOverviewPage from "@/app/(app)/admin/classes/[id]/page";

describe("AdminClassOverviewPage — workflow card integration", () => {
  beforeEach(() => {
    entityWorkflowCardMock.mockClear();
  });

  it("renders EntityWorkflowCard scoped to the class offering, between Connected work and Recent activity", async () => {
    const element = await AdminClassOverviewPage({
      params: Promise.resolve({ id: "class-1" }),
    });

    expect(element).toBeTruthy();

    const children = (element as { props: { children: unknown[] } }).props
      .children as any[];

    const workflowCardIndex = children.findIndex(
      (child) => child?.type === entityWorkflowCardMock,
    );
    expect(workflowCardIndex).toBeGreaterThan(-1);

    const workflowCardElement = children[workflowCardIndex];
    expect(workflowCardElement.props).toEqual({
      entityType: "CLASS_OFFERING",
      entityId: "class-1",
      chapterId: "chapter-9",
      title: "Class launch workflow",
    });

    // "Recent activity" RecordSection should come after the workflow card.
    const recentActivityIndex = children.findIndex(
      (child) =>
        child?.props?.title === "Recent activity",
    );
    expect(recentActivityIndex).toBeGreaterThan(workflowCardIndex);
  });

  it("falls back to null chapterId when the class has none", async () => {
    loadClassAdminDetailMock.mockResolvedValueOnce({
      id: "class-2",
      title: "No Chapter Class",
      chapterId: null,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-01"),
      meetingDays: [],
      meetingTime: "",
      timezone: "America/New_York",
      deliveryMode: "VIRTUAL",
      locationName: null,
      locationAddress: null,
      zoomLink: null,
      status: "ACTIVE",
      confirmedCount: 0,
      approval: null,
    });

    const element = await AdminClassOverviewPage({
      params: Promise.resolve({ id: "class-2" }),
    });

    const children = (element as { props: { children: unknown[] } }).props
      .children as any[];
    const workflowCardElement = children.find(
      (child) => child?.type === entityWorkflowCardMock,
    );

    expect(workflowCardElement.props.chapterId).toBeNull();
    expect(workflowCardElement.props.entityId).toBe("class-2");
  });
});
