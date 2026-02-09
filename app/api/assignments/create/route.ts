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
    const courseId = formData.get("courseId") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const instructions = formData.get("instructions") as string | null;
    const type = formData.get("type") as "INDIVIDUAL" | "GROUP" | "PEER_REVIEW";
    const maxPointsStr = formData.get("maxPoints") as string | null;
    const dueDateStr = formData.get("dueDate") as string | null;
    const attachmentUrl = formData.get("attachmentUrl") as string | null;
    const allowLateSubmission = formData.get("allowLateSubmission") === "true";

    if (!courseId || !title || !description || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const maxPoints = maxPointsStr ? parseInt(maxPointsStr) : null;
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    // Verify user is instructor for this course
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.leadInstructorId !== session.user.id && session.user.primaryRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create the assignment
    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        title: title.trim(),
        description: description.trim(),
        instructions: instructions?.trim() || null,
        type,
        maxPoints,
        dueDate,
        attachmentUrl: attachmentUrl?.trim() || null,
        allowLateSubmission,
        createdById: session.user.id
      }
    });

    // Create empty submissions for all enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        status: { not: "DROPPED" }
      }
    });

    await prisma.assignmentSubmission.createMany({
      data: enrollments.map(enrollment => ({
        assignmentId: assignment.id,
        studentId: enrollment.userId,
        status: "NOT_SUBMITTED"
      }))
    });

    return NextResponse.redirect(new URL(`/courses/${courseId}/assignments/${assignment.id}`, request.url));
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
