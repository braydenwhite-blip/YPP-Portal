import { prisma } from "@/lib/prisma";
import { hasInstructorPathwaySpecTable } from "@/lib/instructor-pathway-spec-compat";
import { RoleType } from "@prisma/client";
import { whereUserHasRole } from "@/lib/user-role-where";

/**
 * Returns ranked instructors for a given pathway and student user.
 * Priority:
 *   1. Instructors with explicit InstructorPathwaySpec for this pathway
 *   2. Instructors in the same chapter
 *   3. All other active instructors
 * Within each tier, sort by ascending mentee count (less busy first).
 */
export async function getSuggestedMentorsForPathway(
  userId: string,
  pathwayId: string
): Promise<{ id: string; name: string; chapterName: string | null; bio: string | null; menteeCount: number; isSpecialist: boolean }[]> {
  const hasPathwaySpecTable = await hasInstructorPathwaySpecTable();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true },
  });

  // Pathway specialists
  const specialists = hasPathwaySpecTable
    ? await prisma.instructorPathwaySpec.findMany({
        where: { pathwayId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              chapterId: true,
              chapter: { select: { name: true } },
              profile: { select: { bio: true } },
              menteePairs: { select: { id: true } },
            },
          },
        },
      }).catch(() => [] as any[])
    : [];

  const specialistIds = new Set(specialists.map((s: any) => s.user.id));

  // Same-chapter instructors (non-specialist)
  const chapterInstructors = user?.chapterId
    ? await prisma.user.findMany({
        where: {
          chapterId: user.chapterId,
          id: { notIn: [...specialistIds] },
          ...whereUserHasRole(RoleType.INSTRUCTOR),
        },
        select: {
          id: true,
          name: true,
          chapterId: true,
          chapter: { select: { name: true } },
          profile: { select: { bio: true } },
          menteePairs: { select: { id: true } },
        },
      })
    : [];
  const chapterInstructorIds = new Set(chapterInstructors.map((instructor: any) => instructor.id));
  const otherInstructors = await prisma.user.findMany({
    where: {
      id: {
        notIn: [...specialistIds, ...chapterInstructorIds],
      },
      ...whereUserHasRole(RoleType.INSTRUCTOR),
    },
    select: {
      id: true,
      name: true,
      chapterId: true,
      chapter: { select: { name: true } },
      profile: { select: { bio: true } },
      menteePairs: { select: { id: true } },
    },
  });

  const allMentors = [
    ...specialists.map((s: any) => ({ ...s.user, isSpecialist: true })),
    ...chapterInstructors.map((u: any) => ({ ...u, isSpecialist: false })),
    ...otherInstructors.map((u: any) => ({ ...u, isSpecialist: false })),
  ];

  return allMentors
    .map((m: any) => ({
      id: m.id,
      name: m.name,
      chapterId: m.chapterId ?? null,
      chapterName: m.chapter?.name ?? null,
      bio: m.profile?.bio ?? null,
      menteeCount: m.menteePairs?.length ?? 0,
      isSpecialist: m.isSpecialist,
    }))
    .sort((a: any, b: any) => {
      if (a.isSpecialist !== b.isSpecialist) return a.isSpecialist ? -1 : 1;
      const aSameChapter = Boolean(user?.chapterId && a.chapterId === user.chapterId);
      const bSameChapter = Boolean(user?.chapterId && b.chapterId === user.chapterId);
      if (aSameChapter !== bSameChapter) return aSameChapter ? -1 : 1;
      return a.menteeCount - b.menteeCount;
    })
    .map(({ chapterId, ...mentor }: any) => mentor);
}
