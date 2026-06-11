import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { runHelpAgentSearch } from "@/lib/help-agent/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=… — YPP Help Agent deterministic entity search.
 *
 * Grouped, ranked, tier-filtered results across people, partners, classes,
 * meetings, actions, and initiatives. Empty query returns the viewer's
 * recently viewed entities. Selecting any result hydrates through
 * /api/entity-360, which re-authorizes — this route never returns more than
 * a title/subtitle/href per row. No model calls; nothing here is AI.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  const payload = await runHelpAgentSearch(q, viewer);
  return NextResponse.json(payload);
}
