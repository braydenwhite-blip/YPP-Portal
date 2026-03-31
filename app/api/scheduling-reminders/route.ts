import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runInterviewSchedulingAutomation } from "@/lib/interview-scheduling-actions";
import { processMentorshipSchedulingReminders } from "@/lib/mentorship-scheduling-actions";
import { processCollegeAdvisorSchedulingReminders } from "@/lib/college-advisor-scheduling";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const [, mentorship, collegeAdvisor] = await Promise.all([
      runInterviewSchedulingAutomation(),
      processMentorshipSchedulingReminders(),
      processCollegeAdvisorSchedulingReminders(),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      interview: { processed: true },
      mentorship,
      collegeAdvisor,
    });
  } catch (error) {
    console.error("[SchedulingReminderCron] Failed to process reminders:", error);
    return NextResponse.json(
      { error: "Failed to process scheduling reminders" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const now = new Date();
  const [pendingInterview24, pendingInterview2, pendingMentorship24, pendingMentorship2, pendingAdvisor24, pendingAdvisor2] =
    await Promise.all([
      prisma.interviewSchedulingRequest.count({
        where: {
          status: "BOOKED",
          reminder24SentAt: null,
          scheduledAt: {
            gte: new Date(now.getTime() + 23 * 60 * 60 * 1000),
            lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.interviewSchedulingRequest.count({
        where: {
          status: "BOOKED",
          reminder2SentAt: null,
          scheduledAt: {
            gte: new Date(now.getTime() + 90 * 60 * 1000),
            lte: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.mentorshipSession.count({
        where: {
          cancelledAt: null,
          completedAt: null,
          reminder24SentAt: null,
          scheduleRequestId: { not: null },
          scheduledAt: {
            gte: new Date(now.getTime() + 23 * 60 * 60 * 1000),
            lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.mentorshipSession.count({
        where: {
          cancelledAt: null,
          completedAt: null,
          reminder2SentAt: null,
          scheduleRequestId: { not: null },
          scheduledAt: {
            gte: new Date(now.getTime() + 90 * 60 * 1000),
            lte: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.collegeAdvisorMeeting.count({
        where: {
          status: "CONFIRMED",
          reminder24SentAt: null,
          scheduledAt: {
            gte: new Date(now.getTime() + 23 * 60 * 60 * 1000),
            lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.collegeAdvisorMeeting.count({
        where: {
          status: "CONFIRMED",
          reminder2SentAt: null,
          scheduledAt: {
            gte: new Date(now.getTime() + 90 * 60 * 1000),
            lte: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return NextResponse.json({
    status: "ok",
    pending: {
      interview24: pendingInterview24,
      interview2: pendingInterview2,
      mentorship24: pendingMentorship24,
      mentorship2: pendingMentorship2,
      advisor24: pendingAdvisor24,
      advisor2: pendingAdvisor2,
    },
  });
}
