import { NextRequest, NextResponse } from "next/server";
import { runMentorshipCycleRollover } from "@/lib/cron/mentorship-cycle-rollover";

/**
 * Scheduled entry point for the Phase 0.99999 mentorship cycle cron.
 *
 * Register in vercel.json (or any external scheduler) to fire daily around
 * early morning UTC. Protected by the shared CRON_SECRET bearer.
 */
async function handle(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry-run") === "1";

  try {
    const result = await runMentorshipCycleRollover({ dryRun });
    return NextResponse.json({ success: true, dryRun, result });
  } catch (err) {
    console.error("[MentorshipCycleRolloverCron]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const POST = handle;
export const GET = handle;
