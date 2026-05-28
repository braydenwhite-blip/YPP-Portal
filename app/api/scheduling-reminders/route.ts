import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runInterviewSchedulingAutomation } from "@/lib/interview-scheduling-actions";
import { processMentorshipSchedulingReminders } from "@/lib/mentorship-scheduling-actions";
import { processCollegeAdvisorSchedulingReminders } from "@/lib/college-advisor-scheduling";
import { processInstructorInterviewReminders } from "@/lib/instructor-interview-reminders";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const [, mentorship, collegeAdvisor, instructorInterviews] = await Promise.all([
      runInterviewSchedulingAutomation(),
      processMentorshipSchedulingReminders(),
      processCollegeAdvisorSchedulingReminders(),
      processInstructorInterviewReminders(now),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      interview: { processed: true },
      instructorInterviews,
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
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [pendingInterview24, pendingInstructorInterview24, pendingInstructorChoices, pendingMentorship24, pendingAdvisor24] =
    await Promise.all([
      prisma.interviewSchedulingRequest.count({
        where: {
          status: "BOOKED",
          reminder24SentAt: null,
          scheduledAt: {
            gt: now,
            lte: in24Hours,
          },
        },
      }),
      prisma.offeredInterviewSlot.count({
        where: {
          confirmedAt: { not: null },
          reminder24SentAt: null,
          scheduledAt: {
            gt: now,
            lte: in24Hours,
          },
        },
      }),
      prisma.offeredInterviewSlot.count({
        where: {
          confirmedAt: null,
          choiceReminderSentAt: null,
          createdAt: {
            lte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
          scheduledAt: { gt: now },
        },
      }),
      prisma.mentorshipSession.count({
        where: {
          cancelledAt: null,
          completedAt: null,
          reminder24SentAt: null,
          scheduleRequestId: { not: null },
          scheduledAt: {
            gt: now,
            lte: in24Hours,
          },
        },
      }),
      prisma.collegeAdvisorMeeting.count({
        where: {
          status: "CONFIRMED",
          reminder24SentAt: null,
          scheduledAt: {
            gt: now,
            lte: in24Hours,
          },
        },
      }),
    ]);

  return NextResponse.json({
    status: "ok",
    pending: {
      interview24: pendingInterview24,
      instructorInterview24: pendingInstructorInterview24,
      instructorInterviewChoices: pendingInstructorChoices,
      mentorship24: pendingMentorship24,
      advisor24: pendingAdvisor24,
    },
  });
}
