import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

// ── Hoisted mock fns (referenced inside vi.mock factories below) ──────────
const { entityWorkflowCardMock, relationshipWorkspaceMock } = vi.hoisted(() => ({
  entityWorkflowCardMock: vi.fn(async () =>
    createElement("div", { "data-testid": "workflow-card" })
  ),
  relationshipWorkspaceMock: vi.fn(async () =>
    createElement("div", { "data-testid": "relationship-workspace" })
  ),
}));

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(async () => ({
    user: { id: "admin-1", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: [] },
  })),
}));

vi.mock("@/lib/mentorship-program-actions", () => ({
  reassignProgramMentor: vi.fn(),
  setProgramMentorshipStatus: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mentorship: {
      findUnique: vi.fn(async () => ({
        id: "ms-1",
        mentorId: "mentor-1",
        menteeId: "mentee-1",
        status: "ACTIVE",
      })),
    },
    user: {
      findMany: vi.fn(async () => []),
    },
  },
}));

vi.mock("@/components/mentorship/relationship-workspace/relationship-workspace", () => ({
  RelationshipWorkspace: relationshipWorkspaceMock,
}));

vi.mock("@/components/workflow-engine/entity-workflow-card", () => ({
  EntityWorkflowCard: entityWorkflowCardMock,
}));

import AdminMentorshipRelationshipDetailPage from "@/app/(app)/admin/mentorship/relationships/[mentorshipId]/page";

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

describe("AdminMentorshipRelationshipDetailPage — workflow card integration", () => {
  beforeEach(() => {
    entityWorkflowCardMock.mockClear();
    relationshipWorkspaceMock.mockClear();
  });

  it("renders EntityWorkflowCard scoped to the mentorship (MENTORSHIP) inside adminControls", async () => {
    const element = await AdminMentorshipRelationshipDetailPage({
      params: { mentorshipId: "ms-1" },
    });

    // The page renders RelationshipWorkspace with an adminControls prop
    // (a React element tree), not as a rendered child — assert against the
    // adminControls prop directly since RelationshipWorkspace is mocked out.
    const workspaceMatches = findElementsByType(element, relationshipWorkspaceMock);
    expect(workspaceMatches).toHaveLength(1);

    const adminControls = workspaceMatches[0].props.adminControls;
    const cardMatches = findElementsByType(adminControls, entityWorkflowCardMock);
    expect(cardMatches).toHaveLength(1);
    expect(cardMatches[0].props).toEqual({
      entityType: "MENTORSHIP",
      entityId: "ms-1",
      title: "Mentorship workflow",
    });
  });
});
