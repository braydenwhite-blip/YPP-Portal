import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const badgeId = formData.get("badgeId") as string;
    const isVisible = formData.get("isVisible") === "true";

    if (!badgeId) {
      return NextResponse.json({ error: "Missing badge ID" }, { status: 400 });
    }

    // Verify ownership
    const badge = await prisma.skillBadge.findUnique({
      where: { id: badgeId }
    });

    if (!badge || badge.userId !== session.user.id) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    // Update visibility
    await prisma.skillBadge.update({
      where: { id: badgeId },
      data: { isVisible }
    });

    return NextResponse.redirect(new URL(`/badges/${badgeId}`, request.url));
  } catch (error) {
    console.error("Error updating badge visibility:", error);
    return NextResponse.json({ error: "Failed to update badge visibility" }, { status: 500 });
  }
}
