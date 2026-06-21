import { NextRequest, NextResponse } from "next/server";

import { isWeeklyTeamBriefsEnabled } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import { generateWeeklyTeamBriefs } from "@/lib/people-strategy/weekly-team-briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly Team Brief generation cron.
 *
 * Schedule (UTC): Mondays after the Action Tracker digest. Generation is
 * idempotent on (initiativeId, workstreamId, weekStart), creates the distinct
 * Team Meeting record for each generated brief, and never creates Officer
 * Meeting agenda items by itself.
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

  if (!isWeeklyTeamBriefsEnabled()) {
    return NextResponse.json({ ok: true, skipped: "ENABLE_WEEKLY_TEAM_BRIEFS is off" });
  }

  try {
    const result = await generateWeeklyTeamBriefs(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "weekly-team-briefs cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
