import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import { archiveAllApplicantSubmissions } from "@/lib/instructor-application-actions";

/**
 * POST /api/admin/applicants/archive-all
 *
 * Soft-archives every applicant submission across all five submission tables.
 * Idempotent. Intended for the one-time "fresh slate" cleanup and any future
 * bulk archive sweeps.
 *
 * Auth: either a logged-in ADMIN session, or a cron-style Bearer token using
 * the same CRON_SECRET as the sibling /auto-archive route — so this can be
 * driven both interactively from the admin UI and by automation.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuthed =
    !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  let actorId: string | null = null;

  if (!isCronAuthed) {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(session.user.roles ?? []).includes("ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    actorId = session.user.id;
  }

  let reason: string | undefined;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.reason === "string") {
      reason = body.reason;
    }
  } catch {
    // body is optional
  }

  try {
    const counts = await archiveAllApplicantSubmissions({
      actorId,
      reason: reason ?? (isCronAuthed ? "cron-archive-all" : "admin-api"),
    });
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    console.error("[archive-all]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
