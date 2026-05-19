/**
 * Engagement snapshot for the mentor hub command center.
 *
 * The cycle Kanban already tells a mentor what the monthly review workflow
 * needs from them. This adds the two signals the cycle stage cannot show:
 * what is on the calendar next, and which mentees have gone quiet (no logged
 * session or check-in recently and nothing booked soon). "Quiet" is the
 * relationship-health signal the weekly digest already counts internally but
 * never surfaces in the UI.
 */
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getMentorshipAccessibleMenteeIds } from "@/lib/mentorship-access";

/** A mentee with no logged contact in this many days counts as "quiet". */
export const MENTOR_QUIET_WINDOW_DAYS = 14;
/** How far back we load sessions when computing recency. */
const RECENT_LOOKBACK_DAYS = 75;

export type MentorUpcomingSession = {
  id: string;
  menteeId: string;
  menteeName: string;
  title: string;
  type: string;
  scheduledAt: string;
  meetingLink: string | null;
};

export type MentorQuietMentee = {
  menteeId: string;
  menteeName: string;
  cycleStage: string;
  /** ISO timestamp of the most recent session or check-in, or null if none. */
  lastContactAt: string | null;
};

export type MentorEngagementSnapshot = {
  upcomingSessions: MentorUpcomingSession[];
  upcomingSessionCount: number;
  /** The soonest upcoming session, or null. */
  nextSessionAt: string | null;
  quietMentees: MentorQuietMentee[];
};

const EMPTY: MentorEngagementSnapshot = {
  upcomingSessions: [],
  upcomingSessionCount: 0,
  nextSessionAt: null,
  quietMentees: [],
};

export async function getMentorEngagementSnapshot(): Promise<MentorEngagementSnapshot> {
  const session = await getSession();
  if (!session?.user?.id) return EMPTY;

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const accessibleMenteeIds = isAdmin
    ? null
    : (await getMentorshipAccessibleMenteeIds(userId, roles)) ?? [];

  const where =
    accessibleMenteeIds === null
      ? { status: "ACTIVE" as const }
      : {
          status: "ACTIVE" as const,
          menteeId: {
            in: accessibleMenteeIds.length > 0 ? accessibleMenteeIds : ["__none__"],
          },
        };

  const now = new Date();
  const lookback = new Date(now.getTime() - RECENT_LOOKBACK_DAYS * 86_400_000);
  const quietCutoff = new Date(
    now.getTime() - MENTOR_QUIET_WINDOW_DAYS * 86_400_000
  );
  const soonCutoff = new Date(
    now.getTime() + MENTOR_QUIET_WINDOW_DAYS * 86_400_000
  );

  const mentorships = await prisma.mentorship.findMany({
    where,
    select: {
      cycleStage: true,
      mentee: { select: { id: true, name: true, email: true } },
      sessions: {
        where: { cancelledAt: null, scheduledAt: { gte: lookback } },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          scheduledAt: true,
          completedAt: true,
          meetingLink: true,
        },
      },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const upcomingSessions: MentorUpcomingSession[] = [];
  const quietMentees: MentorQuietMentee[] = [];

  for (const m of mentorships) {
    const menteeName = m.mentee.name ?? m.mentee.email;

    for (const s of m.sessions) {
      if (!s.completedAt && s.scheduledAt.getTime() >= now.getTime()) {
        upcomingSessions.push({
          id: s.id,
          menteeId: m.mentee.id,
          menteeName,
          title: s.title,
          type: s.type,
          scheduledAt: s.scheduledAt.toISOString(),
          meetingLink: s.meetingLink,
        });
      }
    }

    // A finished cycle isn't "quiet" — it's done.
    if (m.cycleStage === "COMPLETE" || m.cycleStage === "PAUSED") continue;

    const completed = m.sessions.filter((s) => s.completedAt);
    const lastCompleted = completed.length
      ? completed.reduce((a, b) =>
          (a.completedAt as Date) > (b.completedAt as Date) ? a : b
        ).completedAt
      : null;
    const lastCheckIn = m.checkIns[0]?.createdAt ?? null;
    const lastContact =
      lastCompleted && lastCheckIn
        ? lastCompleted > lastCheckIn
          ? lastCompleted
          : lastCheckIn
        : lastCompleted ?? lastCheckIn;

    const hasSessionBookedSoon = m.sessions.some(
      (s) =>
        !s.completedAt &&
        s.scheduledAt.getTime() >= now.getTime() &&
        s.scheduledAt.getTime() <= soonCutoff.getTime()
    );

    const isQuiet =
      !hasSessionBookedSoon && (!lastContact || lastContact < quietCutoff);

    if (isQuiet) {
      quietMentees.push({
        menteeId: m.mentee.id,
        menteeName,
        cycleStage: m.cycleStage,
        lastContactAt: lastContact ? lastContact.toISOString() : null,
      });
    }
  }

  upcomingSessions.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  // Longest-quiet first — mentees with no contact at all lead.
  quietMentees.sort((a, b) => {
    if (a.lastContactAt === null && b.lastContactAt === null) return 0;
    if (a.lastContactAt === null) return -1;
    if (b.lastContactAt === null) return 1;
    return a.lastContactAt.localeCompare(b.lastContactAt);
  });

  return {
    upcomingSessions: upcomingSessions.slice(0, 6),
    upcomingSessionCount: upcomingSessions.length,
    nextSessionAt: upcomingSessions[0]?.scheduledAt ?? null,
    quietMentees,
  };
}
