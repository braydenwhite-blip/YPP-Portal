import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isActionTrackerEmailsEnabled } from "@/lib/feature-flags";
import {
  runWeeklyActionDigest,
  runWeeklyLeadershipBriefing,
} from "@/lib/people-strategy/action-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly Action Digest cron — People Strategy Action Tracker.
 *
 * Schedule (UTC): `0 8 * * 1` (Mondays 8am). Two things run on this Monday cron:
 *   1. Per recipient, groups their open action items into Overdue / Due This
 *      Week / Upcoming and sends one personal digest.
 *   2. Sends the shareable weekly Leadership Briefing to leadership and records a
 *      pulse snapshot for week-over-week trends.
 * Both are idempotent per recipient per week via `ActionEmailLog`.
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
    const now = new Date();
    const digest = await runWeeklyActionDigest(now);
    const briefing = await runWeeklyLeadershipBriefing(now);
    return NextResponse.json({ ok: true, ...digest, digest, briefing });
  } catch (err) {
    logger.error({ err }, "action-weekly-digest cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
