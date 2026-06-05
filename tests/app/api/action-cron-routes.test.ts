import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route handlers should reject before any DB/email work, so the cron lib is
// mocked to a harmless spy. We assert auth gating + the feature-flag short
// circuit, the parts the routes themselves own.

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const isActionTrackerEmailsEnabled = vi.fn(() => true);
vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEmailsEnabled: () => isActionTrackerEmailsEnabled(),
}));

const runWeeklyActionDigest = vi.fn().mockResolvedValue({ recipients: 0, emailsSent: 0 });
const runWeeklyLeadershipBriefing = vi
  .fn()
  .mockResolvedValue({ recipients: 0, emailsSent: 0 });
const runDeadlineWarnings = vi.fn().mockResolvedValue({ items: 0, emailsSent: 0 });
const runDeadlineReached = vi
  .fn()
  .mockResolvedValue({ dueToday: 0, reachedEmailsSent: 0, markedOverdue: 0, leadEmailsSent: 0 });
vi.mock("@/lib/people-strategy/action-cron", () => ({
  runWeeklyActionDigest: (d: Date) => runWeeklyActionDigest(d),
  runWeeklyLeadershipBriefing: (d: Date) => runWeeklyLeadershipBriefing(d),
  runDeadlineWarnings: (d: Date) => runDeadlineWarnings(d),
  runDeadlineReached: (d: Date) => runDeadlineReached(d),
}));

import { GET as weeklyDigestGET } from "@/app/api/cron/action-weekly-digest/route";
import { GET as warningGET } from "@/app/api/cron/action-deadline-warning/route";
import { GET as reachedGET } from "@/app/api/cron/action-deadline-reached/route";

const ROUTES: Array<{ name: string; GET: (req: any) => Promise<Response>; url: string; runner: ReturnType<typeof vi.fn> }> = [
  { name: "weekly-digest", GET: weeklyDigestGET, url: "http://localhost/api/cron/action-weekly-digest", runner: runWeeklyActionDigest },
  { name: "deadline-warning", GET: warningGET, url: "http://localhost/api/cron/action-deadline-warning", runner: runDeadlineWarnings },
  { name: "deadline-reached", GET: reachedGET, url: "http://localhost/api/cron/action-deadline-reached", runner: runDeadlineReached },
];

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers }) as any;
}

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  isActionTrackerEmailsEnabled.mockReturnValue(true);
  runWeeklyActionDigest.mockClear();
  runWeeklyLeadershipBriefing.mockClear();
  runDeadlineWarnings.mockClear();
  runDeadlineReached.mockClear();
});

afterEach(() => vi.clearAllMocks());

describe.each(ROUTES)("$name cron route auth", ({ GET, url, runner }) => {
  it("503s when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req(url));
    expect(res.status).toBe(503);
    expect(runner).not.toHaveBeenCalled();
  });

  it("401s when the Authorization header is missing", async () => {
    const res = await GET(req(url));
    expect(res.status).toBe(401);
    expect(runner).not.toHaveBeenCalled();
  });

  it("401s when the Authorization header is wrong", async () => {
    const res = await GET(req(url, { authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
    expect(runner).not.toHaveBeenCalled();
  });

  it("skips (200) without running when the emails flag is off", async () => {
    isActionTrackerEmailsEnabled.mockReturnValue(false);
    const res = await GET(req(url, { authorization: "Bearer cron-secret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, skipped: expect.any(String) });
    expect(runner).not.toHaveBeenCalled();
  });

  it("runs with a valid secret + flag on", async () => {
    const res = await GET(req(url, { authorization: "Bearer cron-secret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
    expect(runner).toHaveBeenCalledTimes(1);
  });
});
