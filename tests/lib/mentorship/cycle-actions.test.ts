import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authorization")>();
  return { ...actual, requireLeadership: vi.fn() };
});
vi.mock("@/lib/development/load", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/development/load")>();
  return { ...actual, loadDevelopmentPeople: vi.fn() };
});

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import { loadDevelopmentPeople } from "@/lib/development/load";
import { EMPTY_DEVELOPMENT_FACTS } from "@/lib/development/signals";
import {
  closeReviewCycle,
  launchReviewCycle,
  setParticipantOverride,
  startReviewForPerson,
} from "@/lib/mentorship/cycle-actions";
import { LaunchReviewCycleSchema } from "@/lib/mentorship/cycle-schemas";

const LEADERSHIP_USER = {
  id: "leader-1",
  roles: ["ADMIN"],
  primaryRole: "ADMIN",
  adminSubtypes: ["LEADERSHIP"],
} as never;

function factsPerson(id: string, overrides: Record<string, unknown> = {}) {
  return {
    ...EMPTY_DEVELOPMENT_FACTS,
    id,
    name: `Person ${id}`,
    email: `${id}@ypp.org`,
    role: "INSTRUCTOR",
    population: "instructor",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENABLE_PEOPLE_DASHBOARD = "true";
  vi.mocked(requireLeadership).mockResolvedValue(LEADERSHIP_USER);
  vi.mocked(loadDevelopmentPeople).mockResolvedValue([
    factsPerson("inst-1", { daysSinceJoined: 5 }),
    factsPerson("inst-2", { daysSinceJoined: 400 }),
  ] as never);

  (prisma as never as Record<string, unknown>).reviewCycle = {
    create: vi.fn().mockResolvedValue({ id: "cycle-1" }),
    update: vi.fn().mockResolvedValue({ id: "cycle-1" }),
  };
  (prisma as never as Record<string, unknown>).reviewCycleParticipant = {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({ cycleId: "cycle-1" }),
  };
  (prisma as never as Record<string, unknown>).mentorship = {
    findMany: vi.fn().mockResolvedValue([{ id: "pair-1", menteeId: "inst-1" }]),
    findFirst: vi.fn().mockResolvedValue(null),
  };
  (prisma as never as Record<string, unknown>).user = {
    findMany: vi
      .fn()
      .mockResolvedValue([{ id: "inst-1", name: "Person inst-1", email: "i1@ypp.org" }]),
  };
  (prisma as never as Record<string, unknown>).chapter = {
    findUnique: vi.fn().mockResolvedValue({ name: "Scarsdale" }),
  };
});

describe("LaunchReviewCycleSchema", () => {
  it("rejects unknown kinds, scopes, and empty custom lists", () => {
    expect(() =>
      LaunchReviewCycleSchema.parse({ kind: "weekly", scope: { type: "custom", userIds: ["a"] } })
    ).toThrow();
    expect(() =>
      LaunchReviewCycleSchema.parse({ kind: "monthly", scope: { type: "everyone" } })
    ).toThrow();
    expect(() =>
      LaunchReviewCycleSchema.parse({ kind: "monthly", scope: { type: "custom", userIds: [] } })
    ).toThrow();
  });

  it("accepts a lane scope with population", () => {
    const parsed = LaunchReviewCycleSchema.parse({
      kind: "monthly",
      scope: { type: "lane", lane: "review-due", population: "instructor" },
    });
    expect(parsed.scope.type).toBe("lane");
  });
});

