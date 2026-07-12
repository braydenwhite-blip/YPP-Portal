/**
 * Data-loading helper for the mentorship layout — sidebar user info,
 * upcoming events, and dashboard-strip counts. Keeps the layout server
 * component lean by colocating all Prisma queries here.
 */
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getMentorshipAccessibleMenteeIds } from "@/lib/mentorship-access";
import { getMentorEngagementSnapshot } from "@/lib/mentor-overview";
import { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import { getMentorshipPendingActionCount } from "@/lib/mentorship-notifications";

export type MentorshipLayoutData = {
  userName: string;
  userRole: string;
  mentor: { name: string; email: string } | null;
  menteeCount: number;
  upcomingEvents: { date: string; label: string; href: string }[];
  dashboardStrip: {
    pendingReviews: number;
    checkInsDue: number;
    followUpsNeeded: number;
    kickoffsPending: number;
    quietMentees: number;
    actionItems: number;
  };
};

export async function loadMentorshipLayoutData(): Promise<MentorshipLayoutData | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole ?? "INSTRUCTOR";
  const isAdmin = roles.includes("ADMIN");

  // ── User info ──────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, primaryRole: true },
  });
  const userName = user?.name ?? user?.email ?? "You";
  const userRole = primaryRole;

  // ── Mentor info (for mentee POV) ───────────────────────────
  const myMentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select: {
      mentor: { select: { name: true, email: true } },
    },
  });
  const mentor = myMentorship?.mentor
    ? { name: myMentorship.mentor.name ?? myMentorship.mentor.email, email: myMentorship.mentor.email }
    : null;

  // ── Mentee count (for mentor POV) ──────────────────────────
  const accessibleMenteeIds = isAdmin
    ? null
    : (await getMentorshipAccessibleMenteeIds(userId, roles)) ?? [];

  const menteeWhere = accessibleMenteeIds === null
    ? { status: "ACTIVE" as const }
    : {
        status: "ACTIVE" as const,
        menteeId: {
          in: accessibleMenteeIds.length > 0 ? accessibleMenteeIds : ["__none__"],
        },
      };

  const menteeCount = await prisma.mentorship.count({ where: menteeWhere });

  // ── Upcoming events (mentor + mentee sessions) ─────────────
  const now = new Date();
  // Sessions where user is the mentor (their mentees' sessions)
  const mentorSessions = await prisma.mentorshipSession.findMany({
    where: {
      cancelledAt: null,
      scheduledAt: { gte: now },
      mentorship: menteeWhere,
    },
    orderBy: { scheduledAt: "asc" },
    take: 6,
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      mentorship: {
        select: {
          mentee: { select: { name: true } },
          mentor: { select: { name: true } },
        },
      },
    },
  });
  // Sessions where user is the mentee (their own sessions with their mentor)
  const menteeSessions = await prisma.mentorshipSession.findMany({
    where: {
      cancelledAt: null,
      scheduledAt: { gte: now },
      mentorship: {
        menteeId: userId,
        status: "ACTIVE",
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 4,
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      mentorship: {
        select: {
          mentee: { select: { name: true } },
          mentor: { select: { name: true } },
        },
      },
    },
  });

  const allSessions = [...mentorSessions, ...menteeSessions]
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 8);

  const upcomingEvents = allSessions.map((s) => {
    const otherName = s.mentorship
      ? s.mentorship.mentee?.name ?? s.mentorship.mentor?.name ?? null
      : null;
    return {
      date: s.scheduledAt.toISOString(),
      label: s.title || `Session${otherName ? ` with ${otherName}` : ""}`,
      href: `/mentorship/schedule`,
    };
  });

  // ── Dashboard strip counts ─────────────────────────────────
  const [engagement, kanban, pendingActionCount] = await Promise.all([
    getMentorEngagementSnapshot(),
    getSimplifiedMentorKanban(),
    getMentorshipPendingActionCount(userId),
  ]);

  const allCards = kanban.columns.flatMap((c) => c.cards);
  const pendingReviews = kanban.columns.find((c) => c.key === "READY_FOR_REVIEW")?.cards.length ?? 0;
  const kickoffsPending = allCards.filter((c) => c.kickoffPending).length;

  // Check-ins due: count active mentorships where reflection is due
  const checkInsDue = await prisma.mentorship.count({
    where: {
      ...menteeWhere,
      cycleStage: "REFLECTION_DUE",
    },
  });

  // Follow-ups needed: count cards with FOLLOW_UP_NEEDED tag
  const followUpsNeeded = allCards.filter((c) => c.mentorTag === "FOLLOW_UP_NEEDED").length;

  return {
    userName,
    userRole,
    mentor,
    menteeCount,
    upcomingEvents,
    dashboardStrip: {
      pendingReviews,
      checkInsDue,
      followUpsNeeded,
      kickoffsPending,
      quietMentees: engagement.quietMentees.length,
      actionItems: pendingActionCount,
    },
  };
}