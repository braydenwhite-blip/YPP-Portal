import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  runBoardRollups,
  runCpoEscalations,
} from "@/lib/people-strategy/action-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CPO Escalation + Board roll-up cron — People Strategy Action Tracker.
 *
 * Schedule (UTC): `0 7 * * *` (daily, morning). Two stages:
 *   1. CPO escalation — flagged/OVERDUE items unresolved 48h+ are escalated to
 *      the CPO exactly once (`escalatedToCpoAt`).
 *   2. Board roll-up — CPO-escalated items still unresolved 7 days past the CPO
 *      escalation are rolled up to the Board exactly once (`boardRolledUpAt` +
 *      an audit comment), notifying the Board when email infra is configured.
 * Both stages mark with race-safe conditional updates and dedupe sends via
 * `ActionEmailLog`, so retried/overlapping runs never double-act.
 *
 * Auth: Vercel-to-route cron secret (CRON_SECRET bearer header), checked first.
 * Gated by ENABLE_ACTION_TRACKER; emails additionally need
 * ENABLE_ACTION_TRACKER_EMAILS (handled inside each runner).
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

  try {
    const now = new Date();
    // Escalate first, then roll up: an item can escalate and (much later) roll
    // up, but never in the same run since the 7-day window can't have elapsed.
    const escalation = await runCpoEscalations(now);
    const boardRollup = await runBoardRollups(now);
    return NextResponse.json({ ok: true, escalation, boardRollup });
  } catch (err) {
    logger.error({ err }, "action-cpo-escalation cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
