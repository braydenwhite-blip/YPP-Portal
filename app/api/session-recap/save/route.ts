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
  const sessionId = formData.get("sessionId") as string;
  const whatCovered = formData.get("whatCovered") as string;
  const whatWorked = formData.get("whatWorked") as string | null;
  const whatToImprove = formData.get("whatToImprove") as string | null;
  const nextSteps = formData.get("nextSteps") as string | null;

  // Verify the session exists and user is instructor
  const attendanceSession = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { course: true }
  });

  if (!attendanceSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const isInstructor =
    attendanceSession.course.leadInstructorId === session.user.id ||
    session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upsert the recap
  await prisma.sessionRecap.upsert({
    where: { sessionId },
    create: {
      sessionId,
      instructorId: session.user.id,
      whatCovered,
      whatWorked: whatWorked || null,
      whatToImprove: whatToImprove || null,
      nextSteps: nextSteps || null
    },
    update: {
      whatCovered,
      whatWorked: whatWorked || null,
      whatToImprove: whatToImprove || null,
      nextSteps: nextSteps || null
    }
  });

  redirect(`/courses/${attendanceSession.courseId}`);
}
