import { NextRequest, NextResponse } from "next/server";
import { chairDecide } from "@/lib/instructor-application-actions";
import { getSession } from "@/lib/auth-supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { canMakeFinalApplicantDecision, getActiveChairUserId } from "@/lib/active-chair";

export async function POST(req: NextRequest) {
  try {
    // Defense-in-depth handler-level gate. chairDecide() itself enforces the
    // single-active-Chair rule, but we re-check here so a direct API request
    // from a non-Chair user is rejected before reaching the action. Final
    // decision authority is identity-based: the caller must be the currently
    // assigned active Chair (not merely an ADMIN/HIRING_CHAIR role holder).
    // Also rate-limit per-user so a logged-in caller can't flood.
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const activeChairId = await getActiveChairUserId();
    if (!canMakeFinalApplicantDecision({ id: session.user.id }, activeChairId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rate = checkRateLimit(`chair-decide:user:${session.user.id}`, 60, 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { applicationId, action, rationale, comparisonNotes } = body;

    if (!applicationId || !action) {
      return NextResponse.json({ error: "applicationId and action are required" }, { status: 400 });
    }
    if (typeof applicationId !== "string" || typeof action !== "string") {
      return NextResponse.json({ error: "applicationId and action must be strings" }, { status: 400 });
    }

    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("action", action);
    if (rationale && typeof rationale === "string") fd.set("rationale", rationale);
    if (comparisonNotes && typeof comparisonNotes === "string") {
      fd.set("comparisonNotes", comparisonNotes);
    }

    const result = await chairDecide(fd);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[chair-decide]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
