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

const sendActionDeadlineWarningEmail = vi.fn().mockResolvedValue({ ok: true });
const sendActionDeadlineReachedEmail = vi.fn().mockResolvedValue({ ok: true });
const sendActionOverdueLeadEmail = vi.fn().mockResolvedValue({ ok: true });
const sendWeeklyOfficerDigestEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email", () => ({
  sendActionDeadlineWarningEmail: (a: unknown) => sendActionDeadlineWarningEmail(a),
  sendActionDeadlineReachedEmail: (a: unknown) => sendActionDeadlineReachedEmail(a),
  sendActionOverdueLeadEmail: (a: unknown) => sendActionOverdueLeadEmail(a),
  sendWeeklyOfficerDigestEmail: (a: unknown) => sendWeeklyOfficerDigestEmail(a),
}));

// The officer digest composes org-wide Command Center data over EVERY action
// item (not just "open" ones), so it loads through `listAllActionItems`
// rather than the `loadOpenItems`/`prisma.actionItem.findMany` path the other
// crons in this file use.
let allItems: FullFakeItem[] = [];
vi.mock("@/lib/people-strategy/action-queries", () => ({
  listAllActionItems: vi.fn(async () => allItems),
}));

let winContributions = new Map<string, { thisWeek: number; label: string | null }>();
const loadCompletedContributionsByMember = vi.fn(async () => winContributions);
vi.mock("@/lib/people-strategy/completed-contributions", () => ({
  loadCompletedContributionsByMember: (...args: unknown[]) =>
    loadCompletedContributionsByMember(...args),
}));