describe("launchReviewCycle", () => {
  it("refuses viewers who fail the leadership gate", async () => {
    vi.mocked(requireLeadership).mockRejectedValue(new Error("Unauthorized"));
    await expect(
      launchReviewCycle({
        kind: "monthly",
        scope: { type: "role-group", group: "instructors" },
      })
    ).rejects.toThrow();
    expect(
      (prisma as never as { reviewCycle: { create: ReturnType<typeof vi.fn> } }).reviewCycle
        .create
    ).not.toHaveBeenCalled();
  });

  it("creates the cycle and one participant per person, snapshotting pairings", async () => {
    const result = await launchReviewCycle({
      kind: "monthly",
      scope: { type: "role-group", group: "instructors" },
    });
    expect(result).toEqual({ ok: true, cycleId: "cycle-1", participantCount: 2 });

    const createArgs = (
      prisma as never as { reviewCycle: { create: ReturnType<typeof vi.fn> } }
    ).reviewCycle.create.mock.calls[0][0];
    expect(createArgs.data.scopeType).toBe("role-group");
    expect(createArgs.data.scopeLabel).toBe("All instructors");
    expect(createArgs.data.kind).toBe("monthly");
    expect(createArgs.data.periodLabel).toMatch(/^\d{4}-\d{2}$/);
    expect(createArgs.data.createdById).toBe("leader-1");

    const createManyArgs = (
      prisma as never as {
        reviewCycleParticipant: { createMany: ReturnType<typeof vi.fn> };
      }
    ).reviewCycleParticipant.createMany.mock.calls[0][0];
    expect(createManyArgs.data).toEqual([
      { cycleId: "cycle-1", userId: "inst-1", mentorshipId: "pair-1" },
      { cycleId: "cycle-1", userId: "inst-2", mentorshipId: null },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/mentorship");
    expect(revalidatePath).toHaveBeenCalledWith("/mentorship/cycles");
  });

  it("returns a typed error (creating nothing) for an empty cohort", async () => {
    vi.mocked(loadDevelopmentPeople).mockResolvedValue([] as never);
    const result = await launchReviewCycle({
      kind: "monthly",
      scope: { type: "role-group", group: "chapter-presidents" },
    });
    expect(result.ok).toBe(false);
    expect(
      (prisma as never as { reviewCycle: { create: ReturnType<typeof vi.fn> } }).reviewCycle
        .create
    ).not.toHaveBeenCalled();
  });

  it("uses a quarterly period label for quarterly cycles", async () => {
    await launchReviewCycle({
      kind: "quarterly",
      scope: { type: "role-group", group: "instructors" },
    });
    const createArgs = (
      prisma as never as { reviewCycle: { create: ReturnType<typeof vi.fn> } }
    ).reviewCycle.create.mock.calls[0][0];
    expect(createArgs.data.periodLabel).toMatch(/^\d{4}-Q[1-4]$/);
  });
});

describe("startReviewForPerson", () => {
  it("launches a single-participant custom cycle named for the person", async () => {
    const result = await startReviewForPerson({ userId: "inst-1" });
    expect(result.ok).toBe(true);

    const createArgs = (
      prisma as never as { reviewCycle: { create: ReturnType<typeof vi.fn> } }
    ).reviewCycle.create.mock.calls[0][0];
    expect(createArgs.data.scopeType).toBe("custom");
    expect(createArgs.data.scopeLabel).toBe("Person inst-1");

    const createManyArgs = (
      prisma as never as {
        reviewCycleParticipant: { createMany: ReturnType<typeof vi.fn> };
      }
    ).reviewCycleParticipant.createMany.mock.calls[0][0];
    expect(createManyArgs.data).toHaveLength(1);
    expect(createManyArgs.data[0].userId).toBe("inst-1");
  });
});

describe("cycle maintenance actions", () => {
  it("closes a cycle and stamps closedAt", async () => {
    await closeReviewCycle({ cycleId: "cycle-1" });
    const updateArgs = (
      prisma as never as { reviewCycle: { update: ReturnType<typeof vi.fn> } }
    ).reviewCycle.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "cycle-1" });
    expect(updateArgs.data.status).toBe("closed");
    expect(updateArgs.data.closedAt).toBeInstanceOf(Date);
  });

  it("waives and un-waives a participant", async () => {
    await setParticipantOverride({ participantId: "p-1", override: "waived" });
    await setParticipantOverride({ participantId: "p-1", override: null });
    const calls = (
      prisma as never as {
        reviewCycleParticipant: { update: ReturnType<typeof vi.fn> };
      }
    ).reviewCycleParticipant.update.mock.calls;
    expect(calls[0][0].data.stageOverride).toBe("waived");
    expect(calls[1][0].data.stageOverride).toBeNull();
  });

  it("rejects an unknown override value", async () => {
    await expect(
      setParticipantOverride({ participantId: "p-1", override: "skipped" })
    ).rejects.toThrow();
  });
});
