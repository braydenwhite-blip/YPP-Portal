import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  isActionTrackerEnabled,
  isActionTrackerEmailsEnabled,
} from "@/lib/feature-flags";
import { runCpoEscalations } from "@/lib/people-strategy/action-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CPO Escalation cron — People Strategy Action Tracker.
 *
 * Schedule (UTC): `0 7 * * *` (daily, morning). Finds flagged or OVERDUE action
 * items that have been unresolved for 48h+ and, if not already escalated,
 * notifies the CPO/Board exactly once and marks `escalatedToCpoAt`. The send is
 * `ActionEmailLog`-deduped and the mark is a race-safe conditional update, so a
 * retried or overlapping run never double-escalates.
 *
 * Auth: Vercel-to-route cron secret (CRON_SECRET bearer header), checked first.
 * Gated by ENABLE_ACTION_TRACKER (feature) + ENABLE_ACTION_TRACKER_EMAILS (send).
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

  if (!isActionTrackerEnabled()) {
    return NextResponse.json({ ok: true, skipped: "ENABLE_ACTION_TRACKER is off" });
  }
  if (!isActionTrackerEmailsEnabled()) {
    return NextResponse.json({ ok: true, skipped: "ENABLE_ACTION_TRACKER_EMAILS is off" });
  }

  try {
    const result = await runCpoEscalations(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "action-cpo-escalation cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
