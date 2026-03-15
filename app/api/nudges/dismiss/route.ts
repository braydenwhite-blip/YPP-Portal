import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { dismissNudge } from "@/lib/nudge-engine";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
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
