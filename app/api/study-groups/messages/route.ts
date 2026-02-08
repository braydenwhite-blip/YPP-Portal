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
    const groupId = formData.get("groupId") as string;
    const content = formData.get("content") as string;

    if (!groupId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user is a member of the group
    const membership = await prisma.studyGroupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "You must be a member of this group" }, { status: 403 });
    }

    // Create the message
    await prisma.studyGroupMessage.create({
      data: {
        groupId,
        userId: session.user.id,
        content: content.trim()
      }
    });

    return NextResponse.redirect(new URL(`/study-groups/${groupId}`, request.url));
  } catch (error) {
    console.error("Error posting message:", error);
    return NextResponse.json({ error: "Failed to post message" }, { status: 500 });
  }
}
