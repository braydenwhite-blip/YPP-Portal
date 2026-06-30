import { NextRequest, NextResponse } from "next/server";

import { runWorkflowEngineCron } from "@/lib/workflow-engine/cron";

/**
 * Daily entry point for the Universal Workflow Engine maintenance job: fires
 * follow-up + overdue-escalation automations and rolls up analytics metrics.
 * Registered in vercel.json; protected by the shared CRON_SECRET bearer.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWorkflowEngineCron();
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[WorkflowEngineCron]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const POST = handle;
export const GET = handle;
