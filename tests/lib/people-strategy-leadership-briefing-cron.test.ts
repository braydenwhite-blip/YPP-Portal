import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

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
  isActionTrackerEnabled: () => true,
}));

const sendLeadershipBriefingEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email", () => ({
  sendLeadershipBriefingEmail: (a: unknown) => sendLeadershipBriefingEmail(a),
}));

// The leadership-wide item load is mocked so we can drive the briefing without a
// full ActionItemWithRelations fixture; composeCommandCenter runs for real over it.
let allItems: ActionItemWithRelations[] = [];
vi.mock("@/lib/people-strategy/action-queries", () => ({
  listAllActionItems: vi.fn(async () => allItems),
}));

// ── Fake prisma: leadership recipients, pulse snapshots, email-log dedupe. ───

type FakeUser = { id: string; name: string | null; email: string | null };
let leadershipUsers: FakeUser[] = [];
type SnapshotRow = {
  weekStart: Date;
  openTotal: number;
  completedThisWeek: number;
  overdue: number;
  flagged: number;
  blocked: number;
  dueThisWeek: number;
  unowned: number;
  consideredCount: number;
};
let snapshots: SnapshotRow[] = [];
const emailLogKeys = new Set<string>();

const upsertSpy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async () => leadershipUsers),
    },
    actionPulseSnapshot: {
      findFirst: vi.fn(async (args: any) => {
        const lt: Date | undefined = args?.where?.weekStart?.lt;
        const earlier = snapshots
          .filter((s) => !lt || s.weekStart.getTime() < lt.getTime())
          .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
        return earlier[0] ?? null;
      }),
      upsert: vi.fn(async (args: any) => {
        upsertSpy(args);
        const weekStart: Date = args.where.weekStart;
        const existing = snapshots.find(
          (s) => s.weekStart.getTime() === weekStart.getTime()
        );
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        const row = { weekStart, ...args.create } as SnapshotRow;
        snapshots.push(row);
        return row;
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

import { runWeeklyLeadershipBriefing } from "@/lib/people-strategy/action-cron";

const NOW = new Date("2026-06-08T12:00:00Z"); // a Monday

function user(id: string): FakeUser {
  return { id, name: `Leader ${id}`, email: `${id}@test.dev` };
}

beforeEach(() => {
  allItems = [];
  leadershipUsers = [user("lead-a"), user("lead-b")];
  snapshots = [];
  emailLogKeys.clear();
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  sendLeadershipBriefingEmail.mockClear();
  upsertSpy.mockClear();
});

afterEach(() => vi.clearAllMocks());

describe("runWeeklyLeadershipBriefing", () => {
  it("sends one briefing to each leadership recipient with an email", async () => {
    const res = await runWeeklyLeadershipBriefing(NOW);

    expect(res.recipients).toBe(2);
    expect(res.emailsSent).toBe(2);
    expect(sendLeadershipBriefingEmail).toHaveBeenCalledTimes(2);

    const arg = sendLeadershipBriefingEmail.mock.calls[0][0];
    expect(arg.to).toBe("lead-a@test.dev");
    expect(arg.commandCenterUrl).toBe("https://app.test/actions/command-center");
    expect(typeof arg.briefingMarkdown).toBe("string");
    expect(arg.briefingMarkdown).toContain("Weekly Leadership Briefing");
  });

  it("skips recipients without an email address", async () => {
    leadershipUsers = [user("lead-a"), { id: "noemail", name: "No Email", email: null }];
    const res = await runWeeklyLeadershipBriefing(NOW);
    expect(res.recipients).toBe(1);
    expect(res.emailsSent).toBe(1);
  });

  it("is idempotent per recipient per week across re-runs", async () => {
    const first = await runWeeklyLeadershipBriefing(NOW);
    const second = await runWeeklyLeadershipBriefing(NOW);

    expect(first.emailsSent).toBe(2);
    expect(second.emailsSent).toBe(0);
    expect(sendLeadershipBriefingEmail).toHaveBeenCalledTimes(2);
  });

  it("persists exactly one pulse snapshot for the operating week (idempotent)", async () => {
    await runWeeklyLeadershipBriefing(NOW);
    await runWeeklyLeadershipBriefing(NOW);

    expect(snapshots).toHaveLength(1);
    // Empty item set → an all-zero pulse is still recorded.
    expect(upsertSpy.mock.calls[0][0].create).toMatchObject({
      openTotal: 0,
      overdue: 0,
      consideredCount: 0,
    });
  });

  it("reads the prior week's snapshot before persisting the current one", async () => {
    // Seed last week's snapshot so the trend path has something to compare to.
    snapshots = [
      {
        weekStart: new Date("2026-06-01T00:00:00Z"),
        openTotal: 9,
        completedThisWeek: 1,
        overdue: 4,
        flagged: 2,
        blocked: 1,
        dueThisWeek: 3,
        unowned: 2,
        consideredCount: 9,
      },
    ];

    const res = await runWeeklyLeadershipBriefing(NOW);

    expect(res.emailsSent).toBe(2);
    // This week's snapshot is added alongside last week's (now two rows).
    expect(snapshots).toHaveLength(2);
  });

  it("is a no-op when the emails flag is off", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    const res = await runWeeklyLeadershipBriefing(NOW);
    expect(res).toEqual({ recipients: 0, emailsSent: 0 });
    expect(sendLeadershipBriefingEmail).not.toHaveBeenCalled();
    expect(snapshots).toHaveLength(0);
  });
});
