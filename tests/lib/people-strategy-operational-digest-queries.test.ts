import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma so the real meeting mappers can be imported without a client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEnabled: vi.fn(() => true),
}));

// Override only the DB loaders; keep the real pure mappers / derivations.
vi.mock("@/lib/people-strategy/action-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/people-strategy/action-queries")>();
  return { ...actual, listVisibleActionItems: vi.fn() };
});
vi.mock("@/lib/people-strategy/meetings-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/people-strategy/meetings-queries")>();
  return {
    ...actual,
    listMeetingsInRange: vi.fn(),
    getMeetingsForEntities: vi.fn(),
    listMeetingsForArea: vi.fn(),
  };
});
vi.mock("@/lib/people-strategy/connections", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/people-strategy/connections")>();
  return { ...actual, loadRelatedEntityLabels: vi.fn() };
});
vi.mock("@/lib/people-strategy/operational-context-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/people-strategy/operational-context-queries")>();
  return { ...actual, getOperationalContextForEntity: vi.fn() };
});

import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { listVisibleActionItems, type ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  getMeetingsForEntities,
  listMeetingsForArea,
  listMeetingsInRange,
  type MeetingWithCommandCenter,
} from "@/lib/people-strategy/meetings-queries";
import { loadRelatedEntityLabels, type RelatedEntitySummary } from "@/lib/people-strategy/connections";
import {
  getOperationalContextForEntity,
  type EntityOperationalContext,
} from "@/lib/people-strategy/operational-context-queries";
import { computeOperationalHealth } from "@/lib/people-strategy/operational-context";
import {
  getOperationalDigestForArea,
  getOperationalDigestForEntity,
  getWeeklyOperationalDigestForViewer,
} from "@/lib/people-strategy/operational-digest-queries";

const NOW = new Date("2026-06-04T12:00:00");
const VIEWER = { id: "admin", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: ["LEADERSHIP"] };

type Assignment = ActionItemWithRelations["assignments"][number];
function assignment(userId: string, role: Assignment["role"]): Assignment {
  return {
    id: `${userId}-${role}`,
    role,
    createdAt: NOW,
    user: { id: userId, name: userId, email: `${userId}@x.org`, primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null },
  } as Assignment;
}

function action(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Item",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-10T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    leadId: "alice",
    lead: { id: "alice", name: "Alice", email: "alice@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null },
    officerMeetingId: null,
    officerMeeting: null,
    relatedEntityType: null,
    relatedEntityId: null,
    flaggedAt: null,
    resolvedAt: null,
    createdAt: new Date("2026-05-01T00:00:00"),
    updatedAt: new Date("2026-06-03T00:00:00"),
    assignments: [assignment("alice", "LEAD"), assignment("bob", "EXECUTING")],
    comments: [],
    ...overrides,
  } as ActionItemWithRelations;
}

function rawMeeting(overrides: Record<string, unknown> = {}): MeetingWithCommandCenter {
  return {
    id: "rm" + Math.random().toString(36).slice(2),
    title: "Ops Sync",
    purpose: null,
    date: new Date("2026-06-02T18:00:00"),
    endTime: null,
    category: "CLASSES",
    priority: "MEDIUM",
    recurrence: null,
    location: null,
    status: "COMPLETED",
    notesText: null,
    facilitatorId: null,
    facilitator: null,
    attendees: [],
    agendaItems: [],
    decisions: [],
    followUps: [],
    actionItems: [],
    relatedEntityType: null,
    relatedEntityId: null,
    ...overrides,
  } as unknown as MeetingWithCommandCenter;
}

function rawDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: "d" + Math.random().toString(36).slice(2),
    decision: "Ship the new flow",
    rationale: null,
    createdAt: new Date("2026-06-01T00:00:00"),
    linkedActionId: null,
    linkedAction: null,
    decidedBy: { id: "u1", name: "Alice", email: "alice@x.org" },
    ...overrides,
  };
}