const recordPulseSnapshot = vi.fn(async () => undefined);
vi.mock("@/lib/people-strategy/pulse-snapshot", () => ({
  recordPulseSnapshot: (...args: unknown[]) => recordPulseSnapshot(...args),
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

/** Richer fixture shape for the officer digest, which reads full Command Center data. */
type FullFakeItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  leadId: string | null;
  lead: FakeUser | null;
  assignments: Array<{ role: string; user: FakeUser }>;
  department: { id: string; name: string } | null;
  comments: Array<{ createdAt: Date; author: FakeUser | null }>;
  flaggedAt: Date | null;
  resolvedAt: Date | null;
  escalatedToLeadershipAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

let items: FakeItem[] = [];
const emailLogKeys = new Set<string>();

let officerUsers: FakeUser[] = [];
let winImpactRows: any[] = [];
let overdueImpactRows: any[] = [];
let overdueFollowUps: any[] = [];
const userFindManySpy = vi.fn();

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
    user: {
      findMany: vi.fn(async (args: any) => {
        userFindManySpy(args);
        return officerUsers;
      }),
    },
    weeklyImpactRow: {
      findMany: vi.fn(async (args: any) => {
        // The wins query filters by `entry.weekStart` (+ `entry.status`); the
        // overdue query filters by `due` (+ `entry.status`, no weekStart).
        // Route to the matching fixture by shape, then actually apply the
        // `entry.status` filter so a regression that drops it (surfacing
        // draft rows) fails the test — this is the privacy fix under test.
        const entryWhere = args?.where?.entry ?? {};
        const isWinsQuery = entryWhere.weekStart !== undefined;
        const requiredStatus = entryWhere.status;
        const rows = isWinsQuery ? winImpactRows : overdueImpactRows;
        return rows.filter((r: any) => !requiredStatus || r.entry?.status === requiredStatus);
      }),
    },
    meetingFollowUp: {
      findMany: vi.fn(async () => overdueFollowUps),
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
  runWeeklyOfficerDigest,
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

function makeFullItem(over: Partial<FullFakeItem> & { id: string }): FullFakeItem {
  return {
    id: over.id,
    title: over.title ?? `Item ${over.id}`,
    status: over.status ?? "IN_PROGRESS",
    priority: over.priority ?? "MEDIUM",
    deadlineStart: over.deadlineStart ?? NOW,
    deadlineEnd: over.deadlineEnd ?? null,
    leadId: over.leadId ?? over.lead?.id ?? null,
    lead: over.lead ?? null,
    assignments: over.assignments ?? [],
    department: over.department ?? null,
    comments: over.comments ?? [],
    flaggedAt: over.flaggedAt ?? null,
    resolvedAt: over.resolvedAt ?? null,
    escalatedToLeadershipAt: over.escalatedToLeadershipAt ?? null,
    completedAt: over.completedAt ?? null,
    updatedAt: over.updatedAt ?? NOW,
  };
}

beforeEach(() => {
  items = [];
  allItems = [];
  officerUsers = [];
  winImpactRows = [];
  overdueImpactRows = [];
  overdueFollowUps = [];
  winContributions = new Map();
  emailLogKeys.clear();
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  sendActionDeadlineWarningEmail.mockClear();
  sendActionDeadlineReachedEmail.mockClear();
  sendActionOverdueLeadEmail.mockClear();
  sendWeeklyOfficerDigestEmail.mockClear();
  loadCompletedContributionsByMember.mockClear();
  recordPulseSnapshot.mockClear();
  userFindManySpy.mockClear();
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
    expect(arg.flagToLeadershipUrl).toContain("flag-to-leadership");
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
  it("emails assignees for an item due today without marking it overdue early", async () => {
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
    // same-day items are not marked overdue until the following day, so an
    // early/manual cron run cannot close the day before it is actually over.
    expect(res.markedOverdue).toBe(0);
    expect(res.leadEmailsSent).toBe(0);
    expect(sendActionOverdueLeadEmail).not.toHaveBeenCalled();
    expect(items[0].status).toBe("NOT_STARTED");
  });

  it("marks a previous-day untouched item overdue and notifies the lead", async () => {
    items = [
      makeItem({
        id: "old",
        deadline: new Date("2026-05-31T09:00:00Z"),
        status: "NOT_STARTED",
      }),
    ];

    const res = await runDeadlineReached(NOW);

    expect(res.dueToday).toBe(0);
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
        deadline: new Date("2026-05-31T09:00:00Z"),
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

// ── Weekly officer digest ───────────────────────────────────────────────────

describe("runWeeklyOfficerDigest", () => {
  const owen = user("overdue-owner");
  const wanda = user("win-person");

  beforeEach(() => {
    officerUsers = [user("officer-a"), user("officer-b")];

    allItems = [
      // Overdue by 30+ days, with an executor → surfaces as a high-severity
      // priority AND as the "Action" source in Owen's overdue task list.
      makeFullItem({
        id: "a1",
        title: "Ship Q3 report",
        status: "IN_PROGRESS",
        priority: "HIGH",
        deadlineStart: new Date("2026-05-01T00:00:00Z"),
        lead: owen,
        assignments: [
          { role: "LEAD", user: owen },
          { role: "EXECUTING", user: owen },
        ],
        department: { id: "dept-1", name: "Ops" },
      }),
      // Not urgent or overdue — exists only to register Wanda as a candidate
      // member (lead + executor) for the wins scan.
      makeFullItem({
        id: "a2",
        title: "Plan fall showcase",
        status: "NOT_STARTED",
        priority: "LOW",
        deadlineStart: new Date("2026-07-01T00:00:00Z"),
        lead: wanda,
        assignments: [
          { role: "LEAD", user: wanda },
          { role: "EXECUTING", user: wanda },
        ],
        department: { id: "dept-2", name: "Programs" },
      }),
    ];

    // Action win: Wanda completed 1 action this week, per the shared
    // completed-contributions selector (mocked at its module boundary).
    winContributions = new Map([
      [
        "win-person",
        {
          thisWeek: 1,
          thisMonth: 1,
          total: 1,
          asLead: 1,
          lastCompletedAtISO: null,
          label: "1 completed action this week",
        },
      ],
    ]);

    // Weekly-impact win: Wanda ALSO has a SUBMITTED row sent to the board
    // this week — the two win sources should merge into one person with
    // both reasons. Only SUBMITTED entries may surface (drafts are private
    // to the author — see the dedicated privacy test below).
    winImpactRows = [
      { whatGoal: "Ran donor mixer", entry: { user: wanda, status: "SUBMITTED" } },
    ];

    // Meeting follow-up overdue, owned by Owen — merges with his Action
    // overdue item into a single person with multiple tasks.
    overdueFollowUps = [
      { title: "Send donor thank-you", dueDate: new Date("2026-05-29T00:00:00Z"), owner: owen },
    ];

    // Weekly-impact overdue, also owned by Owen — the third overdue source.
    // Also SUBMITTED-only, per the privacy fix.
    overdueImpactRows = [
      {
        whatGoal: "Submit expense report",
        due: new Date("2026-05-30T00:00:00Z"),
        entry: { user: owen, status: "SUBMITTED" },
      },
    ];
  });

  it("sends one identical digest to every officer recipient", async () => {
    const res = await runWeeklyOfficerDigest(NOW);

    expect(res.recipients).toBe(2);
    expect(res.emailsSent).toBe(2);
    expect(sendWeeklyOfficerDigestEmail).toHaveBeenCalledTimes(2);
    const [argA, argB] = sendWeeklyOfficerDigestEmail.mock.calls.map((c) => c[0]);
    expect(argA.to).toBe("officer-a@test.dev");
    expect(argB.to).toBe("officer-b@test.dev");
    expect(argA.priorities).toEqual(argB.priorities);
    expect(argA.congrats).toEqual(argB.congrats);
    expect(argA.overdue).toEqual(argB.overdue);
  });

  it("filters recipients to active officers only", async () => {
    await runWeeklyOfficerDigest(NOW);
    expect(userFindManySpy).toHaveBeenCalledTimes(1);
    const where = userFindManySpy.mock.calls[0][0].where;
    expect(where.archivedAt).toBeNull();
    expect(JSON.stringify(where)).toContain("ADMIN");
  });

  it("surfaces org-wide urgent/overdue items as priorities (no pulse-metric row)", async () => {
    await runWeeklyOfficerDigest(NOW);
    const arg = sendWeeklyOfficerDigestEmail.mock.calls[0][0];
    expect(arg.priorities).toHaveLength(1);
    expect(arg.priorities[0].title).toBe("Ship Q3 report");
    expect(arg.priorities[0].actionUrl).toContain("/actions/a1");
  });

  it("merges wins across the action-completion and weekly-impact sources for one person", async () => {
    await runWeeklyOfficerDigest(NOW);
    const arg = sendWeeklyOfficerDigestEmail.mock.calls[0][0];
    expect(arg.congrats).toHaveLength(1);
    expect(arg.congrats[0].name).toBe(wanda.name);
    expect(arg.congrats[0].email).toBe(wanda.email);
    expect(arg.congrats[0].reasons).toEqual(
      expect.arrayContaining(["1 completed action this week", "Ran donor mixer"])
    );
  });

  it("merges overdue work across actions, meeting follow-ups, and weekly impact for one person", async () => {
    await runWeeklyOfficerDigest(NOW);
    const arg = sendWeeklyOfficerDigestEmail.mock.calls[0][0];
    expect(arg.overdue).toHaveLength(1);
    expect(arg.overdue[0].name).toBe(owen.name);
    expect(arg.overdue[0].tasks).toHaveLength(3);
    const sources = arg.overdue[0].tasks.map((t: any) => t.source).sort();
    expect(sources).toEqual(["Action", "Meeting follow-up", "Weekly impact"]);
  });

  it("never surfaces DRAFT (unsubmitted) Weekly Impact rows — privacy", async () => {
    const drafter = user("draft-person");
    // A draft row must never be readable by officers, whether it would
    // otherwise count as a win (DONE/sendToBoard) or an overdue item.
    winImpactRows = [
      ...winImpactRows,
      { whatGoal: "Secret draft plan", entry: { user: drafter, status: "DRAFT" } },
    ];
    overdueImpactRows = [
      ...overdueImpactRows,
      {
        whatGoal: "Draft overdue thing",
        due: new Date("2026-05-30T00:00:00Z"),
        entry: { user: drafter, status: "DRAFT" },
      },
    ];

    await runWeeklyOfficerDigest(NOW);
    const arg = sendWeeklyOfficerDigestEmail.mock.calls[0][0];
    expect(arg.congrats.map((c: any) => c.name)).not.toContain(drafter.name);
    expect(arg.overdue.map((o: any) => o.name)).not.toContain(drafter.name);
    // The SUBMITTED fixtures for Wanda/Owen are unaffected.
    expect(arg.congrats).toHaveLength(1);
    expect(arg.overdue).toHaveLength(1);
  });

  it("is idempotent per recipient per week", async () => {
    const first = await runWeeklyOfficerDigest(NOW);
    const second = await runWeeklyOfficerDigest(NOW);
    expect(first.emailsSent).toBe(2);
    expect(second.emailsSent).toBe(0);
    expect(sendWeeklyOfficerDigestEmail).toHaveBeenCalledTimes(2);
  });

  it("records the pulse snapshot for the operating week", async () => {
    await runWeeklyOfficerDigest(NOW);
    expect(recordPulseSnapshot).toHaveBeenCalledTimes(1);
    expect(recordPulseSnapshot.mock.calls[0][2]).toBe(allItems.length);
  });

  it("is a no-op when the emails flag is off", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    const res = await runWeeklyOfficerDigest(NOW);
    expect(res).toEqual({ recipients: 0, emailsSent: 0 });
    expect(sendWeeklyOfficerDigestEmail).not.toHaveBeenCalled();
    expect(recordPulseSnapshot).not.toHaveBeenCalled();
  });
});
