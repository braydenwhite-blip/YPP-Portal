import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper to generate random 6-digit code
function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only instructors and admins can generate check-in codes
  if (session.user.primaryRole !== "INSTRUCTOR" && session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId") as string;
    const durationMinutes = parseInt(formData.get("durationMinutes") as string) || 30;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    // Verify session exists and user has permission
    const attendanceSession = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        course: true,
        event: true
      }
    });

    if (!attendanceSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify instructor owns this course
    if (
      attendanceSession.course &&
      attendanceSession.course.leadInstructorId !== session.user.id &&
      session.user.primaryRole !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Deactivate any existing check-in for this session
    await prisma.selfCheckIn.updateMany({
      where: { sessionId },
      data: { isActive: false }
    });

    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.selfCheckIn.findUnique({ where: { code } });
      if (!existing || !existing.isActive || existing.expiresAt < new Date()) {
        break;
      }
      code = generateCode();
      attempts++;
    }

    // Create new check-in
    const checkIn = await prisma.selfCheckIn.create({
      data: {
        sessionId,
        code,
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      code: checkIn.code,
      expiresAt: checkIn.expiresAt
    });
  } catch (error) {
    console.error("Error generating check-in code:", error);
    return NextResponse.json({ error: "Failed to generate code" }, { status: 500 });
  }
}
