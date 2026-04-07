import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { processWaitlist } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const courseId = formData.get("courseId") as string;

    if (!courseId) {
      return NextResponse.json({ error: "Missing course ID" }, { status: 400 });
    }

    // Get the enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        courseId,
        status: "ENROLLED"
      },
      include: { course: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    // Update enrollment status to DROPPED
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "DROPPED" }
    });

    // Process waitlist - notify next person in line
    await processWaitlist(courseId);

    return NextResponse.redirect(new URL(`/courses/${courseId}`, request.url));
  } catch (error) {
    console.error("Error dropping course:", error);
    return NextResponse.json({ error: "Failed to drop course" }, { status: 500 });
  }
}
