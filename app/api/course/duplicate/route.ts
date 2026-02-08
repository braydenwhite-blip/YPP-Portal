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
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const code = formData.get("code") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const description = formData.get("description") as string | null;

  // Get the original course with all related data
  const originalCourse = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      assignments: true,
      resources: true
    }
  });

  if (!originalCourse) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const isInstructor =
    originalCourse.leadInstructorId === session.user.id ||
    session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create the new course
  const newCourse = await prisma.course.create({
    data: {
      title,
      code,
      description: description || originalCourse.description,
      leadInstructorId: session.user.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      level: originalCourse.level,
      category: originalCourse.category,
      status: "DRAFT", // Start as draft
      maxStudents: originalCourse.maxStudents,
      location: originalCourse.location,
      meetingTime: originalCourse.meetingTime
    }
  });

  // Duplicate assignments
  for (const assignment of originalCourse.assignments) {
    await prisma.assignment.create({
      data: {
        courseId: newCourse.id,
        title: assignment.title,
        description: assignment.description,
        type: assignment.type,
        dueDate: assignment.dueDate, // You might want to adjust dates
        points: assignment.points,
        instructions: assignment.instructions,
        rubric: assignment.rubric
      }
    });
  }

  // Duplicate resources
  for (const resource of originalCourse.resources) {
    await prisma.resource.create({
      data: {
        courseId: newCourse.id,
        uploaderId: session.user.id,
        title: resource.title,
        description: resource.description,
        type: resource.type,
        url: resource.url,
        isPublic: resource.isPublic,
        expiresAt: resource.expiresAt
      }
    });
  }

  redirect(`/courses/${newCourse.id}`);
}
