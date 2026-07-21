import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/public-app-url", () => ({
  toAbsoluteAppUrl: (path: string) => `https://app.test${path}`,
}));

const isActionTrackerEnabled = vi.fn(() => true);
const isActionTrackerEmailsEnabled = vi.fn(() => true);
vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEnabled: () => isActionTrackerEnabled(),
  isActionTrackerEmailsEnabled: () => isActionTrackerEmailsEnabled(),
}));

const sendBoardEscalationRollupEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email", () => ({
  sendWeeklyOfficerDigestEmail: vi.fn(),
  sendActionDeadlineWarningEmail: vi.fn(),
  sendActionDeadlineReachedEmail: vi.fn(),
  sendActionOverdueLeadEmail: vi.fn(),
  sendLeadershipEscalationEmail: vi.fn(),
  sendBoardEscalationRollupEmail: (a: unknown) => sendBoardEscalationRollupEmail(a),
}));

type FakeUser = { id: string; name: string | null; email: string | null };
type FakeItem = {
  id: string;
  title: string;
  status: string;
  escalatedToLeadershipAt: Date | null;
  resolvedAt: Date | null;
  boardRolledUpAt: Date | null;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  department: { name: string };
  lead: FakeUser | null;
};

let items: FakeItem[] = [];
let boardUsers: FakeUser[] = [];
const emailLogKeys = new Set<string>();
const createdComments: Array<{ actionItemId: string; authorId: string | null; body: string }> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    actionItem: {
      findMany: vi.fn(async (args: any) => {
        const w = args?.where ?? {};
        return items.filter((i) => {
          if (w.resolvedAt === null && i.resolvedAt !== null) return false;
          if (w.boardRolledUpAt === null && i.boardRolledUpAt !== null) return false;
          if (w.escalatedToLeadershipAt?.not === null && i.escalatedToLeadershipAt === null) return false;
          return true;
        });
      }),
      updateMany: vi.fn(async (args: any) => {
        let count = 0;
        for (const it of items) {
          if (it.id !== args.where.id) continue;
          if (args.where.boardRolledUpAt === null && it.boardRolledUpAt !== null) continue;
          if (args.where.resolvedAt === null && it.resolvedAt !== null) continue;
          Object.assign(it, args.data);
          count++;
        }
        return { count };
      }),
    },
    actionComment: {
      create: vi.fn(async (args: any) => {
        createdComments.push({
          actionItemId: args.data.actionItemId,
          authorId: args.data.authorId ?? null,
          body: args.data.body,
        });
        return { id: `c${createdComments.length}` };
      }),
    },
    user: {
      findMany: vi.fn(async () => boardUsers),
    },
    actionEmailLog: {
      createMany: vi.fn(async (args: any) => {
        let count = 0;
        for (const row of args.data) {
          if (!emailLogKeys.has(row.dedupeKey)) {
            emailLogKeys.add(row.dedupeKey);
            count++;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async (args: any) => {
        const key = args?.where?.dedupeKey;
        return { count: key && emailLogKeys.delete(key) ? 1 : 0 };
      }),
    },
  },
}));

import { runBoardRollups } from "@/lib/people-strategy/action-cron";

const NOW = new Date("2026-06-20T12:00:00Z");

function daysAgo(d: number): Date {
  return new Date(NOW.getTime() - d * 86_400_000);
}

beforeEach(() => {
  items = [];
  boardUsers = [{ id: "board", name: "Bea Board", email: "board@test.dev" }];
  emailLogKeys.clear();
  createdComments.length = 0;
  isActionTrackerEnabled.mockReturnValue(true);
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  sendBoardEscalationRollupEmail.mockClear();
});

