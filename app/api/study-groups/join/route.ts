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

    if (!groupId) {
      return NextResponse.json({ error: "Missing group ID" }, { status: 400 });
    }

    // Get the study group
    const group = await prisma.studyGroup.findUnique({
      where: { id: groupId },
      include: {
        members: true,
        course: true
      }
    });

    if (!group) {
      return NextResponse.json({ error: "Study group not found" }, { status: 404 });
    }

    // Check if already a member
    const existingMember = group.members.find(m => m.userId === session.user.id);
    if (existingMember) {
      return NextResponse.redirect(new URL(`/study-groups/${groupId}`, request.url));
    }

    // Check if group is full
    if (group.maxMembers && group.members.length >= group.maxMembers) {
      return NextResponse.json({ error: "Study group is full" }, { status: 400 });
    }

    // Verify user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        courseId: group.courseId,
        status: { not: "DROPPED" }
      }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "You must be enrolled in this course" }, { status: 403 });
    }

    // Add user to the study group
    await prisma.studyGroupMember.create({
      data: {
        groupId,
        userId: session.user.id,
        role: "MEMBER"
      }
    });

    return NextResponse.redirect(new URL(`/study-groups/${groupId}`, request.url));
  } catch (error) {
    console.error("Error joining study group:", error);
    return NextResponse.json({ error: "Failed to join study group" }, { status: 500 });
  }
}
