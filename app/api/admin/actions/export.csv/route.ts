import { NextResponse } from "next/server";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { listVisibleActionItems } from "@/lib/people-strategy/action-queries";
import {
  applyActionFilters,
  parseActionFilters,
} from "@/lib/people-strategy/action-filters";
import {
  actionItemsCsvFilename,
  toActionItemsCsv,
} from "@/lib/people-strategy/action-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV export of the Action Tracker, restricted to the SAME filtered view the
 * officer is looking at on `/all-actions` (the page links here with its current
 * query string). Officer-tier and above only.
 */
export async function GET(req: Request) {
  // Feature flag: route does not exist when the tracker is off.
  if (!isActionTrackerEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Officer guard. requireOfficer() throws "Unauthorized" for members /
  // instructors below officer (and unauthenticated requests).
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filters = parseActionFilters(Object.fromEntries(searchParams.entries()));

  const now = new Date();
  const visible = await listVisibleActionItems(viewer);
  const items = applyActionFilters(visible, filters, now);

  const body = toActionItemsCsv(items, now);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${actionItemsCsvFilename(now)}"`,
      "Cache-Control": "no-store",
    },
  });
}
