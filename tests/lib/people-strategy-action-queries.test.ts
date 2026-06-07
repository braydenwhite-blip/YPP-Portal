import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    actionItem: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  getActionsForEntity,
  getActionsForEntities,
  relatedEntityRefKey,
} from "@/lib/people-strategy/action-queries";

const findMany = prisma.actionItem.findMany as unknown as ReturnType<typeof vi.fn>;

const member: ActionViewer = {
  id: "m1",
  roles: ["STUDENT"],
  primaryRole: "STUDENT",
  adminSubtypes: [],
};
const officer: ActionViewer = {
  id: "o1",
  roles: ["STAFF"],
  primaryRole: "STAFF",
  adminSubtypes: [],
};

// Minimal row shape: only the fields toAccessShape / canViewAction / grouping read.
function row(overrides: Record<string, unknown>) {
  return {
    leadId: null,
    createdById: "x",
    visibility: "ALL_LEADERSHIP",
    assignments: [],
    relatedEntityType: null,
    relatedEntityId: null,
    ...overrides,
  };
}

// m1 is the lead → visible to m1.
const classMine = row({
  id: "a1",
  leadId: "m1",
  relatedEntityType: "CLASS_OFFERING",
  relatedEntityId: "c1",
});
// m1 is not involved → hidden from m1, visible to officers.
const classNotMine = row({
  id: "a2",
  leadId: "someoneElse",
  relatedEntityType: "CLASS_OFFERING",
  relatedEntityId: "c1",
});
// m1 is the lead on a mentorship-linked action.
const mentorshipMine = row({
  id: "a3",
  leadId: "m1",
  relatedEntityType: "MENTORSHIP",
  relatedEntityId: "men1",
});

beforeEach(() => {
  process.env.ENABLE_ACTION_TRACKER = "true";
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.ENABLE_ACTION_TRACKER;
});

describe("getActionsForEntity", () => {
  it("returns [] when the tracker flag is off (no query)", async () => {
    process.env.ENABLE_ACTION_TRACKER = "false";
    const result = await getActionsForEntity("CLASS_OFFERING", "c1", member);
    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns [] for an unknown type without querying", async () => {
    const result = await getActionsForEntity(
      "DEPARTMENT" as never,
      "d1",
      member
    );
    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns [] for a blank id without querying", async () => {
    const result = await getActionsForEntity("CLASS_OFFERING", "   ", member);
    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("filters out actions the member cannot see", async () => {
    findMany.mockResolvedValue([classMine, classNotMine]);
    const result = await getActionsForEntity("CLASS_OFFERING", "c1", member);
    expect(result.map((a) => a.id)).toEqual(["a1"]);
  });

  it("shows officers every action on the entity", async () => {
    findMany.mockResolvedValue([classMine, classNotMine]);
    const result = await getActionsForEntity("CLASS_OFFERING", "c1", officer);
    expect(result.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("queries with a trimmed id scoped to the type", async () => {
    findMany.mockResolvedValue([]);
    await getActionsForEntity("CLASS_OFFERING", "  c1  ", member);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: "c1",
    });
  });
});

describe("getActionsForEntities", () => {
  it("returns an empty map when the flag is off", async () => {
    process.env.ENABLE_ACTION_TRACKER = "false";
    const map = await getActionsForEntities(
      [{ type: "CLASS_OFFERING", id: "c1" }],
      member
    );
    expect(map.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("groups visible actions by ref in a single query and de-dupes refs", async () => {
    findMany.mockResolvedValue([classMine, classNotMine, mentorshipMine]);
    const map = await getActionsForEntities(
      [
        { type: "CLASS_OFFERING", id: "c1" },
        { type: "MENTORSHIP", id: "men1" },
        { type: "CLASS_OFFERING", id: "c1" }, // duplicate
      ],
      member
    );

    // One batched query, with the duplicate ref collapsed.
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.OR).toHaveLength(2);

    // Visibility filtering applied per group (a2 hidden from the member).
    expect(map.get(relatedEntityRefKey("CLASS_OFFERING", "c1"))?.map((a) => a.id)).toEqual([
      "a1",
    ]);
    expect(map.get(relatedEntityRefKey("MENTORSHIP", "men1"))?.map((a) => a.id)).toEqual([
      "a3",
    ]);
  });

  it("seeds every valid ref with an empty list even with no actions", async () => {
    findMany.mockResolvedValue([]);
    const map = await getActionsForEntities(
      [{ type: "CLASS_OFFERING", id: "c1" }],
      member
    );
    expect(map.get(relatedEntityRefKey("CLASS_OFFERING", "c1"))).toEqual([]);
  });

  it("skips invalid / blank refs and queries nothing when none remain", async () => {
    const map = await getActionsForEntities(
      [
        { type: "DEPARTMENT" as never, id: "d1" },
        { type: "USER", id: "   " },
      ],
      member
    );
    expect(map.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
