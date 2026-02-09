import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const sectionId = formData.get("sectionId") as string;
  const type = formData.get("type") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const mediaUrl = formData.get("mediaUrl") as string;
  const thumbnailUrl = formData.get("thumbnailUrl") as string;
  const tags = formData.get("tags") as string;
  const achievements = formData.get("achievements") as string;
  const completedAt = formData.get("completedAt") as string;

  // Parse tags from comma-separated string
  const tagArray = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  // Get the next display order for this section
  const lastItem = await prisma.portfolioItem.findFirst({
    where: { sectionId },
    orderBy: { displayOrder: "desc" }
  });
  const displayOrder = (lastItem?.displayOrder || 0) + 1;

  // Create portfolio item
  await prisma.portfolioItem.create({
    data: {
      sectionId,
      type,
      title,
      description,
      mediaUrl,
      thumbnailUrl: thumbnailUrl || null,
      tags: tagArray,
      achievements: achievements || null,
      completedAt: completedAt ? new Date(completedAt) : null,
      displayOrder
    }
  });

  redirect("/portfolio");
}
