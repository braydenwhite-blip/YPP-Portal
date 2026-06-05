import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/public-app-url", () => ({
  toAbsoluteAppUrl: (path: string) => `https://app.test${path}`,
}));

const isActionTrackerEmailsEnabled = vi.fn(() => true);
vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEmailsEnabled: () => isActionTrackerEmailsEnabled(),
}));

const sendLeadershipEscalationEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email", () => ({
  sendWeeklyActionDigestEmail: vi.fn(),
  sendActionDeadlineWarningEmail: vi.fn(),
  sendActionDeadlineReachedEmail: vi.fn(),
  sendActionOverdueLeadEmail: vi.fn(),
  sendLeadershipEscalationEmail: (a: unknown) => sendLeadershipEscalationEmail(a),
}));

type FakeUser = { id: string; name: string | null; email: string | null };
type FakeItem = {
  id: string;
  title: string;
  status: string;
  flaggedAt: Date | null;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  resolvedAt: Date | null;
  escalatedToLeadershipAt: Date | null;
  department: { name: string };
  lead: FakeUser | null;
};

let items: FakeItem[] = [];
let cpoUsers: FakeUser[] = [];
const emailLogKeys = new Set<string>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    actionItem: {
      findMany: vi.fn(async (args: any) => {
        const w = args?.where ?? {};
        return items.filter((i) => {
          if (w.resolvedAt === null && i.resolvedAt !== null) return false;
          if (w.escalatedToLeadershipAt === null && i.escalatedToLeadershipAt !== null) return false;
          if (Array.isArray(w.OR)) {
            const flaggedCond = i.flaggedAt != null;
            const overdueCond = i.status === "OVERDUE";
            if (!(flaggedCond || overdueCond)) return false;
          }
          return true;
        });
      }),
      updateMany: vi.fn(async (args: any) => {
        let count = 0;
        for (const it of items) {
          if (it.id !== args.where.id) continue;
          if (args.where.escalatedToLeadershipAt === null && it.escalatedToLeadershipAt !== null) continue;
          Object.assign(it, args.data);
          count++;
        }
        return { count };
      }),
    },
    user: {
      findMany: vi.fn(async () => cpoUsers),
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

import { runLeadershipEscalations } from "@/lib/people-strategy/action-cron";

const NOW = new Date("2026-06-10T12:00:00Z");

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 3_600_000);
}

beforeEach(() => {
  items = [];
  cpoUsers = [{ id: "cpo", name: "Casey CPO", email: "cpo@test.dev" }];
  emailLogKeys.clear();
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  sendLeadershipEscalationEmail.mockClear();
});

function makeItem(over: Partial<FakeItem> & { id: string }): FakeItem {
  return {
    id: over.id,
    title: over.title ?? `Item ${over.id}`,
    status: over.status ?? "IN_PROGRESS",
    flaggedAt: over.flaggedAt ?? null,
    deadlineStart: over.deadlineStart ?? hoursAgo(1),
    deadlineEnd: over.deadlineEnd ?? null,
    resolvedAt: over.resolvedAt ?? null,
    escalatedToLeadershipAt: over.escalatedToLeadershipAt ?? null,
    department: over.department ?? { name: "Marketing" },
    lead: over.lead ?? { id: "lead", name: "Lee Lead", email: "lead@test.dev" },
  };
}

describe("runLeadershipEscalations", () => {
  it("escalates a flagged item older than 48h: one email, marks escalatedToLeadershipAt", async () => {
    items = [makeItem({ id: "a", flaggedAt: hoursAgo(72) })];

    const res = await runLeadershipEscalations(NOW);

    expect(res.eligible).toBe(1);
    expect(res.itemsEscalated).toBe(1);
    expect(res.emailsSent).toBe(1);
    expect(sendLeadershipEscalationEmail).toHaveBeenCalledTimes(1);
    expect(items[0].escalatedToLeadershipAt).toEqual(NOW);
  });

  it("escalates an OVERDUE item whose deadline passed > 48h ago", async () => {
    items = [makeItem({ id: "b", status: "OVERDUE", deadlineStart: hoursAgo(100) })];
    const res = await runLeadershipEscalations(NOW);
    expect(res.emailsSent).toBe(1);
    expect(items[0].escalatedToLeadershipAt).toEqual(NOW);
  });

  it("does NOT escalate items younger than 48h", async () => {
    items = [makeItem({ id: "c", flaggedAt: hoursAgo(10) })];
    const res = await runLeadershipEscalations(NOW);
    expect(res.eligible).toBe(0);
    expect(sendLeadershipEscalationEmail).not.toHaveBeenCalled();
  });

  it("never escalates an already-escalated item (no duplicate notification)", async () => {
    items = [
      makeItem({ id: "d", flaggedAt: hoursAgo(72), escalatedToLeadershipAt: hoursAgo(20) }),
    ];
    const res = await runLeadershipEscalations(NOW);
    expect(res.eligible).toBe(0);
    expect(sendLeadershipEscalationEmail).not.toHaveBeenCalled();
  });

  it("running twice sends exactly one notification (idempotent)", async () => {
    items = [makeItem({ id: "e", flaggedAt: hoursAgo(72) })];

    await runLeadershipEscalations(NOW);
    sendLeadershipEscalationEmail.mockClear();
    // Second run: item is now marked escalatedToLeadershipAt, so it is filtered out.
    const second = await runLeadershipEscalations(new Date(NOW.getTime() + 86_400_000));

    expect(second.eligible).toBe(0);
    expect(sendLeadershipEscalationEmail).not.toHaveBeenCalled();
  });

  it("notifies every CPO/Board recipient once each", async () => {
    cpoUsers = [
      { id: "cpo", name: "Casey", email: "cpo@test.dev" },
      { id: "board", name: "Board", email: "board@test.dev" },
    ];
    items = [makeItem({ id: "f", flaggedAt: hoursAgo(72) })];

    const res = await runLeadershipEscalations(NOW);
    expect(res.emailsSent).toBe(2);
    expect(sendLeadershipEscalationEmail).toHaveBeenCalledTimes(2);
  });

  it("does not mark escalated when there is no CPO recipient (re-fires later)", async () => {
    cpoUsers = [];
    items = [makeItem({ id: "g", flaggedAt: hoursAgo(72) })];

    const res = await runLeadershipEscalations(NOW);
    expect(res.itemsEscalated).toBe(0);
    expect(items[0].escalatedToLeadershipAt).toBeNull();
  });

  it("is a no-op when emails are disabled", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    items = [makeItem({ id: "h", flaggedAt: hoursAgo(72) })];

    const res = await runLeadershipEscalations(NOW);
    expect(res).toEqual({ eligible: 0, itemsEscalated: 0, emailsSent: 0 });
    expect(sendLeadershipEscalationEmail).not.toHaveBeenCalled();
  });
});