function classSummary(id: string, label: string): RelatedEntitySummary {
  return { type: "CLASS_OFFERING", id, label, typeLabel: "Class", href: `/admin/classes/${id}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isActionTrackerEnabled).mockReturnValue(true);
  vi.mocked(listVisibleActionItems).mockResolvedValue([]);
  vi.mocked(listMeetingsInRange).mockResolvedValue([]);
  vi.mocked(listMeetingsForArea).mockResolvedValue([]);
  vi.mocked(getMeetingsForEntities).mockResolvedValue(new Map());
  vi.mocked(loadRelatedEntityLabels).mockResolvedValue(new Map());
});

describe("getWeeklyOperationalDigestForViewer", () => {
  it("returns an empty digest for an empty org", async () => {
    const d = await getWeeklyOperationalDigestForViewer(VIEWER, { now: NOW });
    expect(d.counts.overdueActions).toBe(0);
    expect(d.counts.criticalEntities).toBe(0);
    expect(d.recommendedReviewOrder).toEqual([]);
  });

  it("short-circuits to an empty digest when the tracker is off (no DB reads)", async () => {
    vi.mocked(isActionTrackerEnabled).mockReturnValue(false);
    const d = await getWeeklyOperationalDigestForViewer(VIEWER, { now: NOW });
    expect(d.counts.overdueActions).toBe(0);
    expect(listVisibleActionItems).not.toHaveBeenCalled();
    expect(listMeetingsInRange).not.toHaveBeenCalled();
  });

  it("surfaces one critical entity and ranks it first", async () => {
    vi.mocked(listVisibleActionItems).mockResolvedValue([
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
    ]);
    // The entity's last meeting is old (history loaded via getMeetingsForEntities).
    vi.mocked(getMeetingsForEntities).mockResolvedValue(
      new Map([["CLASS_OFFERING:cls1", [rawMeeting({ id: "old1", date: new Date("2026-04-01T18:00:00"), relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1" })]]])
    );
    vi.mocked(loadRelatedEntityLabels).mockResolvedValue(
      new Map([["CLASS_OFFERING:cls1", classSummary("cls1", "Algebra 101")]])
    );

    const d = await getWeeklyOperationalDigestForViewer(VIEWER, { now: NOW });
    expect(d.counts.criticalEntities).toBe(1);
    expect(d.criticalEntities[0].label).toBe("Algebra 101");
    expect(d.criticalEntities[0].daysSinceLastMeeting).toBe(64); // Apr 1 → Jun 4
    expect(d.recommendedReviewOrder[0].kind).toBe("class");
    // The class history meeting was loaded by the batched per-entity query.
    expect(getMeetingsForEntities).toHaveBeenCalledWith([{ type: "CLASS_OFFERING", id: "cls1" }]);
  });

  it("extracts decisions-needing-action and meetings-without-actions from real mappers", async () => {
    vi.mocked(listMeetingsInRange).mockResolvedValue([
      // A recent completed meeting with a decision but no linked action.
      rawMeeting({
        id: "rmA",
        date: new Date("2026-06-02T18:00:00"),
        status: "COMPLETED",
        decisions: [rawDecision({ createdAt: new Date("2026-06-02T00:00:00") })],
        actionItems: [],
      }),
    ]);

    const d = await getWeeklyOperationalDigestForViewer(VIEWER, { now: NOW });
    expect(d.counts.decisionsNeedingAction).toBe(1);
    expect(d.counts.meetingsWithoutActions).toBe(1);
    expect(d.meetingsNeedingFollowThrough.length).toBeGreaterThan(0);
    expect(d.decisionsNeedingAction[0].decision).toBe("Ship the new flow");
  });

  it("treats multiple entity types and counts warnings vs criticals", async () => {
    vi.mocked(listVisibleActionItems).mockResolvedValue([
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "PARTNER", relatedEntityId: "p1", deadlineStart: new Date("2026-05-25T00:00:00") }),
    ]);
    const d = await getWeeklyOperationalDigestForViewer(VIEWER, { now: NOW });
    expect(d.counts.criticalEntities).toBe(1);
    expect(d.counts.warningEntities).toBe(1);
  });
});

describe("getOperationalDigestForArea", () => {
  it("scopes the digest to actions whose entity rolls up to the area", async () => {
    vi.mocked(listVisibleActionItems).mockResolvedValue([
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }), // CLASSES area
      action({ relatedEntityType: "PARTNER", relatedEntityId: "p1", deadlineStart: new Date("2026-05-20T00:00:00") }), // PARTNERSHIPS area — excluded
    ]);
    const out = await getOperationalDigestForArea("CLASSES", VIEWER, { now: NOW });
    expect(out.area).toBe("CLASSES");
    expect(out.areaLabel).toBe("Classes");
    expect(out.health.level).toBe("at_risk"); // 1 overdue class action
    expect(out.explanation.headline).toMatch(/Warning because/);
    // Only the class action rolled into the area digest.
    expect(out.digest.counts.overdueActions).toBe(1);
  });

  it("returns an empty area when the tracker is off", async () => {
    vi.mocked(isActionTrackerEnabled).mockReturnValue(false);
    const out = await getOperationalDigestForArea("MENTORSHIP", VIEWER, { now: NOW });
    expect(out.digest.counts.overdueActions).toBe(0);
    expect(out.health.level).toBe("healthy");
  });
});

describe("getOperationalDigestForEntity", () => {
  it("enriches the existing entity context with an explanation + counts", async () => {
    const context: EntityOperationalContext = {
      ref: { type: "CLASS_OFFERING", id: "cls1" },
      area: "CLASSES",
      summary: classSummary("cls1", "Algebra 101"),
      meetings: [],
      actions: [
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      ],
      openFollowUps: [],
      recentDecisions: [],
      health: computeOperationalHealth({ openActions: 3, overdueActions: 3 }),
    };
    vi.mocked(getOperationalContextForEntity).mockResolvedValue(context);

    const out = await getOperationalDigestForEntity("CLASS_OFFERING", "cls1", VIEWER, { now: NOW });
    expect(out).not.toBeNull();
    expect(out!.overdueCount).toBe(3);
    expect(out!.openCount).toBe(3);
    expect(out!.explanation.level).toBe("critical");
    expect(out!.isStale).toBe(true); // open work, no meeting on record
    expect(out!.recommendedNextAction.length).toBeGreaterThan(0);
  });

  it("returns null when the context loader returns null", async () => {
    vi.mocked(getOperationalContextForEntity).mockResolvedValue(null);
    const out = await getOperationalDigestForEntity("CLASS_OFFERING", "missing", VIEWER, { now: NOW });
    expect(out).toBeNull();
  });
});
