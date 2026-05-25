import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import { archiveUserById } from "@/lib/instructor-application-actions";

/**
 * POST /api/admin/users/:id/archive
 *
 * Soft-archive a User account. Does NOT delete the user; sets archivedAt so
 * list views filtering on archivedAt: null treat the account as cleared.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(session.user.roles ?? []).includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot archive your own account" },
      { status: 400 }
    );
  }

  try {
    const archived = await archiveUserById(id, { actorId: session.user.id });
    if (!archived) {
      return NextResponse.json(
        { ok: false, error: "Not found or already archived" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[archive-user]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
