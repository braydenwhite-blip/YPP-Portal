import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { targetType, targetId } = body; // targetType: "MOMENT", "AWARD", "SHOWCASE", etc.

  try {
    // Increment celebration count based on target type
    if (targetType === "MOMENT") {
      await prisma.breakthroughMoment.update({
        where: { id: targetId },
        data: {
          celebrationCount: { increment: 1 }
        }
      });
    } else if (targetType === "PROGRESS_COMPARISON") {
      await prisma.progressComparison.update({
        where: { id: targetId },
        data: {
          likes: { increment: 1 }
        }
      });
    } else if (targetType === "SHOWCASE") {
      await prisma.showcasePresentation.update({
        where: { id: targetId },
        data: {
          votes: { increment: 1 }
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Celebration error:", error);
    return NextResponse.json({ error: "Failed to celebrate" }, { status: 500 });
  }
}