function makeItem(over: Partial<FakeItem> & { id: string }): FakeItem {
  return {
    id: over.id,
    title: over.title ?? `Item ${over.id}`,
    status: over.status ?? "OVERDUE",
    escalatedToLeadershipAt: over.escalatedToLeadershipAt ?? null,
    resolvedAt: over.resolvedAt ?? null,
    boardRolledUpAt: over.boardRolledUpAt ?? null,
    deadlineStart: over.deadlineStart ?? daysAgo(10),
    deadlineEnd: over.deadlineEnd ?? null,
    department: over.department ?? { name: "Marketing" },
    lead: over.lead ?? { id: "lead", name: "Lee Lead", email: "lead@test.dev" },
  };
}

describe("runBoardRollups", () => {
  it("rolls up an escalation unresolved past the threshold: marks, audits, notifies once", async () => {
    items = [makeItem({ id: "a", escalatedToLeadershipAt: daysAgo(8) })];

    const res = await runBoardRollups(NOW);

    expect(res.eligible).toBe(1);
    expect(res.itemsRolledUp).toBe(1);
    expect(res.emailsSent).toBe(1);
    expect(items[0].boardRolledUpAt).toEqual(NOW);
    // Authorless audit comment recorded in history.
    expect(createdComments).toHaveLength(1);
    expect(createdComments[0]).toMatchObject({ actionItemId: "a", authorId: null });
    expect(createdComments[0].body).toMatch(/Rolled up to the Board/i);
  });

  it("does NOT roll up before the threshold (3 days) past Leadership escalation", async () => {
    items = [makeItem({ id: "b", escalatedToLeadershipAt: daysAgo(2) })];
    const res = await runBoardRollups(NOW);
    expect(res.eligible).toBe(0);
    expect(items[0].boardRolledUpAt).toBeNull();
    expect(createdComments).toHaveLength(0);
  });

  it("never rolls up a non-escalated item", async () => {
    items = [makeItem({ id: "c", escalatedToLeadershipAt: null })];
    const res = await runBoardRollups(NOW);
    expect(res.eligible).toBe(0);
  });

  it("rolls up exactly once across repeated runs (idempotent)", async () => {
    items = [makeItem({ id: "d", escalatedToLeadershipAt: daysAgo(8) })];

    await runBoardRollups(NOW);
    sendBoardEscalationRollupEmail.mockClear();
    const second = await runBoardRollups(new Date(NOW.getTime() + 86_400_000));

    expect(second.itemsRolledUp).toBe(0);
    expect(sendBoardEscalationRollupEmail).not.toHaveBeenCalled();
    expect(createdComments).toHaveLength(1); // no duplicate audit entry
  });

  it("still marks + audits when emails are off (Board list populates); no email", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    items = [makeItem({ id: "e", escalatedToLeadershipAt: daysAgo(8) })];

    const res = await runBoardRollups(NOW);

    expect(res.itemsRolledUp).toBe(1);
    expect(res.emailsSent).toBe(0);
    expect(items[0].boardRolledUpAt).toEqual(NOW);
    expect(createdComments).toHaveLength(1);
    expect(sendBoardEscalationRollupEmail).not.toHaveBeenCalled();
  });

  it("notifies every Board recipient once each", async () => {
    boardUsers = [
      { id: "b1", name: "B1", email: "b1@test.dev" },
      { id: "b2", name: "B2", email: "b2@test.dev" },
    ];
    items = [makeItem({ id: "f", escalatedToLeadershipAt: daysAgo(8) })];

    const res = await runBoardRollups(NOW);
    expect(res.emailsSent).toBe(2);
    expect(sendBoardEscalationRollupEmail).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when the Action Tracker feature is off", async () => {
    isActionTrackerEnabled.mockReturnValue(false);
    items = [makeItem({ id: "g", escalatedToLeadershipAt: daysAgo(8) })];

    const res = await runBoardRollups(NOW);
    expect(res).toEqual({ eligible: 0, itemsRolledUp: 0, emailsSent: 0 });
    expect(items[0].boardRolledUpAt).toBeNull();
  });
});
