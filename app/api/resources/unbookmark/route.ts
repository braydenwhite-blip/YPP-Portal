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
    const bookmarkId = formData.get("bookmarkId") as string;

    if (!bookmarkId) {
      return NextResponse.json({ error: "Missing bookmark ID" }, { status: 400 });
    }

    // Verify ownership
    const bookmark = await prisma.resourceBookmark.findUnique({
      where: { id: bookmarkId }
    });

    if (!bookmark || bookmark.userId !== session.user.id) {
      return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });
    }

    // Delete bookmark
    await prisma.resourceBookmark.delete({
      where: { id: bookmarkId }
    });

    return NextResponse.redirect(new URL("/resources/bookmarks", request.url));
  } catch (error) {
    console.error("Error removing bookmark:", error);
    return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 });
  }
}
