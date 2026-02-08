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
    const assignmentId = formData.get("assignmentId") as string;
    const submissionUrl = formData.get("submissionUrl") as string | null;
    const submissionText = formData.get("submissionText") as string | null;

    if (!assignmentId) {
      return NextResponse.json({ error: "Missing assignment ID" }, { status: 400 });
    }

    if (!submissionUrl && !submissionText) {
      return NextResponse.json({ error: "Please provide either a URL or text submission" }, { status: 400 });
    }

    // Get the assignment
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true }
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Check if late submission is allowed
    if (assignment.dueDate && new Date(assignment.dueDate) < new Date() && !assignment.allowLateSubmission) {
      return NextResponse.json({ error: "Late submissions are not allowed" }, { status: 400 });
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        courseId: assignment.courseId,
        status: { not: "DROPPED" }
      }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "You must be enrolled in this course" }, { status: 403 });
    }

    // Create or update submission
    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: session.user.id
        }
      },
      create: {
        assignmentId,
        studentId: session.user.id,
        status: "SUBMITTED",
        submissionUrl: submissionUrl?.trim() || null,
        submissionText: submissionText?.trim() || null,
        submittedAt: new Date()
      },
      update: {
        status: "SUBMITTED",
        submissionUrl: submissionUrl?.trim() || null,
        submissionText: submissionText?.trim() || null,
        submittedAt: new Date()
      }
    });

    return NextResponse.redirect(
      new URL(`/courses/${assignment.courseId}/assignments/${assignmentId}`, request.url)
    );
  } catch (error) {
    console.error("Error submitting assignment:", error);
    return NextResponse.json({ error: "Failed to submit assignment" }, { status: 500 });
  }
}
