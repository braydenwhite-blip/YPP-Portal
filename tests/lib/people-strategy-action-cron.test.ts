import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const sendWeeklyActionDigestEmail = vi.fn().mockResolvedValue({ ok: true });
const sendActionDeadlineWarningEmail = vi.fn().mockResolvedValue({ ok: true });
const sendActionDeadlineReachedEmail = vi.fn().mockResolvedValue({ ok: true });
const sendActionOverdueLeadEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email", () => ({
  sendWeeklyActionDigestEmail: (a: unknown) => sendWeeklyActionDigestEmail(a),
  sendActionDeadlineWarningEmail: (a: unknown) => sendActionDeadlineWarningEmail(a),
  sendActionDeadlineReachedEmail: (a: unknown) => sendActionDeadlineReachedEmail(a),
  sendActionOverdueLeadEmail: (a: unknown) => sendActionOverdueLeadEmail(a),
}));

// In-memory ActionItem store + ActionEmailLog dedupe set, wired to a fake prisma.
type FakeUser = { id: string; name: string | null; email: string | null };
type FakeItem = {
  id: string;
  title: string;
  status: string;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  leadId: string;
  department: { name: string };
  lead: FakeUser | null;
  assignments: Array<{ role: string; user: FakeUser }>;
};

let items: FakeItem[] = [];
const emailLogKeys = new Set<string>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    actionItem: {
      findMany: vi.fn(async (args: any) => {
        const allowed: string[] | undefined = args?.where?.status?.in;
        return items.filter((i) => !allowed || allowed.includes(i.status));
      }),
      updateMany: vi.fn(async (args: any) => {
        let count = 0;
        for (const it of items) {
          if (it.id !== args.where.id) continue;
          if (args.where.status && it.status !== args.where.status) continue;
          Object.assign(it, args.data);
          count++;
        }
        return { count };
      }),
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

import {
  runWeeklyActionDigest,
  runDeadlineWarnings,
  runDeadlineReached,
} from "@/lib/people-strategy/action-cron";

const NOW = new Date("2026-06-01T12:00:00Z"); // a Monday

function user(id: string): FakeUser {
  return { id, name: `User ${id}`, email: `${id}@test.dev` };
}

function makeItem(over: Partial<FakeItem> & { id: string; deadline: Date }): FakeItem {
  const lead = over.lead ?? user("lead");
  return {
    id: over.id,
    title: over.title ?? `Item ${over.id}`,
    status: over.status ?? "NOT_STARTED",
    deadlineStart: over.deadline,
    deadlineEnd: over.deadlineEnd ?? null,
    leadId: lead.id,
    department: over.department ?? { name: "Instruction" },
    lead,
    assignments: over.assignments ?? [{ role: "LEAD", user: lead }],
  };
}

beforeEach(() => {
  items = [];
  emailLogKeys.clear();
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  sendWeeklyActionDigestEmail.mockClear();
  sendActionDeadlineWarningEmail.mockClear();
  sendActionDeadlineReachedEmail.mockClear();
  sendActionOverdueLeadEmail.mockClear();
});

afterEach(() => vi.clearAllMocks());

// ── 24-hour warning ─────────────────────────────────────────────────────────

describe("runDeadlineWarnings", () => {
  it("sends one warning for an item due exactly tomorrow", async () => {
    // Lead is also the sole executor → one deduped recipient → one email.
    const lead = user("lead");
    items = [
      makeItem({
        id: "a1",
        deadline: new Date("2026-06-02T09:00:00Z"), // tomorrow
        lead,
        assignments: [
          { role: "LEAD", user: lead },
          { role: "EXECUTING", user: lead },
        ],
      }),
    ];

    const res = await runDeadlineWarnings(NOW);

    expect(res.items).toBe(1);
    expect(res.emailsSent).toBe(1);
    expect(sendActionDeadlineWarningEmail).toHaveBeenCalledTimes(1);
    const arg = sendActionDeadlineWarningEmail.mock.calls[0][0];
    expect(arg.role).toBe("Lead + Executing");
    expect(arg.updateStatusUrl).toContain("/actions/a1");
    expect(arg.flagToCpoUrl).toContain("flag-to-cpo");
  });

  it("does not warn for items due today or later than tomorrow", async () => {
    items = [
      makeItem({ id: "today", deadline: new Date("2026-06-01T09:00:00Z") }),
      makeItem({ id: "later", deadline: new Date("2026-06-05T09:00:00Z") }),
    ];
    const res = await runDeadlineWarnings(NOW);
    expect(res.items).toBe(0);
    expect(sendActionDeadlineWarningEmail).not.toHaveBeenCalled();
  });

  it("is idempotent across re-runs (no duplicate same-day warning)", async () => {
    items = [makeItem({ id: "a1", deadline: new Date("2026-06-02T09:00:00Z") })];

    const first = await runDeadlineWarnings(NOW);
    const second = await runDeadlineWarnings(NOW);

    expect(first.emailsSent).toBe(1);
    expect(second.emailsSent).toBe(0);
    expect(sendActionDeadlineWarningEmail).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the emails flag is off", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    items = [makeItem({ id: "a1", deadline: new Date("2026-06-02T09:00:00Z") })];
    const res = await runDeadlineWarnings(NOW);
    expect(res).toEqual({ items: 0, emailsSent: 0 });
    expect(sendActionDeadlineWarningEmail).not.toHaveBeenCalled();
  });
});

// ── Deadline reached + overdue sweep ────────────────────────────────────────

describe("runDeadlineReached", () => {
  it("emails assignees for an item due today and marks it overdue at end of day", async () => {
    const lead = user("lead");
    const exec = user("exec");
    items = [
      makeItem({
        id: "d1",
        deadline: new Date("2026-06-01T09:00:00Z"), // today
        status: "NOT_STARTED",
        lead,
        assignments: [
          { role: "LEAD", user: lead },
          { role: "EXECUTING", user: exec },
        ],
      }),
    ];

    const res = await runDeadlineReached(NOW);

    expect(res.dueToday).toBe(1);
    // one email per distinct recipient (lead + exec)
    expect(sendActionDeadlineReachedEmail).toHaveBeenCalledTimes(2);
    // no status update → overdue + lead notified
    expect(res.markedOverdue).toBe(1);
    expect(res.leadEmailsSent).toBe(1);
    expect(sendActionOverdueLeadEmail).toHaveBeenCalledTimes(1);
    expect(items[0].status).toBe("OVERDUE");
  });

  it("does not mark overdue when the item already has a status update", async () => {
    items = [
      makeItem({
        id: "d2",
        deadline: new Date("2026-06-01T09:00:00Z"),
        status: "IN_PROGRESS",
      }),
    ];
    const res = await runDeadlineReached(NOW);
    expect(res.dueToday).toBe(1);
    expect(res.markedOverdue).toBe(0);
    expect(sendActionOverdueLeadEmail).not.toHaveBeenCalled();
    expect(items[0].status).toBe("IN_PROGRESS");
  });

  it("overdue transition is safe and idempotent across re-runs", async () => {
    items = [
      makeItem({
        id: "d1",
        deadline: new Date("2026-06-01T09:00:00Z"),
        status: "NOT_STARTED",
      }),
    ];

    const first = await runDeadlineReached(NOW);
    const second = await runDeadlineReached(NOW);

    expect(first.markedOverdue).toBe(1);
    expect(first.leadEmailsSent).toBe(1);
    // already OVERDUE → not transitioned again, lead not re-notified
    expect(second.markedOverdue).toBe(0);
    expect(second.leadEmailsSent).toBe(0);
    expect(sendActionOverdueLeadEmail).toHaveBeenCalledTimes(1);
    // second run still loads it (OVERDUE is "open") but it's no longer "due today"
    expect(items[0].status).toBe("OVERDUE");
  });
});

// ── Weekly digest ───────────────────────────────────────────────────────────

describe("runWeeklyActionDigest", () => {
  it("groups a recipient's open items into Overdue / Due This Week / Upcoming", async () => {
    const lead = user("lead");
    items = [
      makeItem({ id: "o1", deadline: new Date("2026-05-20T09:00:00Z"), lead }), // overdue
      makeItem({ id: "w1", deadline: new Date("2026-06-03T09:00:00Z"), lead }), // this week
      makeItem({ id: "u1", deadline: new Date("2026-06-20T09:00:00Z"), lead }), // upcoming
    ];

    const res = await runWeeklyActionDigest(NOW);

    expect(res.recipients).toBe(1);
    expect(res.emailsSent).toBe(1);
    expect(sendWeeklyActionDigestEmail).toHaveBeenCalledTimes(1);
    const arg = sendWeeklyActionDigestEmail.mock.calls[0][0];
    expect(arg.groups.overdue).toHaveLength(1);
    expect(arg.groups.dueThisWeek).toHaveLength(1);
    expect(arg.groups.upcoming).toHaveLength(1);
    expect(arg.groups.overdue[0].department).toBe("Instruction");
    expect(arg.groups.overdue[0].role).toBe("Lead");
    expect(arg.myActionsUrl).toContain("/my-actions");
  });

  it("classifies a status=OVERDUE item into the Overdue group regardless of date", async () => {
    items = [
      makeItem({
        id: "o2",
        deadline: new Date("2026-06-20T09:00:00Z"),
        status: "OVERDUE",
      }),
    ];
    const res = await runWeeklyActionDigest(NOW);
    const arg = sendWeeklyActionDigestEmail.mock.calls[0][0];
    expect(arg.groups.overdue).toHaveLength(1);
    expect(arg.groups.upcoming).toHaveLength(0);
    expect(res.emailsSent).toBe(1);
  });

  it("is idempotent per recipient per week", async () => {
    items = [makeItem({ id: "w1", deadline: new Date("2026-06-03T09:00:00Z") })];
    const first = await runWeeklyActionDigest(NOW);
    const second = await runWeeklyActionDigest(NOW);
    expect(first.emailsSent).toBe(1);
    expect(second.emailsSent).toBe(0);
    expect(sendWeeklyActionDigestEmail).toHaveBeenCalledTimes(1);
  });
});
