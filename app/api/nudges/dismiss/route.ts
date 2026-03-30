import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { dismissNudge } from "@/lib/nudge-engine";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const nudgeId = body.nudgeId;

  if (!nudgeId || typeof nudgeId !== "string") {
    return NextResponse.json({ error: "Missing nudgeId" }, { status: 400 });
  }

  await dismissNudge(nudgeId, session.user.id);

  return NextResponse.json({ ok: true });
}
