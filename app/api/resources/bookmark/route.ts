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
    const resourceId = formData.get("resourceId") as string;
    const folderId = formData.get("folderId") as string | null;

    if (!resourceId) {
      return NextResponse.json({ error: "Missing resource ID" }, { status: 400 });
    }

    // Check if already bookmarked
    const existing = await prisma.resourceBookmark.findUnique({
      where: {
        userId_resourceId: {
          userId: session.user.id,
          resourceId
        }
      }
    });

    if (existing) {
      return NextResponse.json({ message: "Already bookmarked" });
    }

    // Create bookmark
    await prisma.resourceBookmark.create({
      data: {
        userId: session.user.id,
        resourceId,
        folderId: folderId || null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error bookmarking resource:", error);
    return NextResponse.json({ error: "Failed to bookmark resource" }, { status: 500 });
  }
}
