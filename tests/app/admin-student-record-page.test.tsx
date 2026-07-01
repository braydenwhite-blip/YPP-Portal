import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

// ── Hoisted mock fns (referenced inside vi.mock factories below) ──────────
const { entityWorkflowCardMock, loadStudentRecordMock } = vi.hoisted(() => ({
  entityWorkflowCardMock: vi.fn(async () =>
    createElement("div", { "data-testid": "workflow-card" })
  ),
  loadStudentRecordMock: vi.fn(async () => ({
    id: "student-1",
    name: "Grace Hopper",
    email: "grace@example.com",
    avatarUrl: null,
    grade: 10,
    school: "Test High",
    chapterName: "Chapter One",
    joinedAtISO: "2025-01-01T00:00:00.000Z",
    roleSet: ["STUDENT"],
    certificateCount: 0,
    classes: [],
    legacyCourses: [],
    advising: null,
    mentor: null,
    parents: [],
  })),
}));

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(async () => ({
    user: { id: "session-user-1", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: [] },
  })),
}));

vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEnabled: vi.fn(() => false),
  isOperationsHubEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/people-strategy/operational-context-queries", () => ({
  getOperationalContextForEntity: vi.fn(async () => null),
}));

vi.mock("@/lib/people-strategy/operational-digest", () => ({
  toActionLite: vi.fn((a: unknown) => a),
}));

vi.mock("@/lib/people/student-record", () => ({
  loadStudentRecord: loadStudentRecordMock,
}));

vi.mock("@/components/workflow-engine/entity-workflow-card", () => ({
  EntityWorkflowCard: entityWorkflowCardMock,
}));

import AdminStudentRecordPage from "@/app/(app)/admin/students/[id]/page";

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

describe("AdminStudentRecordPage — workflow card integration", () => {
  beforeEach(() => {
    entityWorkflowCardMock.mockClear();
    loadStudentRecordMock.mockClear();
  });

  it("renders EntityWorkflowCard scoped to the student (USER) with the advising title", async () => {
    const element = await AdminStudentRecordPage({
      params: Promise.resolve({ id: "student-1" }),
    });

    const matches = findElementsByType(element, entityWorkflowCardMock);
    expect(matches).toHaveLength(1);
    expect(matches[0].props).toEqual({
      entityType: "USER",
      entityId: "student-1",
      title: "Advising workflow",
    });
  });
});
