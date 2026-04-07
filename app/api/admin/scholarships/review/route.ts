import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Scholarship models are not wired up yet.
  redirect("/admin/scholarships?notice=not-enabled");
}
