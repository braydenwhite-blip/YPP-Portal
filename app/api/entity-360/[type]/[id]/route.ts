import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { isEntity360Type } from "@/lib/operations/entity-360";
import { loadEntity360 } from "@/lib/operations/entity-360-queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/entity-360/:type/:id — JSON for the universal Entity 360 drawer.
 *
 * One route backs every panel (person, class, partner, initiative, meeting,
 * action). Authorization lives in `loadEntity360`: person profiles follow the
 * public-profile gating, actions follow `canViewAction`, and the operations
 * entities (class / partner / initiative / meeting) are officer-tier only.
 * Anything the viewer may not see — or that does not exist — is a 404, so the
 * route never leaks existence.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEntity360Type(type)) {
    return NextResponse.json({ error: "Unknown entity type" }, { status: 404 });
  }

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  const entity = await loadEntity360(type, id, viewer);
  if (!entity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Knowledge OS V2 — record the view for Help Agent recents / "Recently
  // Viewed". Fire-and-forget: a recents failure must never break a 360 open.
  recordRecentView(viewer.id, type, id).catch(() => {});

  return NextResponse.json(entity);
}

/** Upsert the recents row and prune the viewer's list to the newest 50. */
async function recordRecentView(userId: string, entityType: string, entityId: string) {
  await prisma.recentEntityView.upsert({
    where: { userId_entityType_entityId: { userId, entityType, entityId } },
    create: { userId, entityType, entityId },
    update: { viewedAt: new Date() },
  });
  const stale = await prisma.recentEntityView.findMany({
    where: { userId },
    orderBy: { viewedAt: "desc" },
    skip: 50,
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.recentEntityView.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });
  }
}
