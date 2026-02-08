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
    const name = formData.get("name") as string;
    const courseId = formData.get("courseId") as string;
    const description = formData.get("description") as string | null;
    const maxMembersStr = formData.get("maxMembers") as string | null;
    const maxMembers = maxMembersStr ? parseInt(maxMembersStr) : null;

    if (!name || !courseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        courseId,
        status: { not: "DROPPED" }
      }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "You must be enrolled in this course" }, { status: 403 });
    }

    // Create the study group
    const studyGroup = await prisma.studyGroup.create({
      data: {
        name,
        description,
        courseId,
        createdById: session.user.id,
        maxMembers,
        members: {
          create: {
            userId: session.user.id,
            role: "CREATOR"
          }
        }
      }
    });

    return NextResponse.redirect(new URL(`/study-groups/${studyGroup.id}`, request.url));
  } catch (error) {
    console.error("Error creating study group:", error);
    return NextResponse.json({ error: "Failed to create study group" }, { status: 500 });
  }
}
