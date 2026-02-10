import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Portfolio sections/items are currently demo-only on the client page.
  // Keep this endpoint so the form submission doesn't error during development.
  redirect("/portfolio?notice=not-enabled");
}
