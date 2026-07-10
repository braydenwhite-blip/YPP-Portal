import { NextRequest, NextResponse } from "next/server";
import {
  autoArchiveInactiveApplications,
  autoArchiveTerminalApplications,
} from "@/lib/instructor-application-actions";

/**
 * Nightly applicant archive sweep (vercel.json cron).
 * - Terminal decisions older than 30 days → archive with status reason
 * - Open apps idle 14+ days → archive as INACTIVE_14D (nudges on day 3/7/14 stubbed)
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [terminal, inactive] = await Promise.all([
      autoArchiveTerminalApplications(),
      autoArchiveInactiveApplications(),
    ]);
    return NextResponse.json({
      terminalArchived: terminal.archived,
      inactiveNudged: inactive.nudged,
      inactiveArchived: inactive.archived,
      archived: terminal.archived + inactive.archived,
    });
  } catch (err) {
    console.error("[auto-archive]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
