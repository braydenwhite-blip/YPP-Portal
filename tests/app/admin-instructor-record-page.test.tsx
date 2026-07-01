import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

// ── Hoisted mock fns (referenced inside vi.mock factories below) ──────────
const { entityWorkflowCardMock, getInstructorOpsProfileMock } = vi.hoisted(() => ({
  entityWorkflowCardMock: vi.fn(async () =>
    createElement("div", { "data-testid": "workflow-card" })
  ),
  getInstructorOpsProfileMock: vi.fn(async () => ({
    record: {
      id: "instructor-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
      avatarUrl: null,
      chapterId: "chapter-9",
      chapterName: "Chapter Nine",
      roles: ["INSTRUCTOR"],
      stageLabel: "Active",
      stageDetail: "In good standing",
      needsAttention: false,
      currentLoadLabel: "Available",
      trainingCompleted: 3,
      trainingTotal: 3,
      attentionFlags: [],
      application: null,
    },
    user: {
      classOfferingsInstructed: [],
      courses: [],
      coInstructorAssignments: [],
      menteePairs: [],
      mentorPairs: [],
      instructorApplications: [],
      instructorGrowthEvents: [],
    },
    readiness: { missingRequirements: [] },
  })),
}));

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(async () => ({
    user: { id: "session-user-1", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: [] },
  })),
}));

vi.mock("@/lib/instructor-ops", () => ({
  getInstructorOpsProfile: getInstructorOpsProfileMock,
  formatInstructorOpsDate: (v: unknown) => String(v ?? ""),
  formatInstructorOpsDateTime: (v: unknown) => String(v ?? ""),
  formatInstructorOpsLabel: (v: unknown) => String(v ?? ""),
}));

vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEnabled: vi.fn(() => false),
  isLeadershipRolesEnabled: vi.fn(() => false),
  isOperationsHubEnabled: vi.fn(() => false),
  isQuarterlyReviewsEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/people-strategy/quarterly-review-actions", () => ({
  getLatestQuarterlyReview: vi.fn(async () => null),
}));

vi.mock("@/lib/leadership/queries", () => ({
  loadInstructorLeadership: vi.fn(async () => null),
}));

vi.mock("@/lib/people-strategy/operational-context-queries", () => ({
  getOperationalContextForEntity: vi.fn(async () => null),
}));

vi.mock("@/lib/people-strategy/operational-digest", () => ({
  toActionLite: vi.fn((a: unknown) => a),
}));

vi.mock("@/lib/people/instructor-record", () => ({
  loadAdvisorCaseload: vi.fn(async () => []),
  loadQuarterlyReviewHistory: vi.fn(async () => []),
  loadUpcomingSessions: vi.fn(async () => []),
}));

vi.mock("@/components/workflow-engine/entity-workflow-card", () => ({
  EntityWorkflowCard: entityWorkflowCardMock,
}));

import AdminInstructorRecordPage from "@/app/(app)/admin/instructors/[id]/page";

function findElementsByType(node: any, type: unknown, out: any[] = []): any[] {
  if (!node || typeof node !== "object") return out;
  if (node.type === type) out.push(node);
  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) findElementsByType(child, type, out);
  } else if (children) {
    findElementsByType(children, type, out);
  }
  return out;
}

describe("AdminInstructorRecordPage — workflow card integration", () => {
  beforeEach(() => {
    entityWorkflowCardMock.mockClear();
    getInstructorOpsProfileMock.mockClear();
  });

  it("renders EntityWorkflowCard scoped to the instructor (USER) with the instructor's chapterId", async () => {
    const element = await AdminInstructorRecordPage({
      params: Promise.resolve({ id: "instructor-1" }),
    });

    const matches = findElementsByType(element, entityWorkflowCardMock);
    expect(matches).toHaveLength(1);
    expect(matches[0].props).toEqual({
      entityType: "USER",
      entityId: "instructor-1",
      chapterId: "chapter-9",
      title: "Onboarding & training workflow",
    });
  });

  it("falls back to null chapterId when the instructor has none", async () => {
    getInstructorOpsProfileMock.mockResolvedValueOnce({
      record: {
        id: "instructor-2",
        name: "No Chapter",
        email: "nc@example.com",
        phone: null,
        avatarUrl: null,
        chapterId: null,
        chapterName: "No chapter",
        roles: ["INSTRUCTOR"],
        stageLabel: "Active",
        stageDetail: "In good standing",
        needsAttention: false,
        currentLoadLabel: "Available",
        trainingCompleted: 0,
        trainingTotal: 3,
        attentionFlags: [],
        application: null,
      },
      user: {
        classOfferingsInstructed: [],
        courses: [],
        coInstructorAssignments: [],
        menteePairs: [],
        mentorPairs: [],
        instructorApplications: [],
        instructorGrowthEvents: [],
      },
      readiness: { missingRequirements: [] },
    });

    const element = await AdminInstructorRecordPage({
      params: Promise.resolve({ id: "instructor-2" }),
    });

    const matches = findElementsByType(element, entityWorkflowCardMock);
    expect(matches).toHaveLength(1);
    expect(matches[0].props.chapterId).toBeNull();
    expect(matches[0].props.entityId).toBe("instructor-2");
  });
});
