import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Project feedback request workflow is not wired up yet.
  redirect("/projects/feedback?notice=not-enabled");
}
