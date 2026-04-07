import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Portfolio sections/items are currently demo-only on the client page.
  // Keep this endpoint so the form submission doesn't error during development.
  redirect("/portfolio?notice=not-enabled");
}
