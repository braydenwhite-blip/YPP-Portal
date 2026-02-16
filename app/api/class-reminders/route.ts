import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/class-reminders
// Cron endpoint to process and send class reminders
// Call this via Vercel Cron or an external scheduler every 30 minutes
export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: 0, failed: 0, created: 0 };

  try {
    // 1. Find upcoming sessions that need reminders generated
    const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const upcomingSessions = await prisma.classSession.findMany({
      where: {
        date: {
          gte: now,
          lte: twentyFiveHoursFromNow,
        },
        isCancelled: false,
      },
      include: {
        offering: {
          include: {
            enrollments: {
              where: { status: "ENROLLED" },
              include: {
                student: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    // 2. Create pending reminders for enrolled students
    for (const session of upcomingSessions) {
      const offering = session.offering;
      const sessionDate = new Date(session.date);

      for (const enrollment of offering.enrollments) {
        const student = enrollment.student;

        // 24-hour reminder
        if (offering.send24HrReminder) {
          const reminderTime24 = new Date(sessionDate.getTime() - 24 * 60 * 60 * 1000);

          if (reminderTime24 > now || (reminderTime24 <= now && sessionDate > now)) {
            const existing = await prisma.classReminder.findFirst({
              where: {
                offeringId: offering.id,
                sessionId: session.id,
                userId: student.id,
                type: "TWENTY_FOUR_HOUR",
              },
            });

            if (!existing) {
              await prisma.classReminder.create({
                data: {
                  offeringId: offering.id,
                  sessionId: session.id,
                  userId: student.id,
                  type: "TWENTY_FOUR_HOUR",
                  scheduledFor: reminderTime24 < now ? now : reminderTime24,
                  subject: `Reminder: ${offering.title} tomorrow`,
                  body: `Hi ${student.name},\n\nYou have "${offering.title}" tomorrow!\n\nSession ${session.sessionNumber}: ${session.topic}\nTime: ${session.startTime} - ${session.endTime}\n${offering.zoomLink ? `\nJoin: ${offering.zoomLink}` : ""}${offering.locationName ? `\nLocation: ${offering.locationName}` : ""}\n\nSee you there!`,
                  zoomLink: offering.zoomLink,
                },
              });
              results.created++;
            }
          }
        }

        // 1-hour reminder
        if (offering.send1HrReminder) {
          const reminderTime1 = new Date(sessionDate.getTime() - 1 * 60 * 60 * 1000);

          if (reminderTime1 > now || (reminderTime1 <= now && sessionDate > now)) {
            const existing = await prisma.classReminder.findFirst({
              where: {
                offeringId: offering.id,
                sessionId: session.id,
                userId: student.id,
                type: "ONE_HOUR",
              },
            });

            if (!existing) {
              await prisma.classReminder.create({
                data: {
                  offeringId: offering.id,
                  sessionId: session.id,
                  userId: student.id,
                  type: "ONE_HOUR",
                  scheduledFor: reminderTime1 < now ? now : reminderTime1,
                  subject: `Starting soon: ${offering.title} in 1 hour`,
                  body: `Hi ${student.name},\n\n"${offering.title}" starts in 1 hour!\n\nSession ${session.sessionNumber}: ${session.topic}\nTime: ${session.startTime} - ${session.endTime}\n${offering.zoomLink ? `\nJoin now: ${offering.zoomLink}` : ""}${offering.locationName ? `\nLocation: ${offering.locationName}` : ""}`,
                  zoomLink: offering.zoomLink,
                },
              });
              results.created++;
            }
          }
        }
      }
    }

    // 3. Send pending reminders that are due
    const pendingReminders = await prisma.classReminder.findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: now },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      take: 100, // Process in batches
    });

    for (const reminder of pendingReminders) {
      try {
        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: reminder.userId,
            title: reminder.subject,
            body: reminder.body,
            type: "CLASS_REMINDER",
            link: `/curriculum/${reminder.offeringId}`,
          },
        });

        // Mark as sent
        await prisma.classReminder.update({
          where: { id: reminder.id },
          data: { status: "SENT", sentAt: new Date() },
        });

        results.sent++;
      } catch {
        // Mark as failed
        await prisma.classReminder.update({
          where: { id: reminder.id },
          data: { status: "FAILED" },
        });
        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Class reminder cron error:", error);
    return NextResponse.json(
      { error: "Failed to process reminders" },
      { status: 500 }
    );
  }
}

// GET endpoint for health check
export async function GET() {
  const pendingCount = await prisma.classReminder.count({
    where: { status: "PENDING" },
  });

  return NextResponse.json({
    status: "ok",
    pendingReminders: pendingCount,
  });
}
