import { NextRequest, NextResponse } from "next/server";
import { chairDecide } from "@/lib/instructor-application-actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicationId, action, rationale, comparisonNotes } = body;

    if (!applicationId || !action) {
      return NextResponse.json({ error: "applicationId and action are required" }, { status: 400 });
    }

    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("action", action);
    if (rationale) fd.set("rationale", rationale);
    if (comparisonNotes) fd.set("comparisonNotes", comparisonNotes);

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
