import { describe, expect, it, vi } from "vitest";

import {
  backfillMentorshipActions,
  type BackfillPrismaClient,
} from "@/scripts/backfill-mentorship-actions";

type LegacyRow = Awaited<
  ReturnType<BackfillPrismaClient["mentorshipActionItem"]["findMany"]>
>[number];

type ActionLookup = { id: string; status?: string | null };

function legacyRow(overrides: Partial<LegacyRow> = {}): LegacyRow {
  const createdAt = new Date("2026-06-01T12:00:00.000Z");
  const updatedAt = new Date("2026-06-02T12:00:00.000Z");

  return {
    id: "legacy-1",
    mentorshipId: "mentorship-1",
    menteeId: "mentee-1",
    sessionId: null,
    session: null,
    title: "Bring a project outline",
    details: "Share the first draft before the next check-in.",
    status: "OPEN",
    ownerId: "mentee-1",
    createdById: "mentor-1",
    dueAt: new Date("2026-06-10T00:00:00.000Z"),
    completedAt: null,
    linkedActionId: null,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function makeClient(
  rows: LegacyRow[],
  options: {
    linkedActions?: Map<string, ActionLookup>;
    sourceMatches?: Map<string, string>;
    possibleMatches?: Map<string, string>;
  } = {}
): BackfillPrismaClient {
  let client: BackfillPrismaClient;

  client = {
    mentorshipActionItem: {
      findMany: vi.fn(async (args) => {
        const cursorId = args.cursor?.id;
        const startIndex = cursorId
          ? rows.findIndex((row) => row.id === cursorId) + 1
          : 0;
        return rows.slice(startIndex, startIndex + args.take);
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        if (row) row.linkedActionId = data.linkedActionId;
        return row ?? {};
      }),
    },
    actionItem: {
      findUnique: vi.fn(async ({ where }) => {
        return options.linkedActions?.get(where.id) ?? null;
      }),
      findFirst: vi.fn(async ({ where }) => {
        const sourceId = typeof where.sourceId === "string" ? where.sourceId : null;
        if (sourceId) {
          const sourceMatch = options.sourceMatches?.get(sourceId);
          if (sourceMatch) return { id: sourceMatch };
        }

        const title = typeof where.title === "string" ? where.title : null;
        if (title) {
          const possibleMatch = options.possibleMatches?.get(title);
          if (possibleMatch) return { id: possibleMatch };
        }

        return null;
      }),
      create: vi.fn(async () => ({ id: "action-created-1" })),
    },
    $transaction: vi.fn(async (fn) => fn(client)),
  };

  return client;
}

describe("backfillMentorshipActions", () => {
  it("defaults to dry-run and reports records it would create", async () => {
    const client = makeClient([legacyRow()]);

    const summary = await backfillMentorshipActions(client);

    expect(summary.mode).toBe("dry-run");
    expect(summary.recordsScanned).toBe(1);
    expect(summary.recordsWouldCreate).toBe(1);
    expect(summary.recordsCreated).toBe(0);
    expect(client.actionItem.create).not.toHaveBeenCalled();
    expect(client.mentorshipActionItem.update).not.toHaveBeenCalled();
  });

  it("creates a canonical mentorship ActionItem with source-session provenance", async () => {
    const completedAt = new Date("2026-06-03T18:00:00.000Z");
    const row = legacyRow({
      status: "COMPLETE",
      completedAt,
      sessionId: "session-1",
      session: {
        id: "session-1",
        mentorshipId: "mentorship-1",
        menteeId: "mentee-1",
      },
    });
    const client = makeClient([row]);

    const summary = await backfillMentorshipActions(client, { apply: true });

    expect(summary.recordsCreated).toBe(1);
    expect(summary.legacyLinksUpdated).toBe(1);
    expect(client.actionItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Bring a project outline",
        description: "Share the first draft before the next check-in.",
        status: "COMPLETE",
        completedAt,
        visibility: "ALL_LEADERSHIP",
        leadId: "mentee-1",
        createdById: "mentor-1",
        relatedEntityType: "MENTORSHIP",
        relatedEntityId: "mentorship-1",
        sourceType: "ENTITY",
        sourceId: "legacy-1",
        mentorshipSessionId: "session-1",
      }),
      select: { id: true },
    });
    expect(client.mentorshipActionItem.update).toHaveBeenCalledWith({
      where: { id: "legacy-1" },
      data: { linkedActionId: "action-created-1" },
    });
  });

  it("reuses an existing linkedActionId without creating a duplicate", async () => {
    const client = makeClient(
      [legacyRow({ linkedActionId: "action-1" })],
      { linkedActions: new Map([["action-1", { id: "action-1", status: "IN_PROGRESS" }]]) }
    );

    const summary = await backfillMentorshipActions(client, { apply: true });

    expect(summary.recordsAlreadyLinked).toBe(1);
    expect(client.actionItem.create).not.toHaveBeenCalled();
    expect(client.mentorshipActionItem.update).not.toHaveBeenCalled();
  });

  it("updates linkedActionId when a canonical source match already exists", async () => {
    const client = makeClient(
      [legacyRow()],
      { sourceMatches: new Map([["legacy-1", "action-existing"]]) }
    );

    const summary = await backfillMentorshipActions(client, { apply: true });

    expect(summary.recordsCreated).toBe(0);
    expect(summary.legacyLinksUpdated).toBe(1);
    expect(client.actionItem.create).not.toHaveBeenCalled();
    expect(client.mentorshipActionItem.update).toHaveBeenCalledWith({
      where: { id: "legacy-1" },
      data: { linkedActionId: "action-existing" },
    });
  });

  it("skips ambiguous ownership instead of guessing a lead", async () => {
    const client = makeClient([legacyRow({ ownerId: null })]);

    const summary = await backfillMentorshipActions(client, { apply: true });

    expect(summary.recordsSkipped).toBe(1);
    expect(summary.ambiguousOwnershipCases).toBe(1);
    expect(summary.skipped[0]?.reason).toContain("missing owner");
    expect(client.actionItem.create).not.toHaveBeenCalled();
  });

  it("fails safely when an unlinked row looks like a possible duplicate", async () => {
    const client = makeClient(
      [legacyRow()],
      { possibleMatches: new Map([["Bring a project outline", "action-possible"]]) }
    );

    const summary = await backfillMentorshipActions(client, { apply: true });

    expect(summary.recordsFailed).toBe(1);
    expect(summary.failed[0]?.reason).toContain("possible existing mentorship ActionItem");
    expect(client.actionItem.create).not.toHaveBeenCalled();
    expect(client.mentorshipActionItem.update).not.toHaveBeenCalled();
  });
});
