/**
 * Server gatherer for the "Why This Person Has Access" profile section.
 *
 * Phase 2 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. Collects a person's
 * authority + relationships + assignments from the DB and hands them to the pure
 * summarizer (`lib/org/access-explainer.ts`). Read-only.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { resolvePersonAuthority } from "@/lib/org/levels";
import {
  summarizePersonAccess,
  type AccessFact,
} from "@/lib/org/access-explainer";

/**
 * Build the access-summary facts for `userId`. Returns null when the user does
 * not exist. Caller is responsible for gating this to authorized administrators.
 */
export async function getPersonAccessSummary(userId: string): Promise<AccessFact[] | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      title: true,
      primaryRole: true,
      internalLevel: true,
      ladder: true,
      canonicalTitle: true,
      chapterId: true,
      chapter: { select: { id: true, name: true } },
      adminSubtypes: { select: { subtype: true } },
      roles: { select: { role: true } },
    },
  });
  if (!user) return null;

  const [mentorships, assignments, committees] = await Promise.all([
    prisma.mentorship.findMany({
      where: { mentorId: userId, status: "ACTIVE" },
      select: { mentee: { select: { id: true, name: true } } },
      orderBy: { startDate: "desc" },
      take: 25,
    }),
    prisma.actionAssignment.findMany({
      where: { userId },
      select: { role: true, actionItem: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.committeeMembership.findMany({
      where: { userId, isActive: true, committee: { archivedAt: null } },
      select: { committee: { select: { name: true } } },
    }),
  ]);

  const roleSet = new Set<string>([
    user.primaryRole,
    ...user.roles.map((r) => r.role),
  ]);
  const isChapterPresident = roleSet.has("CHAPTER_PRESIDENT") && Boolean(user.chapterId);

  return summarizePersonAccess({
    name: user.name,
    authority: resolvePersonAuthority({
      title: user.title,
      primaryRole: user.primaryRole,
      internalLevel: user.internalLevel,
      ladder: user.ladder,
      canonicalTitle: user.canonicalTitle,
      adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
    }),
    chapter: user.chapter,
    isChapterPresident,
    committees: committees.map((c) => c.committee.name),
    mentees: mentorships.map((m) => m.mentee),
    actionAssignments: assignments.map((a) => ({
      id: a.actionItem.id,
      title: a.actionItem.title,
      role: a.role,
    })),
  });
}
