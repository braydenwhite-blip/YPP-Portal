import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deliverNotification } from "@/lib/notification-delivery";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: 0, failed: 0 };

  try {
    const pendingReminders = await prisma.eventReminder.findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: now },
      },
      include: {
        event: true,
        user: { select: { id: true } },
      },
      take: 150,
    });

    for (const reminder of pendingReminders) {
      try {
        await deliverNotification({
          userId: reminder.userId,
          type: "EVENT_REMINDER",
          title: reminder.subject,
          body: reminder.body,
          link: reminder.eventId ? `/my-chapter/calendar?eventId=${reminder.eventId}` : "/my-chapter/calendar",
        });

        await prisma.eventReminder.update({
          where: { id: reminder.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
        results.sent += 1;
      } catch (error) {
        console.error("[EventReminderCron] Failed to deliver reminder:", error);
        await prisma.eventReminder.update({
          where: { id: reminder.id },
          data: { status: "FAILED" },
        });
        results.failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[EventReminderCron] Failed to process reminders:", error);
    return NextResponse.json({ error: "Failed to process event reminders" }, { status: 500 });
  }
}

export async function GET() {
  const pendingCount = await prisma.eventReminder.count({
    where: { status: "PENDING" },
  });

  return NextResponse.json({
    status: "ok",
    pendingReminders: pendingCount,
  });
}
