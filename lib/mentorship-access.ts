import { prisma } from "@/lib/prisma";

const MENTOR_CAPACITY_SOFT_CAP = 3;

function hasRole(roles: string[], role: string) {
  return roles.includes(role);
}

export function canAccessMentorship(primaryRole: string): boolean {
  return primaryRole !== "STUDENT" && primaryRole !== "APPLICANT" && primaryRole !== "PARENT";
}

export async function getMentorCapacityStatus(mentorId: string) {
  const count = await prisma.mentorship.count({
    where: { mentorId, status: "ACTIVE" },
  });
  return {
    current: count,
    cap: MENTOR_CAPACITY_SOFT_CAP,
    isAtCapacity: count >= MENTOR_CAPACITY_SOFT_CAP,
    isOverCapacity: count > MENTOR_CAPACITY_SOFT_CAP,
  };
}

export async function getMentorshipAccessibleMenteeIds(
  userId: string,
  roles: string[]
) {
  if (hasRole(roles, "ADMIN")) {
    return null;
  }

  if (hasRole(roles, "CHAPTER_PRESIDENT")) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chapterId: true },
    });

    if (!user?.chapterId) {
      return [];
    }

    const chapterUsers = await prisma.user.findMany({
      where: { chapterId: user.chapterId },
      select: { id: true },
    });

    return chapterUsers.map((member) => member.id);
  }

  const [pairings, memberships] = await Promise.all([
    prisma.mentorship.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ mentorId: userId }, { chairId: userId }],
      },
      select: { menteeId: true },
    }),
    prisma.mentorshipCircleMember.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: { menteeId: true },
    }),
  ]);

  return Array.from(
    new Set([
      ...pairings.map((pairing) => pairing.menteeId),
      ...memberships.map((member) => member.menteeId),
    ])
  );
}

export async function hasMentorshipMenteeAccess(
  userId: string,
  roles: string[],
  menteeId: string
) {
  if (userId === menteeId || hasRole(roles, "ADMIN")) {
    return true;
  }

  const accessibleMenteeIds = await getMentorshipAccessibleMenteeIds(
    userId,
    roles
  );

  return accessibleMenteeIds == null || accessibleMenteeIds.includes(menteeId);
}
