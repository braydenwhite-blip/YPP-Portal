import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { reconcileSearchDocuments } from "@/lib/help-agent/search-indexing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Nightly SearchDocument reconcile — YPP Help Agent (Knowledge OS V2 §8).
 *
 * Schedule (UTC): `0 4 * * *` (daily 4am — see vercel.json). Re-derives the
 * deterministic search index from the live entity tables so write-path
 * upsert misses self-heal: upserts every qualifying person / partner /
 * applicant / class / meeting / action and deletes stale rows. Idempotent;
 * safe to trigger manually. Reports counts by entity type.
 *
 * Auth: Vercel-to-route cron secret (CRON_SECRET bearer header).
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

  try {
    const report = await reconcileSearchDocuments();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    logger.error({ err }, "search-reconcile cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
