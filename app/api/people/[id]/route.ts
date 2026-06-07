import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import { loadPublicProfile } from "@/lib/people-strategy/public-profile";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/people/:id — JSON for the slide-in profile drawer.
 *
 * Reuses `loadPublicProfile` so the exact same gating applies as the
 * `/people/[id]` page: any signed-in member sees public identity/contact +
 * (viewer-filtered) ownership; growth signals are returned only for officer
 * viewers; applicant-only / archived ids resolve to 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const profile = await loadPublicProfile(id, viewer);
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
