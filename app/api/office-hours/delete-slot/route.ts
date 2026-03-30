import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Office hour slot management is not enabled yet.
  redirect("/office-hours/manage?notice=not-enabled");
}
