import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isActionTrackerEmailsEnabled } from "@/lib/feature-flags";
import { runDeadlineReached } from "@/lib/people-strategy/action-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deadline Reached cron — People Strategy Action Tracker.
 *
 * Schedule (UTC): `0 23 * * *` (daily, end of day). Emails assignees (+ Lead)
 * of items due today; then any item past its deadline with no status update
 * (still NOT_STARTED) is set to OVERDUE and its Lead notified. Both halves are
 * idempotent (conditional update + `ActionEmailLog`).
 *
 * Auth: Vercel-to-route cron secret (CRON_SECRET bearer header), checked first.
 * Gated by ENABLE_ACTION_TRACKER_EMAILS.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isActionTrackerEmailsEnabled()) {
    return NextResponse.json({ ok: true, skipped: "ENABLE_ACTION_TRACKER_EMAILS is off" });
  }

  try {
    const result = await runDeadlineReached(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "action-deadline-reached cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
