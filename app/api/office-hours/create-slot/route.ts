import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";
  if (!isInstructor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Office hour slot management is not enabled yet.
  redirect("/office-hours/manage?notice=not-enabled");
}
