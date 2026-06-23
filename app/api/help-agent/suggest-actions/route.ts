import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { checkRateLimit } from "@/lib/rate-limit-redis";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { isOfficerTier } from "@/lib/people-strategy/action-permissions";
import { isNotesAIConfigured } from "@/lib/people-strategy/notes-to-actions-ai";

export const dynamic = "force-dynamic";

/**
 * Smart notes → actions — the "Review suggested actions" endpoint.
 *
 * The meeting model that fed this endpoint was removed in the weekly-meetings
 * rebuild, so there are no meeting notes to read. The endpoint is kept so its
 * client callers keep a stable contract, but it now returns no suggestions.
 */
export async function POST() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isActionTrackerEnabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseLimit = await checkRateLimit(`cos-suggest:${viewer.id}`, 60, 60 * 60 * 1000);
  if (!baseLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  return NextResponse.json({ suggestions: [], aiUsed: false, aiAvailable: isNotesAIConfigured() });
}
