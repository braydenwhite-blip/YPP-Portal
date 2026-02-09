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
    const code = (formData.get("code") as string)?.toUpperCase().trim();

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
    }

    // Find active check-in session with this code
    const checkIn = await prisma.selfCheckIn.findUnique({
      where: {
        code,
        isActive: true,
        expiresAt: { gte: new Date() }
      },
      include: {
        session: {
          include: {
            course: true,
            event: true
          }
        }
      }
    });

    if (!checkIn) {
      return NextResponse.json({ error: "Invalid or expired check-in code" }, { status: 404 });
    }

    // Verify user is enrolled in the course (if this is a course session)
    if (checkIn.session.courseId) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: session.user.id,
          courseId: checkIn.session.courseId,
          status: { not: "DROPPED" }
        }
      });

      if (!enrollment) {
        return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 });
      }
    }

    // Check if already checked in
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        sessionId_userId: {
          sessionId: checkIn.sessionId,
          userId: session.user.id
        }
      }
    });

    if (existingRecord) {
      return NextResponse.json({
        message: "You are already checked in",
        record: existingRecord
      });
    }

    // Create attendance record
    const record = await prisma.attendanceRecord.create({
      data: {
        sessionId: checkIn.sessionId,
        userId: session.user.id,
        status: "PRESENT"
      }
    });

    return NextResponse.json({
      success: true,
      message: "Successfully checked in!",
      record,
      session: {
        title: checkIn.session.title,
        course: checkIn.session.course?.title,
        event: checkIn.session.event?.title
      }
    });
  } catch (error) {
    console.error("Error checking in:", error);
    return NextResponse.json({ error: "Failed to check in" }, { status: 500 });
  }
}
