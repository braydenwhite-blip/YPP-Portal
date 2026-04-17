import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { approveHiringDecision } from "@/lib/application-actions";

function errorStatus(message: string) {
  if (message.includes("cannot approve it as Chair")) {
    return 403;
  }
  if (message.includes("Unauthorized")) {
    return 403;
  }
  if (message.includes("not found")) {
    return 404;
  }
  return 400;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const chairNote = typeof body.chairNote === "string" ? body.chairNote : undefined;

  try {
    await approveHiringDecision(params.id, session.user.id, chairNote);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve decision.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
