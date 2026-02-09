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
    const instructorId = formData.get("instructorId") as string;
    const role = formData.get("role") as string;

    if (!courseId || !instructorId || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user is lead instructor
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.leadInstructorId !== session.user.id && session.user.primaryRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Add co-instructor
    await prisma.courseInstructor.create({
      data: {
        courseId,
        instructorId,
        role: role as any
      }
    });

    return NextResponse.redirect(new URL(`/instructor/course/${courseId}/co-instructors`, request.url));
  } catch (error) {
    console.error("Error adding co-instructor:", error);
    return NextResponse.json({ error: "Failed to add co-instructor" }, { status: 500 });
  }
}
