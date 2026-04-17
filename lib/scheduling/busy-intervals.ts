import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import type { BusyInterval } from "@/lib/scheduling/shared";

export async function getUserBusyIntervals(userId: string, from = new Date()) {
  const [interviewRequests, mentorshipSessions, advisorships] = await Promise.all([
    prisma.interviewSchedulingRequest.findMany({
      where: {
        status: "BOOKED",
        scheduledAt: { gte: from },
        OR: [{ intervieweeId: userId }, { interviewerId: userId }],
      },
      select: {
        scheduledAt: true,
        duration: true,
      },
    }),
    prisma.mentorshipSession.findMany({
      where: {
        cancelledAt: null,
        scheduledAt: { gte: from },
        participantIds: { has: userId },
      },
      select: {
        scheduledAt: true,
        durationMinutes: true,
      },
    }),
    withPrismaFallback(
      "scheduling:getUserBusyIntervals:collegeAdvisorMeetings",
      () =>
        prisma.collegeAdvisorMeeting.findMany({
          where: {
            scheduledAt: { gte: from },
            status: { in: ["REQUESTED", "CONFIRMED"] },
            OR: [
              {
                advisorship: {
                  adviseeId: userId,
                },
              },
              {
                advisorship: {
                  advisor: {
                    userId,
                  },
                },
              },
            ],
          },
          select: {
            scheduledAt: true,
            durationMinutes: true,
          },
        }),
      [],
    ),
  ]);

  const intervals: BusyInterval[] = [];

  for (const request of interviewRequests) {
    if (!request.scheduledAt) continue;
    intervals.push({
      startsAt: request.scheduledAt,
      endsAt: new Date(request.scheduledAt.getTime() + request.duration * 60_000),
      label: "Interview",
    });
  }

  for (const session of mentorshipSessions) {
    intervals.push({
      startsAt: session.scheduledAt,
      endsAt: new Date(
        session.scheduledAt.getTime() + (session.durationMinutes ?? 30) * 60_000
      ),
      label: "Mentorship session",
    });
  }

  for (const meeting of advisorships) {
    intervals.push({
      startsAt: meeting.scheduledAt,
      endsAt: new Date(
        meeting.scheduledAt.getTime() + meeting.durationMinutes * 60_000
      ),
      label: "College advisor meeting",
    });
  }

  return intervals.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}
