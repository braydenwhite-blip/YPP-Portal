import { NextRequest, NextResponse } from "next/server";
import { autoArchiveTerminalApplications } from "@/lib/instructor-application-actions";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await autoArchiveTerminalApplications();
    return NextResponse.json({ archived: result.archived });
  } catch (err) {
    console.error("[auto-archive]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
