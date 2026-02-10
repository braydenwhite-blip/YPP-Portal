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
  const courseIdRaw = formData.get("courseId");
  const titleRaw = formData.get("title");
  const descriptionRaw = formData.get("description");

  if (typeof courseIdRaw !== "string" || !courseIdRaw) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }
  if (typeof titleRaw !== "string" || !titleRaw.trim()) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }
  const courseId = courseIdRaw;
  const title = titleRaw.trim();
  const description = typeof descriptionRaw === "string" ? descriptionRaw : null;

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
      description: description ?? originalCourse.description,
      leadInstructorId: session.user.id,
      chapterId: originalCourse.chapterId,
      format: originalCourse.format,
      level: originalCourse.level,
      interestArea: originalCourse.interestArea,
      isVirtual: originalCourse.isVirtual,
      maxEnrollment: originalCourse.maxEnrollment
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
        maxPoints: assignment.maxPoints,
        dueDate: assignment.dueDate,
        allowLateSubmission: assignment.allowLateSubmission,
        instructions: assignment.instructions,
        attachmentUrl: assignment.attachmentUrl,
        isPublished: assignment.isPublished,
        createdById: session.user.id
      }
    });
  }

  // Duplicate resources
  for (const resource of originalCourse.resources) {
    await prisma.resource.create({
      data: {
        courseId: newCourse.id,
        uploadedById: session.user.id,
        title: resource.title,
        description: resource.description,
        type: resource.type,
        url: resource.url,
        fileSize: resource.fileSize,
        isPublic: resource.isPublic,
        tags: resource.tags
      }
    });
  }

  redirect(`/courses/${newCourse.id}`);
}
